import {
  DATA_CLASSES,
  ENTITY_KINDS,
  SCHEMA_VERSION,
  type AnyEntity,
  type DataClass,
  type EntityKind,
  type NoteOrigin,
} from "./entities.js";

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Limites de tamanho. Protegem o armazenamento local e a importação de arquivos. */
export const LIMITS = {
  id: 64,
  deviceId: 64,
  providerId: 64,
  taskTitle: 200,
  taskNotes: 5_000,
  subjectName: 100,
  noteTitle: 200,
  noteBody: 100_000,
} as const;

const NOTE_ORIGINS: readonly NoteOrigin[] = ["manual", "ai-manual-paste"];

type Obj = Record<string, unknown>;

function isObject(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

/** Aceita apenas datas reais no formato AAAA-MM-DD (rejeita, por exemplo, 2026-02-30). */
export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Rótulos exibidos ao usuário quando um campo é inválido. */
export const FIELD_LABELS: Readonly<Record<string, string>> = {
  id: "identificador",
  deviceId: "aparelho",
  providerId: "provedor",
  title: "título",
  notes: "notas",
  name: "nome",
  body: "conteúdo",
  dueDate: "data de vencimento",
  subjectId: "disciplina",
  done: "concluída",
  origin: "origem",
  classes: "classes de dado",
  decision: "decisão",
  itemCount: "quantidade de itens",
  characterCount: "tamanho do conteúdo",
  createdAt: "data de criação",
  updatedAt: "data de alteração",
  deletedAt: "data de exclusão",
  schemaVersion: "versão do esquema",
};

function label(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

function checkText(
  obj: Obj,
  key: string,
  errors: string[],
  options: { min: number; max: number },
): void {
  const value = obj[key];
  if (typeof value !== "string") {
    errors.push(`${label(key)} deve ser texto`);
    return;
  }
  if (value.trim().length < options.min) {
    errors.push(`${label(key)} não pode estar vazio`);
  }
  if (value.length > options.max) {
    errors.push(`${label(key)} excede ${options.max} caracteres`);
  }
}

function checkOptionalId(obj: Obj, key: string, errors: string[]): void {
  const value = obj[key];
  if (value === null) return;
  if (typeof value !== "string" || value.length === 0 || value.length > LIMITS.id) {
    errors.push(`${label(key)} deve ser vazio ou um identificador válido`);
  }
}

function checkBase(obj: Obj, errors: string[]): void {
  checkText(obj, "id", errors, { min: 1, max: LIMITS.id });
  checkText(obj, "deviceId", errors, { min: 1, max: LIMITS.deviceId });

  if (!isIsoTimestamp(obj["createdAt"])) errors.push("data de criação inválida");
  if (!isIsoTimestamp(obj["updatedAt"])) errors.push("data de alteração inválida");
  const deletedAt = obj["deletedAt"];
  if (deletedAt !== null && !isIsoTimestamp(deletedAt)) {
    errors.push("data de exclusão deve ser nula ou uma data válida");
  }

  if (isIsoTimestamp(obj["createdAt"]) && isIsoTimestamp(obj["updatedAt"])) {
    if (Date.parse(obj["updatedAt"]) < Date.parse(obj["createdAt"])) {
      errors.push("data de alteração é anterior à data de criação");
    }
  }

  const version = obj["schemaVersion"];
  if (!Number.isInteger(version) || (version as number) < 1 || (version as number) > SCHEMA_VERSION) {
    errors.push(`versão do esquema deve ser um inteiro entre 1 e ${SCHEMA_VERSION}`);
  }
}

function checkTask(obj: Obj, errors: string[]): void {
  checkText(obj, "title", errors, { min: 1, max: LIMITS.taskTitle });
  checkText(obj, "notes", errors, { min: 0, max: LIMITS.taskNotes });
  if (typeof obj["done"] !== "boolean") errors.push("situação de conclusão deve ser verdadeira ou falsa");
  const due = obj["dueDate"];
  if (due !== null && !isDateOnly(due)) errors.push("data de vencimento deve ser vazia ou uma data válida (AAAA-MM-DD)");
  checkOptionalId(obj, "subjectId", errors);
}

function checkSubject(obj: Obj, errors: string[]): void {
  checkText(obj, "name", errors, { min: 1, max: LIMITS.subjectName });
}

function checkNote(obj: Obj, errors: string[]): void {
  checkText(obj, "title", errors, { min: 1, max: LIMITS.noteTitle });
  checkText(obj, "body", errors, { min: 0, max: LIMITS.noteBody });
  if (!NOTE_ORIGINS.includes(obj["origin"] as NoteOrigin)) errors.push("origem da nota inválida");
  checkOptionalId(obj, "subjectId", errors);
}

function checkEgressLog(obj: Obj, errors: string[]): void {
  checkText(obj, "providerId", errors, { min: 1, max: LIMITS.providerId });
  const classes = obj["classes"];
  if (!Array.isArray(classes) || classes.length > DATA_CLASSES.length) {
    errors.push("classes de dado devem ser uma lista válida");
  } else if (!classes.every((c) => DATA_CLASSES.includes(c as DataClass))) {
    errors.push("classes de dado contêm um valor desconhecido");
  }
  if (obj["decision"] !== "allowed" && obj["decision"] !== "blocked") {
    errors.push("decisão deve ser permitida ou bloqueada");
  }
  for (const key of ["itemCount", "characterCount"]) {
    const value = obj[key];
    if (!Number.isInteger(value) || (value as number) < 0) {
      errors.push(`${label(key)} deve ser um inteiro não negativo`);
    }
  }
}

/**
 * Valida um registro vindo de qualquer fonte não confiável (armazenamento, arquivo importado).
 * É a fronteira de confiança: só registros que passam aqui entram no domínio.
 */
export function validateEntity(value: unknown): ValidationResult<AnyEntity> {
  if (!isObject(value)) return { ok: false, errors: ["registro não é um objeto válido"] };

  const kind = value["kind"];
  if (typeof kind !== "string" || !ENTITY_KINDS.includes(kind as EntityKind)) {
    return { ok: false, errors: ["tipo de registro desconhecido"] };
  }

  const errors: string[] = [];
  checkBase(value, errors);

  switch (kind as EntityKind) {
    case "task":
      checkTask(value, errors);
      break;
    case "subject":
      checkSubject(value, errors);
      break;
    case "note":
      checkNote(value, errors);
      break;
    case "egress-log":
      checkEgressLog(value, errors);
      break;
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: value as unknown as AnyEntity };
}

export { isObject };
export type { Obj as PlainObject };
