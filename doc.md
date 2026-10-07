# AI Dev Studio — Especificación V1 FINAL

## Regla general

Esta especificación define el alcance cerrado de la V1. Codex debe implementar únicamente lo indicado aquí.

Si una decisión, campo, pantalla, automatización o comportamiento no está definido en este documento, **no debe inventarse ni agregarse**. Debe quedar fuera de V1 hasta que la especificación sea modificada por el usuario.

La aplicación es local para Windows. Usa **Codex App Server** con una cuenta **ChatGPT Plus o Go** del usuario mediante el flujo oficial de Sign in with ChatGPT. La comunicación Web → Backend → App Server → Codex fue validada mediante una PoC.

---

# 1. Alcance de V1

AI Dev Studio es una interfaz web local que permite al usuario trabajar manualmente con cinco agentes Codex especializados:

- Requirements
- Architect
- Designer
- Developer
- Tester

La pantalla presenta un único historial cronológico por proyecto con los mensajes del usuario y las respuestas de todos los agentes. Cada mensaje del usuario se envía únicamente al agente activo en el momento de enviarlo. Los otros agentes no reciben ese mensaje ni las respuestas de los demás.

Puede no haber un proyecto activo. En ese estado, no hay agente activo y el chat está deshabilitado hasta que el usuario seleccione un proyecto.

El usuario es la autoridad y el orquestador del sistema.

## Reglas generales

- Puede haber cero o un proyecto `ACTIVO` a la vez.
- Puede haber cero o un agente `ACTIVO` en la interfaz; solo hay uno cuando existe un proyecto activo.
- Activar un agente desactiva el anterior en la interfaz.
- Activar otro agente no detiene una ejecución que ya esté en curso.
- Cada combinación `project + agent` tiene un thread de Codex persistente.
- Threads de agentes diferentes pueden tener ejecuciones simultáneas.
- El usuario decide qué agente utilizar y qué tarea debe realizar.
- El usuario controla manualmente el inicio, parada, cierre, reapertura y estado de las tareas.
- El usuario decide cuándo una tarea pasa a pruebas.
- No existe orquestación automática entre agentes.
- No existe traspaso automático Developer → Tester.
- No existe debate autónomo entre agentes.
- No existe planificación autónoma del sistema.
- No existe ejecución autónoma de tareas no solicitadas por el usuario.
- No existe cambio automático del estado de una tarea por parte de Developer o Tester.
- No existe voz.
- No existe Git ni gestión automática de Git en V1.
- No existe más de un proyecto activo simultáneamente.
- No existe una pantalla independiente de gestión de tareas.
- No existe una pantalla independiente de gestión de bugs.

---

# 2. Arquitectura e integración con Codex

## Stack

- Frontend: React + Vite + Tailwind CSS.
- Backend: Node.js + Express.
- Base de datos: SQLite.
- IA: Codex App Server.
- Sistema operativo objetivo: Windows.

## Arquitectura

```text
Navegador
    ↓
Frontend
    ↓
Backend local
    ├── SQLite
    ├── archivos del proyecto
    └── Codex App Server
            ↓
        agentes Codex
```

El navegador no accede directamente a Windows, SQLite ni credenciales. El backend local realiza esas operaciones.

El backend debe permanecer independiente del navegador: cerrar la interfaz no debe finalizar intencionalmente una ejecución de Codex ya iniciada.

## ChatGPT Plus y Go

Usar exclusivamente el flujo oficial **Sign in with ChatGPT** y el acceso al plan ChatGPT autorizado para la aplicación.

- No usar `OPENAI_API_KEY`.
- No usar facturación independiente de la API.
- No usar scraping de ChatGPT.
- No usar cookies de la sesión web de ChatGPT.
- Los tokens no se envían al navegador.
- Los tokens no se guardan en logs.
- Los tokens no se incluyen en el código fuente.
- Los tokens no se exponen al modelo como datos de conversación.
- El OAuth access token se mantiene en el backend local y se entrega internamente al App Server según el flujo oficial.
- Implementar renovación de credenciales según el flujo oficial.
- V1 usa una sola cuenta ChatGPT conectada.

## App Server

La integración se realiza mediante el protocolo de Codex App Server.

Flujo mínimo:

```text
initialize
→ initialized
→ thread/start o thread/resume
→ turn/start
→ eventos de respuesta
→ turn/completed
```

El backend debe:

- conservar el `thread_id` por combinación `project + agent`;
- conservar el `turn_id` mientras exista una ejecución;
- mostrar streaming cuando lleguen eventos de mensaje del agente;
- tratar `turn/completed` con estado `completed` como ejecución exitosa;
- tratar estados como `failed` o `interrupted` como no exitosos;
- utilizar el mecanismo de interrupción soportado por la versión instalada;
- renovar credenciales según el flujo oficial;
- reanudar threads mediante el mecanismo oficial cuando corresponda.

La versión concreta de Codex utilizada para V1 debe quedar fijada y no actualizarse automáticamente.

## Modelos y catálogo de modelos

El selector de modelo de la aplicación **no debe estar hardcodeado**.

El backend consulta `GET https://api.openai.com/v1/models` con el OAuth access token autorizado para obtener el catálogo correspondiente a la cuenta conectada. `model/list` de Codex App Server puede devolver un catálogo local agrupado o en caché; no se utiliza por sí solo como catálogo de acceso específico de la cuenta. La aplicación puede usar `model/list` como fuente complementaria de capacidades por modelo, emparejando por el identificador exacto.

El catálogo se utiliza para poblar el selector. La disponibilidad efectiva de un modelo se confirma mediante una inferencia exitosa; la aplicación no debe asumir que la presencia en el catálogo equivale a autorización definitiva para una solicitud.

Para el modelo seleccionado:

- las opciones de `reasoning` deben corresponder a los esfuerzos soportados por ese modelo;
- las opciones de `service tier` deben corresponder a los niveles reportados para ese modelo/contexto;
- no se debe hardcodear `gpt-5-codex` como única opción;
- no se debe hardcodear `auto` como nivel de servicio.

## Parámetros de Codex usados por V1

La configuración de agentes puede utilizar las opciones que la versión instalada de Codex realmente soporte, entre ellas:

- modelo;
- reasoning/effort;
- service tier, cuando esté disponible;
- approval policy;
- sandbox;
- acceso de red;
- herramientas;
- raíces de escritura;
- instrucciones del agente;
- otras opciones oficialmente soportadas por la versión fijada.

No se incluyen en V1 controles de `temperature` ni `max output tokens`.

No existe un **directorio de trabajo global** en la configuración de Codex. El directorio de trabajo (`cwd`) de una ejecución se obtiene de la ruta del proyecto activo.

## Búsqueda en Internet y fuentes

Cuando el acceso a Internet esté habilitado para un agente, este debe poder buscar y consultar documentación oficial pertinente para fundamentar sus respuestas. Debe respetar los dominios permitidos configurados para ese agente.

Los agentes deben consultar fuentes oficiales y confiables cuando necesiten validar información técnica externa, respetando los dominios permitidos. Deben responder de forma breve y directa; no es necesario explicar de dónde obtuvieron cada dato ni incluir enlaces rutinariamente. Pueden proporcionar enlaces cuando el usuario los solicite o sean necesarios para resolver una discrepancia. No deben presentar una fuente de terceros como documentación oficial ni atribuir respaldo a información no verificada.

La búsqueda se realiza durante una ejecución iniciada por el usuario; no hay vigilancia continua de sitios Web ni ejecuciones automáticas.

## Uso y límites de ChatGPT

La interfaz puede mostrar información de uso/límites únicamente cuando esa información real esté disponible mediante la integración utilizada.

Si está disponible, mostrar los datos reales, por ejemplo:

```text
Usado: XX%
Restante: YY%
Próximo reset: fecha/hora
```

Si existen varias ventanas de uso, mostrarlas por separado.

Si un dato no está disponible, mostrar `No disponible`.

Nunca estimar consumo ni inventar porcentajes o fechas.

## Referencias oficiales para la implementación de Codex

La implementación debe verificarse contra la versión fijada de Codex y su protocolo oficial. Como referencias de base:

- Codex App Server con Sign in with ChatGPT: https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server
- Modelos y catálogo por cuenta: https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- Protocolo `model/list`: https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/protocol/v2/model.rs
- Protocolo App Server: https://github.com/openai/codex/tree/main/codex-rs/app-server-protocol

---

# 3. Agentes

La configuración de los cinco agentes es **global** y se almacena en SQLite. El contexto conversacional es por proyecto mediante el thread correspondiente.

## 3.1 Requirements

Responsabilidades:

- Define y mantiene `requirements.md`.
- Puede leer la información necesaria del proyecto y de la BD según sus permisos.
- Es el único agente autorizado para modificar `requirements.md`.
- No crea ni modifica tareas por iniciativa propia.
- No cambia estados de tareas automáticamente.

## 3.2 Architect

Responsabilidades:

- Define y mantiene `architecture.md`.
- Define en `architecture.md` el contrato funcional verificable de cada pantalla incluida: propósito, navegación, contenido, acciones, respuestas, validaciones, estados, adaptación a tamaños de pantalla, accesibilidad y ubicación de recursos.
- Distingue decisiones confirmadas, propuestas visuales y decisiones de producto pendientes. No delega decisiones de requisitos o arquitectura en Designer.
- Consulta requisitos, arquitectura, tareas y estado actual de la BD según sus permisos.
- Es el único agente autorizado para modificar `architecture.md`.
- Cuando el usuario se lo indique, analiza el proyecto y define las tareas necesarias para desarrollarlo.
- No crea directamente las tareas en SQLite.
- No asigna tareas.
- No inicia tareas.
- No cambia estados de tareas automáticamente.

La creación de las tareas en SQLite corresponde al Developer cuando el usuario se lo indica.

## 3.3 Designer

Responsabilidades:

- Consulta requisitos, arquitectura y tareas según sus permisos.
- Ejecuta el contrato de pantallas definido por Architect en `architecture.md`; no define requisitos, reglas de negocio ni arquitectura.
- Crea y mantiene entregables UX/UI dentro de `design/` según sus permisos.
- Crea `design/assets/images/` para guardar imágenes originales que genere y enlaza los recursos con rutas relativas.
- Presenta el diseño en el chat y solicita aprobación explícita del usuario antes de considerarlo listo para implementación.
- No modifica `requirements.md` ni `architecture.md`.
- No cambia estados de tareas automáticamente.

## 3.4 Developer

Responsabilidades:

- Consulta requisitos, arquitectura, tareas y bugs según sus permisos.
- Implementa frontend y backend.
- Crea tareas en SQLite cuando el usuario se lo indica, utilizando únicamente las sentencias SQL autorizadas.
- Puede editar tareas en SQLite según sus permisos y cuando el usuario se lo indique.
- Implementa las tareas que el usuario le asigna/inicia.
- Informa al usuario cuando considera que una tarea está lista para pruebas.
- No cambia automáticamente la tarea a `POR_PROBAR`.
- Puede crear, modificar y eliminar archivos dentro de la raíz del proyecto, excepto `requirements.md` y `architecture.md`, sujeto a los permisos configurados.
- Puede ejecutar comandos dentro de los permisos configurados.

## 3.5 Tester

Responsabilidades:

- Consulta requisitos, arquitectura, tareas y bugs según sus permisos.
- Valida funcionalidad y frontend.
- Puede ejecutar comandos y pruebas dentro de los permisos configurados.
- Puede crear, modificar y eliminar archivos dentro de `tests/`, sujeto a los permisos configurados.
- `tests/` no tiene que existir al registrar el proyecto. Si necesita guardar pruebas, Tester puede crearla escribiendo un archivo bajo esa ruta mediante la herramienta controlada del backend; este crea las carpetas padre faltantes.
- Puede crear y editar bugs en SQLite mediante las sentencias SQL autorizadas.
- No cambia automáticamente el estado de una tarea ni de un bug.
- Informa al usuario del resultado de las pruebas.

## 3.6 Regla de contexto

La interfaz muestra un único historial cronológico por proyecto, que incluye los mensajes del usuario y las respuestas de todos los agentes. El historial compartido es una presentación de la conversación; no es un contexto compartido de Codex.

Cada agente conserva su contexto mediante su propio thread por proyecto. Cada mensaje del usuario se envía solo al agente activo y a su thread. Los agentes no reciben los mensajes dirigidos a otros agentes ni las respuestas de estos. Al recibir un mensaje, el agente consulta el estado actualizado de SQLite y los archivos MD necesarios para responder, siempre dentro de sus permisos. No hay vigilancia continua ni acciones autónomas ante cambios en BD o archivos.

---

# 4. Configuración de agentes y permisos

## 4.1 Configuración del agente

Como mínimo, la configuración global de cada agente contempla:

- id;
- nombre;
- rol;
- descripción;
- instrucciones;
- modelo;
- reasoning/effort, si el modelo lo soporta;
- service tier, si está disponible para el modelo/cuenta;
- approval policy;
- sandbox;
- acceso de red;
- raíces de escritura;
- herramientas habilitadas;
- opciones adicionales soportadas por la versión instalada de Codex;
- habilitado/deshabilitado.

Las instrucciones y descripciones de cada agente son globales. Sus permisos de red controlan también si puede buscar documentación oficial en Internet.

Los valores deben ser compatibles con el modelo y versión de Codex seleccionados.

### Estado del agente

Hay dos conceptos diferentes y no deben confundirse:

- `habilitado/deshabilitado`: configuración del agente.
- `ACTIVO/INACTIVO`: estado de uso en la interfaz.

Solo puede existir un agente `ACTIVO` para el chat.

Activar un agente desactiva el anterior en la interfaz, pero no detiene una ejecución que ya esté en curso.

## 4.2 Permisos de proyectos/archivos, comandos, red, sandbox y herramientas

Los permisos son parametrizables por agente y se almacenan en SQLite.

La sección **Permisos Agentes** administra, como mínimo:

### Sistema de archivos

- leer;
- escribir;
- eliminar;
- raíces/rutas permitidas.

### Comandos

- ejecutar comandos;
- comandos restringidos;
- allowlist de comandos.

### Red

- acceso a Internet;
- dominios permitidos;
- búsqueda y consulta de documentación oficial durante las ejecuciones del agente cuando el acceso a Internet esté habilitado.

### Sandbox

- uso de sandbox;
- acceso al host, cuando la versión/configuración de Codex lo soporte.

### Herramientas

- terminal;
- diffs;
- búsqueda en proyecto;
- otras herramientas soportadas y explícitamente habilitadas.

La aplicación debe aplicar estos permisos por operación.

## 4.3 Permisos de base de datos SQL

Los agentes pueden trabajar con SQLite mediante SQL, pero **no pueden ejecutar SQL arbitrario**.

Solo pueden ejecutar sentencias SQL que estén registradas, habilitadas y autorizadas para ellos.

Cada sentencia SQL parametrizada debe tener como mínimo:

- id;
- nombre;
- descripción;
- sentencia SQL;
- tipo de operación;
- enabled.

La relación entre agentes y sentencias SQL debe indicar qué agente puede ejecutar cada sentencia.

Las sentencias deben utilizar parámetros (`?` o el mecanismo equivalente soportado por SQLite). No se permite construir SQL mediante concatenación de valores proporcionados por el agente.

Flujo obligatorio:

```text
Agente
  ↓
solicita sentencia SQL registrada + parámetros
  ↓
Backend valida existencia + enabled + permiso del agente
  ↓
Backend ejecuta sentencia parametrizada
  ↓
SQLite
  ↓
resultado al agente
```

El agente no puede:

- crear una sentencia SQL nueva;
- modificar una sentencia SQL registrada;
- ejecutar una sentencia no registrada;
- ejecutar una sentencia deshabilitada;
- ejecutar una sentencia no autorizada para él.

## 4.4 Configuración SQL inicial por agente

| Agente | SQL inicial autorizado | Escritura de archivos inicial |
|---|---|---|
| Requirements | `consultar_proyecto` | `requirements.md` |
| Architect | `consultar_proyecto`, `consultar_tareas`, `consultar_tarea` | `architecture.md` |
| Designer | `consultar_proyecto`, `consultar_tareas`, `consultar_tarea` | `design/` |
| Developer | `consultar_proyecto`, `consultar_tareas`, `consultar_tarea`, `consultar_bugs`, `crear_tarea`, `editar_tarea`, `obtener_resumen` | raíz del proyecto, excepto `requirements.md` y `architecture.md` |
| Tester | `consultar_proyecto`, `consultar_tareas`, `consultar_tarea`, `consultar_bugs`, `crear_bug`, `editar_bug`, `obtener_resumen` | `tests/` |

Requirements, Architect y Designer tienen acceso SQL de solo lectura. Developer puede crear tareas sin asignación y editar su título y descripción; no puede asignar tareas ni cambiar sus estados por SQL. Tester puede registrar y editar la descripción de bugs reproducibles; no puede cambiar su severidad ni estado por SQL. El usuario conserva el control de asignaciones y estados desde la interfaz. Estos son los permisos iniciales; el usuario puede modificarlos individualmente en **Configuración → Permisos Agentes**.

Los permisos son modificables desde **Configuración → Permisos Agentes**.

El catálogo de sentencias SQL se administra directamente en SQLite. El usuario agrega nuevas definiciones mediante sentencias `INSERT`; la interfaz no crea ni edita definiciones del catálogo. En **Permisos Agentes**, el usuario configura individualmente qué sentencias registradas puede ejecutar cada agente. La definición debe estar habilitada globalmente y autorizada para el agente antes de ejecutarse.

## 4.5 Sentencias SQL iniciales

Como mínimo deben poder registrarse/configurarse las siguientes sentencias:

```text
consultar_proyecto
consultar_tareas
consultar_tarea
crear_tarea
editar_tarea
consultar_bugs
crear_bug
editar_bug
obtener_resumen
```

Todas las sentencias disponibles deben estar registradas antes de poder ejecutarse.

El catálogo inicial y las sentencias adicionales se agregan directamente a SQLite mediante `INSERT`. V1 no incluye una pantalla para crear, editar o eliminar definiciones del catálogo. El usuario tiene control total sobre los permisos individuales de los agentes.

---

# 5. Proyectos y archivos

## 5.1 Creación de la carpeta

El usuario crea manualmente en Windows la carpeta raíz del proyecto.

AI Dev Studio no crea por iniciativa propia la carpeta raíz del proyecto.

Desde AI Dev Studio el usuario registra esa carpeta existente.

La selección de la carpeta la resuelve el backend local; el navegador no accede directamente al sistema de archivos.

Registrar un proyecto no crea archivos ni carpetas dentro de la ruta. Los agentes crean los archivos que les corresponden cuando el usuario se lo solicita y sus permisos lo permiten.

## 5.2 Atributos del proyecto

Los atributos funcionales del proyecto en V1 son únicamente:

- `id`;
- `nombre`;
- `descripción`;
- `ruta local`;
- `estado`;
- `created_at`;
- `updated_at`.

El proyecto **no** tiene configuración propia de:

- modelo;
- reasoning;
- service tier;
- approval policy;
- agentes permitidos;
- notas;
- directorio de trabajo independiente.

Esas configuraciones son globales de los agentes o se derivan del proyecto activo cuando corresponda.

La visibilidad en la aplicación es un dato técnico de persistencia, separado de los atributos funcionales anteriores. La acción `Eliminar` quita el proyecto de la aplicación mediante ocultamiento; no borra la carpeta ni su contenido físico, ni elimina sus tareas, bugs, threads, ejecuciones o mensajes guardados. Un proyecto oculto no puede activarse desde la aplicación.

## 5.3 Estados del proyecto

```text
NUEVO
ACTIVO
PAUSADO
FINALIZADO
```

Reglas:

- Solo puede haber cero o un proyecto `ACTIVO`.
- `NUEVO` y `PAUSADO` pueden pasar a `ACTIVO` mediante una acción explícita del usuario.
- Al activar otro proyecto, el proyecto actualmente `ACTIVO` pasa a `PAUSADO`.
- `FINALIZADO` no puede ser activado en V1.
- V1 no define un flujo automático de finalización ni una acción independiente para finalizar un proyecto.
- El sistema nunca cambia automáticamente un proyecto a `FINALIZADO`.

## 5.4 Cambio de proyecto desde la pantalla principal

El botón `Cambiar de proyecto` de la pantalla principal abre un pequeño diálogo, no una navegación obligatoria a otra pantalla.

El diálogo contiene:

- un combo box con los proyectos que pueden ser activados;
- `Guardar`;
- `Cancelar`.

El proyecto actualmente activo se identifica como tal y no debe permitir una operación de cambio hacia sí mismo.

Cuando el usuario selecciona otro proyecto y pulsa `Guardar`, la aplicación muestra una segunda confirmación de advertencia.

Si hay un proyecto activo, la confirmación informa que este pasará a `PAUSADO` y que el seleccionado pasará a `ACTIVO`. Si no hay proyecto activo, informa que el proyecto seleccionado pasará a `ACTIVO`; no se muestra un proyecto anterior para pausar.

Después de activar un proyecto desde este estado, ningún agente se activa automáticamente. El usuario selecciona manualmente el agente que recibirá el chat.

Acciones:

- `Cancelar`;
- `Sí, activar`.

Solo después de `Sí, activar` se realiza el cambio.

## 5.5 Configuración → Proyectos

La vista de Proyectos debe permitir únicamente las funciones definidas para V1:

- listar proyectos;
- buscar proyectos;
- crear proyecto;
- editar proyecto;
- eliminar proyecto;
- visualizar estado;
- activar/cambiar proyecto mediante el flujo definido.

`Eliminar` aplica el ocultamiento descrito en la sección 5.2. El proyecto deja de aparecer en la aplicación y sus datos se conservan.

Si se elimina el proyecto activo:

- su estado pasa a `PAUSADO` y su visibilidad se desactiva;
- no se selecciona otro proyecto automáticamente;
- el proyecto activo global y el agente activo global quedan sin valor;
- el chat y sus controles de envío y adjuntos quedan deshabilitados;
- se muestra `Seleccione un proyecto para desarrollar` y la acción `Cambiar de proyecto`;
- la navegación a `Configuración` permanece disponible;
- la carpeta, sus archivos, los datos operativos y los threads se conservan.

No agregar en esta vista configuración de modelo, agentes, service tier, approval policy ni otras opciones no definidas.

## 5.6 Formulario Nuevo proyecto

El formulario de creación contiene únicamente:

- `Nombre`;
- `Descripción`;
- `Ruta local`.

Acciones:

- `Cancelar`;
- `Crear proyecto`.

No contiene configuración de agentes ni configuración de Codex.

## 5.7 Estructura esperada del proyecto

```text
Proyecto/
├── requirements.md
├── architecture.md
├── design/
│   └── assets/images/   (Designer la crea si necesita guardar imágenes)
├── tests/
└── src/
```

No existe `progress.md`.

No se crean otros MD de control de tareas, estados o protocolos.

Esta estructura es la organización esperada, no una plantilla que AI Dev Studio genere al registrar el proyecto. Los agentes crean los archivos o directorios autorizados que necesiten durante el trabajo solicitado.

## 5.8 Reglas de escritura

- `requirements.md`: solo Requirements.
- `architecture.md`: solo Architect.
- `design/`: Designer, según permisos; incluye `design/assets/images/` para imágenes originales generadas por Designer cuando correspondan.
- `tests/`: Tester, según permisos.
- resto del proyecto: Developer, según permisos configurados.

Los agentes pueden leer los archivos necesarios según sus permisos.

Codex se ejecuta con sandbox de solo lectura. Las escrituras y eliminaciones de archivos pasan exclusivamente por las herramientas controladas del backend, que valida agente, permisos, ruta autorizada y aprobación del usuario. La escritura mediante backend crea automáticamente los directorios padre faltantes.

El backend proporciona a los agentes una herramienta para listar las entradas inmediatas de una carpeta del proyecto, respetando el permiso de lectura y la raíz del proyecto. Para consultas registradas que incluyan `:project_id`, el backend enlaza siempre el ID del proyecto activo; el agente no lo elige ni puede consultar proyectos distintos.

---

# 6. Base de datos y datos operativos

SQLite es la **única fuente de verdad** para los datos operativos de AI Dev Studio.

No se duplican tareas, estados ni bugs en archivos MD.

## 6.1 Tablas principales

```text
projects
agents
agent_permissions
sql_statements
agent_sql_permissions
agent_threads
executions
tasks
bugs
app_state
chat_messages
```

`agent_permissions` representa los permisos generales del agente.

`sql_statements` contiene las sentencias SQL parametrizadas disponibles.

`agent_sql_permissions` relaciona agentes con las sentencias SQL que pueden ejecutar.

## 6.2 Projects

Campos mínimos:

```text
id
name
description
path
status
created_at
updated_at
is_visible
```

`status` utiliza los valores definidos en la sección 5.

`is_visible` es un indicador técnico con valor inicial verdadero, usado para ocultar proyectos desde la aplicación sin eliminar ni cambiar los demás datos del proyecto. Los proyectos ocultos se excluyen de las listas y selectores y no pueden activarse.

## 6.3 Estado global

`app_state` mantiene como mínimo:

- proyecto activo;
- agente activo.

Ambos valores pueden ser `NULL` cuando no hay proyecto activo.

`ACTIVO/INACTIVO` del agente es estado de uso de la interfaz, no configuración del agente.

## 6.4 Threads

Existe un thread de Codex por combinación:

```text
project + agent
```

El thread se conserva para continuar la conversación dirigida a ese agente en ese proyecto. Solo recibe los mensajes del usuario dirigidos a ese agente y sus propias respuestas.

No se crea un thread global de Codex ni se copian mensajes de un agente a los threads de otros agentes.

## 6.5 Historial visible del chat

`chat_messages` conserva el historial cronológico único que se muestra para cada proyecto. Incluye cada mensaje del usuario, asociado al agente activo al enviarlo, y cada respuesta del agente, asociada al agente que la produjo. El historial se recupera al volver a abrir la aplicación y no se usa para distribuir contexto entre threads.

Campos mínimos:

```text
id
project_id
agent_id
sender_type
content
created_at
```

El orden del historial debe ser estable. El cambio de agente no limpia ni separa visualmente el historial del proyecto.

## 6.6 Tareas

Campos mínimos:

- `id`;
- `project_id`;
- `parent_task_id`;
- `title`;
- `description`;
- `assigned_agent_id`;
- `status`;
- `created_at`;
- `updated_at`.

`parent_task_id` permite representar subtareas.

Una subtarea no crea dependencias automáticas de ejecución.

`assigned_agent_id` puede ser `NULL` mientras la tarea no haya sido asignada. El usuario es quien asigna el agente desde la interfaz.

Varias tareas pueden estar en ejecución simultáneamente.

## 6.7 Creación y edición de tareas

El Architect define las tareas necesarias a partir de requisitos y arquitectura.

El Developer crea las tareas en SQLite cuando el usuario se lo indica, utilizando `crear_tarea` y las sentencias autorizadas.

Las tareas creadas por Developer inician en `CREADA` y sin agente asignado. Developer sólo puede editar su título y descripción mediante SQL; el usuario asigna responsables y cambia estados desde la interfaz.

El Developer puede editar las tareas mediante `editar_tarea` cuando el usuario se lo indica.

El usuario puede revisar y modificar los datos de las tareas desde la interfaz, asignarlas y cambiar manualmente su estado.

El usuario también puede solicitar al Developer que cree o modifique tareas.

No existe un formulario independiente para la creación de tareas.

No existe una pantalla independiente de gestión de tareas.

## 6.8 Estados de tarea

```text
CREADA
EN_DESARROLLO
POR_PROBAR
EN_PRUEBA
VERIFICADA
BLOQUEADA
```

## 6.9 Acciones de tarea

`Iniciar`:

- `CREADA` → `EN_DESARROLLO`;
- `POR_PROBAR` → `EN_PRUEBA`.

`Iniciar` solo cambia el estado de la tarea en SQLite. No inicia ni envía una ejecución a Codex. El usuario solicita después al agente activo que trabaje en la tarea mediante el chat.

`Parar`:

- detiene la ejecución Codex actual;
- no modifica el estado de la tarea.

`Cerrar`:

- establece `VERIFICADA`.

`Reabrir`:

- establece `CREADA`.

El menú contextual permite al usuario seleccionar manualmente cualquiera de los seis estados definidos, independientemente de las transiciones de las acciones rápidas.

Las acciones rápidas no sustituyen el control manual del usuario.

El sistema no cambia automáticamente el estado de una tarea por acciones de Developer o Tester.

## 6.10 Flujo de tarea

```text
Requirements
    ↓
requirements.md

Architect
    ↓
architecture.md
    ↓
define las tareas necesarias

Developer
    ↓
crea las tareas en SQLite cuando el usuario se lo indica

Usuario
    ↓
revisa / modifica / asigna / inicia

Developer
    ↓
implementa

Developer informa que está lista para pruebas
    ↓
Usuario → POR_PROBAR

Usuario inicia prueba
    ↓
Tester → EN_PRUEBA

Tester encuentra problema
    ↓
Tester crea bug
    ↓
Usuario decide el estado del bug
```

## 6.11 Bugs

Campos mínimos:

- `id`;
- `project_id`;
- `task_id`;
- `title`;
- `description`;
- `severity`;
- `status`;
- `created_at`;
- `updated_at`.

En V1 todos los bugs se crean con severidad `MEDIA`.

No existe selección individual de severidad.

Estados:

```text
ABIERTO
EN_CORRECCION
CORREGIDO
VERIFICADO
```

El Tester puede crear y editar datos del bug según sus permisos y mediante SQL autorizado.

El usuario puede revisar, editar y cambiar manualmente el estado de los bugs desde la interfaz.

Tester no cambia automáticamente el estado de un bug.

No existe una pantalla independiente de gestión de bugs.

Los bugs se muestran en la pantalla principal junto con su información principal y estado.

---

# 7. Flujo de trabajo y ejecuciones

El flujo es manual y siempre parte de una acción del usuario.

El usuario:

1. selecciona un agente;
2. conversa con él;
3. consulta las tareas y bugs;
4. decide qué agente trabaja en cada tarea;
5. asigna tareas;
6. inicia tareas;
7. detiene ejecuciones cuando lo decide;
8. cambia estados;
9. decide cuándo una tarea pasa a pruebas;
10. revisa los bugs;
11. decide el cierre o reapertura de tareas y bugs.

Los agentes no realizan estos cambios automáticamente.

## 7.1 Ejecuciones

Cada ejecución registra como mínimo:

- `agent_id`;
- `project_id`;
- `thread_id`;
- `turn_id`;
- inicio;
- fin;
- estado.

Estados:

```text
EN_EJECUCION
COMPLETADA
INTERRUMPIDA
FALLIDA
```

Un mismo thread no puede tener dos ejecuciones activas simultáneamente.

Threads diferentes sí pueden ejecutarse simultáneamente.

## 7.2 Detener

`Detener` interrumpe la ejecución actual usando el mecanismo soportado por Codex App Server.

No cierra el thread.

No cambia automáticamente el estado de la tarea.

## 7.3 Aprobaciones

Si Codex solicita aprobación, el chat muestra una solicitud dentro de la conversación con:

```text
APROBAR
DENEGAR
```

La decisión siempre corresponde al usuario.

---

# 8. Interfaz

La pantalla principal ya está definida y **no debe ser rediseñada**.

Su estructura funcional es:

```text
┌──────────────┬──────────────────────────┬────────────────────┐
│   Agentes    │           Chat           │ Resumen + Tareas   │
│              │                          │ + Bugs             │
└──────────────┴──────────────────────────┴────────────────────┘
```

## 8.1 Barra superior

Debe mostrar:

- `AI Dev Studio`;
- indicador de conexión con Codex;
- botón `Configuración`.

No agregar acciones globales no definidas.

## 8.2 Panel izquierdo: Agentes

Mostrar los cinco agentes:

- Requirements;
- Architect;
- Designer;
- Developer;
- Tester.

Cada agente muestra estado visual:

```text
ACTIVO
INACTIVO
```

Solo puede haber un agente `ACTIVO` para el chat. Si no hay proyecto activo, todos los agentes aparecen `INACTIVO`; su configuración habilitado/deshabilitado no cambia.

Activar otro agente desactiva el anterior en la interfaz.

Activar otro agente no detiene ejecuciones existentes.

## 8.3 Panel izquierdo: Proyecto

Mostrar:

- nombre;
- ruta;
- descripción;
- botón `Cambiar de proyecto`.

No mostrar el estado del proyecto en este panel.

El botón `Cambiar de proyecto` abre el pequeño diálogo definido en la sección 5.4.

Cuando no hay proyecto activo, este panel muestra `Seleccione un proyecto para desarrollar` y ofrece la acción `Cambiar de proyecto`.

## 8.4 Chat central

Debe mostrar:

- mensajes del usuario;
- respuestas del agente;
- streaming;
- estado de ejecución;
- solicitudes de aprobación;
- enlaces a las fuentes oficiales consultadas por el agente;
- botón `Detener`;
- entrada para nuevo mensaje;
- archivos/adjuntos cuando correspondan a las capacidades soportadas.

No mostrar el botón `Limpiar chat` del boceto en V1.

El chat se dirige únicamente al agente activo. Cuando no hay proyecto activo, no se puede escribir ni enviar archivos o adjuntos.

Los mensajes y respuestas de todos los agentes aparecen en el mismo historial cronológico del proyecto. Cada nuevo mensaje del usuario se envía únicamente al agente activo; los demás agentes no reciben ese mensaje ni las respuestas de otros agentes. Al cambiar de agente no se limpia el historial visible.

## 8.5 Panel derecho: Resumen

### Tareas

Tarjetas:

- Total;
- Pendientes = `CREADA`;
- En desarrollo = `EN_DESARROLLO`;
- Completadas = `VERIFICADA`.

### Bugs

Tarjetas:

- Abiertos = `ABIERTO`;
- En corrección = `EN_CORRECCION`;
- Verificados = `VERIFICADO`.

Los estados que no tengan tarjeta propia se muestran en las listas correspondientes.

## 8.6 Panel derecho: Tareas

Mostrar todas las tareas del proyecto activo.

Cada tarea muestra como mínimo la información principal, jerarquía y estado.

Al pulsar el icono/selector de estado se abre un menú contextual para cambiar manualmente el estado.

El menú contiene los seis estados definidos:

```text
CREADA
EN_DESARROLLO
POR_PROBAR
EN_PRUEBA
VERIFICADA
BLOQUEADA
```

No existe un formulario separado para crear tareas.

## 8.7 Bugs en pantalla principal

Mostrar los bugs del proyecto activo con su información principal y estado.

El usuario puede revisar y gestionar sus datos desde la interfaz según los permisos definidos.

No crear una pantalla independiente de bugs.

---

# 9. Configuración

Al entrar en `Configuración`, la navegación de agentes/proyecto de la pantalla principal se reemplaza por la navegación específica de configuración.

La navegación es:

```text
Configuración
├── Proyectos
├── Agentes
├── Permisos Agentes
└── Codex
```

No se utilizan pestañas superiores para esta navegación.

## 9.1 Proyectos

La vista permite:

- listar proyectos;
- buscar proyectos;
- crear proyecto;
- editar proyecto;
- eliminar proyecto;
- visualizar estado;
- activar/cambiar proyecto mediante el flujo definido.

### Tabla/listado

Debe mostrar la información necesaria para identificar cada proyecto, incluyendo como mínimo:

- nombre;
- ruta;
- estado;
- acciones definidas.

No agregar configuraciones de agentes o Codex dentro de cada proyecto.

### Nuevo proyecto

Formulario:

- Nombre;
- Descripción;
- Ruta local.

Acciones:

- Cancelar;
- Crear proyecto.

## 9.2 Agentes

La vista de Agentes utiliza tarjetas horizontales para seleccionar el agente.

La página del agente seleccionado contiene:

### Información del agente

- id;
- nombre;
- rol;
- descripción;
- estado habilitado/deshabilitado;
- instrucciones del agente.

### Configuración del modelo

- Modelo;
- Reasoning/effort;
- Service tier cuando esté disponible y sea soportado.

El modelo se obtiene dinámicamente del catálogo de Codex.

Las opciones de reasoning y service tier dependen del modelo/cuenta disponibles.

No mostrar `temperature`.

No mostrar `max output tokens`.

No mostrar un directorio de trabajo global.

### Permisos

La página de Agentes no contiene la configuración detallada de permisos.

Debe indicar que los permisos se administran desde `Permisos Agentes`.

### Acciones

- `Guardar cambios`.

No agregar un botón independiente de `Restablecer configuración`.

## 9.3 Permisos Agentes

La vista utiliza tarjetas horizontales de agentes.

Para el agente seleccionado se muestran dos áreas principales.

### Permisos de proyectos/operaciones

- sistema de archivos: leer, escribir, eliminar, rutas permitidas;
- comandos: ejecutar, restringidos, allowlist;
- red: acceso a Internet, dominios permitidos;
- sandbox: uso y acceso al host cuando esté soportado;
- herramientas: terminal, diffs, búsqueda de proyecto y otras explícitamente habilitadas.

### Permisos de base de datos SQL

Mostrar las sentencias SQL configuradas para el agente en una tabla con:

- ID;
- nombre de la sentencia;
- tipo;
- descripción;
- enabled.

En esta tabla, `enabled` representa si el agente seleccionado tiene permiso para ejecutar esa sentencia. La columna `enabled` de `sql_statements` controla si la definición está habilitada globalmente.

Acción:

- `Guardar cambios`.

## 9.4 Codex

La vista Codex debe permitir administrar únicamente opciones realmente soportadas por la integración instalada.

Debe contemplar:

- estado de conexión;
- cuenta/autenticación de ChatGPT;
- correo electrónico cuando esté disponible mediante el scope de identidad utilizado;
- modelo predeterminado;
- reasoning predeterminado;
- service tier cuando esté disponible;
- política de aprobación;
- uso/límites de ChatGPT cuando sean expuestos realmente por la integración;
- `Probar conexión`;
- `Cerrar sesión`;
- `Guardar cambios`.

### Modelo predeterminado

Debe ser un combo box poblado dinámicamente mediante el catálogo de Codex.

No hardcodear un modelo específico.

### Reasoning

Debe ser un combo box cuyas opciones correspondan al modelo seleccionado.

### Service tier

Debe ser un combo box cuyas opciones correspondan a los niveles realmente reportados para el modelo/cuenta.

No hardcodear `auto`.

### Directorio de trabajo

No mostrar un campo de directorio de trabajo global.

El `cwd` de una ejecución se deriva de la ruta del proyecto activo.

### Uso/límites

No inventar porcentajes, límites ni fechas.

Mostrar únicamente datos reales disponibles.

### Probar conexión

`Probar conexión` es una función de AI Dev Studio para validar la conexión/configuración mediante una operación real compatible con la integración.

No se considera una función propia del protocolo con un botón equivalente.

La aplicación puede mostrar el resultado de la prueba, pero no debe inventar métricas o datos que el servicio no proporcione.

---

# 10. Persistencia y estado operativo

Cerrar el navegador no debe detener intencionalmente el backend ni una ejecución activa.

Al volver a abrir la interfaz se recuperan como mínimo:

- proyecto activo;
- agente activo;
- threads;
- ejecuciones;
- tareas;
- bugs.

Después de reiniciar el backend o el PC, la aplicación recupera el estado persistido disponible.

Cuando el mecanismo oficial de Codex lo permita, los threads se reanudan mediante `thread/resume`.

La recuperación de un thread no implica que una ejecución que estaba en curso antes de un apagado abrupto continúe automáticamente desde el punto exacto donde quedó.

No se promete continuidad de una ejecución terminada abruptamente por cierre del backend, apagado del PC o pérdida irrecuperable de sesión.

---

# 11. Seguridad

- Los tokens OAuth permanecen en el backend local.
- Nunca llegan al navegador.
- No se envían al modelo como datos de conversación.
- No se almacenan en logs.
- No se incluyen en código fuente.
- No se almacenan en URLs.
- El backend entrega al App Server únicamente el credencial necesario para su operación.
- Las operaciones de BD de los agentes pasan por herramientas controladas.
- Los agentes no tienen acceso SQL directo.
- Los agentes solo pueden ejecutar SQL registrado, habilitado y autorizado.
- Los agentes solo pueden escribir en las rutas autorizadas.
- El sandbox de Codex permanece en solo lectura; las modificaciones solicitadas por agentes usan las herramientas de archivos del backend y requieren las aprobaciones configuradas.
- El acceso fuera de la raíz del proyecto queda bloqueado por defecto para Developer.
- Designer queda limitado por defecto a `design/`.
- Tester queda limitado por defecto a `tests/`.
- Requirements queda limitado por defecto a `requirements.md` para escritura.
- Architect queda limitado por defecto a `architecture.md` para escritura.
- No se exponen credenciales al frontend.

---

# 12. Manejo de errores

V1 debe mostrar errores claros para:

- autenticación;
- renovación de token;
- búsqueda Web no disponible o sin acceso a fuentes oficiales;
- App Server no disponible;
- fallo de ejecución;
- límite de uso;
- permiso denegado;
- archivo/ruta no permitida;
- pérdida de conexión;
- fallo al consultar o ejecutar una sentencia SQL autorizada;
- modelo no disponible para la solicitud.

No se implementa un sistema avanzado de observabilidad o auditoría.

---

# 13. Pruebas mínimas

## Codex

1. Autenticación con ChatGPT Plus y Go.
2. Web → Backend → App Server → Codex.
3. `initialize` / `initialized`.
4. `thread/start`.
5. `turn/start`.
6. Streaming.
7. `turn/completed`.
8. Continuidad del mismo thread.
9. `thread/resume` cuando corresponda.
10. `Detener`.
11. Aprobaciones.
12. Renovación de credenciales.
13. Modelo obtenido dinámicamente.
14. Reasoning compatible con modelo.
15. Service tier compatible con modelo/cuenta.
16. Ausencia de `OPENAI_API_KEY`.

## Agentes y permisos

17. Cada agente solo puede modificar sus archivos autorizados.
18. Requirements no puede modificar `architecture.md`.
19. Architect no puede modificar `requirements.md`.
20. Designer queda limitado a `design/` para escritura.
21. Tester queda limitado a `tests/` para escritura.
22. Developer no puede modificar `requirements.md` ni `architecture.md`.
23. SQL no autorizado es rechazado.
24. SQL deshabilitado es rechazado.
25. SQL no registrado es rechazado.
26. Parámetros SQL se ejecutan sin concatenación de valores.

## Proyectos

27. Crear proyecto con nombre, descripción y ruta.
28. Editar proyecto.
29. Ocultar un proyecto conserva todos sus datos asociados y archivos.
30. Solo un proyecto puede estar `ACTIVO`.
31. Activar un proyecto `NUEVO`.
32. Activar un proyecto `PAUSADO`.
33. Al activar otro, el proyecto anterior pasa a `PAUSADO`.
34. El diálogo `Cambiar de proyecto` muestra el combo box.
35. La confirmación advierte el cambio de estados.
36. `Cancelar` no realiza cambios.
37. `Sí, activar` realiza el cambio.
38. Un proyecto `FINALIZADO` no puede activarse.

## Tareas

39. Architect define las tareas necesarias sin crearlas directamente en SQLite.
40. Developer crea tareas mediante SQL autorizado.
41. Developer puede editar tareas mediante SQL autorizado.
42. Usuario puede revisar tareas.
43. Usuario puede modificar tareas.
44. Usuario puede asignar tareas.
45. Usuario puede cambiar manualmente cualquier estado definido.
46. Varias tareas pueden estar activas simultáneamente.
47. `Parar` no cambia el estado de la tarea.
48. Developer no cambia automáticamente estados.
49. Tester no cambia automáticamente estados.
50. No existe pantalla independiente de tareas.

## Bugs

51. Tester puede crear bugs mediante SQL autorizado.
52. Tester puede editar bugs mediante SQL autorizado.
53. Todos los bugs nuevos tienen severidad `MEDIA`.
54. Usuario puede revisar bugs.
55. Usuario puede editar bugs.
56. Usuario puede cambiar manualmente el estado del bug.
57. Tester no cambia automáticamente estados de bugs.
58. No existe pantalla independiente de bugs.

## Persistencia

59. Cerrar navegador no detiene intencionalmente el backend.
60. El estado del proyecto activo, o la ausencia de proyecto activo, se recupera.
61. Estado de agente activo se recupera.
62. Threads se recuperan.
63. Ejecuciones se recuperan.
64. Tareas se recuperan.
65. Bugs se recuperan.

## Chat único y contexto de agentes

66. El historial único del chat se recupera en el orden original.
67. Una pregunta del usuario se envía solo al agente activo; no aparece como turno en los threads de otros agentes.
68. Las respuestas de distintos agentes aparecen en el mismo historial visible del proyecto y se identifican por agente.
69. Cambiar de agente no detiene ejecuciones existentes ni borra el historial visible.

## Actualización de información y búsqueda Web

70. Antes de responder, cada agente puede consultar los datos actuales de SQLite y los archivos MD autorizados; no existen observadores continuos ni ejecuciones automáticas por cambios.
71. Con permiso de Internet, el agente consulta fuentes oficiales pertinentes cuando necesita verificar información externa; responde brevemente y sólo proporciona enlaces si el usuario los pide o si son necesarios para resolver una discrepancia.
72. Sin permiso de Internet, la búsqueda Web del agente se bloquea.

## Registro de proyectos y tareas

73. Registrar un proyecto no crea archivos ni carpetas en su ruta.
74. `Iniciar` cambia solo el estado de la tarea y no comienza una ejecución Codex.
75. Ocultar un proyecto conserva en SQLite su registro, tareas, bugs, threads y ejecuciones, y no modifica los archivos del proyecto.
76. Al ocultar el proyecto activo, este pasa a `PAUSADO`, no se activa otro proyecto y el proyecto/agente activos quedan sin valor.
77. Sin proyecto activo, los agentes aparecen inactivos, el chat no acepta texto ni adjuntos y aparece `Seleccione un proyecto para desarrollar`.
78. Sin proyecto activo, Configuración sigue disponible y `Cambiar de proyecto` permite activar explícitamente uno visible.
79. El selector sin proyecto actual confirma la activación del seleccionado sin anunciar que otro proyecto será pausado.
80. El botón `Limpiar chat` no aparece en V1.
81. Activar un proyecto desde el estado vacío no activa automáticamente un agente.

---

# 14. Fuera de alcance de V1

Queda explícitamente fuera de V1:

- voz;
- Git automático;
- gestión automática de Git;
- múltiples proyectos activos;
- orquestación automática;
- debate autónomo;
- traspaso automático Developer → Tester;
- planificación autónoma;
- ejecución autónoma de tareas no solicitadas;
- pantalla independiente de tareas;
- pantalla independiente de bugs;
- `progress.md`;
- otros MD de control de tareas/estados/protocolos;
- configuración de Codex específica por proyecto;
- directorio de trabajo global independiente del proyecto;
- temperature;
- max output tokens;
- SQL arbitrario por parte de agentes;
- exposición de tokens al navegador;
- estimación de uso de ChatGPT;
- sistema avanzado de auditoría/observabilidad.

---

# 15. Criterio de terminación de V1

La V1 se considera terminada cuando:

1. Todas las funciones de este documento están implementadas.
2. Todas las pruebas mínimas aplicables pasan.
3. Los permisos de agentes se aplican realmente en backend.
4. Los permisos SQL se validan antes de cada ejecución.
5. El comportamiento de proyectos, tareas y bugs coincide con esta especificación.
6. La integración con Codex utiliza las capacidades realmente soportadas por la versión fijada.
7. No existen funciones implementadas que estén expresamente fuera de alcance.

**No agregar funcionalidades fuera de este documento sin modificar primero esta especificación y aprobar el cambio.**
