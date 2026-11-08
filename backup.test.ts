import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../src/storage/repository.js";
import { BackupError, createBackupText, importBackupText, sha256Hex } from "../src/storage/backup.js";
import { encryptText, decryptText, DecryptionError } from "../src/storage/crypto.js";
import { createNote, createTask, applyChange, softDelete } from "../src/domain/factories.js";
import type { AnyEntity } from "../src/domain/entities.js";
import { makeContext } from "./helpers.js";

const SECRET_TITLE = "Prova de Cálculo com dados sigilosos";

function fixtureEntities(): AnyEntity[] {
  const ctx = makeContext("aparelho-origem");
  const task = createTask({ title: SECRET_TITLE, notes: "conteúdo pessoal" }, ctx);
  const note = createNote({ title: "Resumo", body: "corpo da nota", origin: "manual" }, ctx);
  if (!task.ok || !note.ok) throw new Error("fixture inválida");
  return [task.value, note.value];
}

async function exportText(entities: AnyEntity[], passphrase?: string): Promise<string> {
  return createBackupText(entities, {
    deviceId: "aparelho-origem",
    exportedAt: "2026-03-01T12:00:00.000Z",
    ...(passphrase !== undefined ? { passphrase } : {}),
  });
}

describe("backup sem cifração", () => {
  it("exporta e importa em um armazenamento vazio, preservando os registros", async () => {
    const entities = fixtureEntities();
    const text = await exportText(entities);
    const target = new MemoryStore();
    const report = await importBackupText(target, text);
    assert.equal(report.imported, entities.length);
    assert.equal(report.invalid, 0);
    const restored = await target.all();
    assert.deepEqual(
      restored.map((e) => e.id).sort(),
      entities.map((e) => e.id).sort(),
    );
  });

  it("recusa arquivo que não é JSON", async () => {
    await assert.rejects(importBackupText(new MemoryStore(), "{ isto não é json"), (err: unknown) => {
      return err instanceof BackupError && err.code === "INVALID_JSON";
    });
  });

  it("recusa arquivo de outro formato", async () => {
    const fake = JSON.stringify({ format: "outro-app", formatVersion: 1, schemaVersion: 1, entities: [], checksum: "x" });
    await assert.rejects(importBackupText(new MemoryStore(), fake), (err: unknown) => {
      return err instanceof BackupError && err.code === "UNKNOWN_FORMAT";
    });
  });

  it("recusa backup criado por versão de esquema mais nova", async () => {
    const text = await exportText(fixtureEntities());
    const doc = JSON.parse(text) as Record<string, unknown>;
    doc["schemaVersion"] = 99;
    await assert.rejects(importBackupText(new MemoryStore(), JSON.stringify(doc)), (err: unknown) => {
      return err instanceof BackupError && err.code === "UNSUPPORTED_SCHEMA_VERSION";
    });
  });

  it("recusa arquivo alterado após exportação (checksum)", async () => {
    const text = await exportText(fixtureEntities());
    const doc = JSON.parse(text) as { entities: Array<{ title?: string }> };
    const first = doc.entities[0];
    if (!first || first.title === undefined) throw new Error("fixture inválida");
    first.title = "título adulterado";
    await assert.rejects(importBackupText(new MemoryStore(), JSON.stringify(doc)), (err: unknown) => {
      return err instanceof BackupError && err.code === "CHECKSUM_MISMATCH";
    });
  });

  it("não grava nada quando a verificação global falha", async () => {
    const text = await exportText(fixtureEntities());
    const doc = JSON.parse(text) as { entities: Array<{ title?: string }> };
    const first = doc.entities[0];
    if (!first) throw new Error("fixture inválida");
    first.title = "x";
    const target = new MemoryStore();
    await assert.rejects(importBackupText(target, JSON.stringify(doc)));
    assert.equal((await target.all()).length, 0);
  });

  it("registros inválidos são contados e ignorados, sem interromper a importação", async () => {
    const entities = fixtureEntities();
    const text = await exportText([...entities, { kind: "task", id: "" } as unknown as AnyEntity]);
    const target = new MemoryStore();
    const report = await importBackupText(target, text);
    assert.equal(report.imported, entities.length);
    assert.equal(report.invalid, 1);
    assert.equal(report.errors.length, 1);
  });
});

describe("mesclagem por última alteração", () => {
  it("substitui registro local mais antigo e ignora o mais antigo do arquivo", async () => {
    const ctx = makeContext("aparelho-origem");
    const base = createTask({ title: "original" }, ctx);
    if (!base.ok) throw new Error("fixture inválida");
    const newer = await applyChange(base.value, { title: "mais recente" }, ctx);
    if (!newer.ok) throw new Error("fixture inválida");

    const fileText = await exportText([newer.value]);
    const localStore = new MemoryStore();
    await localStore.put(base.value);
    const report1 = await importBackupText(localStore, fileText);
    assert.equal(report1.updated, 1);
    assert.equal((await localStore.get(base.value.id))?.kind, "task");

    const olderText = await exportText([base.value]);
    const report2 = await importBackupText(localStore, olderText);
    assert.equal(report2.ignored, 1);
    const finalState = await localStore.get(base.value.id);
    assert.equal(finalState && "title" in finalState ? finalState.title : undefined, "mais recente");
  });

  it("propaga exclusão lógica quando o registro do arquivo é mais novo", async () => {
    const ctx = makeContext("aparelho-origem");
    const created = createTask({ title: "a remover" }, ctx);
    if (!created.ok) throw new Error("fixture inválida");
    const deleted = softDelete(created.value, ctx);
    if (!deleted.ok) throw new Error("fixture inválida");

    const local = new MemoryStore();
    await local.put(created.value);
    await importBackupText(local, await exportText([deleted.value]));
    const after = await local.get(created.value.id);
    assert.notEqual(after?.deletedAt, null);
  });
});

describe("backup cifrado", () => {
  const PASSPHRASE = "senha-longa-de-teste";

  it("cifra o conteúdo: o texto do arquivo não revela dados em claro", async () => {
    const text = await exportText(fixtureEntities(), PASSPHRASE);
    assert.equal(text.includes(SECRET_TITLE), false);
    assert.equal(text.includes("alfred-backup-encrypted"), true);
  });

  it("importa com a senha correta", async () => {
    const text = await exportText(fixtureEntities(), PASSPHRASE);
    const target = new MemoryStore();
    const report = await importBackupText(target, text, { passphrase: PASSPHRASE });
    assert.equal(report.imported, 2);
  });

  it("exige senha para importar arquivo cifrado", async () => {
    const text = await exportText(fixtureEntities(), PASSPHRASE);
    await assert.rejects(importBackupText(new MemoryStore(), text), (err: unknown) => {
      return err instanceof BackupError && err.code === "PASSPHRASE_REQUIRED";
    });
  });

  it("rejeita senha incorreta sem gravar nada", async () => {
    const text = await exportText(fixtureEntities(), PASSPHRASE);
    const target = new MemoryStore();
    await assert.rejects(importBackupText(target, text, { passphrase: "senha-errada-123" }), (err: unknown) => {
      return err instanceof BackupError && err.code === "DECRYPT_FAILED";
    });
    assert.equal((await target.all()).length, 0);
  });

  it("recusa senha curta na cifração", async () => {
    await assert.rejects(encryptText("conteúdo", "curta"));
  });

  it("decifragem com senha errada lança DecryptionError", async () => {
    const envelope = await encryptText("conteúdo", PASSPHRASE);
    await assert.rejects(decryptText(envelope, "outra-senha-longa"), DecryptionError);
    assert.equal(await decryptText(envelope, PASSPHRASE), "conteúdo");
  });
});

describe("integridade", () => {
  it("checksum é determinístico para o mesmo conteúdo", async () => {
    const a = await sha256Hex("abc");
    const b = await sha256Hex("abc");
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });
});
