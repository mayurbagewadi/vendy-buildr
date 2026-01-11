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

try {
    // Check if file was uploaded
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('No file uploaded or upload error');
    }

    $file = $_FILES['file'];
    $uploadType = $_POST['type'] ?? 'products'; // products, categories, banners

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

    // Create directory if it doesn't exist
    $targetDir = $uploadBasePath . $subdir . '/';
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
    $imageUrl = $baseUrl . $subdir . '/' . $filename;

    // Return success response
    echo json_encode([
        'success' => true,
        'imageUrl' => $imageUrl,
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
