<?php
header('Content-Type: application/json; charset=utf-8');

$allowedRoots = [];
$projectRoot = realpath(__DIR__);
if ($projectRoot !== false) {
    $allowedRoots[] = $projectRoot;
}
$htdocsRoot = realpath(dirname(__DIR__));
if ($htdocsRoot !== false && !in_array($htdocsRoot, $allowedRoots, true)) {
    $allowedRoots[] = $htdocsRoot;
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function normalize_path(string $path): string
{
    $path = trim($path);
    $path = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
    return rtrim($path, DIRECTORY_SEPARATOR);
}

function is_within_root(string $path, array $allowedRoots): bool
{
    foreach ($allowedRoots as $root) {
        if ($path === $root || strpos($path, $root . DIRECTORY_SEPARATOR) === 0) {
            return true;
        }
    }
    return false;
}

function ensure_allowed_dir(string $path, array $allowedRoots): string
{
    $normalized = normalize_path($path);
    $real = realpath($normalized);
    if ($real === false || !is_dir($real) || !is_within_root($real, $allowedRoots)) {
        respond(400, ['ok' => false, 'message' => 'Invalid or unauthorized folder path.']);
    }
    return $real;
}

function ensure_allowed_file(string $path, array $allowedRoots): string
{
    $normalized = normalize_path($path);
    $real = realpath($normalized);
    if ($real === false || !is_file($real) || !is_within_root($real, $allowedRoots)) {
        respond(400, ['ok' => false, 'message' => 'Invalid or unauthorized file path.']);
    }
    return $real;
}

function ensure_target_path(string $path, array $allowedRoots): string
{
    $normalized = normalize_path($path);
    $parent = dirname($normalized);
    $realParent = realpath($parent);
    if ($realParent === false || !is_dir($realParent) || !is_within_root($realParent, $allowedRoots)) {
        respond(400, ['ok' => false, 'message' => 'Target parent folder is invalid or unauthorized.']);
    }
    return $realParent . DIRECTORY_SEPARATOR . basename($normalized);
}

function list_tree(string $dir): array
{
    $items = scandir($dir);
    if ($items === false) {
        return [];
    }

    $directories = [];
    $files = [];

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }

        $fullPath = $dir . DIRECTORY_SEPARATOR . $item;
        $node = [
            'name' => $item,
            'path' => $fullPath,
            'type' => is_dir($fullPath) ? 'directory' : 'file',
        ];

        if (is_dir($fullPath)) {
            $node['children'] = list_tree($fullPath);
            $directories[] = $node;
        } else {
            $node['size'] = filesize($fullPath) ?: 0;
            $files[] = $node;
        }
    }

    usort($directories, fn($a, $b) => strcasecmp($a['name'], $b['name']));
    usort($files, fn($a, $b) => strcasecmp($a['name'], $b['name']));

    return array_merge($directories, $files);
}

function delete_path(string $path): void
{
    if (is_file($path)) {
        if (!unlink($path)) {
            respond(500, ['ok' => false, 'message' => 'Unable to delete file.']);
        }
        return;
    }

    $items = scandir($path);
    if ($items === false) {
        respond(500, ['ok' => false, 'message' => 'Unable to read directory for deletion.']);
    }

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        delete_path($path . DIRECTORY_SEPARATOR . $item);
    }

    if (!rmdir($path)) {
        respond(500, ['ok' => false, 'message' => 'Unable to delete directory.']);
    }
}

$action = $_REQUEST['action'] ?? '';

if ($action === 'roots') {
    respond(200, ['ok' => true, 'roots' => array_values($allowedRoots)]);
}

if ($action === 'tree') {
    $root = $_GET['root'] ?? '';
    $dir = ensure_allowed_dir($root, $allowedRoots);
    respond(200, ['ok' => true, 'root' => $dir, 'tree' => list_tree($dir)]);
}

if ($action === 'read') {
    $path = $_GET['path'] ?? '';
    $file = ensure_allowed_file($path, $allowedRoots);
    $content = file_get_contents($file);
    if ($content === false) {
        respond(500, ['ok' => false, 'message' => 'Unable to read file.']);
    }
    respond(200, ['ok' => true, 'path' => $file, 'content' => $content]);
}

if ($action === 'save') {
    $path = $_POST['path'] ?? '';
    $content = $_POST['content'] ?? '';
    $file = ensure_allowed_file($path, $allowedRoots);
    if (file_put_contents($file, $content) === false) {
        respond(500, ['ok' => false, 'message' => 'Unable to save file.']);
    }
    respond(200, ['ok' => true, 'message' => 'File saved.', 'path' => $file]);
}

if ($action === 'create-file') {
    $path = $_POST['path'] ?? '';
    $target = ensure_target_path($path, $allowedRoots);
    if (file_exists($target)) {
        respond(400, ['ok' => false, 'message' => 'File already exists.']);
    }
    if (file_put_contents($target, '') === false) {
        respond(500, ['ok' => false, 'message' => 'Unable to create file.']);
    }
    respond(200, ['ok' => true, 'message' => 'File created.', 'path' => $target]);
}

if ($action === 'create-folder') {
    $path = $_POST['path'] ?? '';
    $target = ensure_target_path($path, $allowedRoots);
    if (file_exists($target)) {
        respond(400, ['ok' => false, 'message' => 'Folder already exists.']);
    }
    if (!mkdir($target, 0777, true)) {
        respond(500, ['ok' => false, 'message' => 'Unable to create folder.']);
    }
    respond(200, ['ok' => true, 'message' => 'Folder created.', 'path' => $target]);
}

if ($action === 'delete') {
    $path = $_POST['path'] ?? '';
    $normalized = normalize_path($path);
    $real = realpath($normalized);
    if ($real === false || !is_within_root($real, $allowedRoots)) {
        respond(400, ['ok' => false, 'message' => 'Invalid or unauthorized path.']);
    }
    delete_path($real);
    respond(200, ['ok' => true, 'message' => 'Deleted successfully.', 'path' => $real]);
}

if ($action === 'rename') {
    $path = $_POST['path'] ?? '';
    $newName = trim($_POST['newName'] ?? '');
    if ($newName === '' || strpos($newName, DIRECTORY_SEPARATOR) !== false || strpos($newName, '/') !== false || strpos($newName, '\\') !== false) {
        respond(400, ['ok' => false, 'message' => 'Invalid new name.']);
    }
    $normalized = normalize_path($path);
    $real = realpath($normalized);
    if ($real === false || !is_within_root($real, $allowedRoots)) {
        respond(400, ['ok' => false, 'message' => 'Invalid or unauthorized path.']);
    }
    $target = dirname($real) . DIRECTORY_SEPARATOR . $newName;
    if (file_exists($target)) {
        respond(400, ['ok' => false, 'message' => 'Target name already exists.']);
    }
    if (!rename($real, $target)) {
        respond(500, ['ok' => false, 'message' => 'Unable to rename item.']);
    }
    respond(200, ['ok' => true, 'message' => 'Renamed successfully.', 'path' => $target]);
}

if ($action === 'move') {
    $path = $_POST['path'] ?? '';
    $destinationDir = $_POST['destinationDir'] ?? '';
    $normalized = normalize_path($path);
    $real = realpath($normalized);
    $destination = ensure_allowed_dir($destinationDir, $allowedRoots);
    if ($real === false || !is_within_root($real, $allowedRoots)) {
        respond(400, ['ok' => false, 'message' => 'Invalid or unauthorized source path.']);
    }
    $target = $destination . DIRECTORY_SEPARATOR . basename($real);
    if (file_exists($target)) {
        respond(400, ['ok' => false, 'message' => 'Destination already contains this name.']);
    }
    if (!rename($real, $target)) {
        respond(500, ['ok' => false, 'message' => 'Unable to move item.']);
    }
    respond(200, ['ok' => true, 'message' => 'Moved successfully.', 'path' => $target]);
}

if ($action === 'upload') {
    $destinationDir = $_POST['destinationDir'] ?? '';
    $destination = ensure_allowed_dir($destinationDir, $allowedRoots);
    if (!isset($_FILES['files'])) {
        respond(400, ['ok' => false, 'message' => 'No uploaded files received.']);
    }

    $uploaded = [];
    $fileNames = $_FILES['files']['name'];
    $tmpNames = $_FILES['files']['tmp_name'];
    $errors = $_FILES['files']['error'];

    foreach ($fileNames as $index => $name) {
        if ($errors[$index] !== UPLOAD_ERR_OK) {
            respond(400, ['ok' => false, 'message' => 'Upload failed for ' . $name]);
        }
        $target = $destination . DIRECTORY_SEPARATOR . basename($name);
        if (!move_uploaded_file($tmpNames[$index], $target)) {
            respond(500, ['ok' => false, 'message' => 'Unable to move uploaded file ' . $name]);
        }
        $uploaded[] = $target;
    }

    respond(200, ['ok' => true, 'message' => 'Upload complete.', 'files' => $uploaded]);
}

respond(404, ['ok' => false, 'message' => 'Unknown action.']);
