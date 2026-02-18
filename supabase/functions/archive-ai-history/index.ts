/**
 * AI History Archive Edge Function
 * Daily job: Archives AI designer history older than 30 days to Google Drive
 * Then deletes from Supabase to save storage
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ============================================
    // Get records older than 30 days
    // ============================================
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const { data: oldRecords, error: fetchError } = await supabase
      .from('ai_designer_history')
      .select('*')
      .lt('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching old records:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch old records' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!oldRecords || oldRecords.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No records to archive',
          records_archived: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // Get Google Drive credentials
    // ============================================
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('google_drive_service_account_json, google_drive_archive_folder_id')
      .eq('id', SETTINGS_ID)
      .single();

    if (!settings?.google_drive_service_account_json || !settings?.google_drive_archive_folder_id) {
      console.error('Google Drive not configured');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Google Drive not configured. Please add credentials in Platform Settings.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const serviceAccount = JSON.parse(settings.google_drive_service_account_json);
    const folderId = settings.google_drive_archive_folder_id;

    // ============================================
    // Group records by date for archiving
    // ============================================
    const recordsByDate: Record<string, any[]> = {};
    for (const record of oldRecords) {
      const date = new Date(record.created_at).toISOString().split('T')[0];
      if (!recordsByDate[date]) {
        recordsByDate[date] = [];
      }
      recordsByDate[date].push(record);
    }

    // ============================================
    // Upload each date's records to Google Drive
    // ============================================
    let totalArchived = 0;
    const archivedDates = [];

    for (const [date, records] of Object.entries(recordsByDate)) {
      // Prepare JSONL content (one JSON object per line)
      const jsonlContent = records.map(r => JSON.stringify(r)).join('\n');
      const encoder = new TextEncoder();
      const fileContent = encoder.encode(jsonlContent);

      // Get Google Drive access token
      const accessToken = await getGoogleDriveAccessToken(serviceAccount);

      // Upload to Google Drive
      const fileName = `ai-history-${date}.jsonl`;
      const uploadResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'multipart/related; boundary=foo_bar_baz',
          },
          body: createMultipartBody(fileName, fileContent, folderId),
        }
      );

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        console.error('Google Drive upload failed:', error);
        continue; // Skip this date, try next
      }

      const uploadedFile = await uploadResponse.json();
      const fileId = uploadedFile.id;

      // Save archive metadata
      await supabase.from('ai_history_archives').insert({
        archive_date: date,
        google_drive_file_id: fileId,
        google_drive_file_url: `https://drive.google.com/file/d/${fileId}/view`,
        record_count: records.length,
        file_size_bytes: fileContent.length,
        oldest_record_date: records[0].created_at,
        newest_record_date: records[records.length - 1].created_at,
      });

      // Delete archived records from Supabase
      const recordIds = records.map(r => r.id);
      await supabase
        .from('ai_designer_history')
        .delete()
        .in('id', recordIds);

      totalArchived += records.length;
      archivedDates.push(date);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Archive completed',
        records_archived: totalArchived,
        dates_archived: archivedDates.length,
        archived_dates: archivedDates,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Archive function error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unexpected error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// ============================================
// Helper: Get Google Drive Access Token
// ============================================
async function getGoogleDriveAccessToken(serviceAccount: any): Promise<string> {
  const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = btoa(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));

  const signatureInput = `${jwtHeader}.${jwtClaimSet}`;

  // Import private key
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign JWT
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signatureInput)
  );

  const jwt = `${signatureInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// ============================================
// Helper: Convert PEM to ArrayBuffer
// ============================================
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ============================================
// Helper: Create Multipart Body for Google Drive
// ============================================
function createMultipartBody(
  fileName: string,
  fileContent: Uint8Array,
  folderId: string
): string {
  const boundary = 'foo_bar_baz';
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
  };

  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const filePart = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${new TextDecoder().decode(fileContent)}\r\n--${boundary}--`;

  return metadataPart + filePart;
}
