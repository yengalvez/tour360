<?php
declare(strict_types=1);

const TOUR_STORAGE = __DIR__ . '/../tours';

$RESERVED_SLUGS = [
    'api',
    'css',
    'img',
    'images',
    'js',
    'vendor',
    'assets',
    'tours',
    'viewer',
    'index',
    'favicon',
];

if (!is_dir(TOUR_STORAGE) && !mkdir(TOUR_STORAGE, 0775, true) && !is_dir(TOUR_STORAGE)) {
    send_json(['error' => 'No se pudo preparar el almacenamiento de tours'], 500);
}

function send_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function read_json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
        send_json(['error' => 'JSON inválido'], 400);
    }
    return $data;
}

function slugify(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return '';
    }
    $transliterated = iconv('UTF-8', 'ASCII//TRANSLIT', $value);
    if ($transliterated === false) {
        $transliterated = $value;
    }
    $transliterated = strtolower($transliterated);
    $transliterated = preg_replace('/[^a-z0-9\s-]/', '', $transliterated) ?? '';
    $transliterated = preg_replace('/[\s-]+/', '-', $transliterated) ?? '';
    return trim($transliterated, '-');
}

function is_valid_slug(string $slug): bool
{
    return (bool) preg_match('/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/', $slug);
}

function ensure_slug_is_allowed(string $slug): void
{
    global $RESERVED_SLUGS;
    if (in_array($slug, $RESERVED_SLUGS, true)) {
        send_json(['error' => 'Este nombre está reservado, elige otro'], 400);
    }
}

function tours_dir(string $slug = ''): string
{
    $base = rtrim(TOUR_STORAGE, DIRECTORY_SEPARATOR);
    if ($slug === '') {
        return $base;
    }
    return $base . DIRECTORY_SEPARATOR . $slug;
}

function tour_file(string $slug): string
{
    return tours_dir($slug) . DIRECTORY_SEPARATOR . 'tour.json';
}

function load_tour(string $slug): ?array
{
    $path = tour_file($slug);
    if (!is_file($path)) {
        return null;
    }
    $contents = file_get_contents($path);
    if ($contents === false) {
        return null;
    }
    $data = json_decode($contents, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
        return null;
    }
    return $data;
}

function save_tour(string $slug, array $data): void
{
    $dir = tours_dir($slug);
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        send_json(['error' => 'No se pudo guardar el tour'], 500);
    }
    $path = tour_file($slug);
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($path, $json) === false) {
        send_json(['error' => 'No se pudo guardar el tour'], 500);
    }
}

function format_scene(string $slug, array $scene): array
{
    return [
        'id' => $scene['id'] ?? null,
        'name' => $scene['name'] ?? 'Escena',
        'file' => $scene['file'] ?? null,
        'hotspots' => $scene['hotspots'] ?? [],
        'url' => sprintf('/tours/%s/%s', $slug, $scene['file'] ?? ''),
    ];
}

function format_tour_response(string $slug, array $data): array
{
    $scenes = [];
    foreach ($data['scenes'] ?? [] as $scene) {
        if (!isset($scene['file'])) {
            continue;
        }
        $scenes[] = format_scene($slug, $scene);
    }
    return [
        'slug' => $slug,
        'title' => $data['title'] ?? $slug,
        'initialSceneId' => $data['initialSceneId'] ?? null,
        'scenes' => $scenes,
    ];
}

function clean_hotspots(array $hotspots): array
{
    $clean = [];
    foreach ($hotspots as $hotspot) {
        if (!is_array($hotspot)) {
            continue;
        }
        $label = isset($hotspot['label']) ? trim((string) $hotspot['label']) : 'Hotspot';
        $target = $hotspot['targetSceneId'] ?? null;
        $id = isset($hotspot['id']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $hotspot['id']) : null;
        try {
            $yaw = isset($hotspot['yaw']) ? (float) $hotspot['yaw'] : null;
            $pitch = isset($hotspot['pitch']) ? (float) $hotspot['pitch'] : null;
        } catch (Throwable $th) {
            $yaw = null;
            $pitch = null;
        }
        if ($yaw === null || $pitch === null) {
            continue;
        }
        if ($id === null || $id === '') {
            $id = 'hotspot-' . bin2hex(random_bytes(4));
        }
        $clean[] = [
            'id' => $id,
            'label' => $label === '' ? 'Hotspot' : $label,
            'targetSceneId' => $target,
            'yaw' => $yaw,
            'pitch' => $pitch,
        ];
    }
    return $clean;
}

function clean_scene(array $scene, string $dir): ?array
{
    if (!isset($scene['id'], $scene['file'])) {
        return null;
    }
    $id = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $scene['id']);
    $file = basename((string) $scene['file']);
    if ($id === '' || $file === '') {
        return null;
    }
    $path = $dir . DIRECTORY_SEPARATOR . $file;
    if (!is_file($path)) {
        return null;
    }
    $name = isset($scene['name']) ? trim((string) $scene['name']) : 'Escena';
    $hotspots = clean_hotspots(is_array($scene['hotspots'] ?? null) ? $scene['hotspots'] : []);
    return [
        'id' => $id,
        'name' => $name === '' ? 'Escena' : $name,
        'file' => $file,
        'hotspots' => $hotspots,
    ];
}

function generate_scene_filename(string $extension): string
{
    return sprintf('scene-%s.%s', bin2hex(random_bytes(6)), $extension);
}

function generate_scene_id(): string
{
    return 'scene-' . bin2hex(random_bytes(6));
}

function allowed_extension(string $extension): bool
{
    return in_array(strtolower($extension), ['jpg', 'jpeg', 'png', 'webp'], true);
}
