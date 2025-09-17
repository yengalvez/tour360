const state = {
  slug: '',
  title: '',
  scenes: [],
  initialSceneId: null,
  currentSceneId: null,
};

let viewer = null;
let markersPlugin = null;
let placingHotspot = false;
let pendingCoords = null;
let pendingSceneFile = null;
let toastTimeout = null;

const createForm = document.getElementById('createTourForm');
const createPanel = document.getElementById('createPanel');
const workspace = document.getElementById('workspace');
const tourNameInput = document.getElementById('tourName');
const tourTitleInput = document.getElementById('tourTitle');
const slugPreview = document.getElementById('slugPreview');
const sceneUploadInput = document.getElementById('sceneUpload');
const scenesListEl = document.getElementById('scenesList');
const viewerTitleEl = document.getElementById('currentSceneTitle');
const viewerHintEl = document.getElementById('viewerHint');
const addHotspotBtn = document.getElementById('addHotspot');
const saveTourBtn = document.getElementById('saveTour');
const hotspotsListEl = document.getElementById('hotspotsList');
const hotspotCountEl = document.getElementById('hotspotCount');
const placingNotice = document.getElementById('placingNotice');
const hotspotModal = document.getElementById('hotspotModal');
const hotspotLabelInput = document.getElementById('hotspotLabel');
const hotspotTargetSelect = document.getElementById('hotspotTarget');
const confirmHotspotBtn = document.getElementById('confirmHotspot');
const cancelHotspotBtn = document.getElementById('cancelHotspot');
const toastEl = document.getElementById('toast');
const tourFolderInfo = document.getElementById('tourFolderInfo');
const tourPublicLink = document.getElementById('tourPublicLink');
const sceneModal = document.getElementById('sceneModal');
const sceneNameInput = document.getElementById('sceneNameInput');
const confirmSceneModalBtn = document.getElementById('confirmSceneModal');
const cancelSceneModalBtn = document.getElementById('cancelSceneModal');
const sceneFileName = document.getElementById('sceneFileName');

function normalizeOrigin() {
  return window.location.origin && window.location.origin !== 'null'
    ? window.location.origin
    : 'tu-dominio';
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/_/g, '-')
    .replace(/[^a-z0-9-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function updateSlugPreview() {
  const slug = slugify(tourNameInput.value) || 'carpeta';
  slugPreview.textContent = `${normalizeOrigin()}/${slug}`;
}

tourNameInput.addEventListener('input', updateSlugPreview);

function showToast(message, type = 'info') {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden', 'success', 'error', 'visible');
  if (type === 'success') {
    toastEl.classList.add('success');
  } else if (type === 'error') {
    toastEl.classList.add('error');
  }
  toastEl.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.add('hidden');
    toastEl.classList.remove('visible');
  }, 3200);
}

function hideToast() {
  toastEl.classList.add('hidden');
  toastEl.classList.remove('visible');
  clearTimeout(toastTimeout);
}

function mapScene(scene) {
  return {
    id: scene.id,
    name: scene.name,
    file: scene.file,
    hotspots: (scene.hotspots || []).map((spot) => ({
      id: spot.id,
      label: spot.label,
      targetSceneId: spot.targetSceneId || null,
      yaw: Number(spot.yaw),
      pitch: Number(spot.pitch),
    })),
    url: scene.url || `/tours/${state.slug}/${scene.file}`,
  };
}

function getSceneById(id) {
  return state.scenes.find((scene) => scene.id === id) || null;
}

function getCurrentScene() {
  return getSceneById(state.currentSceneId);
}

function renderScenesList() {
  if (!state.scenes.length) {
    scenesListEl.innerHTML = '<li class="scene-empty">Sube tu primera escena 360° para comenzar.</li>';
    return;
  }

  const fragment = document.createDocumentFragment();
  state.scenes.forEach((scene) => {
    const li = document.createElement('li');
    li.className = `scene-item${state.currentSceneId === scene.id ? ' active' : ''}`;
    li.dataset.id = scene.id;

    const img = document.createElement('img');
    img.src = scene.url;
    img.alt = scene.name;
    img.className = 'scene-thumb';
    li.appendChild(img);

    const details = document.createElement('div');
    details.className = 'scene-details';

    const nameEl = document.createElement('div');
    nameEl.className = 'scene-name';
    nameEl.textContent = scene.name;
    details.appendChild(nameEl);

    const actions = document.createElement('div');
    actions.className = 'scene-actions';

    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.dataset.action = 'view';
    viewBtn.className = 'ghost';
    viewBtn.textContent = 'Ver escena';
    actions.appendChild(viewBtn);

    const initialBtn = document.createElement('button');
    initialBtn.type = 'button';
    initialBtn.dataset.action = 'initial';
    initialBtn.className = 'ghost';
    if (state.initialSceneId === scene.id) {
      initialBtn.classList.add('is-initial');
      initialBtn.textContent = 'Inicio actual';
    } else {
      initialBtn.textContent = 'Marcar inicio';
    }
    actions.appendChild(initialBtn);

    details.appendChild(actions);
    li.appendChild(details);
    fragment.appendChild(li);
  });

  scenesListEl.innerHTML = '';
  scenesListEl.appendChild(fragment);
}

function renderHotspotList(scene) {
  hotspotsListEl.innerHTML = '';
  if (!scene || !scene.hotspots.length) {
    const empty = document.createElement('li');
    empty.className = 'scene-empty';
    empty.textContent = 'No hay hotspots en esta escena todavía.';
    hotspotsListEl.appendChild(empty);
    hotspotCountEl.textContent = '0 hotspots';
    return;
  }

  hotspotCountEl.textContent = `${scene.hotspots.length} hotspot${scene.hotspots.length === 1 ? '' : 's'}`;

  const fragment = document.createDocumentFragment();
  scene.hotspots.forEach((hotspot) => {
    const item = document.createElement('li');
    item.className = 'hotspot-item';
    item.dataset.id = hotspot.id;

    const meta = document.createElement('div');
    meta.className = 'hotspot-meta';
    const label = document.createElement('strong');
    label.textContent = hotspot.label;
    const targetScene = getSceneById(hotspot.targetSceneId);
    const hint = document.createElement('span');
    hint.textContent = targetScene ? `Dirige a: ${targetScene.name}` : 'Sin escena destino';
    meta.appendChild(label);
    meta.appendChild(hint);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.dataset.id = hotspot.id;
    remove.textContent = 'Eliminar';

    item.appendChild(meta);
    item.appendChild(remove);
    fragment.appendChild(item);
  });
  hotspotsListEl.appendChild(fragment);
}

function updateViewerMarkers(scene) {
  if (!markersPlugin) return;
  markersPlugin.clearMarkers();
  (scene.hotspots || []).forEach((hotspot) => {
    const target = getSceneById(hotspot.targetSceneId);
    const tooltip = target
      ? `<strong>${escapeHtml(hotspot.label)}</strong><br/><span>${escapeHtml(target.name)}</span>`
      : `<strong>${escapeHtml(hotspot.label)}</strong>`;
    markersPlugin.addMarker({
      id: hotspot.id,
      longitude: hotspot.yaw,
      latitude: hotspot.pitch,
      html: '<div class="hotspot-pin"></div>',
      anchor: 'bottom center',
      tooltip: { content: tooltip },
      data: { targetSceneId: hotspot.targetSceneId },
    });
  });
}

function escapeHtml(text = '') {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function ensureViewer(scene) {
  if (viewer) {
    viewer.setPanorama(scene.url);
    return;
  }

  viewer = new PhotoSphereViewer.Viewer({
    container: document.getElementById('viewer'),
    panorama: scene.url,
    navbar: ['zoomOut', 'zoomRange', 'zoomIn', 'fullscreen'],
    touchmoveTwoFingers: true,
    plugins: [[PhotoSphereViewer.MarkersPlugin, { markers: [] }]],
  });

  markersPlugin = viewer.getPlugin(PhotoSphereViewer.MarkersPlugin);

  viewer.on('panorama-loaded', () => {
    const current = getCurrentScene();
    if (current) {
      viewerTitleEl.textContent = current.name;
      viewerHintEl.textContent = current.hotspots.length
        ? `${current.hotspots.length} hotspot${current.hotspots.length === 1 ? '' : 's'} listos`
        : 'Aún no hay hotspots en esta escena';
      updateViewerMarkers(current);
    }
  });

  viewer.on('click', (_event, data) => {
    if (!placingHotspot) return;
    placingHotspot = false;
    placingNotice.classList.add('hidden');
    pendingCoords = {
      yaw: data.longitude,
      pitch: data.latitude,
    };
    openHotspotModal();
  });

  markersPlugin.on('select-marker', (_event, marker) => {
    const targetId = marker?.config?.data?.targetSceneId
      ?? marker?.data?.targetSceneId
      ?? null;
    if (targetId) {
      activateScene(targetId);
    }
  });
}

function activateScene(sceneId) {
  const scene = getSceneById(sceneId);
  if (!scene) return;
  state.currentSceneId = sceneId;
  ensureViewer(scene);
  viewer.setPanorama(scene.url);
  viewerTitleEl.textContent = scene.name;
  viewerHintEl.textContent = scene.hotspots.length
    ? `${scene.hotspots.length} hotspot${scene.hotspots.length === 1 ? '' : 's'} listos`
    : 'Aún no hay hotspots en esta escena';
  renderScenesList();
  renderHotspotList(scene);
  hotspotCountEl.textContent = `${scene.hotspots.length} hotspot${scene.hotspots.length === 1 ? '' : 's'}`;
}

function resetSceneUpload() {
  pendingSceneFile = null;
  sceneNameInput.value = '';
  sceneModal.classList.add('hidden');
  confirmSceneModalBtn.disabled = false;
}

function openSceneModal(file, suggestedName) {
  pendingSceneFile = file;
  sceneFileName.textContent = file.name;
  sceneNameInput.value = suggestedName;
  sceneModal.classList.remove('hidden');
  sceneNameInput.focus();
}

function openHotspotModal() {
  hotspotModal.classList.remove('hidden');
  hotspotLabelInput.value = '';
  hotspotLabelInput.focus();
  hotspotTargetSelect.innerHTML = '';

  const fragment = document.createDocumentFragment();
  state.scenes.forEach((scene) => {
    const option = document.createElement('option');
    option.value = scene.id;
    option.textContent = scene.name;
    if (scene.id === state.currentSceneId) {
      option.selected = true;
    }
    fragment.appendChild(option);
  });
  hotspotTargetSelect.appendChild(fragment);
}

function closeHotspotModal() {
  hotspotModal.classList.add('hidden');
  hotspotLabelInput.value = '';
  hotspotTargetSelect.innerHTML = '';
  pendingCoords = null;
}

function startHotspotPlacement() {
  const current = getCurrentScene();
  if (!current) {
    showToast('Primero selecciona una escena', 'error');
    return;
  }
  placingHotspot = true;
  pendingCoords = null;
  placingNotice.classList.remove('hidden');
  showToast('Haz clic en la escena para colocar el hotspot');
}

async function uploadScene(name) {
  if (!pendingSceneFile) return;
  confirmSceneModalBtn.disabled = true;
  const formData = new FormData();
  formData.append('scene', pendingSceneFile);
  formData.append('sceneName', name);

  try {
    const response = await fetch(`/api/upload-scene.php?slug=${encodeURIComponent(state.slug)}`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      showToast(error.error || 'No se pudo subir la escena', 'error');
      resetSceneUpload();
      return;
    }
    const data = await response.json();
    const newScene = mapScene(data.scene);
    state.scenes.push(newScene);
    state.initialSceneId = data.tour.initialSceneId || state.initialSceneId;
    renderScenesList();
    if (!state.currentSceneId) {
      activateScene(newScene.id);
    }
    showToast('Escena subida correctamente', 'success');
  } catch (error) {
    console.error(error);
    showToast('Error al subir la escena', 'error');
  } finally {
    resetSceneUpload();
  }
}

async function saveTour() {
  if (!state.slug) return;
  saveTourBtn.disabled = true;
  const payload = {
    title: state.title,
    initialSceneId: state.initialSceneId,
    scenes: state.scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      file: scene.file,
      hotspots: scene.hotspots.map((spot) => ({
        id: spot.id,
        label: spot.label,
        targetSceneId: spot.targetSceneId,
        yaw: spot.yaw,
        pitch: spot.pitch,
      })),
    })),
  };

  try {
    const response = await fetch(`/api/save-tour.php?slug=${encodeURIComponent(state.slug)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      showToast(error.error || 'No se pudo guardar el tour', 'error');
      return;
    }
    const data = await response.json();
    state.title = data.title;
    state.initialSceneId = data.initialSceneId;
    state.scenes = data.scenes.map(mapScene);
    if (state.currentSceneId) {
      const refreshed = getSceneById(state.currentSceneId);
      if (refreshed) {
        renderHotspotList(refreshed);
        updateViewerMarkers(refreshed);
      }
    }
    renderScenesList();
    showToast('Tour guardado', 'success');
  } catch (error) {
    console.error(error);
    showToast('Error de conexión al guardar', 'error');
  } finally {
    saveTourBtn.disabled = false;
  }
}

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = tourNameInput.value.trim();
  const title = tourTitleInput.value.trim();
  if (!name) {
    showToast('Escribe un nombre para tu tour', 'error');
    return;
  }
  const payload = { name, title };
  try {
    const response = await fetch('/api/create-tour.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      showToast(data.error || 'No se pudo crear el tour', 'error');
      return;
    }
    state.slug = data.slug;
    state.title = data.title;
    state.initialSceneId = data.initialSceneId;
    state.scenes = (data.scenes || []).map(mapScene);
    createPanel.classList.add('hidden');
    workspace.classList.remove('hidden');
    tourFolderInfo.textContent = `Carpeta actual: /${state.slug}`;
    tourPublicLink.href = `/${state.slug}`;
    tourPublicLink.textContent = `${normalizeOrigin()}/${state.slug}`;
    tourPublicLink.classList.remove('hidden');
    renderScenesList();
    if (state.initialSceneId) {
      activateScene(state.initialSceneId);
    }
    showToast('Tour listo para editar', 'success');
  } catch (error) {
    console.error(error);
    showToast('No se pudo conectar con el servidor', 'error');
  }
});

sceneUploadInput.addEventListener('change', (event) => {
  if (!state.slug) {
    showToast('Crea un tour antes de subir escenas', 'error');
    sceneUploadInput.value = '';
    return;
  }
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const suggested = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  openSceneModal(file, suggested);
  sceneUploadInput.value = '';
});

confirmSceneModalBtn.addEventListener('click', () => {
  if (!pendingSceneFile) return;
  const sceneName = sceneNameInput.value.trim() || pendingSceneFile.name.replace(/\.[^.]+$/, '');
  uploadScene(sceneName);
});

cancelSceneModalBtn.addEventListener('click', resetSceneUpload);

sceneModal.addEventListener('click', (event) => {
  if (event.target === sceneModal) {
    resetSceneUpload();
  }
});

confirmHotspotBtn.addEventListener('click', () => {
  const scene = getCurrentScene();
  if (!scene || !pendingCoords) {
    closeHotspotModal();
    return;
  }
  const label = hotspotLabelInput.value.trim();
  const targetSceneId = hotspotTargetSelect.value;
  if (!label) {
    showToast('Escribe una etiqueta para el hotspot', 'error');
    return;
  }
  if (!targetSceneId) {
    showToast('Elige una escena destino', 'error');
    return;
  }
  const hotspot = {
    id: `hotspot-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`,
    label,
    targetSceneId,
    yaw: pendingCoords.yaw,
    pitch: pendingCoords.pitch,
  };
  scene.hotspots.push(hotspot);
  closeHotspotModal();
  renderHotspotList(scene);
  updateViewerMarkers(scene);
  showToast('Hotspot agregado', 'success');
});

cancelHotspotBtn.addEventListener('click', () => {
  closeHotspotModal();
});

hotspotModal.addEventListener('click', (event) => {
  if (event.target === hotspotModal) {
    closeHotspotModal();
  }
});

hotspotsListEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-id]');
  if (!button) return;
  const scene = getCurrentScene();
  if (!scene) return;
  const hotspotId = button.dataset.id;
  scene.hotspots = scene.hotspots.filter((spot) => spot.id !== hotspotId);
  renderHotspotList(scene);
  updateViewerMarkers(scene);
  showToast('Hotspot eliminado', 'success');
});

scenesListEl.addEventListener('click', (event) => {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) return;
  const item = actionButton.closest('li[data-id]');
  if (!item) return;
  const sceneId = item.dataset.id;

  if (actionButton.dataset.action === 'view') {
    activateScene(sceneId);
  } else if (actionButton.dataset.action === 'initial') {
    state.initialSceneId = sceneId;
    renderScenesList();
    showToast('Escena marcada como inicio', 'success');
  }
});

addHotspotBtn.addEventListener('click', () => {
  startHotspotPlacement();
});

saveTourBtn.addEventListener('click', () => {
  saveTour();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!sceneModal.classList.contains('hidden')) {
      resetSceneUpload();
    }
    if (!hotspotModal.classList.contains('hidden')) {
      closeHotspotModal();
    }
    if (placingHotspot) {
      placingHotspot = false;
      placingNotice.classList.add('hidden');
      pendingCoords = null;
    }
  }
});

window.addEventListener('beforeunload', () => {
  hideToast();
});

updateSlugPreview();
