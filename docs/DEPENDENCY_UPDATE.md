# Actualización de dependencias

Fecha: 2026-09-13

## Alcance

Se actualizaron dependencias de producción dentro de sus ramas mayores:

- Frontend: `axios`, `dompurify`, `js-yaml` y `react-router-dom`.
- Backend: `compression`, `express-rate-limit`, `jspdf`, `morgan` y `zod`.

También se fijaron versiones parcheadas de dependencias transitivas relacionadas con Monaco, Socket.IO, Engine.IO, `ws`, `body-parser`, `fflate`, `path-to-regexp`, `picomatch` y `qs`.

## Docker

- El backend instala la imagen de producción con `npm ci --omit=dev`.
- El frontend compila las dependencias en `dist` y la imagen final solo sirve ese contenido con nginx.
- Las vulnerabilidades de las imágenes base deben revisarse con un escáner de imágenes independiente de `npm audit`.

## Validación

- `npm ci` correcto en frontend y backend.
- `npm audit --omit=dev`: 0 vulnerabilidades en ambos paquetes.
- TypeScript y builds Docker correctos.
- Tests frontend correctos.

No se modificó lógica de aplicación en esta actualización.
