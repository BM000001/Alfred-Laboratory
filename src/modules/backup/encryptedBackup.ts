import { decodeBase64, encodeBase64 } from './backupBase64';

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

function parseEnvelope(raw: string) {
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
  const { salt, iv, ciphertext } = envelope;
  if (typeof salt !== 'string' || typeof iv !== 'string' || typeof ciphertext !== 'string') {
    throw new Error('Envelope de backup criptografado inválido.');
  }
  try {
    const decoded = { salt: decodeBase64(salt), iv: decodeBase64(iv), ciphertext: decodeBase64(ciphertext) };
    if (decoded.salt.length === SALT_BYTES && decoded.iv.length === IV_BYTES && decoded.ciphertext.length >= 16) {
      return decoded;
    }
  } catch {
    throw new Error('Envelope de backup criptografado inválido.');
  }
  throw new Error('Envelope de backup criptografado inválido.');
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
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(envelope);
}

export async function decryptBackup(raw: string, password: string): Promise<string> {
  if (!password) throw new Error('Informe a senha do backup.');
  const { salt, iv, ciphertext } = parseEnvelope(raw);
  try {
    const key = await deriveKey(password, salt);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error('Senha incorreta ou backup criptografado danificado.');
  }
}
