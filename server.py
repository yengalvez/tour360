#!/usr/bin/env python3
"""Minimal backend to manage 360° tour creation and hosting."""
from __future__ import annotations

import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning, module="cgi")
warnings.filterwarnings("ignore", category=DeprecationWarning, message=r".*'cgi' is deprecated.*")

import cgi
import json
import os
import re
import shutil
import uuid
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict
from urllib.parse import urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
TOURS_DIR = os.path.join(PUBLIC_DIR, "tours")


def ensure_directories() -> None:
    os.makedirs(TOURS_DIR, exist_ok=True)


def slugify(value: str) -> str:
    """Create a filesystem safe slug from the provided name."""
    value = (value or "").strip()
    if not value:
        return ""
    normalized = (
        value.lower()
        .strip()
        .replace("_", "-")
    )
    normalized = (
        normalized
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    normalized = re.sub(r"[^a-z0-9-\s]", "", normalized)
    normalized = re.sub(r"\s+", "-", normalized)
    normalized = re.sub(r"-+", "-", normalized)
    return normalized.strip("-")


def is_valid_slug(slug: str) -> bool:
    return bool(re.match(r"^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$", slug))


class TourRequestHandler(SimpleHTTPRequestHandler):
    """Request handler serving API endpoints and static files."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    # ------------------------------- helpers ------------------------------- #
    def _send_json(self, payload: Dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._send_json({"error": "JSON inválido"}, HTTPStatus.BAD_REQUEST)
            raise

    def _tour_dir(self, slug: str) -> str:
        return os.path.join(TOURS_DIR, slug)

    def _tour_file(self, slug: str) -> str:
        return os.path.join(self._tour_dir(slug), "tour.json")

    def _tour_exists(self, slug: str) -> bool:
        return os.path.exists(self._tour_file(slug))

    def _load_tour(self, slug: str) -> Dict[str, Any] | None:
        try:
            with open(self._tour_file(slug), "r", encoding="utf-8") as handler:
                return json.load(handler)
        except FileNotFoundError:
            return None

    def _save_tour(self, slug: str, data: Dict[str, Any]) -> None:
        os.makedirs(self._tour_dir(slug), exist_ok=True)
        with open(self._tour_file(slug), "w", encoding="utf-8") as handler:
            json.dump(data, handler, ensure_ascii=False, indent=2)

    def _format_tour_response(self, slug: str, data: Dict[str, Any]) -> Dict[str, Any]:
        scenes = []
        for scene in data.get("scenes", []):
            scene_copy = {
                "id": scene.get("id"),
                "name": scene.get("name"),
                "file": scene.get("file"),
                "hotspots": scene.get("hotspots", []),
                "url": f"/tours/{slug}/{scene.get('file')}"
            }
            scenes.append(scene_copy)
        return {
            "slug": slug,
            "title": data.get("title", slug),
            "initialSceneId": data.get("initialSceneId"),
            "scenes": scenes,
        }

    def _clean_scene(self, scene: Dict[str, Any]) -> Dict[str, Any]:
        clean_hotspots = []
        for hotspot in scene.get("hotspots", []):
            try:
                yaw = float(hotspot["yaw"])
                pitch = float(hotspot["pitch"])
            except (KeyError, TypeError, ValueError):
                continue
            clean_hotspots.append(
                {
                    "id": hotspot.get("id") or f"hotspot-{uuid.uuid4().hex}",
                    "label": hotspot.get("label", "Hotspot"),
                    "targetSceneId": hotspot.get("targetSceneId"),
                    "yaw": yaw,
                    "pitch": pitch,
                }
            )
        return {
            "id": scene.get("id"),
            "name": scene.get("name", "Escena"),
            "file": scene.get("file"),
            "hotspots": clean_hotspots,
        }

    def _json_error(self, message: str, status: HTTPStatus) -> None:
        self._send_json({"error": message}, status)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003 - overrides parent
        # Quieter logs for a cleaner console.
        return

    # --------------------------------- GET --------------------------------- #
    def do_GET(self) -> None:  # noqa: N802 - API from base class
        parsed = urlparse(self.path)
        parts = parsed.path.strip("/").split("/") if parsed.path else []

        if parts[:2] == ["api", "tours"]:
            if len(parts) == 3 and parts[2]:
                slug = parts[2].lower()
                if not is_valid_slug(slug):
                    self._json_error("Carpeta del tour inválida", HTTPStatus.BAD_REQUEST)
                    return
                tour_data = self._load_tour(slug)
                if not tour_data:
                    self._json_error("Tour no encontrado", HTTPStatus.NOT_FOUND)
                    return
                response = self._format_tour_response(slug, tour_data)
                response["folderPath"] = f"/{slug}"
                self._send_json(response)
                return
            self._json_error("Endpoint no encontrado", HTTPStatus.NOT_FOUND)
            return

        # Serve viewer when accessing /<slug> without extension
        if parsed.path not in ("", "/"):
            slug_candidate = parsed.path.strip("/")
            if slug_candidate and "." not in os.path.basename(slug_candidate):
                slug = slug_candidate.lower()
                if is_valid_slug(slug) and self._tour_exists(slug):
                    self.path = "/viewer.html"
        return super().do_GET()

    # --------------------------------- POST -------------------------------- #
    def do_POST(self) -> None:  # noqa: N802 - API from base class
        parsed = urlparse(self.path)
        parts = parsed.path.strip("/").split("/") if parsed.path else []

        if parts[:2] != ["api", "tours"]:
            self._json_error("Endpoint no encontrado", HTTPStatus.NOT_FOUND)
            return

        if len(parts) == 2:
            self._handle_create_tour()
            return

        if len(parts) >= 3:
            slug = parts[2].lower()
            if not is_valid_slug(slug):
                self._json_error("Carpeta del tour inválida", HTTPStatus.BAD_REQUEST)
                return

            if len(parts) == 4 and parts[3] == "upload":
                self._handle_scene_upload(slug)
                return
            if len(parts) == 4 and parts[3] == "save":
                self._handle_save_tour(slug)
                return

        self._json_error("Endpoint no encontrado", HTTPStatus.NOT_FOUND)

    # ------------------------------- handlers ------------------------------ #
    def _handle_create_tour(self) -> None:
        try:
            payload = self._read_json()
        except json.JSONDecodeError:
            return

        name = (payload.get("name") or "").strip()
        title = (payload.get("title") or "").strip()

        if not name:
            self._json_error("Debes indicar un nombre para la carpeta", HTTPStatus.BAD_REQUEST)
            return

        slug = slugify(name)
        if not slug or not is_valid_slug(slug):
            self._json_error(
                "El nombre solo puede contener letras, números y guiones",
                HTTPStatus.BAD_REQUEST,
            )
            return

        tour_dir = self._tour_dir(slug)
        os.makedirs(tour_dir, exist_ok=True)
        tour_data = self._load_tour(slug)
        if not tour_data:
            tour_data = {
                "slug": slug,
                "title": title or name,
                "initialSceneId": None,
                "scenes": [],
            }
        else:
            if title:
                tour_data["title"] = title

        self._save_tour(slug, tour_data)
        response = self._format_tour_response(slug, tour_data)
        response["folderPath"] = f"/{slug}"
        self._send_json(response, HTTPStatus.CREATED)

    def _handle_scene_upload(self, slug: str) -> None:
        tour_data = self._load_tour(slug)
        if not tour_data:
            self._json_error("Primero debes crear el tour", HTTPStatus.NOT_FOUND)
            return

        content_type = self.headers.get("Content-Type")
        if not content_type or not content_type.startswith("multipart/form-data"):
            self._json_error("Se esperaba un formulario de tipo multipart", HTTPStatus.BAD_REQUEST)
            return

        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": content_type,
            },
        )

        if "scene" not in form:
            self._json_error("Debes adjuntar una fotografía 360", HTTPStatus.BAD_REQUEST)
            return

        file_item = form["scene"]
        if not getattr(file_item, "filename", ""):
            self._json_error("Archivo de escena inválido", HTTPStatus.BAD_REQUEST)
            return

        raw_filename = os.path.basename(file_item.filename)
        _, ext = os.path.splitext(raw_filename)
        ext = ext.lower() or ".jpg"
        if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
            self._json_error("Formato no soportado. Usa JPG, PNG o WEBP", HTTPStatus.BAD_REQUEST)
            return

        scene_name = (form.getfirst("sceneName") or os.path.splitext(raw_filename)[0] or "Escena").strip()
        if not scene_name:
            scene_name = "Escena"

        scene_id = f"scene-{uuid.uuid4().hex}"
        filename = f"{scene_id}{ext}"
        tour_dir = self._tour_dir(slug)
        os.makedirs(tour_dir, exist_ok=True)
        file_path = os.path.join(tour_dir, filename)

        with open(file_path, "wb") as output:
            shutil.copyfileobj(file_item.file, output)

        new_scene = {
            "id": scene_id,
            "name": scene_name,
            "file": filename,
            "hotspots": [],
        }
        tour_data.setdefault("scenes", []).append(new_scene)
        if not tour_data.get("initialSceneId"):
            tour_data["initialSceneId"] = scene_id

        self._save_tour(slug, tour_data)

        response_scene = dict(new_scene)
        response_scene["url"] = f"/tours/{slug}/{filename}"
        response = {
            "scene": response_scene,
            "tour": {
                "initialSceneId": tour_data.get("initialSceneId"),
            },
        }
        self._send_json(response, HTTPStatus.CREATED)

    def _handle_save_tour(self, slug: str) -> None:
        tour_data = self._load_tour(slug)
        if not tour_data:
            self._json_error("Tour no encontrado", HTTPStatus.NOT_FOUND)
            return

        try:
            payload = self._read_json()
        except json.JSONDecodeError:
            return

        scenes_payload = payload.get("scenes", [])
        cleaned_scenes = []
        for scene in scenes_payload:
            cleaned = self._clean_scene(scene)
            if not cleaned.get("id") or not cleaned.get("file"):
                continue
            if not cleaned.get("name"):
                cleaned["name"] = "Escena"
            cleaned_scenes.append(cleaned)

        tour_data["scenes"] = cleaned_scenes

        title = (payload.get("title") or "").strip()
        if title:
            tour_data["title"] = title

        initial_scene = payload.get("initialSceneId")
        if initial_scene and any(scene["id"] == initial_scene for scene in cleaned_scenes):
            tour_data["initialSceneId"] = initial_scene
        elif cleaned_scenes:
            tour_data["initialSceneId"] = cleaned_scenes[0]["id"]
        else:
            tour_data["initialSceneId"] = None

        self._save_tour(slug, tour_data)
        response = self._format_tour_response(slug, tour_data)
        response["folderPath"] = f"/{slug}"
        self._send_json(response)


def run() -> None:
    ensure_directories()
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), TourRequestHandler)
    print(f"\nTour 360 server disponible en http://localhost:{port}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido")
    finally:
        server.server_close()


if __name__ == "__main__":
    run()
