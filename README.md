# Tour360 Studio

Plataforma minimalista en tonos oscuros que permite crear y compartir tours 360°. Los usuarios pueden subir panorámicas, previsualizarlas, generar hotspots interactivos y guardar el resultado dentro de una carpeta accesible desde `dominio/carpeta`.

## Características

- **Creación de proyectos** con un nombre de carpeta que define la URL pública.
- **Carga de fotografías 360°** (JPG, PNG o WEBP) con administración de escenas.
- **Visualizador interactivo** basado en Photo Sphere Viewer.
- **Hotspots enlazados** entre escenas para recorrer el espacio.
- **Publicación automática** del tour en `/<carpeta>` para visitantes.

## Requisitos

- PHP 8.1 o superior con extensiones estándar habilitadas (funciona en la mayoría de los hostings Plesk).
- Permisos de escritura sobre la carpeta donde se desplegará el proyecto (para crear directorios de tours y guardar imágenes).
- Acceso a Internet para cargar los assets CDN (Photo Sphere Viewer y fuentes).

## Ejecutar en local (opcional)

Puedes usar el servidor embebido de PHP para previsualizar la herramienta:

```bash
php -S 0.0.0.0:8000 -t public
```

Visita `http://localhost:8000` para abrir el constructor de tours.

## Despliegue en Plesk

1. Copia el contenido de la carpeta `public/` dentro del directorio `httpdocs` (o la raíz del dominio) mediante FTP o el gestor de archivos de Plesk.
2. Asegúrate de subir también el archivo oculto `.htaccess`; es el encargado de redirigir las rutas `/<carpeta>` hacia el visor PHP.
3. Comprueba que PHP está habilitado para el dominio y que `upload_max_filesize` / `post_max_size` soportan el tamaño de tus panorámicas.
4. Verifica que el usuario del hosting tenga permisos de escritura sobre `httpdocs/tours`, ya que ahí se guardarán las imágenes y el `tour.json` de cada proyecto.

Una vez desplegado, accede al dominio y crea un tour: cada carpeta quedará publicada automáticamente en `https://tudominio.com/<carpeta>`.

## Flujo de trabajo

1. En la página principal introduce el nombre de la carpeta (solo letras, números y guiones) y un título opcional.
2. Sube tus panorámicas 360°; cada escena se puede abrir y visualizar inmediatamente.
3. Selecciona una escena, pulsa **Añadir hotspot** y haz clic sobre la vista para ubicarlo. Define la etiqueta y la escena destino.
4. Marca la escena inicial del tour y guarda los cambios.
5. Comparte el enlace generado (`http://localhost:8000/tu-carpeta`) para que otros recorran el tour.

## Estructura

- `public/api/*.php`: endpoints PHP que gestionan la creación de carpetas, subida de escenas e información del tour.
- `public/index.html`: interfaz de edición de tours.
- `public/viewer.php`: visor público para los tours guardados.
- `public/js`: lógica de la app (constructor y visor).
- `public/styles.css`: estilos oscuros de inspiración futurista.

Los tours se almacenan en `public/tours/<carpeta>` junto con un archivo `tour.json` que describe escenas y hotspots.

## Notas

- Las imágenes 360° deben estar en formato equirectangular para una visualización correcta.
- Los hotspots pueden apuntar a cualquier escena existente, incluida la actual.
- El backend está construido en PHP puro, por lo que no requiere frameworks adicionales ni gestor de paquetes.
