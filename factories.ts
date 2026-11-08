import { SCHEMA_VERSION, type AnyEntity, type EgressLog, type Note, type NoteOrigin, type Subject, type Task, type DataClass } from "./entities.js";
import { validateEntity, type ValidationResult } from "./validation.js";

/** Dependências injetadas, para que as fábricas sejam testáveis e puras. */
export interface Context {
  readonly now: () => string;
  readonly deviceId: string;
  readonly newId: () => string;
}

function base(ctx: Context) {
  const now = ctx.now();
  return {
    id: ctx.newId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deviceId: ctx.deviceId,
    schemaVersion: SCHEMA_VERSION,
  } as const;
}

function checked<T extends AnyEntity>(entity: unknown): ValidationResult<T> {
  const result = validateEntity(entity);
  return result.ok ? { ok: true, value: result.value as T } : result;
}

export function createTask(
  input: { title: string; notes?: string; dueDate?: string | null; subjectId?: string | null },
  ctx: Context,
): ValidationResult<Task> {
  return checked<Task>({
    ...base(ctx),
    kind: "task",
    title: input.title.trim(),
    notes: (input.notes ?? "").trim(),
    done: false,
    dueDate: input.dueDate ?? null,
    subjectId: input.subjectId ?? null,
  });
}

export function createSubject(input: { name: string }, ctx: Context): ValidationResult<Subject> {
  return checked<Subject>({ ...base(ctx), kind: "subject", name: input.name.trim() });
}

export function createNote(
  input: { title: string; body: string; origin: NoteOrigin; subjectId?: string | null },
  ctx: Context,
): ValidationResult<Note> {
  return checked<Note>({
    ...base(ctx),
    kind: "note",
    title: input.title.trim(),
    body: input.body,
    origin: input.origin,
    subjectId: input.subjectId ?? null,
  });
}

export function createEgressLog(
  input: {
    providerId: string;
    classes: readonly DataClass[];
    decision: "allowed" | "blocked";
    itemCount: number;
    characterCount: number;
  },
  ctx: Context,
): ValidationResult<EgressLog> {
  return checked<EgressLog>({ ...base(ctx), kind: "egress-log", ...input, classes: [...input.classes] });
}

/**
 * Aplica alterações a um registro existente.
 * Mantém id, kind, createdAt e schemaVersion. Atualiza updatedAt e deviceId.
 */
export function applyChange<T extends AnyEntity>(
  entity: T,
  patch: Readonly<Record<string, unknown>>,
  ctx: Context,
): ValidationResult<T> {
  const forbidden = ["id", "kind", "createdAt", "schemaVersion"];
  for (const key of forbidden) {
    if (key in patch) return { ok: false, errors: [`campo ${key} não pode ser alterado`] };
  }
  return checked<T>({ ...entity, ...patch, updatedAt: ctx.now(), deviceId: ctx.deviceId });
}

export function softDelete<T extends AnyEntity>(entity: T, ctx: Context): ValidationResult<T> {
  return applyChange(entity, { deletedAt: ctx.now() }, ctx);
}
