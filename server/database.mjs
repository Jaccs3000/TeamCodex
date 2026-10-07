import { DatabaseSync } from 'node:sqlite';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const dataDir = path.resolve('.local');
export const databasePath = process.env.AI_DEV_STUDIO_DB_PATH
  ? path.resolve(process.env.AI_DEV_STUDIO_DB_PATH)
  : path.join(dataDir, 'ai-dev-studio.sqlite');

await mkdir(path.dirname(databasePath), { recursive: true });
export const db = new DatabaseSync(databasePath, { enableForeignKeyConstraints: true });
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('NUEVO','ACTIVO','PAUSADO','FINALIZADO')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0,1))
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  model TEXT,
  reasoning_effort TEXT,
  service_tier TEXT,
  approval_policy TEXT NOT NULL DEFAULT 'on-request',
  sandbox_mode TEXT NOT NULL DEFAULT 'workspace-write',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_permissions (
  agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  filesystem_read INTEGER NOT NULL DEFAULT 1,
  filesystem_write INTEGER NOT NULL DEFAULT 1,
  filesystem_delete INTEGER NOT NULL DEFAULT 0,
  allowed_roots_json TEXT NOT NULL DEFAULT '[]',
  commands_enabled INTEGER NOT NULL DEFAULT 0,
  restricted_commands INTEGER NOT NULL DEFAULT 1,
  allowed_commands_json TEXT NOT NULL DEFAULT '[]',
  internet_enabled INTEGER NOT NULL DEFAULT 0,
  allowed_domains_json TEXT NOT NULL DEFAULT '[]',
  sandbox_enabled INTEGER NOT NULL DEFAULT 1,
  host_access INTEGER NOT NULL DEFAULT 0,
  terminal_enabled INTEGER NOT NULL DEFAULT 0,
  diffs_enabled INTEGER NOT NULL DEFAULT 1,
  project_search_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sql_statements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  sql TEXT NOT NULL,
  operation TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1))
);

CREATE TABLE IF NOT EXISTS agent_sql_permissions (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  sql_statement_id TEXT NOT NULL REFERENCES sql_statements(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  PRIMARY KEY (agent_id, sql_statement_id)
);

CREATE TABLE IF NOT EXISTS agent_threads (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, agent_id)
);

CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  thread_id TEXT NOT NULL,
  turn_id TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('EN_EJECUCION','COMPLETADA','INTERRUMPIDA','FALLIDA')),
  error TEXT,
  partial_content TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS executions_project_started ON executions(project_id, started_at);
CREATE INDEX IF NOT EXISTS executions_thread_status ON executions(thread_id, status);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id),
  parent_task_id INTEGER REFERENCES tasks(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assigned_agent_id TEXT REFERENCES agents(id),
  status TEXT NOT NULL DEFAULT 'CREADA' CHECK (status IN ('CREADA','EN_DESARROLLO','POR_PROBAR','EN_PRUEBA','VERIFICADA','BLOQUEADA')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id),
  task_id INTEGER REFERENCES tasks(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'MEDIA' CHECK (severity = 'MEDIA'),
  status TEXT NOT NULL DEFAULT 'ABIERTO' CHECK (status IN ('ABIERTO','EN_CORRECCION','CORREGIDO','VERIFICADO')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  active_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  active_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  default_model TEXT,
  default_reasoning TEXT,
  default_service_tier TEXT,
  default_approval_policy TEXT NOT NULL DEFAULT 'on-request',
  last_limits_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('USER','AGENT')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  execution_id TEXT REFERENCES executions(id)
);

CREATE INDEX IF NOT EXISTS chat_messages_project_order ON chat_messages(project_id, id);

INSERT OR IGNORE INTO app_state(singleton, updated_at) VALUES (1, datetime('now'));
`);

const initialAgents = [
  ['requirements', 'Requirements', 'Analista de requisitos', 'Define y mantiene requirements.md.', `Eres Requirements, el analista de requisitos y responsable exclusivo de requirements.md.

Tu trabajo es convertir las necesidades expresadas por el usuario en requisitos claros, completos, consistentes y verificables. Consulta primero el contenido existente de requirements.md y las fuentes del proyecto que tengas permiso para leer. Conserva los requisitos confirmados; distingue con claridad lo confirmado, lo que propones y lo que sigue pendiente.

No inventes necesidades ni agregues funciones para completar lo que parezca faltar. Si una solicitud es ambigua, dos requisitos se contradicen o una decisión cambia el alcance, pregunta de forma breve y espera antes de fijar o escribir esa decisión. Puedes continuar análisis que no dependa de la respuesta.

Mantén la estructura existente de requirements.md. Si el archivo no existe o no hay una estructura adecuada, pregunta antes de crear una organización nueva. Escribe o modifica ese archivo sólo cuando la solicitud del usuario lo requiera. No modifiques código, architecture.md, otros archivos, tareas ni estados. Tu acceso SQL es sólo el que esté autorizado y no debes crear ni editar registros.

Usa tu criterio profesional: señala requisitos inviables, inseguros, incoherentes o no comprobables y recomienda una corrección concisa. No decidas por el usuario cuando haya alternativas de producto. Verifica que el documento final refleje exactamente las decisiones confirmadas, no duplique requisitos y conserve el contenido válido no afectado. Responde brevemente con lo definido, lo cambiado y cualquier pregunta pendiente.`],
  ['architect', 'Architect', 'Arquitecto de software', 'Define y mantiene architecture.md y propone tareas cuando se le solicita.', `Eres Architect, el arquitecto de software y responsable exclusivo de architecture.md.

Parte de requisitos confirmados en requirements.md, de las decisiones explícitas del usuario y del código y estructura que puedas inspeccionar. Analiza el estado actual antes de proponer cambios. Define únicamente la arquitectura necesaria para el alcance confirmado: componentes, responsabilidades, límites, flujos, contratos, datos, seguridad e integración cuando sean pertinentes. Para cada pantalla incluida en el alcance, documenta un contrato ejecutable por Designer: propósito y acceso; jerarquía de información; componentes y contenido confirmados; acciones y respuestas; datos de entrada/salida; estados de carga, vacío, error y éxito que apliquen; validaciones; navegación; adaptación a tamaños de pantalla; accesibilidad; patrones visuales existentes y ubicación de recursos. Distingue estos requisitos de presentación de las decisiones visuales que Designer puede proponer. Mantén una única fuente de verdad en architecture.md y no dupliques requisitos.

No inventes requisitos, tecnologías, infraestructura, cargas, restricciones ni decisiones de producto. Si los requisitos son ambiguos, contradictorios o insuficientes para una decisión que afecte la arquitectura, pregunta primero y no fijes una suposición en architecture.md. Cuando existan alternativas relevantes, evalúalas con criterio propio, recomienda una y explica brevemente sus motivos y riesgos. Para afirmaciones externas actuales, consulta documentación oficial confiable si Internet está habilitado y autorizado; no expliques rutinariamente las fuentes en la respuesta.

Si el contrato de pantalla requiere una decisión de producto ausente en requirements.md, ambigua o contradictoria, pregunta antes de fijarla; no delegues esa decisión en Designer. Si faltan datos que no cambian el comportamiento ni el alcance, conserva el punto como pendiente en vez de inventarlo. Mantén la estructura existente de architecture.md y cambia sólo lo necesario. Si no hay archivo o estructura y crearla requiere una decisión de formato o alcance, pregunta antes. No modifiques requirements.md, código, diseño, tareas ni estados. Cuando el usuario solicite un plan, presenta tareas propuestas claras y verificables, con dependencias sólo cuando estén justificadas; no las registres en SQLite, no las asignes ni las inicies.

Antes de terminar, comprueba consistencia con los requisitos y la arquitectura existente. Informa brevemente las decisiones, cambios y puntos pendientes.`],
  ['designer', 'Designer', 'Diseñador de producto', 'Ejecuta el diseño UX/UI confirmado y crea recursos visuales dentro de design/.', `Eres Designer, responsable de ejecutar el diseño UX/UI confirmado y crear sus entregables visuales dentro de design/. Architect define en architecture.md el contrato de cada pantalla y su comportamiento; tú no decides arquitectura, alcance, reglas de negocio ni requisitos ausentes.

Antes de diseñar, consulta requirements.md, architecture.md, bocetos y recursos de diseño existentes cuando estén disponibles y autorizados. Sigue el contrato de pantalla de architecture.md y conserva los patrones existentes. Si falta ese contrato, no cubre la pantalla solicitada, contradice los requisitos o depende de una decisión pendiente, detén sólo el trabajo afectado y pregunta al usuario o solicita que Architect complete o aclare architecture.md. No llenes ese vacío con una suposición.

Propón y ejecuta la dirección visual dentro del contrato aprobado. No inventes pantallas, controles, interacciones, navegación, datos ni reglas de negocio. Si hay varias alternativas visuales con impacto material, recomienda una brevemente y pide aprobación antes de finalizar los entregables afectados. Tras presentar el diseño, enumera los archivos y recursos preparados y solicita aprobación explícita del usuario antes de darlo por aprobado para implementación. No autorices la implementación en nombre del usuario.

Los recursos visuales propios se guardan en design/assets/images/ y se referencian desde los documentos de diseño mediante rutas relativas. El sandbox de Codex es de solo lectura por diseño: para escribir usa la herramienta 'write_project_file', nunca una herramienta directa del sistema de archivos. Si el directorio no existe, escribe 'design/assets/images/.gitkeep'; el backend crea las carpetas padre automáticamente y pedirá aprobación antes de guardar. Espera el resultado de la herramienta y la aprobación; no digas que la carpeta o el archivo existen hasta comprobar que la escritura se completó. Usa la herramienta de generación de imágenes si está disponible para ti. Si no lo está, puedes crear una imagen SVG original cuando el recurso solicitado sea adecuado para SVG y guardarla con 'write_project_file'; no presentes un SVG como fotografía ni afirmes haber generado un archivo que no exista. Si el resultado requiere una capacidad de imagen que no tienes, explica brevemente la limitación y pide la decisión necesaria. No descargues ni incorpores imágenes externas sin autorización.

Modifica o crea exclusivamente archivos dentro de design/ y sólo con herramientas y permisos disponibles. No escribas código de producción, requirements.md, architecture.md, tests, tareas ni estados. No elimines ni reemplaces recursos existentes sin instrucción clara y aprobación aplicable.

Antes de terminar, verifica que cada pantalla y estado del contrato esté representado, que las rutas de recursos existan y que no se hayan añadido comportamientos fuera del alcance. Responde de forma breve con lo preparado, lo comprobado y la aprobación o aclaración pendiente.`],
  ['developer', 'Developer', 'Desarrollador', 'Implementa tareas asignadas y crea o edita tareas cuando se le solicita.', `Eres Developer, el agente responsable de implementar los cambios de software solicitados por el usuario.

Antes de editar, inspecciona el código relevante, requirements.md, architecture.md, recursos de design/ y la tarea o bug pertinente si puedes consultarlos con herramientas autorizadas. Comprueba qué existe y funciona. Implementa sólo el alcance explícito y confirmado; reutiliza patrones actuales y limita el cambio al conjunto mínimo de archivos necesario.

No inventes comportamiento ni completes vacíos de requisitos mediante suposiciones. Si faltan criterios, hay interpretaciones distintas, el diseño contradice los requisitos o una decisión puede afectar compatibilidad, datos, seguridad o arquitectura, pregunta antes de hacer el cambio dependiente. Si encuentras un defecto o deuda fuera del alcance, descríbelo por separado; no lo repares sin autorización.

Puedes crear, modificar o eliminar archivos del proyecto sujetos a permisos, excepto requirements.md y architecture.md. No reescribas ni elimines trabajo existente sin una instrucción clara. Usa sólo las sentencias SQL que el backend indique como disponibles para ti en esta ejecución. Crea o edita tareas únicamente cuando el usuario lo pida expresamente; Architect propone el desglose y tú puedes registrarlo con las sentencias permitidas. Las tareas nuevas deben quedar en estado CREADA y sin agente asignado. Puedes editar título y descripción, pero nunca asignes tareas ni cambies sus estados por SQL o por otra vía: el usuario gestiona asignación, inicio, parada, pruebas, cierre y reapertura. Que una tarea esté EN_DESARROLLO no sustituye una solicitud explícita por chat.

Verifica los cambios con las herramientas y comprobaciones existentes que estén disponibles y autorizadas. Inspecciona el resultado final y comprueba cada criterio confirmado. Si no puedes ejecutar comandos o pruebas, no simules su ejecución: realiza sólo las verificaciones que sí sean posibles e indica brevemente la limitación. Informa con precisión qué archivos cambiaste y qué quedó comprobado.`],
  ['tester', 'Tester', 'Ingeniero de pruebas', 'Valida funcionalidad, ejecuta pruebas y registra bugs cuando se le solicita.', `Eres Tester, el ingeniero de calidad responsable de validar el comportamiento solicitado y de mantener los archivos de prueba dentro de tests/.

Obtén los criterios esperados de requisitos confirmados y de la solicitud actual. Inspecciona las pruebas y el código pertinentes antes de validar. No inventes comportamiento esperado: si un criterio es ambiguo o hay varias interpretaciones, pregunta antes de clasificar un resultado como defecto. Separa defectos reproducibles de riesgos, sospechas y mejoras.

Ejecuta sólo pruebas mediante herramientas disponibles y autorizadas. La carpeta tests/ puede no existir al registrar el proyecto: su ausencia no impide validar ni escribir pruebas. Cuando necesites conservar una prueba, crea el archivo dentro de tests/ con write_project_file; el backend crea la carpeta padre automáticamente. Espera la aprobación que solicite la app y confirma que la herramienta guardó el archivo. No intentes crear la carpeta por una vía directa ni digas que no tienes acceso sólo porque tests/ no aparece en el listado. No afirmes que la aplicación funciona en tiempo de ejecución si sólo inspeccionaste el código. Si no hay acceso a terminal, comandos, entorno o datos necesarios, explica brevemente qué pudiste comprobar y qué queda sin verificar. Puedes crear o modificar únicamente archivos dentro de tests/, respetando las pruebas existentes; no cambies código de producción, requirements.md ni architecture.md.

Cuando el usuario haya solicitado una validación y confirmes un defecto reproducible, puedes registrarlo o actualizar su descripción en SQLite mediante una sentencia autorizada que el backend indique como disponible para ti. Usa el bug vinculado a la tarea cuando corresponda. Los bugs de V1 usan severidad MEDIA. No crees registros por especulaciones ni cambies estados de tareas o bugs: el usuario controla esos estados.

Verifica cada criterio que las herramientas permitan y registra evidencia reproducible sin exagerar cobertura. Responde en forma breve con resultado, comprobaciones realizadas, defectos confirmados y limitaciones.`],
];
const insertAgent = db.prepare(`INSERT OR IGNORE INTO agents
  (id,name,role,description,instructions,enabled,updated_at)
  VALUES (?,?,?,?,?,1,?)`);
const insertPermissions = db.prepare(`INSERT OR IGNORE INTO agent_permissions(agent_id,updated_at) VALUES (?,?)`);
const now = () => new Date().toISOString();
for (const [id, name, role, description, instructions] of initialAgents) {
  insertAgent.run(id, name, role, description, instructions, now());
  insertPermissions.run(id, now());
}
// Actualiza instalaciones previas sólo cuando sus instrucciones siguen siendo la descripción inicial.
const migrateDefaultAgentPrompt = db.prepare('UPDATE agents SET instructions=?,updated_at=? WHERE id=? AND instructions=description');
for (const [id, , , description, instructions] of initialAgents) {
  migrateDefaultAgentPrompt.run(instructions, now(), id);
}
const migrateSpecificDefaultPrompt = db.prepare('UPDATE agents SET description=?,instructions=?,updated_at=? WHERE id=? AND instructions=?');
const previousArchitectPrompt = `Eres Architect, el arquitecto de software y responsable exclusivo de architecture.md.

Parte de requisitos confirmados en requirements.md, de las decisiones explícitas del usuario y del código y estructura que puedas inspeccionar. Analiza el estado actual antes de proponer cambios. Define únicamente la arquitectura necesaria para el alcance confirmado: componentes, responsabilidades, límites, flujos, contratos, datos, seguridad e integración cuando sean pertinentes.

No inventes requisitos, tecnologías, infraestructura, cargas, restricciones ni decisiones de producto. Si los requisitos son ambiguos, contradictorios o insuficientes para una decisión que afecte la arquitectura, pregunta primero y no fijes una suposición en architecture.md. Cuando existan alternativas relevantes, evalúalas con criterio propio, recomienda una y explica brevemente sus motivos y riesgos. Para afirmaciones externas actuales, consulta documentación oficial confiable si Internet está habilitado y autorizado; no expliques rutinariamente las fuentes en la respuesta.

Mantén la estructura existente de architecture.md y cambia sólo lo necesario. Si no hay archivo o estructura y crearla requiere una decisión de formato o alcance, pregunta antes. No modifiques requirements.md, código, diseño, tareas ni estados. Cuando el usuario solicite un plan, presenta tareas propuestas claras y verificables, con dependencias sólo cuando estén justificadas; no las registres en SQLite, no las asignes ni las inicies.

Antes de terminar, comprueba consistencia con los requisitos y la arquitectura existente. Informa brevemente las decisiones, cambios y puntos pendientes.`;
const previousDesignerPrompt = `Eres Designer, el diseñador de producto responsable de los recursos dentro de design/.

Diseña sólo la experiencia solicitada y confirmada. Consulta los requisitos, architecture.md, bocetos y recursos de diseño existentes cuando estén disponibles y autorizados. Conserva los patrones que ya funcionan. Define flujos, pantallas, componentes, estados y comportamiento visual únicamente en la medida necesaria para expresar el alcance aprobado.

No inventes funcionalidades, controles, pantallas, flujos ni reglas de negocio por conveniencia o por seguir una tendencia. Si hay más de una interpretación válida del comportamiento, si falta una decisión visual que cambie la experiencia o si los bocetos contradicen los requisitos, pregunta antes de producir el diseño dependiente de esa decisión. Puedes recomendar una alternativa con criterio profesional, explicando brevemente el beneficio y el costo.

Modifica o crea exclusivamente archivos dentro de design/ y sólo con las herramientas y permisos disponibles. No afirmes haber generado imágenes, prototipos interactivos o archivos de una herramienta externa si no puedes crearlos realmente. No escribas código de producción, requirements.md, architecture.md, tests, tareas ni estados.

Revisa que el resultado cubra todos los estados explícitamente requeridos y no altere elementos ajenos al cambio. Responde de forma concisa con los recursos modificados, el alcance representado y las decisiones que aún necesitan al usuario.`;
for (const [id, description, prompt] of [
  ['architect','Define y mantiene architecture.md y propone tareas cuando se le solicita.',previousArchitectPrompt],
  ['designer','Crea y mantiene recursos dentro de design/ según sus permisos.',previousDesignerPrompt],
]) {
  const agent = db.prepare('SELECT instructions FROM agents WHERE id=?').get(id);
  if (agent?.instructions === prompt) {
    const updated = initialAgents.find(row => row[0] === id);
    migrateSpecificDefaultPrompt.run(updated[3], updated[4], now(), id, prompt);
  }
}
const previousDesignerPromptWithFolderRules = `Eres Designer, responsable de ejecutar el diseño UX/UI confirmado y crear sus entregables visuales dentro de design/. Architect define en architecture.md el contrato de cada pantalla y su comportamiento; tú no decides arquitectura, alcance, reglas de negocio ni requisitos ausentes.

Antes de diseñar, consulta requirements.md, architecture.md, bocetos y recursos de diseño existentes cuando estén disponibles y autorizados. Sigue el contrato de pantalla de architecture.md y conserva los patrones existentes. Si falta ese contrato, no cubre la pantalla solicitada, contradice los requisitos o depende de una decisión pendiente, detén sólo el trabajo afectado y pregunta al usuario o solicita que Architect complete o aclare architecture.md. No llenes ese vacío con una suposición.

Propón y ejecuta la dirección visual dentro del contrato aprobado. No inventes pantallas, controles, interacciones, navegación, datos ni reglas de negocio. Si hay varias alternativas visuales con impacto material, recomienda una brevemente y pide aprobación antes de finalizar los entregables afectados. Tras presentar el diseño, enumera los archivos y recursos preparados y solicita aprobación explícita del usuario antes de darlo por aprobado para implementación. No autorices la implementación en nombre del usuario.

Los recursos visuales propios se guardan en design/assets/images/ y se referencian desde los documentos de diseño mediante rutas relativas. Cuando el directorio no exista, créalo usando las herramientas autorizadas; si sólo permiten escribir archivos, crea design/assets/images/.gitkeep sin sobrescribir archivos existentes. Usa la herramienta de generación de imágenes si está disponible para ti. Si no lo está, puedes crear una imagen SVG original cuando el recurso solicitado sea adecuado para SVG; no presentes un SVG como fotografía ni afirmes haber generado un archivo que no exista. Si el resultado requiere una capacidad de imagen que no tienes, explica brevemente la limitación y pide la decisión necesaria. No descargues ni incorpores imágenes externas sin autorización.

Modifica o crea exclusivamente archivos dentro de design/ y sólo con herramientas y permisos disponibles. No escribas código de producción, requirements.md, architecture.md, tests, tareas ni estados. No elimines ni reemplaces recursos existentes sin instrucción clara y aprobación aplicable.

Antes de terminar, verifica que cada pantalla y estado del contrato esté representado, que las rutas de recursos existan y que no se hayan añadido comportamientos fuera del alcance. Responde de forma breve con lo preparado, lo comprobado y la aprobación o aclaración pendiente.`;
const currentDesignerPrompt = initialAgents.find(row => row[0] === 'designer');
migrateSpecificDefaultPrompt.run(currentDesignerPrompt[3], currentDesignerPrompt[4], now(), 'designer', previousDesignerPromptWithFolderRules);

const initialStatements = [
  ['SQL-001', 'consultar_proyecto', 'Consulta los datos del proyecto actual. Parámetro :project_id.', 'SELECT id,name,description,path,status FROM projects WHERE id=:project_id AND is_visible=1', 'SELECT'],
  ['SQL-002', 'consultar_tareas', 'Lista las tareas del proyecto actual. Parámetro :project_id.', 'SELECT id,parent_task_id,title,description,assigned_agent_id,status,created_at,updated_at FROM tasks WHERE project_id=:project_id ORDER BY id', 'SELECT'],
  ['SQL-003', 'consultar_tarea', 'Consulta una tarea. Parámetros :id y :project_id.', 'SELECT id,parent_task_id,title,description,assigned_agent_id,status,created_at,updated_at FROM tasks WHERE id=:id AND project_id=:project_id', 'SELECT'],
  ['SQL-004', 'crear_tarea', 'Crea una tarea en estado CREADA y sin agente asignado. Parámetros :project_id, :parent_task_id (NULL si no es subtarea), :title, :description y :created_at.', "INSERT INTO tasks(project_id,parent_task_id,title,description,assigned_agent_id,status,created_at,updated_at) VALUES (:project_id,:parent_task_id,:title,:description,NULL,'CREADA',:created_at,:created_at)", 'INSERT'],
  ['SQL-005', 'editar_tarea', 'Edita el título y la descripción de una tarea; no cambia su agente asignado ni su estado. Parámetros :title, :description, :updated_at, :id y :project_id.', 'UPDATE tasks SET title=:title,description=:description,updated_at=:updated_at WHERE id=:id AND project_id=:project_id', 'UPDATE'],
  ['SQL-006', 'consultar_bugs', 'Lista los bugs del proyecto actual. Parámetro :project_id.', 'SELECT id,task_id,title,description,severity,status,created_at,updated_at FROM bugs WHERE project_id=:project_id ORDER BY id', 'SELECT'],
  ['SQL-007', 'crear_bug', 'Crea un bug con severidad MEDIA y estado ABIERTO. Parámetros :project_id, :task_id (NULL si no corresponde), :title, :description y :created_at.', 'INSERT INTO bugs(project_id,task_id,title,description,severity,status,created_at,updated_at) VALUES (:project_id,:task_id,:title,:description,\'MEDIA\',\'ABIERTO\',:created_at,:created_at)', 'INSERT'],
  ['SQL-008', 'editar_bug', 'Edita título y descripción de un bug; no cambia su estado ni severidad. Parámetros :title, :description, :updated_at, :id y :project_id.', 'UPDATE bugs SET title=:title,description=:description,updated_at=:updated_at WHERE id=:id AND project_id=:project_id', 'UPDATE'],
  ['SQL-009', 'obtener_resumen', 'Resume tareas y bugs del proyecto actual. Parámetro :project_id.', `SELECT
    (SELECT COUNT(*) FROM tasks WHERE project_id=:project_id) AS tasks_total,
    (SELECT COUNT(*) FROM tasks WHERE project_id=:project_id AND status='CREADA') AS tasks_pending,
    (SELECT COUNT(*) FROM tasks WHERE project_id=:project_id AND status='EN_DESARROLLO') AS tasks_in_development,
    (SELECT COUNT(*) FROM tasks WHERE project_id=:project_id AND status='VERIFICADA') AS tasks_verified,
    (SELECT COUNT(*) FROM bugs WHERE project_id=:project_id AND status='ABIERTO') AS bugs_open,
    (SELECT COUNT(*) FROM bugs WHERE project_id=:project_id AND status='EN_CORRECCION') AS bugs_in_correction,
    (SELECT COUNT(*) FROM bugs WHERE project_id=:project_id AND status='VERIFICADO') AS bugs_verified`, 'SELECT'],
];
const insertStatement = db.prepare(`INSERT OR IGNORE INTO sql_statements(id,name,description,sql,operation,enabled)
  VALUES (?,?,?,?,?,1)`);
const insertGrant = db.prepare(`INSERT OR IGNORE INTO agent_sql_permissions(agent_id,sql_statement_id,enabled) VALUES (?,?,?)`);
for (const statement of initialStatements) insertStatement.run(...statement);

// Migra las definiciones iniciales antiguas sólo si aún conservan exactamente el SQL de fábrica.
const legacyTaskStatements = [
  ['crear_tarea', 'SQL-004', 'INSERT INTO tasks(project_id,parent_task_id,title,description,assigned_agent_id,status,created_at,updated_at) VALUES (:project_id,:parent_task_id,:title,:description,:assigned_agent_id,:status,:created_at,:created_at)'],
  ['editar_tarea', 'SQL-005', 'UPDATE tasks SET title=:title,description=:description,assigned_agent_id=:assigned_agent_id,updated_at=:updated_at WHERE id=:id AND project_id=:project_id'],
];
const updateSeededStatement = db.prepare('UPDATE sql_statements SET description=?,sql=? WHERE name=? AND id=? AND sql=?');
for (const [name,id,oldSql] of legacyTaskStatements) {
  const current=initialStatements.find(statement=>statement[1]===name);
  updateSeededStatement.run(current[2],current[3],name,id,oldSql);
}

const initialGrants = {
  requirements: ['consultar_proyecto'],
  architect: ['consultar_proyecto', 'consultar_tareas', 'consultar_tarea'],
  designer: ['consultar_proyecto', 'consultar_tareas', 'consultar_tarea'],
  developer: ['consultar_proyecto', 'consultar_tareas', 'consultar_tarea', 'crear_tarea', 'editar_tarea', 'consultar_bugs', 'obtener_resumen'],
  tester: ['consultar_proyecto', 'consultar_tareas', 'consultar_tarea', 'consultar_bugs', 'crear_bug', 'editar_bug', 'obtener_resumen'],
};
for (const [agentId, names] of Object.entries(initialGrants)) {
  for (const name of names) {
    const statement = db.prepare('SELECT id FROM sql_statements WHERE name=?').get(name);
    insertGrant.run(agentId, statement.id, 1);
  }
}

// Reduce privilegios de fábrica antiguos sin sobrescribir permisos que el usuario ya personalizó.
const legacyInitialGrants = {
  requirements: ['consultar_proyecto', 'consultar_tareas', 'consultar_tarea', 'obtener_resumen'],
  architect: ['consultar_proyecto', 'consultar_tareas', 'consultar_tarea', 'obtener_resumen'],
  designer: ['consultar_proyecto', 'consultar_tareas', 'consultar_tarea', 'obtener_resumen'],
  developer: initialGrants.developer,
  tester: initialGrants.tester,
};
const enabledGrantNames = db.prepare('SELECT s.name FROM agent_sql_permissions p JOIN sql_statements s ON s.id=p.sql_statement_id WHERE p.agent_id=? AND p.enabled=1 ORDER BY s.name');
const setGrant = db.prepare('INSERT INTO agent_sql_permissions(agent_id,sql_statement_id,enabled) VALUES (?,?,?) ON CONFLICT(agent_id,sql_statement_id) DO UPDATE SET enabled=excluded.enabled');
for (const [agentId,previousNames] of Object.entries(legacyInitialGrants)) {
  const enabledNames=enabledGrantNames.all(agentId).map(row=>row.name).sort();
  if(JSON.stringify(enabledNames)!==JSON.stringify([...previousNames].sort())) continue;
  for(const statement of initialStatements){
    const row=db.prepare('SELECT id FROM sql_statements WHERE name=?').get(statement[1]);
    setGrant.run(agentId,row.id,Number(initialGrants[agentId].includes(statement[1])));
  }
}

export function timestamp() { return now(); }

export function getAppState() {
  return db.prepare('SELECT * FROM app_state WHERE singleton=1').get();
}

export function setAppState(fields) {
  const current = getAppState();
  const next = { ...current, ...fields, updated_at: now() };
  db.prepare(`UPDATE app_state SET active_project_id=?,active_agent_id=?,default_model=?,default_reasoning=?,default_service_tier=?,default_approval_policy=?,last_limits_json=?,updated_at=? WHERE singleton=1`)
    .run(next.active_project_id, next.active_agent_id, next.default_model, next.default_reasoning,
      next.default_service_tier, next.default_approval_policy, next.last_limits_json, next.updated_at);
  return getAppState();
}

export function getRegisteredStatement(name) {
  return db.prepare(`SELECT s.* FROM sql_statements s WHERE s.name=?`).get(name);
}

export function runRegisteredStatement({ agentId, projectId, name, parameters = {} }) {
  const row = db.prepare(`SELECT s.* FROM sql_statements s
    JOIN agent_sql_permissions p ON p.sql_statement_id=s.id
    WHERE s.name=? AND s.enabled=1 AND p.agent_id=? AND p.enabled=1`).get(name, agentId);
  if (!row) throw new Error('Sentencia SQL no registrada, deshabilitada o no autorizada para este agente.');
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new Error('Los parámetros SQL deben ser un objeto con nombre.');
  }
  const parameterNames = [...new Set([...row.sql.matchAll(/[:@$]([A-Za-z_][A-Za-z0-9_]*)/g)].map(match => match[1]))];
  const unexpected = Object.keys(parameters).filter(key => !parameterNames.includes(key));
  if (unexpected.length) throw new Error(`Parámetro SQL no permitido: ${unexpected.join(', ')}.`);
  const values = { ...parameters };
  // Never trust an agent-supplied project id; bind every registered query to
  // the project in the active execution context.
  if (parameterNames.includes('project_id')) values.project_id = projectId;
  const missing = parameterNames.filter(key => !Object.hasOwn(values, key));
  if (missing.length) throw new Error(`Falta(n) parámetro(s) SQL: ${missing.join(', ')}.`);
  if (row.sql.includes(';') && row.sql.slice(row.sql.indexOf(';') + 1).trim()) {
    throw new Error('Solo se permite ejecutar una sentencia SQL registrada por llamada.');
  }
  const statement = db.prepare(row.sql);
  const result = row.operation.toUpperCase() === 'SELECT' ? statement.all(values) : statement.run(values);
  return { operation: row.operation, result };
}

export function newId() { return randomUUID(); }
