<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(['error' => 'Método no permitido'], 405);
}

$slug = isset($_GET['slug']) ? (string) $_GET['slug'] : '';
$slug = strtolower($slug);
if (!is_valid_slug($slug)) {
    send_json(['error' => 'Tour inválido'], 400);
}

$tour = load_tour($slug);
if ($tour === null) {
    send_json(['error' => 'Tour no encontrado'], 404);
}

$response = format_tour_response($slug, $tour);
$response['folderPath'] = '/tours/' . $slug;

send_json($response);
