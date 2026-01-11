import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// VPS connection configuration
const VPS_CONFIG = {
  host: Deno.env.get('VPS_HOST') || '',
  port: parseInt(Deno.env.get('VPS_PORT') || '22'),
  username: Deno.env.get('VPS_USERNAME') || '',
  uploadPath: Deno.env.get('VPS_UPLOAD_PATH') || '/var/www/digitaldukandar.in/uploads/',
  baseUrl: 'https://digitaldukandar.in/uploads/',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 200,
    });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log(`[upload-to-vps] User authenticated: ${user.id}`);

    // Get store and check storage limit
    const { data: store, error: storeError } = await supabaseClient
      .from('stores')
      .select('id, storage_used_mb, storage_limit_mb')
      .eq('user_id', user.id)
      .single();

    if (storeError || !store) {
      throw new Error('Store not found');
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const uploadType = formData.get('type') as string || 'products'; // products, categories, banners

    if (!file) {
      throw new Error('No file provided');
    }

    console.log(`[upload-to-vps] Uploading file: ${file.name}, size: ${file.size} bytes, type: ${uploadType}`);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }

    // Check storage limit (server-side enforcement)
    const fileSizeMB = file.size / 1024 / 1024;
    const currentUsage = store.storage_used_mb || 0;
    const storageLimit = store.storage_limit_mb || 100;

    if (currentUsage + fileSizeMB > storageLimit) {
      throw new Error('Storage limit reached. Delete images to free space.');
    }

    console.log(`[upload-to-vps] Storage check: ${currentUsage.toFixed(2)} MB + ${fileSizeMB.toFixed(2)} MB / ${storageLimit} MB`);

    // Generate unique filename
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${uuid}-${timestamp}.${ext}`;

    // Determine subdirectory based on upload type
    const subdir = uploadType === 'categories' ? 'categories' :
                   uploadType === 'banners' ? 'banners' : 'products';

    const remotePath = `${VPS_CONFIG.uploadPath}${subdir}/${filename}`;
    const imageUrl = `${VPS_CONFIG.baseUrl}${subdir}/${filename}`;

    console.log(`[upload-to-vps] Target path: ${remotePath}`);

    // Read file content as bytes
    const fileBytes = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(fileBytes);

    // Upload to VPS via SFTP
    await uploadViaSSH(fileBuffer, remotePath);

    console.log(`[upload-to-vps] Upload successful: ${imageUrl}`);

    // Update storage usage
    const newStorageUsed = currentUsage + fileSizeMB;
    const { error: updateError } = await supabaseClient
      .from('stores')
      .update({ storage_used_mb: newStorageUsed })
      .eq('id', store.id);

    if (updateError) {
      console.error('[upload-to-vps] Failed to update storage usage:', updateError);
      // Don't fail the upload if storage tracking fails
    } else {
      console.log(`[upload-to-vps] Storage updated: ${currentUsage.toFixed(2)} MB → ${newStorageUsed.toFixed(2)} MB`);
    }

    // Return response in same format as upload-to-drive
    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: imageUrl,
        fileId: filename,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[upload-to-vps] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

/**
 * Upload file to VPS via SSH/SFTP
 * Note: Deno doesn't have a native SFTP library, so we use SSH with SCP command
 */
async function uploadViaSSH(fileBuffer: Uint8Array, remotePath: string): Promise<void> {
  try {
    // For Deno edge functions, we'll use a different approach:
    // 1. Write file to temp location in edge function
    // 2. Use SSH command to transfer file

    // Create temp file
    const tempDir = await Deno.makeTempDir();
    const tempFile = `${tempDir}/upload_${Date.now()}`;
    await Deno.writeFile(tempFile, fileBuffer);

    console.log(`[uploadViaSSH] Temp file created: ${tempFile}`);

    // Get SSH key from environment
    const sshKey = Deno.env.get('VPS_SSH_KEY') || '';
    if (!sshKey) {
      throw new Error('VPS_SSH_KEY not configured');
    }

    // Write SSH key to temp file
    const keyFile = `${tempDir}/ssh_key`;
    await Deno.writeTextFile(keyFile, sshKey);
    await Deno.chmod(keyFile, 0o600);

    // Ensure remote directory exists
    const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
    const mkdirCommand = new Deno.Command('ssh', {
      args: [
        '-i', keyFile,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-p', VPS_CONFIG.port.toString(),
        `${VPS_CONFIG.username}@${VPS_CONFIG.host}`,
        `mkdir -p ${remoteDir}`,
      ],
      stdout: 'piped',
      stderr: 'piped',
    });

    const mkdirResult = await mkdirCommand.output();
    if (!mkdirResult.success) {
      const error = new TextDecoder().decode(mkdirResult.stderr);
      console.error(`[uploadViaSSH] mkdir failed: ${error}`);
    }

    // Upload file using SCP
    const scpCommand = new Deno.Command('scp', {
      args: [
        '-i', keyFile,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-P', VPS_CONFIG.port.toString(),
        tempFile,
        `${VPS_CONFIG.username}@${VPS_CONFIG.host}:${remotePath}`,
      ],
      stdout: 'piped',
      stderr: 'piped',
    });

    console.log(`[uploadViaSSH] Executing SCP command...`);
    const scpResult = await scpCommand.output();

    if (!scpResult.success) {
      const error = new TextDecoder().decode(scpResult.stderr);
      console.error(`[uploadViaSSH] SCP failed: ${error}`);
      throw new Error(`Failed to upload file via SCP: ${error}`);
    }

    console.log(`[uploadViaSSH] SCP successful`);

    // Set file permissions on remote server
    const chmodCommand = new Deno.Command('ssh', {
      args: [
        '-i', keyFile,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-p', VPS_CONFIG.port.toString(),
        `${VPS_CONFIG.username}@${VPS_CONFIG.host}`,
        `chmod 644 ${remotePath}`,
      ],
      stdout: 'piped',
      stderr: 'piped',
    });

    await chmodCommand.output();

    // Cleanup temp files
    await Deno.remove(tempFile);
    await Deno.remove(keyFile);
    await Deno.remove(tempDir, { recursive: true });

    console.log(`[uploadViaSSH] Cleanup complete`);
  } catch (error) {
    console.error('[uploadViaSSH] Error:', error);
    throw error;
  }
}
