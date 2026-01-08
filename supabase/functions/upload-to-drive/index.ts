import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get the store's Google Drive tokens
    const { data: store, error: storeError } = await supabaseClient
      .from('stores')
      .select('google_access_token, google_refresh_token, google_token_expiry, id, name')
      .eq('user_id', user.id)
      .single();

    if (storeError || !store) {
      throw new Error('Store not found');
    }

    if (!store.google_access_token) {
      return new Response(
        JSON.stringify({ 
          error: 'Google Drive not connected', 
          message: 'Please connect your Google Drive account in store settings first' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if token needs refresh
    let accessToken = store.google_access_token;
    const tokenExpiry = store.google_token_expiry ? new Date(store.google_token_expiry) : null;
    const now = new Date();

    if (tokenExpiry && now >= tokenExpiry) {
      // Refresh the token
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
          refresh_token: store.google_refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh Google access token');
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      // Update the store with new token
      const newExpiry = new Date(now.getTime() + refreshData.expires_in * 1000);
      await supabaseClient
        .from('stores')
        .update({
          google_access_token: accessToken,
          google_token_expiry: newExpiry.toISOString(),
        })
        .eq('id', store.id);
    }

    // Parse the multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file provided');
    }

    // Get file data
    const fileBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(fileBuffer);

    // Upload file to Google Drive using multipart upload
    const boundary = 'foo_bar_baz';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: file.name,
      mimeType: file.type,
    };

    // Construct multipart body with binary data
    const metadataPart = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata);

    const encoder = new TextEncoder();
    const metadataBytes = encoder.encode(metadataPart);
    const filePart = encoder.encode(delimiter + `Content-Type: ${file.type}\r\n\r\n`);
    const closeDelimiterBytes = encoder.encode(closeDelimiter);

    // Combine all parts
    const multipartBody = new Uint8Array(
      metadataBytes.length + filePart.length + fileData.length + closeDelimiterBytes.length
    );
    multipartBody.set(metadataBytes, 0);
    multipartBody.set(filePart, metadataBytes.length);
    multipartBody.set(fileData, metadataBytes.length + filePart.length);
    multipartBody.set(closeDelimiterBytes, metadataBytes.length + filePart.length + fileData.length);

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Drive upload error:', errorText);
      throw new Error('Failed to upload to Google Drive');
    }

    const uploadData = await uploadResponse.json();
    const fileId = uploadData.id;

    // Make the file publicly accessible
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });

    // Return the direct image URL using thumbnail API
    const imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;

    console.log('File uploaded successfully:', { fileId, imageUrl });

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl,
        fileId 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in upload-to-drive function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
