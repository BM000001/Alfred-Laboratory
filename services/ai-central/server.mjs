import { createAccountVault } from './accountVault.mjs';
import { prepareAccount, publicAccount, executeAccount } from './providerAccounts.mjs';
import { PROMPT_VERSION, buildStudyPrompt } from './prompts.mjs';
import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const operations = new Set(['studies.analyze', 'studies.generate']);

const digest = value => createHash('sha256').update(value).digest('hex');
const failure = (status, message) => Object.assign(new Error(message), { status });

async function readRequestJson(req, maxBytes) {
  let length = 0; const chunks = [];
  for await (const chunk of req) { length += chunk.length; if (length > maxBytes) throw failure(413, 'Conteúdo excedeu o limite.'); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value; } catch { throw failure(400, 'JSON inválido.'); }
}
function checkConfig(config) {
  if (!config.token || config.token.length < 24) throw new Error('Configure CENTRAL_TOKEN com ao menos 24 caracteres.');
  if (!config.allowedOrigins?.length || config.allowedOrigins.includes('*')) throw new Error('Configure CENTRAL_ALLOWED_ORIGINS explicitamente, sem wildcard.');
  if (config.modelUrl) {
    const url = new URL(config.modelUrl);
    if (url.username || url.password || url.search || url.hash || !['http:', 'https:'].includes(url.protocol)) throw new Error('MODEL_URL inválida.');
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Use HTTPS para modelos fora de localhost.');
  }
}
export function createCentralServer(config) {
  checkConfig(config);
  const inflight = new Map();
  const dataDir = resolve(config.dataDir ?? './data');
  const accounts = createAccountVault(dataDir);
  const maxBytes = 12 * 1024 * 1024;
  const maxConcurrent = config.maxConcurrent ?? 1;
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    const send = (status, value) => { if (!res.destroyed) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); } };
    try {
      if (origin && !config.allowedOrigins.includes(origin)) throw failure(403, 'Origem não autorizada.');
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' }); res.end(); return; }
      const token = String(req.headers.authorization ?? '');
      const expected = `Bearer ${config.token}`;
      if (Buffer.byteLength(token) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) throw failure(401, 'Acesso não autorizado.');
      if (req.method === 'GET' && req.url === '/health') { const configured = (await accounts.list()).filter(account => account.model && account.freeTierConfirmed); send(200, { version: 1, ready: !!(config.modelUrl && config.model) || configured.length > 0, operations: [...operations], model: config.model ?? null, configuredConnections: configured.length, capabilities: ['provider-connections-v1', 'result-inbox-v1'] }); return; }
      const resultPath = req.url?.match(/^\/v1\/tasks\/([A-Za-z0-9%._:-]{1,720})$/);
      if (req.method === 'GET' && resultPath) {
        const id = decodeURIComponent(resultPath[1]); if (id.length > 240) throw failure(400, 'ID inválido.');
        try { const cached = JSON.parse(await readFile(resolve(dataDir, `${digest(id)}.json`), 'utf8')); if (cached.response?.id !== id) throw failure(404, 'Resposta não encontrada.'); send(200, cached.response); }
        catch (error) { if (error.code === 'ENOENT') throw failure(404, 'A resposta ainda não está disponível.'); throw error; } return;
      }
      const accountPath = req.url?.match(/^\/v1\/connections(?:\/([a-f0-9-]{36}))?$/);
      if (accountPath) {
        const id = accountPath[1];
        if (req.method === 'GET' && !id) { send(200, { version: 1, connections: (await accounts.list()).map(publicAccount) }); return; }
        if (req.method === 'DELETE' && id) { await accounts.remove(id); send(200, { removed: true }); return; }
        if ((req.method === 'POST' && !id) || (req.method === 'PATCH' && id)) {
          if (!req.headers['content-type']?.startsWith('application/json')) throw failure(415, 'Envie JSON.');
          const input = await readRequestJson(req, 32_000);
          if (req.method === 'POST') { const account = await prepareAccount(input, config.providerFetch ?? fetch); await accounts.add(account); send(201, { connection: publicAccount(account) }); }
          else { if (input.freeTierConfirmed !== true) throw failure(400, 'Confirme o plano e a cota gratuita do modelo.'); const account = await accounts.update(id, input.model); send(200, { connection: publicAccount(account) }); }
          return;
        }
        throw failure(404, 'Rota de conexão não encontrada.');
      }
      if (req.method !== 'POST' || req.url !== '/v1/tasks') throw failure(404, 'Rota não encontrada.');
      if (!req.headers['content-type']?.startsWith('application/json')) throw failure(415, 'Envie JSON.');
      const task = await readRequestJson(req, maxBytes);
      if (!task || task.version !== 1 || typeof task.id !== 'string' || task.id.length > 240 || !task.id || !operations.has(task.operation) || task.promptVersion !== PROMPT_VERSION || typeof task.sourceFileId !== 'string' || !task.sourceFileId || typeof task.text !== 'string' || task.text.length > 200_000) throw failure(400, 'Tarefa inválida.');
      if (task.image !== undefined && (task.operation !== 'studies.analyze' || typeof task.image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(task.image))) throw failure(400, 'Imagem inválida.');
      if (!task.text.trim() && !task.image) throw failure(400, 'Material vazio.');
      const account = task.connectionId ? await accounts.get(task.connectionId) : undefined;
      if (task.connectionId && (!account || !account.model || task.connectionRevision !== account.revision)) throw failure(409, 'A conexão ou o modelo mudou. Prepare uma nova solicitação.');
      if (account && (task.freeTierConsent !== true || !account.freeTierConfirmed)) throw failure(402, 'Confirme o uso da cota gratuita antes de enviar.');
      const selectedModel = account?.model ?? config.model;
      const canonical = JSON.stringify({ version: 1, id: task.id, operation: task.operation, sourceFileId: task.sourceFileId, promptVersion: task.promptVersion, text: task.text, image: task.image ?? null, model: selectedModel, connectionId: account?.id ?? null, revision: account?.revision ?? null });
      const fingerprint = digest(canonical), key = digest(task.id), path = resolve(dataDir, `${key}.json`);
      await mkdir(dataDir, { recursive: true, mode: 0o700 });
      let cached;
      try { cached = JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (cached) { if (cached.fingerprint !== fingerprint) throw failure(409, 'ID pertence a outro material ou modelo.'); send(200, cached.response); return; }
      if (!account && (!config.modelUrl || !config.model)) throw failure(503, 'Nenhum modelo configurado. A Central não simula respostas.');
      const current = inflight.get(key);
      if (current && current.fingerprint !== fingerprint) throw failure(409, 'ID já em uso por outro material.');
      if (!current && inflight.size >= maxConcurrent) throw failure(429, 'Central ocupada. Retome esta tarefa mais tarde.');
      if (!current) {
        const promise = (async () => {
          let result, usage;
          if (account) { const generated = await executeAccount(account, task, buildStudyPrompt(task.operation), config.providerFetch ?? fetch); result = generated.result; usage = generated.usage; } else {
          const content = [{ type: 'text', text: JSON.stringify({ sourceFileId: task.sourceFileId, material: task.text }) }];
          if (task.image) content.push({ type: 'image_url', image_url: { url: task.image } });
          const response = await (config.fetch ?? fetch)(config.modelUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(config.modelToken ? { Authorization: `Bearer ${config.modelToken}` } : {}) }, redirect: 'error', signal: AbortSignal.timeout(config.timeoutMs ?? 110_000), body: JSON.stringify({ model: config.model, temperature: 0, max_tokens: 4096, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: buildStudyPrompt(task.operation) }, { role: 'user', content }] }) });
          if (!response.ok) throw failure(502, 'O modelo recusou a solicitação.');
          const raw = await response.text(); if (raw.length > 1_000_000) throw failure(502, 'Resposta do modelo excedeu o limite.');
          let envelope;
          try { envelope = JSON.parse(raw); result = JSON.parse(envelope.choices[0].message.content); } catch { throw failure(502, 'O modelo não retornou JSON válido.'); }
          const reported = envelope.usage;
          usage = Number.isSafeInteger(reported?.prompt_tokens) && reported.prompt_tokens >= 0 && Number.isSafeInteger(reported?.completion_tokens) && reported.completion_tokens >= 0 ? { inputTokens: reported.prompt_tokens, outputTokens: reported.completion_tokens } : undefined;
          }
          if (!result || Array.isArray(result) || typeof result !== 'object' || (task.operation === 'studies.analyze' ? typeof result.text !== 'string' || !Array.isArray(result.uncertainties) : !Array.isArray(result.flashcards) || !Array.isArray(result.questions))) throw failure(502, 'Resposta incompatível com a operação.');
          const output = { version: 1, id: task.id, model: selectedModel, ...(account ? { connectionId: account.id, connectionRevision: account.revision, provider: account.provider } : {}), result, ...(usage ? { usage } : {}) };
          const temp = `${path}.tmp`; await writeFile(temp, JSON.stringify({ fingerprint, response: output }), { mode: 0o600 }); await rename(temp, path);
          return output;
        })();
        inflight.set(key, { fingerprint, promise });
      }
      try { send(200, await inflight.get(key).promise); } finally { inflight.delete(key); }
    } catch (error) { send(error.status ?? 500, { error: { code: `HTTP_${error.status ?? 500}`, message: error.status ? error.message : 'Falha interna da Central. Verifique o serviço e tente novamente.' } }); }
  });
  server.requestTimeout = 130_000;
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = createCentralServer({ token: process.env.CENTRAL_TOKEN, allowedOrigins: (process.env.CENTRAL_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean), modelUrl: process.env.MODEL_URL, model: process.env.MODEL_ID, modelToken: process.env.MODEL_TOKEN, dataDir: process.env.CENTRAL_DATA_DIR });
  server.listen(Number(process.env.PORT ?? 8787), process.env.HOST ?? '127.0.0.1', () => console.log('Central de IAs iniciada. Modelo configurado:', !!process.env.MODEL_ID));
}
