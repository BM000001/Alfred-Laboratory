// A multiple of three keeps padding confined to the final encoded chunk.
const BYTE_CHUNK_SIZE = 0x6000;
const BASE64_CHUNK_SIZE = BYTE_CHUNK_SIZE / 3 * 4;

export function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += BYTE_CHUNK_SIZE) {
    chunks.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + BYTE_CHUNK_SIZE))));
  }
  return chunks.join('');
}

export function base64ByteLength(value: string): number {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const body = padding ? value.slice(0, -padding) : value;
  // Search for an invalid character without a repeated group on large inputs.
  if (value.length % 4 !== 0 || /[^A-Za-z0-9+/]/.test(body)) {
    throw new Error('Conteúdo Base64 inválido.');
  }
  return value.length / 4 * 3 - padding;
}

export function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(base64ByteLength(value));
  let byteOffset = 0;
  for (let offset = 0; offset < value.length; offset += BASE64_CHUNK_SIZE) {
    const chunk = atob(value.slice(offset, offset + BASE64_CHUNK_SIZE));
    for (let index = 0; index < chunk.length; index++) {
      bytes[byteOffset++] = chunk.charCodeAt(index);
    }
  }
  return bytes;
}
