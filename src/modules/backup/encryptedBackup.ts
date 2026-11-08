const ENCRYPTED_FORMAT = 'alfred-encrypted-backup';
const ENCRYPTED_VERSION = 1;
const KDF_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const MIN_PASSWORD_LENGTH = 12;

interface EncryptedBackupEnvelope {
  format: typeof ENCRYPTED_FORMAT;
  version: typeof ENCRYPTED_VERSION;
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2-SHA-256';
  iterations: typeof KDF_ITERATIONS;
  salt: string;
  iv: string;
  ciphertext: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: unknown): Uint8Array {
  if (typeof value !== 'string' || value.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Envelope de backup criptografado inválido.');
  }
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function parseEnvelope(raw: string): EncryptedBackupEnvelope {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('O arquivo criptografado não contém JSON válido.'); }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Envelope de backup criptografado inválido.');
  }
  const envelope = value as Record<string, unknown>;
  if (envelope.format !== ENCRYPTED_FORMAT || envelope.version !== ENCRYPTED_VERSION ||
      envelope.algorithm !== 'AES-GCM' || envelope.kdf !== 'PBKDF2-SHA-256' ||
      envelope.iterations !== KDF_ITERATIONS) {
    throw new Error('Formato de backup criptografado inválido ou não compatível.');
  }
  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  const ciphertext = fromBase64(envelope.ciphertext);
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || ciphertext.length < 16) {
    throw new Error('Envelope de backup criptografado inválido.');
  }
  return envelope as unknown as EncryptedBackupEnvelope;
}

export function isEncryptedBackup(raw: string): boolean {
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'object' && value !== null && !Array.isArray(value) &&
      (value as Record<string, unknown>).format === ENCRYPTED_FORMAT;
  } catch { return false; }
}

export async function encryptBackup(plaintext: string, password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Use uma senha com pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (!plaintext) throw new Error('Não há conteúdo de backup para criptografar.');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const envelope: EncryptedBackupEnvelope = {
    format: ENCRYPTED_FORMAT,
    version: ENCRYPTED_VERSION,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2-SHA-256',
    iterations: KDF_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(envelope);
}

export async function decryptBackup(raw: string, password: string): Promise<string> {
  if (!password) throw new Error('Informe a senha do backup.');
  const envelope = parseEnvelope(raw);
  try {
    const salt = fromBase64(envelope.salt);
    const iv = fromBase64(envelope.iv);
    const ciphertext = fromBase64(envelope.ciphertext);
    const key = await deriveKey(password, salt);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error('Senha incorreta ou backup criptografado danificado.');
  }
}
