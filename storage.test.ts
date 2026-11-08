import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore, listActive } from "../src/storage/repository.js";
import { createSubject, createTask, softDelete } from "../src/domain/factories.js";
import { makeContext } from "./helpers.js";

describe("armazenamento em memória e consultas", () => {
  it("grava, lê e lista", async () => {
    const store = new MemoryStore();
    const ctx = makeContext();
    const t = createTask({ title: "a" }, ctx);
    if (!t.ok) throw new Error("fixture inválida");
    await store.put(t.value);
    assert.equal((await store.get(t.value.id))?.id, t.value.id);
    assert.equal((await store.all()).length, 1);
  });

  it("listActive esconde exclusões lógicas e filtra por tipo", async () => {
    const store = new MemoryStore();
    const ctx = makeContext();
    const keep = createTask({ title: "ativa" }, ctx);
    const gone = createTask({ title: "excluída" }, ctx);
    const subject = createSubject({ name: "Física" }, ctx);
    if (!keep.ok || !gone.ok || !subject.ok) throw new Error("fixture inválida");
    const removed = softDelete(gone.value, ctx);
    if (!removed.ok) throw new Error("fixture inválida");

    await store.put(keep.value);
    await store.put(removed.value);
    await store.put(subject.value);

    const tasks = await listActive(store, "task");
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.title, "ativa");
    assert.equal((await listActive(store, "subject")).length, 1);
  });
});
