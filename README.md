# Tour360 Studio

Plataforma minimalista en tonos oscuros que permite crear y compartir tours 360°. Los usuarios pueden subir panorámicas, previsualizarlas, generar hotspots interactivos y guardar el resultado dentro de una carpeta accesible desde `dominio/carpeta`.

## Características

- **Creación de proyectos** con un nombre de carpeta que define la URL pública.
- **Carga de fotografías 360°** (JPG, PNG o WEBP) con administración de escenas.
- **Visualizador interactivo** basado en Photo Sphere Viewer.
- **Hotspots enlazados** entre escenas para recorrer el espacio.
- **Publicación automática** del tour en `/<carpeta>` para visitantes.

## Requisitos

- Python 3.9 o superior.
- Acceso a Internet para cargar los assets CDN (Photo Sphere Viewer y fuentes).

## Ejecutar el servidor

```bash
python3 server.py
```

El servidor se iniciará en `http://localhost:8000`. La interfaz de edición está disponible en la raíz (`/`).

## Flujo de trabajo

1. En la página principal introduce el nombre de la carpeta (solo letras, números y guiones) y un título opcional.
2. Sube tus panorámicas 360°; cada escena se puede abrir y visualizar inmediatamente.
3. Selecciona una escena, pulsa **Añadir hotspot** y haz clic sobre la vista para ubicarlo. Define la etiqueta y la escena destino.
4. Marca la escena inicial del tour y guarda los cambios.
5. Comparte el enlace generado (`http://localhost:8000/tu-carpeta`) para que otros recorran el tour.

## Estructura

- `server.py`: servidor HTTP con API para tours y contenido estático.
- `public/index.html`: interfaz de edición de tours.
- `public/viewer.html`: visor público para los tours guardados.
- `public/js`: lógica de la app (constructor y visor).
- `public/styles.css`: estilos oscuros de inspiración futurista.

Los tours se almacenan en `public/tours/<carpeta>` junto con un archivo `tour.json` que describe escenas y hotspots.

## Notas

- Las imágenes 360° deben estar en formato equirectangular para una visualización correcta.
- Los hotspots pueden apuntar a cualquier escena existente, incluida la actual.
- El proyecto no requiere dependencias externas más allá de la biblioteca estándar de Python.
