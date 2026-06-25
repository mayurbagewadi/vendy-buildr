<?php
/**
 * VPS Direct Upload Endpoint
 * Place this file at: /var/www/digitaldukandar.in/api/upload.php
 */

// CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Configuration
$uploadBasePath = '/var/www/digitaldukandar.in/uploads/';
$baseUrl = 'https://digitaldukandar.in/uploads/';
$maxFileSize = 5 * 1024 * 1024; // 5MB in bytes

function createImageResource($path, $mimeType) {
    switch ($mimeType) {
        case 'image/jpeg':
            return function_exists('imagecreatefromjpeg') ? imagecreatefromjpeg($path) : false;
        case 'image/png':
            return function_exists('imagecreatefrompng') ? imagecreatefrompng($path) : false;
        case 'image/webp':
            return function_exists('imagecreatefromwebp') ? imagecreatefromwebp($path) : false;
        default:
            return false;
    }
}

function saveWebpVariant($source, $sourceWidth, $sourceHeight, $targetWidth, $targetPath) {
    if (!function_exists('imagewebp')) {
        return false;
    }

    $width = min($sourceWidth, $targetWidth);
    $height = (int) round($sourceHeight * ($width / $sourceWidth));

    $canvas = imagecreatetruecolor($width, $height);
    imagealphablending($canvas, false);
    imagesavealpha($canvas, true);

    imagecopyresampled($canvas, $source, 0, 0, 0, 0, $width, $height, $sourceWidth, $sourceHeight);
    $saved = imagewebp($canvas, $targetPath, 82);
    imagedestroy($canvas);

    if ($saved) {
        chmod($targetPath, 0644);
    }

    return $saved;
}

function generateImageVariants($sourcePath, $mimeType, $targetDir, $baseName, $publicBaseUrl) {
    $source = createImageResource($sourcePath, $mimeType);
    if (!$source) {
        return [];
    }

    $sourceWidth = imagesx($source);
    $sourceHeight = imagesy($source);
    $variantSizes = [
        'thumb' => 160,
        'card' => 480,
        'mobile' => 768,
        'detail' => 1200,
        'zoom' => 1600,
    ];
    $variants = [];

    foreach ($variantSizes as $key => $width) {
        $variantFilename = $baseName . '-' . $key . '.webp';
        $variantPath = $targetDir . $variantFilename;

        if (saveWebpVariant($source, $sourceWidth, $sourceHeight, $width, $variantPath)) {
            $variants[$key] = $publicBaseUrl . $variantFilename;
        }
    }

    imagedestroy($source);

    return [
        'variants' => $variants,
        'width' => $sourceWidth,
        'height' => $sourceHeight,
    ];
}

try {
    // Check if file was uploaded
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('No file uploaded or upload error');
    }

    $file = $_FILES['file'];
    $uploadType = $_POST['type'] ?? 'products'; // products, categories, banners
    $storeSlug = $_POST['store_slug'] ?? null; // Store identifier

    // Validate file size
    if ($file['size'] > $maxFileSize) {
        throw new Exception('File size exceeds 5MB limit');
    }

    // Validate file type
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, $allowedTypes)) {
        throw new Exception('Only image files are allowed');
    }

    // Determine subdirectory
    $validTypes = ['products', 'categories', 'banners'];
    $subdir = in_array($uploadType, $validTypes) ? $uploadType : 'products';

    // Generate unique filename
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $uuid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
    $timestamp = round(microtime(true) * 1000);
    $filename = $uuid . '-' . $timestamp . '.' . $extension;

    // Build path with store slug if provided
    if ($storeSlug) {
        // Sanitize store slug to prevent directory traversal
        $storeSlug = preg_replace('/[^a-z0-9\-]/i', '', $storeSlug);
        if (empty($storeSlug)) {
            throw new Exception('Invalid store slug');
        }
        $targetDir = $uploadBasePath . $storeSlug . '/' . $subdir . '/';
    } else {
        // Fallback to old structure for backward compatibility
        $targetDir = $uploadBasePath . $subdir . '/';
    }

    // Create directory if it doesn't exist
    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0755, true);
    }

    // Move uploaded file
    $targetPath = $targetDir . $filename;
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        throw new Exception('Failed to save file');
    }

    // Set file permissions
    chmod($targetPath, 0644);

    // Calculate file size in MB
    $fileSizeMB = $file['size'] / 1024 / 1024;

    // Construct public URL
    if ($storeSlug) {
        $publicDirUrl = $baseUrl . $storeSlug . '/' . $subdir . '/';
        $originalUrl = $publicDirUrl . $filename;
    } else {
        $publicDirUrl = $baseUrl . $subdir . '/';
        $originalUrl = $publicDirUrl . $filename;
    }

    $baseName = pathinfo($filename, PATHINFO_FILENAME);
    $variantData = generateImageVariants($targetPath, $mimeType, $targetDir, $baseName, $publicDirUrl);
    $variants = $variantData['variants'] ?? [];
    $imageUrl = $variants['detail'] ?? $variants['card'] ?? $originalUrl;

    $image = [
        'url' => $imageUrl,
        'original' => $originalUrl,
        'variants' => $variants,
        'width' => $variantData['width'] ?? null,
        'height' => $variantData['height'] ?? null,
        'format' => count($variants) > 0 ? 'webp' : $mimeType
    ];

    // Return success response
    echo json_encode([
        'success' => true,
        'imageUrl' => $imageUrl,
        'image' => $image,
        'fileId' => $filename,
        'fileSizeMB' => round($fileSizeMB, 2),
        'fileType' => $subdir
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
