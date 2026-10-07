# AI Dev Studio

Aplicación web local para trabajar con cinco agentes especializados de Codex usando una cuenta ChatGPT elegible, incluida Plus o Go. La especificación funcional está en [doc.md](doc.md) y los diseños de referencia en [bocetos](bocetos/).

## Requisitos

- Windows 10 u 11 y PowerShell.
- Node.js 24 o posterior.
- Codex CLI instalado y disponible como `codex` en `PATH`.
- Una cuenta ChatGPT con permiso para autorizar el uso de su plan en la aplicación.

La integración está validada con `codex-cli 0.162.0-alpha.2` (versión instalada en el entorno actual). El backend comprueba esa versión exacta y no inicia App Server si encuentra otra; actualizar Codex requiere validar y cambiar primero la versión fijada.

Comprueba `node --version`, `npm --version` y `codex --version`.

## Iniciar

```powershell
.\start.ps1
```

El script instala dependencias si faltan, genera la interfaz y ejecuta el servidor local en <http://127.0.0.1:1455>. El callback OAuth usa el mismo puerto y el servidor escucha sólo en `127.0.0.1`.

Para trabajar en modo desarrollo con recarga de Vite:

```powershell
npm install
npm run dev
```

Abre <http://127.0.0.1:5173>. El backend continúa en el puerto 1455.

Conecta ChatGPT desde la cabecera. Luego registra una carpeta de proyecto que ya exista, actívala y selecciona manualmente el agente que recibirá el chat. La app no crea la carpeta del proyecto ni archivos iniciales.

## Datos locales y autenticación

La base persistente está en `.local/ai-dev-studio.sqlite`. Las credenciales OAuth se conservan cifradas con DPAPI de Windows en `.local/credentials.dpapi`; sólo puede descifrarlas el mismo usuario de Windows. Los datos de `.local/` están excluidos del repositorio.

La app usa Codex App Server y el flujo Sign in with ChatGPT; no requiere ni guarda `OPENAI_API_KEY`. La instancia de App Server recibe el token de acceso mediante `ACCESS_TOKEN`. Los modelos se consultan con la cuenta conectada; que aparezcan en el catálogo no garantiza que una ejecución concreta esté disponible para la cuenta.

## Estado de esta implementación

La base funcional implementa selección y ocultamiento de proyectos, activación manual de agentes, historial persistente por proyecto, threads independientes por agente, streaming, cancelación, tareas, bugs, configuración básica, catálogo SQL autorizado, búsqueda oficial opcional y operaciones de archivos validadas en backend.

Las herramientas personalizadas de archivos y SQLite validan los permisos actuales antes de cada operación. Las herramientas nativas de comandos de Codex están desactivadas y el sandbox queda en solo lectura para impedir que se evadan esas comprobaciones. La ejecución de comandos con allowlist y los adjuntos requieren integración adicional antes de considerar completa toda la matriz de permisos de `doc.md`.

Las funciones de App Server y herramientas dinámicas son experimentales y pueden cambiar con la versión de Codex CLI instalada. Para actualizar, primero revisar el protocolo y validar las herramientas de agentes antes de cambiar la versión.

## Referencias oficiales

- [Sign in with ChatGPT](https://developers.openai.com/siwc)
- [Uso del plan ChatGPT en apps open-source](https://developers.openai.com/siwc/token-sharing-open-source)
- [Codex App Server](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server)
- [Limitaciones del preview](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)
- [Búsqueda Web con Responses API](https://developers.openai.com/api/docs/guides/tools-web-search)
