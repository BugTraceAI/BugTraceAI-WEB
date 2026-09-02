# Registro preliminar de evidencia de terceros — BugTraceAI-WEB

> **Fecha de corte:** 2026-09-02
> **Estado:** **CANDIDATO / PENDIENTE DE CIERRE**. Este registro acompaña al
> candidato local y no autoriza por sí solo una publicación. Las versiones,
> hashes y SBOM de los artefactos finales deben verificarse antes del GO.

## 1. Veredicto y alcance real

El inventario anterior era una semilla útil de dependencias directas, pero omitía la unidad `api-routes-mcp`, que forma parte de la funcionalidad core: Compose la arranca siempre y Nginx expone sus rutas. Por tanto, no es correcto describir WEB sólo como frontend, backend y cuatro imágenes genéricas.

El registro actual no procede de un commit candidato ni de imágenes finales. No existen SBOMs de release por imagen, ni hashes/digests, ni un grafo completo de dependencias. El SBOM manual actual contiene 30 componentes, frente a 556 entradas bloqueadas en frontend y 321 en backend (contando el lockfile sin la raíz); incluye directas pero omite gran parte de transitivas, `api-routes`, paquetes OS, binarios, datos y activos.

El worktree WEB local contiene cambios no congelados. Todas las cifras de este registro se refieren a la referencia indicada, no a un árbol de trabajo ni a un candidato futuro.

## 2. Unidades de distribución que deben separarse

| Unidad posible | Contenido relevante | Registro final requerido |
|---|---|---|
| Árbol fuente WEB | Frontend, backend, `api-routes-mcp`, assets/datos | SBOM fuente resuelto y ledger de activos. |
| Imagen frontend | Node de build, `dist`, Nginx | SBOM OCI por digest/plataforma. |
| Imagen backend | Node/Alpine, npm, APK, Prisma y binarios generados | SBOM OCI por digest/plataforma. |
| Imagen API routes | Debian, Python, Kiterunner, ffuf, wordlists | SBOM OCI propio y decisión AGPL explícita. |
| Servicios Compose externos | Postgres, Kali y contextos fuera de WEB | Clasificar: dependencia externa, imagen redistribuida o excluir del compose público. |

## 3. Dependencias directas resueltas por lockfile

Estas versiones son las directas verificables en los lockfiles de la referencia auditada. Una licencia definitiva sigue requiriendo revisar el tarball o la distribución exacta y los textos que la acompañan.

### Frontend (12 directas; 556 entradas de lockfile, 188 de producción)

| Paquete | Versión resuelta | Estado de licencia/aviso |
|---|---:|---|
| `@monaco-editor/react` | 4.7.0 | Verificar tarball exacto |
| `axios` | 1.13.3 | Verificar tarball exacto |
| `dompurify` | 3.3.1 | Expresión Apache-2.0 OR MPL-2.0; elegir/documentar opción aplicable |
| `js-yaml` | 4.1.1 | Verificar tarball exacto |
| `jszip` | 3.10.1 | Documentar opción MIT si es la elegida; no declarar sólo GPL |
| `marked` | 12.0.2 | Verificar tarball exacto |
| `react` | 18.3.1 | Verificar tarball exacto |
| `react-dom` | 18.3.1 | Verificar tarball exacto |
| `react-markdown` | 10.1.0 | Verificar tarball exacto |
| `react-router-dom` | 7.13.0 | Verificar tarball exacto |
| `recharts` | 3.7.0 | Verificar tarball exacto |
| `socket.io-client` | 4.8.3 | Verificar tarball exacto |

### Backend (14 directas; 321 entradas de lockfile, 151 de producción)

| Paquete | Versión resuelta | Estado de licencia/aviso |
|---|---:|---|
| `@prisma/client` | 5.22.0 | Verificar tarball/binarios generados |
| `chokidar` | 3.6.0 | Verificar tarball exacto |
| `compression` | 1.8.1 | Verificar tarball exacto |
| `cors` | 2.8.6 | Verificar tarball exacto |
| `dotenv` | 17.2.3 | Verificar tarball exacto |
| `express` | 5.2.1 | Verificar tarball exacto |
| `express-rate-limit` | 8.2.1 | Verificar tarball exacto |
| `helmet` | 8.1.0 | Verificar tarball exacto |
| `ini` | 4.1.3 | Metadato observado: ISC; verificar texto exacto |
| `jspdf` | 4.0.0 | Verificar tarball exacto |
| `jspdf-autotable` | 5.0.7 | Verificar tarball exacto |
| `morgan` | 1.10.1 | Verificar tarball exacto |
| `socket.io` | 4.8.3 | Verificar tarball exacto |
| `zod` | 4.3.6 | Verificar tarball exacto |

Las dependencias de desarrollo no son automáticamente irrelevantes: el backend genera Prisma durante build/arranque mediante `npx prisma@5`, aunque `prisma` figura como dependencia de desarrollo. El inventario final debe distinguir “build”, “runtime” y “no distribuido”, no omitir una dependencia sólo por su sección de manifiesto.

## 4. Contenedores, binarios y datos omitidos en el borrador anterior

| Área | Componentes observados | Hecho que falta cerrar |
|---|---|---|
| Frontend | `node:20-alpine` de build y `nginx:alpine` runtime | Fijar digest/plataforma y generar SBOM de filesystem final. |
| Backend | `node:20-alpine`, APK `openssl`, `wget`, Docker CLI, `curl`, npm/Prisma | Tags/múltiples capas; resolver todo lo que se instala o descarga con `npx`. |
| API routes | `debian:bookworm-slim`, APT, Python/PyPI, Kiterunner 1.0.2, ffuf 2.1.0 | Generar lock Python/hashes, digests y textos de licencia. |
| Wordlists API routes | Assetnote sin versión/hash; tres ficheros SecLists desde `master` | Fijar release/commit/checksum o excluir. |
| Compose | `postgres:16-alpine`, Kali opcional y perfiles de imágenes MCP externas | No se construyen desde rutas fuera del repositorio; fijar imagen/digest o documentar el prerequisito antes de activar cada perfil. |
| Fuente remota | Google Fonts / Inter | Inventariar servicio o autoalojar con licencia/versión. |
| Datos/activos | `payloads/xsspayloads.txt`, `logo.png` | Procedencia, licencia y decisión de inclusión. |

No es correcto adjudicar una única licencia a Alpine, Debian, una imagen OCI o Chromium/Node por su nombre. La unidad relevante es el contenido exacto del artefacto por digest y plataforma.

## 5. Kiterunner: decisión obligatoria por artefacto

`api-routes-mcp` descarga y ejecuta Kiterunner (`kr`) como subproceso y lo incluye en la imagen de API routes. La versión observada, Kiterunner 1.0.2, se ofrece upstream bajo AGPL-3.0. Ejecutarlo como proceso separado es relevante al analizar la arquitectura, pero no elimina las obligaciones de distribuir una imagen que contiene ese binario y sus materiales asociados.

No se concluye aquí que Apache-2.0 sea imposible para el código propio de WEB. Sí hay un **NO-GO** para afirmar que toda imagen WEB es Apache o para distribuir la imagen API routes sin una decisión documentada. Antes del release hay que elegir y revisar una de estas rutas:

1. Excluir `api-routes-mcp` de esta distribución.
2. Distribuirlo como componente/artifacto separado, con AGPL-3.0, fuente y avisos/obligaciones correspondientes.
3. Obtener una revisión jurídica de la separación de procesos y documentar el cumplimiento por artefacto, sin ocultar Kiterunner en un aviso general.

## 6. Correcciones verificadas frente al borrador anterior

- `js-yaml` se resuelve a 4.1.1, no a la especificación `^4.1.0`.
- El metadato observado de `ini@4.1.3` es ISC, no BSD-3-Clause.
- DOMPurify debe conservar una expresión de licencia completa; JSZip permite una opción MIT que debe seleccionarse/documentarse si se utiliza.
- No hay evidencia de llamadas directas a Google Gemini ni OpenAI desde WEB; sí se observan OpenRouter, Anthropic y Z.ai. Los proveedores de OpenRouter no deben describirse como APIs directas de WEB.
- No se encontró un favicon rastreable en la referencia; no afirmar que es un activo propio.
- `theme.css` no es un tercero y no debe aparecer como tal.
- `payloads/xsspayloads.txt` se usa en runtime y carece de cabecera de origen o licencia demostrada.
- Las afirmaciones “standard npm compatibility”, “legal team” o “cada capa comprobada” no están sustentadas y no se usarán en un aviso final.

## 7. Requisitos para cerrar el gate de terceros

Para cada source tree y cada imagen que se distribuya, el expediente debe contener componentes directos y transitivos, relaciones, hashes, versiones o commits, PURLs, textos de licencia/NOTICE requeridos, proveedor/origen, modo de distribución, plataforma, digest OCI, análisis de obligaciones y una decisión de cumplimiento. Los resultados deben derivarse del candidato y del artefacto final, no de rangos, tags mutables o el worktree.

La estructura final mínima sería:

```text
THIRD_PARTY_NOTICES.md
LICENSES/
sbom/source-web.cdx.json
sbom/image-frontend-<digest>.cdx.json
sbom/image-backend-<digest>.cdx.json
sbom/image-api-routes-<digest>.cdx.json
EXTERNAL_COMPONENTS.md
```

Hasta alcanzar esos requisitos, este archivo prueba que la revisión sigue en **NO-GO** para el inventario de terceros. No cambia por sí mismo la decisión de licenciar bajo Apache-2.0 el material propio que los titulares autoricen.
