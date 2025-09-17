<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['error' => 'Método no permitido'], 405);
}

$slug = isset($_GET['slug']) ? (string) $_GET['slug'] : '';
$slug = strtolower($slug);
if (!is_valid_slug($slug)) {
    send_json(['error' => 'Tour inválido'], 400);
}
ensure_slug_is_allowed($slug);

$tour = load_tour($slug);
if ($tour === null) {
    send_json(['error' => 'Tour no encontrado'], 404);
}

if (!isset($_FILES['scene']) || !is_uploaded_file($_FILES['scene']['tmp_name'])) {
    send_json(['error' => 'No se recibió ningún archivo'], 400);
}

$fileInfo = $_FILES['scene'];
$originalName = $fileInfo['name'] ?? 'escena.jpg';
$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
if (!allowed_extension($extension)) {
    send_json(['error' => 'Formato de imagen no permitido'], 400);
}

$sceneName = isset($_POST['sceneName']) ? trim((string) $_POST['sceneName']) : '';
if ($sceneName === '') {
    $sceneName = preg_replace('/\.[^.]+$/', '', (string) $originalName) ?? 'Escena';
}

$sceneId = generate_scene_id();
$filename = generate_scene_filename($extension);
$targetDir = tours_dir($slug);
if (!is_dir($targetDir) && !mkdir($targetDir, 0775, true) && !is_dir($targetDir)) {
    send_json(['error' => 'No se pudo guardar la escena'], 500);
}
$targetPath = $targetDir . DIRECTORY_SEPARATOR . $filename;

if (!move_uploaded_file($fileInfo['tmp_name'], $targetPath)) {
    send_json(['error' => 'No se pudo guardar la escena'], 500);
}

$sceneData = [
    'id' => $sceneId,
    'name' => $sceneName,
    'file' => $filename,
    'hotspots' => [],
];

$tour['scenes'][] = $sceneData;
if (empty($tour['initialSceneId'])) {
    $tour['initialSceneId'] = $sceneId;
}

save_tour($slug, $tour);

send_json([
    'scene' => format_scene($slug, $sceneData),
    'tour' => format_tour_response($slug, $tour),
]);
