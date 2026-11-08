import { SCHEMA_VERSION, type AnyEntity } from "../domain/entities.js";
import { validateEntity } from "../domain/validation.js";
import { decryptText, encryptText, isEncryptedEnvelope, type EncryptedEnvelope } from "./crypto.js";
import type { EntityStore } from "./repository.js";

export const BACKUP_FORMAT = "alfred-backup";
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupDocument {
  readonly format: typeof BACKUP_FORMAT;
  readonly formatVersion: number;
  readonly schemaVersion: number;
  readonly exportedAt: string;
  readonly deviceId: string;
  readonly entityCount: number;
  /** SHA-256 de JSON.stringify(entities). Detecta corrupção acidental. */
  readonly checksum: string;
  readonly entities: readonly AnyEntity[];
}

export type BackupErrorCode =
  | "INVALID_JSON"
  | "UNKNOWN_FORMAT"
  | "UNSUPPORTED_FORMAT_VERSION"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "MALFORMED"
  | "CHECKSUM_MISMATCH"
  | "PASSPHRASE_REQUIRED"
  | "DECRYPT_FAILED";

export class BackupError extends Error {
  constructor(readonly code: BackupErrorCode, message: string) {
    super(message);
    this.name = "BackupError";
  }
}

export interface ImportReport {
  /** Registros novos, gravados pela primeira vez. */
  readonly imported: number;
  /** Registros existentes substituídos por versão mais recente. */
  readonly updated: number;
  /** Registros do arquivo mais antigos ou iguais aos locais. Nada foi alterado. */
  readonly ignored: number;
  /** Registros rejeitados pela validação. */
  readonly invalid: number;
  readonly errors: readonly string[];
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Gera o texto do backup. Inclui exclusões lógicas, para que a remoção seja
 * propagada ao importar em outro aparelho.
 * Com senha, o arquivo inteiro é cifrado.
 */
export async function createBackupText(
  entities: readonly AnyEntity[],
  options: { readonly deviceId: string; readonly exportedAt: string; readonly passphrase?: string },
): Promise<string> {
  const checksum = await sha256Hex(JSON.stringify(entities));
  const document: BackupDocument = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: options.exportedAt,
    deviceId: options.deviceId,
    entityCount: entities.length,
    checksum,
    entities,
  };
  const plaintext = JSON.stringify(document, null, 2);

  if (options.passphrase === undefined) return plaintext;
  const envelope = await encryptText(plaintext, options.passphrase);
  return JSON.stringify(envelope, null, 2);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new BackupError("INVALID_JSON", "O arquivo não é um JSON válido.");
  }
}

async function unwrap(text: string, passphrase: string | undefined): Promise<BackupDocument> {
  let parsed = parseJson(text);
  if (isEncryptedEnvelope(parsed)) {
    if (passphrase === undefined || passphrase.length === 0) {
      throw new BackupError("PASSPHRASE_REQUIRED", "Este backup está cifrado. Informe a senha.");
    }
    let plaintext: string;
    try {
      plaintext = await decryptText(parsed as EncryptedEnvelope, passphrase);
    } catch {
      throw new BackupError("DECRYPT_FAILED", "Não foi possível decifrar o backup. Verifique a senha.");
    }
    parsed = parseJson(plaintext);
  }
  return checkHeader(parsed);
}

function checkHeader(value: unknown): BackupDocument {
  if (typeof value !== "object" || value === null) {
    throw new BackupError("MALFORMED", "Estrutura do backup inválida.");
  }
  const doc = value as Record<string, unknown>;
  if (doc["format"] !== BACKUP_FORMAT) {
    throw new BackupError("UNKNOWN_FORMAT", "O arquivo não é um backup do Alfred.");
  }
  if (doc["formatVersion"] !== BACKUP_FORMAT_VERSION) {
    throw new BackupError("UNSUPPORTED_FORMAT_VERSION", "Versão de backup não suportada por este aplicativo.");
  }
  const schema = doc["schemaVersion"];
  if (!Number.isInteger(schema) || (schema as number) > SCHEMA_VERSION || (schema as number) < 1) {
    throw new BackupError(
      "UNSUPPORTED_SCHEMA_VERSION",
      "O backup foi criado por uma versão mais nova do Alfred. Atualize o aplicativo para importá-lo.",
    );
  }
  if (!Array.isArray(doc["entities"]) || typeof doc["checksum"] !== "string") {
    throw new BackupError("MALFORMED", "Estrutura do backup inválida.");
  }
  return doc as unknown as BackupDocument;
}

/**
 * Importa um backup por mesclagem. Para cada registro, a versão com `updatedAt` mais
 * recente prevalece. Nada é removido localmente; exclusões chegam como registros com `deletedAt`.
 * Se o arquivo falhar em qualquer verificação global, nada é gravado.
 */
export async function importBackupText(
  store: EntityStore,
  text: string,
  options: { readonly passphrase?: string } = {},
): Promise<ImportReport> {
  const doc = await unwrap(text, options.passphrase);

  const canonical = await sha256Hex(JSON.stringify(doc.entities));
  if (canonical !== doc.checksum) {
    throw new BackupError("CHECKSUM_MISMATCH", "O backup está corrompido: a verificação de integridade falhou.");
  }

  let imported = 0;
  let updated = 0;
  let ignored = 0;
  let invalid = 0;
  const errors: string[] = [];

  for (const [index, raw] of doc.entities.entries()) {
    const result = validateEntity(raw);
    if (!result.ok) {
      invalid += 1;
      errors.push(`registro ${index + 1}: ${result.errors[0] ?? "inválido"}`);
      continue;
    }
    const incoming = result.value;
    const existing = await store.get(incoming.id);
    if (!existing) {
      await store.put(incoming);
      imported += 1;
    } else if (Date.parse(incoming.updatedAt) > Date.parse(existing.updatedAt)) {
      await store.put(incoming);
      updated += 1;
    } else {
      ignored += 1;
    }
  }

  return { imported, updated, ignored, invalid, errors };
}
