<?php
/**
 * VPS Direct Delete Endpoint
 * Place this file at: /var/www/digitaldukandar.in/api/delete.php
 */

// CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow POST or DELETE
if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'DELETE'])) {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Configuration
$uploadBasePath = '/var/www/digitaldukandar.in/uploads/';
$baseUrl = 'https://digitaldukandar.in/uploads/';

try {
    // Get request body
    $input = json_decode(file_get_contents('php://input'), true);

    if (!isset($input['imageUrl']) || empty($input['imageUrl'])) {
        throw new Exception('No image URL provided');
    }

    $imageUrl = $input['imageUrl'];

    // Validate the URL belongs to our domain
    if (strpos($imageUrl, $baseUrl) !== 0) {
        throw new Exception('Invalid image URL - not from this server');
    }

    // Extract the relative path from URL
    $relativePath = str_replace($baseUrl, '', $imageUrl);

    // Sanitize path to prevent directory traversal
    $relativePath = basename(dirname($relativePath)) . '/' . basename($relativePath);

    // Validate the subdirectory
    $validDirs = ['products', 'categories', 'banners'];
    $pathParts = explode('/', $relativePath);
    if (count($pathParts) < 2 || !in_array($pathParts[0], $validDirs)) {
        throw new Exception('Invalid file path');
    }

    // Build full file path
    $filePath = $uploadBasePath . $relativePath;

    // Check if file exists
    if (!file_exists($filePath)) {
        // File doesn't exist, but that's okay - return success
        echo json_encode([
            'success' => true,
            'message' => 'File already deleted or does not exist',
            'deleted' => false
        ]);
        exit;
    }

    // Delete the file
    if (!unlink($filePath)) {
        throw new Exception('Failed to delete file');
    }

    // Return success response
    echo json_encode([
        'success' => true,
        'message' => 'File deleted successfully',
        'deleted' => true,
        'deletedUrl' => $imageUrl
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
