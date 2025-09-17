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

$data = read_json_input();
$title = isset($data['title']) ? trim((string) $data['title']) : '';
$initialSceneId = isset($data['initialSceneId']) ? (string) $data['initialSceneId'] : null;
$scenesPayload = isset($data['scenes']) && is_array($data['scenes']) ? $data['scenes'] : [];

$dir = tours_dir($slug);
$cleanScenes = [];
foreach ($scenesPayload as $scenePayload) {
    if (!is_array($scenePayload)) {
        continue;
    }
    $clean = clean_scene($scenePayload, $dir);
    if ($clean !== null) {
        $cleanScenes[] = $clean;
    }
}

if ($initialSceneId !== null) {
    $exists = false;
    foreach ($cleanScenes as $scene) {
        if ($scene['id'] === $initialSceneId) {
            $exists = true;
            break;
        }
    }
    if (!$exists) {
        $initialSceneId = null;
    }
}

if ($initialSceneId === null && !empty($cleanScenes)) {
    $initialSceneId = $cleanScenes[0]['id'];
}

$tour['title'] = $title === '' ? ($tour['title'] ?? $slug) : $title;
$tour['initialSceneId'] = $initialSceneId;
$tour['scenes'] = $cleanScenes;

save_tour($slug, $tour);

send_json(format_tour_response($slug, $tour));
