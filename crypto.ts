/**
 * Cifração de backups com senha.
 * PBKDF2-SHA256 (600.000 iterações, sal aleatório de 16 bytes) + AES-GCM-256 (IV aleatório de 12 bytes).
 * Sem a senha, o conteúdo não é recuperável.
 */

export const ENCRYPTED_FORMAT = "alfred-backup-encrypted";
const KDF_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedEnvelope {
  readonly format: typeof ENCRYPTED_FORMAT;
  readonly formatVersion: 1;
  readonly kdf: { readonly name: "PBKDF2"; readonly hash: "SHA-256"; readonly iterations: number; readonly salt: string };
  readonly cipher: { readonly name: "AES-GCM"; readonly iv: string };
  readonly data: string;
}

export class DecryptionError extends Error {
  constructor() {
    super("Não foi possível decifrar o backup. Verifique a senha.");
    this.name = "DecryptionError";
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(bytes);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(plaintext: string, passphrase: string): Promise<EncryptedEnvelope> {
  if (passphrase.length < 8) throw new Error("A senha do backup precisa ter pelo menos 8 caracteres.");
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return {
    format: ENCRYPTED_FORMAT,
    formatVersion: 1,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: KDF_ITERATIONS, salt: toBase64(salt) },
    cipher: { name: "AES-GCM", iv: toBase64(iv) },
    data: toBase64(new Uint8Array(cipher)),
  };
}

export async function decryptText(envelope: EncryptedEnvelope, passphrase: string): Promise<string> {
  if (envelope.kdf.iterations < 1 || envelope.kdf.iterations > 10_000_000) throw new DecryptionError();
  const salt = fromBase64(envelope.kdf.salt);
  const iv = fromBase64(envelope.cipher.iv);
  const data = fromBase64(envelope.data);
  const key = await deriveKey(passphrase, salt, envelope.kdf.iterations);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(plain);
  } catch {
    throw new DecryptionError();
  }
}

export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  return typeof value === "object" && value !== null && (value as { format?: unknown }).format === ENCRYPTED_FORMAT;
}
