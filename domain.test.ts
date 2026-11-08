import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { newId } from "../src/domain/ids.js";
import { SCHEMA_VERSION } from "../src/domain/entities.js";
import { applyChange, createNote, createSubject, createTask, softDelete } from "../src/domain/factories.js";
import { validateEntity, isDateOnly, LIMITS } from "../src/domain/validation.js";
import { makeContext } from "./helpers.js";

describe("identificadores", () => {
  it("geram UUID v4 distintos", () => {
    const a = newId();
    const b = newId();
    assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(a, b);
  });
});

describe("criação de tarefas", () => {
  it("cria tarefa válida com metadados e valores padrão", () => {
    const ctx = makeContext("aparelho-A");
    const result = createTask({ title: "  Ler capítulo 3  ", notes: " páginas 40-60 " }, ctx);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const t = result.value;
    assert.equal(t.kind, "task");
    assert.equal(t.title, "Ler capítulo 3");
    assert.equal(t.notes, "páginas 40-60");
    assert.equal(t.done, false);
    assert.equal(t.dueDate, null);
    assert.equal(t.subjectId, null);
    assert.equal(t.deletedAt, null);
    assert.equal(t.deviceId, "aparelho-A");
    assert.equal(t.schemaVersion, SCHEMA_VERSION);
    assert.equal(t.createdAt, t.updatedAt);
  });

  it("rejeita título vazio", () => {
    const result = createTask({ title: "   " }, makeContext());
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.includes("título")));
  });

  it("rejeita título acima do limite", () => {
    const result = createTask({ title: "x".repeat(LIMITS.taskTitle + 1) }, makeContext());
    assert.equal(result.ok, false);
  });

  it("aceita data de vencimento válida e rejeita data inexistente", () => {
    assert.equal(createTask({ title: "a", dueDate: "2026-02-28" }, makeContext()).ok, true);
    const invalid = createTask({ title: "a", dueDate: "2026-02-30" }, makeContext());
    assert.equal(invalid.ok, false);
  });
});

describe("datas somente com dia", () => {
  it("aceita datas reais e rejeita formatos e datas inexistentes", () => {
    assert.equal(isDateOnly("2028-02-29"), true);
    assert.equal(isDateOnly("2027-02-29"), false);
    assert.equal(isDateOnly("29/02/2028"), false);
    assert.equal(isDateOnly("2026-13-01"), false);
    assert.equal(isDateOnly(null), false);
  });
});

describe("alterações e exclusão lógica", () => {
  it("applyChange atualiza updatedAt e mantém id, kind e createdAt", () => {
    const ctx = makeContext();
    const created = createTask({ title: "Tarefa" }, ctx);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const changed = applyChange(created.value, { done: true }, ctx);
    assert.equal(changed.ok, true);
    if (!changed.ok) return;
    assert.equal(changed.value.id, created.value.id);
    assert.equal(changed.value.kind, "task");
    assert.equal(changed.value.createdAt, created.value.createdAt);
    assert.equal(changed.value.done, true);
    assert.ok(Date.parse(changed.value.updatedAt) > Date.parse(created.value.updatedAt));
  });

  it("applyChange recusa alterar campos protegidos", () => {
    const ctx = makeContext();
    const created = createTask({ title: "Tarefa" }, ctx);
    if (!created.ok) throw new Error("fixture inválida");
    const result = applyChange(created.value, { id: "outro" }, ctx);
    assert.equal(result.ok, false);
  });

  it("softDelete mantém o registro com deletedAt preenchido", () => {
    const ctx = makeContext();
    const created = createSubject({ name: "Cálculo I" }, ctx);
    if (!created.ok) throw new Error("fixture inválida");
    const deleted = softDelete(created.value, ctx);
    assert.equal(deleted.ok, true);
    if (!deleted.ok) return;
    assert.notEqual(deleted.value.deletedAt, null);
    assert.equal(deleted.value.id, created.value.id);
  });
});

describe("validação de registros de fonte não confiável", () => {
  const ctx = makeContext();

  it("aceita registros gerados pelas fábricas", () => {
    const note = createNote({ title: "Resumo", body: "texto", origin: "manual" }, ctx);
    if (!note.ok) throw new Error("fixture inválida");
    assert.equal(validateEntity(note.value).ok, true);
  });

  it("rejeita valor que não é objeto", () => {
    assert.equal(validateEntity("texto").ok, false);
    assert.equal(validateEntity(null).ok, false);
    assert.equal(validateEntity([]).ok, false);
  });

  it("rejeita kind desconhecido", () => {
    const result = validateEntity({ kind: "shell-command" });
    assert.equal(result.ok, false);
  });

  it("rejeita schemaVersion de versão futura", () => {
    const task = createTask({ title: "a" }, ctx);
    if (!task.ok) throw new Error("fixture inválida");
    const result = validateEntity({ ...task.value, schemaVersion: SCHEMA_VERSION + 1 });
    assert.equal(result.ok, false);
  });

  it("rejeita updatedAt anterior a createdAt", () => {
    const task = createTask({ title: "a" }, ctx);
    if (!task.ok) throw new Error("fixture inválida");
    const result = validateEntity({ ...task.value, updatedAt: "2000-01-01T00:00:00.000Z" });
    assert.equal(result.ok, false);
  });

  it("rejeita origem de nota desconhecida", () => {
    const note = createNote({ title: "a", body: "b", origin: "manual" }, ctx);
    if (!note.ok) throw new Error("fixture inválida");
    assert.equal(validateEntity({ ...note.value, origin: "web" }).ok, false);
  });

  it("rejeita tipos errados em campos obrigatórios", () => {
    const task = createTask({ title: "a" }, ctx);
    if (!task.ok) throw new Error("fixture inválida");
    assert.equal(validateEntity({ ...task.value, done: "sim" }).ok, false);
    assert.equal(validateEntity({ ...task.value, title: 42 }).ok, false);
  });
});
