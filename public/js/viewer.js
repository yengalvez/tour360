const viewerContainer = document.getElementById('viewer');
const tourTitleEl = document.getElementById('tourTitle');
const tourSubtitleEl = document.getElementById('tourSubtitle');
const tourPathEl = document.getElementById('tourPath');
const sceneSelect = document.getElementById('sceneSelect');
const messageEl = document.getElementById('viewerMessage');

let viewer = null;
let markersPlugin = null;
let scenes = [];
let currentSceneId = null;

function normalizeOrigin() {
  return window.location.origin && window.location.origin !== 'null'
    ? window.location.origin
    : 'tu-dominio';
}

function escapeHtml(text = '') {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function mapScene(slug, scene) {
  return {
    id: scene.id,
    name: scene.name,
    file: scene.file,
    hotspots: (scene.hotspots || []).map((spot) => ({
      id: spot.id,
      label: spot.label,
      targetSceneId: spot.targetSceneId,
      yaw: Number(spot.yaw),
      pitch: Number(spot.pitch),
    })),
    url: scene.url || `/tours/${slug}/${scene.file}`,
  };
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.remove('hidden');
}

function hideMessage() {
  messageEl.classList.add('hidden');
}

function updateSceneOptions() {
  sceneSelect.innerHTML = '';
  if (!scenes.length) {
    sceneSelect.disabled = true;
    return;
  }
  const fragment = document.createDocumentFragment();
  scenes.forEach((scene) => {
    const option = document.createElement('option');
    option.value = scene.id;
    option.textContent = scene.name;
    if (scene.id === currentSceneId) {
      option.selected = true;
    }
    fragment.appendChild(option);
  });
  sceneSelect.appendChild(fragment);
  sceneSelect.disabled = scenes.length <= 1;
}

function renderMarkers(scene) {
  if (!markersPlugin) return;
  markersPlugin.clearMarkers();
  scene.hotspots.forEach((hotspot) => {
    const target = scenes.find((item) => item.id === hotspot.targetSceneId);
    const tooltip = target
      ? `<strong>${escapeHtml(hotspot.label)}</strong><br/><span>${escapeHtml(target.name)}</span>`
      : `<strong>${escapeHtml(hotspot.label)}</strong>`;
    markersPlugin.addMarker({
      id: hotspot.id,
      longitude: Number(hotspot.yaw),
      latitude: Number(hotspot.pitch),
      html: '<div class="hotspot-pin"></div>',
      anchor: 'bottom center',
      tooltip: { content: tooltip },
      data: { targetSceneId: hotspot.targetSceneId },
    });
  });
}

function updateSceneInfo(scene) {
  tourSubtitleEl.textContent = scene.hotspots.length
    ? `${scene.hotspots.length} hotspot${scene.hotspots.length === 1 ? '' : 's'} interactivo${scene.hotspots.length === 1 ? '' : 's'}`
    : 'Esta escena aún no tiene hotspots.';
}

function setScene(sceneId) {
  if (!viewer) return;
  if (sceneId === currentSceneId) {
    return;
  }
  const scene = scenes.find((item) => item.id === sceneId);
  if (!scene) return;
  currentSceneId = sceneId;
  viewer.setPanorama(scene.url);
  updateSceneOptions();
  updateSceneInfo(scene);
}

function initializeViewer(initialScene) {
  viewer = new PhotoSphereViewer.Viewer({
    container: viewerContainer,
    panorama: initialScene.url,
    navbar: ['zoomOut', 'zoomRange', 'zoomIn', 'fullscreen'],
    touchmoveTwoFingers: true,
    plugins: [[PhotoSphereViewer.MarkersPlugin, { markers: [] }]],
  });
  markersPlugin = viewer.getPlugin(PhotoSphereViewer.MarkersPlugin);

  viewer.on('panorama-loaded', () => {
    const scene = scenes.find((item) => item.id === currentSceneId);
    if (scene) {
      renderMarkers(scene);
      updateSceneInfo(scene);
    }
  });

  markersPlugin.on('select-marker', (_event, marker) => {
    const targetId = marker?.config?.data?.targetSceneId
      ?? marker?.data?.targetSceneId
      ?? null;
    if (targetId) {
      setScene(targetId);
      sceneSelect.value = targetId;
    }
  });
}

async function loadTour(slug) {
  tourPathEl.textContent = `${normalizeOrigin()}/${slug}`;
  try {
    const response = await fetch(`/api/get-tour.php?slug=${encodeURIComponent(slug)}`);
    if (!response.ok) {
      showMessage('No pudimos encontrar este tour.');
      return;
    }
    const data = await response.json();
    scenes = (data.scenes || []).map((scene) => mapScene(slug, scene));
    tourTitleEl.textContent = data.title || slug;
    if (!scenes.length) {
      showMessage('Este tour aún no tiene escenas publicadas.');
      return;
    }
    hideMessage();
    const initialScene = scenes.find((scene) => scene.id === data.initialSceneId) || scenes[0];
    currentSceneId = initialScene.id;
    updateSceneOptions();
    initializeViewer(initialScene);
    updateSceneInfo(initialScene);
    sceneSelect.value = currentSceneId;
  } catch (error) {
    console.error(error);
    showMessage('Ha ocurrido un error al cargar el tour.');
  }
}

sceneSelect.addEventListener('change', (event) => {
  setScene(event.target.value);
});

const providedSlug = typeof window !== 'undefined' ? window.__TOUR_SLUG__ : '';
const pathSegments = window.location.pathname.split('/').filter(Boolean);
let slug = '';

if (providedSlug) {
  slug = decodeURIComponent(providedSlug);
} else if (pathSegments.length >= 2 && pathSegments[0] === 'tours') {
  slug = decodeURIComponent(pathSegments[1]);
} else if (pathSegments.length >= 1) {
  slug = decodeURIComponent(pathSegments[0]);
}

if (!slug) {
  showMessage('Para ver un tour ingresa con la ruta /tu-carpeta.');
} else {
  loadTour(slug);
}
