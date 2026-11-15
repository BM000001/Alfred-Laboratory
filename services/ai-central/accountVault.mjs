import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Single-owner vault. Protect/back up the directory; encryption is not protection
 * against a compromised server that can read both the ciphertext and master key. */
export function createAccountVault(dataDir) {
  const directory = resolve(dataDir, '.connections');
  let keyPromise; let chain = Promise.resolve();
  async function key() {
    if (!keyPromise) keyPromise = (async () => {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const path = resolve(directory, 'master.key');
      try { await writeFile(path, randomBytes(32), { flag: 'wx', mode: 0o600 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      const value = await readFile(path); if (value.length !== 32) throw new Error('Chave do cofre inválida.'); return value;
    })();
    return keyPromise;
  }
  async function read() {
    const secret = await key(); let value;
    try { value = JSON.parse(await readFile(resolve(directory, 'accounts.enc'), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    const decipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(value.iv, 'base64')); decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
    const accounts = JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8'));
    if (!Array.isArray(accounts)) throw new Error('Cofre inválido.'); return accounts;
  }
  async function write(accounts) {
    const secret = await key(), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', secret, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(accounts), 'utf8'), cipher.final()]);
    const temporary = resolve(directory, `${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify({ version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') }), { mode: 0o600 });
    await rename(temporary, resolve(directory, 'accounts.enc'));
  }
  async function mutate(operation) {
    const next = chain.then(async () => { const accounts = await read(); const result = await operation(accounts); await write(accounts); return result; });
    chain = next.catch(() => {}); return next;
  }
  return { list: read, get: async id => (await read()).find(account => account.id === id), add: account => mutate(accounts => { if (accounts.length >= 10) throw Object.assign(new Error('Limite de 10 conexões atingido.'), { status: 409 }); accounts.push(account); return account; }), update: (id, model) => mutate(accounts => { const account = accounts.find(item => item.id === id); if (!account || !account.models.includes(model)) throw Object.assign(new Error('Conexão ou modelo inválido.'), { status: 404 }); account.model = model; account.revision = randomUUID(); return account; }), remove: id => mutate(accounts => { const index = accounts.findIndex(item => item.id === id); if (index < 0) throw Object.assign(new Error('Conexão não encontrada.'), { status: 404 }); accounts.splice(index, 1); }) };
}
