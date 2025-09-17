<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json(['error' => 'Método no permitido'], 405);
}

$data = read_json_input();
$name = isset($data['name']) ? (string) $data['name'] : '';
$title = isset($data['title']) ? (string) $data['title'] : '';

$slug = slugify($name);
if ($slug === '') {
    send_json(['error' => 'Elige un nombre válido para tu tour'], 400);
}
if (!is_valid_slug($slug)) {
    send_json(['error' => 'La carpeta del tour no es válida'], 400);
}
ensure_slug_is_allowed($slug);

$dir = tours_dir($slug);
if (is_dir($dir) || is_file($dir)) {
    send_json(['error' => 'Ya existe un tour con este nombre'], 409);
}

if (!mkdir($dir, 0775, true) && !is_dir($dir)) {
    send_json(['error' => 'No se pudo crear la carpeta del tour'], 500);
}

$tourData = [
    'title' => trim($title) === '' ? $name : trim($title),
    'initialSceneId' => null,
    'scenes' => [],
];

save_tour($slug, $tourData);

send_json(format_tour_response($slug, $tourData));
