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

    console.log(`[delete-from-vps] User authenticated: ${user.id}`);

    // Get store for storage tracking
    const { data: store, error: storeError } = await supabaseClient
      .from('stores')
      .select('id, storage_used_mb')
      .eq('user_id', user.id)
      .single();

    if (storeError || !store) {
      throw new Error('Store not found');
    }

    // Parse request body
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      throw new Error('No imageUrl provided');
    }

    console.log(`[delete-from-vps] Deleting image: ${imageUrl}`);

    // Validate that this is a VPS image URL
    if (!imageUrl.includes('digitaldukandar.in/uploads/')) {
      throw new Error('Not a VPS image URL');
    }

    // Extract file path from URL
    // Example: https://digitaldukandar.in/uploads/products/abc-123.jpg
    // Extract: products/abc-123.jpg
    const urlParts = imageUrl.split('/uploads/');
    if (urlParts.length < 2) {
      throw new Error('Invalid image URL format');
    }

    const relativePath = urlParts[1]; // e.g., "products/abc-123.jpg"
    const fullPath = `${VPS_CONFIG.uploadPath}${relativePath}`;

    console.log(`[delete-from-vps] Target path: ${fullPath}`);

    // Get file size before deleting
    const fileSizeMB = await getFileSizeViaSSH(fullPath);

    // Delete file from VPS via SSH
    await deleteViaSSH(fullPath);

    console.log(`[delete-from-vps] Deletion successful: ${imageUrl}`);

    // Update storage usage
    if (fileSizeMB > 0) {
      const currentUsage = store.storage_used_mb || 0;
      const newStorageUsed = Math.max(0, currentUsage - fileSizeMB);

      const { error: updateError } = await supabaseClient
        .from('stores')
        .update({ storage_used_mb: newStorageUsed })
        .eq('id', store.id);

      if (updateError) {
        console.error('[delete-from-vps] Failed to update storage usage:', updateError);
      } else {
        console.log(`[delete-from-vps] Storage updated: ${currentUsage.toFixed(2)} MB → ${newStorageUsed.toFixed(2)} MB`);
      }
    }

    // Remove from media library
    const { error: mediaError } = await supabaseClient
      .from('media_library')
      .delete()
      .eq('file_url', imageUrl)
      .eq('store_id', store.id);

    if (mediaError) {
      console.error('[delete-from-vps] Failed to remove from media library:', mediaError);
    } else {
      console.log(`[delete-from-vps] Removed from media library: ${imageUrl}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'File deleted successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[delete-from-vps] Error:', error);
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
 * Get file size from VPS via SSH
 */
async function getFileSizeViaSSH(filePath: string): Promise<number> {
  try {
    const sshKey = Deno.env.get('VPS_SSH_KEY') || '';
    if (!sshKey) {
      throw new Error('VPS_SSH_KEY not configured');
    }

    const tempDir = await Deno.makeTempDir();
    const keyFile = `${tempDir}/ssh_key`;
    await Deno.writeTextFile(keyFile, sshKey);
    await Deno.chmod(keyFile, 0o600);

    // Get file size in bytes using stat command
    const statCommand = new Deno.Command('ssh', {
      args: [
        '-i', keyFile,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-p', VPS_CONFIG.port.toString(),
        `${VPS_CONFIG.username}@${VPS_CONFIG.host}`,
        `stat -c %s ${filePath} 2>/dev/null || echo 0`,
      ],
      stdout: 'piped',
      stderr: 'piped',
    });

    const statResult = await statCommand.output();
    await Deno.remove(keyFile);
    await Deno.remove(tempDir, { recursive: true });

    if (statResult.success) {
      const sizeBytes = parseInt(new TextDecoder().decode(statResult.stdout).trim());
      const sizeMB = sizeBytes / 1024 / 1024;
      console.log(`[getFileSizeViaSSH] File size: ${sizeMB.toFixed(2)} MB`);
      return sizeMB;
    }

    return 0;
  } catch (error) {
    console.error('[getFileSizeViaSSH] Error:', error);
    return 0; // Return 0 if we can't get the size
  }
}

/**
 * Delete file from VPS via SSH
 */
async function deleteViaSSH(filePath: string): Promise<void> {
  try {
    // Get SSH key from environment
    const sshKey = Deno.env.get('VPS_SSH_KEY') || '';
    if (!sshKey) {
      throw new Error('VPS_SSH_KEY not configured');
    }

    // Create temp directory for SSH key
    const tempDir = await Deno.makeTempDir();
    const keyFile = `${tempDir}/ssh_key`;
    await Deno.writeTextFile(keyFile, sshKey);
    await Deno.chmod(keyFile, 0o600);

    console.log(`[deleteViaSSH] Deleting file: ${filePath}`);

    // Delete file using SSH
    const deleteCommand = new Deno.Command('ssh', {
      args: [
        '-i', keyFile,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-p', VPS_CONFIG.port.toString(),
        `${VPS_CONFIG.username}@${VPS_CONFIG.host}`,
        `rm -f ${filePath}`,
      ],
      stdout: 'piped',
      stderr: 'piped',
    });

    const deleteResult = await deleteCommand.output();

    if (!deleteResult.success) {
      const error = new TextDecoder().decode(deleteResult.stderr);
      console.error(`[deleteViaSSH] Delete failed: ${error}`);
      throw new Error(`Failed to delete file via SSH: ${error}`);
    }

    console.log(`[deleteViaSSH] Delete successful`);

    // Cleanup temp files
    await Deno.remove(keyFile);
    await Deno.remove(tempDir, { recursive: true });

    console.log(`[deleteViaSSH] Cleanup complete`);
  } catch (error) {
    console.error('[deleteViaSSH] Error:', error);
    throw error;
  }
}
