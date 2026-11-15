import { randomUUID } from 'node:crypto';

const fail = (status, message) => Object.assign(new Error(message), { status });
const endpoints = { gemini: 'https://generativelanguage.googleapis.com/v1beta/models', groq: 'https://api.groq.com/openai/v1/models' };
export const providerNames = { gemini: 'Gemini API', groq: 'Groq API' };
async function readJson(response) {
  if (!response.ok) throw fail(response.status === 401 || response.status === 403 ? 422 : response.status === 429 ? 429 : 502, response.status === 401 || response.status === 403 ? 'A chave não permite acesso à API deste provedor.' : response.status === 429 ? 'Cota ou limite da API atingido. A tarefa foi preservada; tente novamente quando houver disponibilidade.' : `Provedor indisponível (HTTP ${response.status}).`);
  const raw = await response.text();
  if (raw.length > 2_000_000) throw fail(502, 'Resposta do provedor excedeu o limite.');
  try { return JSON.parse(raw); } catch { throw fail(502, 'O provedor retornou uma resposta inválida.'); }
}
export async function discoverModels(provider, apiKey, request = fetch) {
  if (!Object.hasOwn(endpoints, provider)) throw fail(400, 'Provedor não suportado.');
  if (typeof apiKey !== 'string' || apiKey.trim().length < 8 || apiKey.length > 4096 || /[\r\n]/.test(apiKey)) throw fail(400, 'Informe uma chave de API válida.');
  const headers = provider === 'gemini' ? { 'x-goog-api-key': apiKey.trim() } : { Authorization: `Bearer ${apiKey.trim()}` };
  const models = new Set(); let next = '';
  for (let page = 0; page < 10; page++) {
    const url = new URL(endpoints[provider]);
    if (provider === 'gemini') { url.searchParams.set('pageSize', '1000'); if (next) url.searchParams.set('pageToken', next); }
    const value = await readJson(await request(url.toString(), { headers, redirect: 'error', signal: AbortSignal.timeout(15_000) }));
    const entries = provider === 'gemini' ? value.models : value.data;
    if (!Array.isArray(entries)) throw fail(502, 'Catálogo de modelos inválido.');
    for (const entry of entries) {
      const id = provider === 'gemini' ? entry?.name?.replace(/^models\//, '') : entry?.id;
      if (typeof id !== 'string' || !/^[a-zA-Z0-9._\/-]{1,200}$/.test(id) || id.includes('..')) continue;
      if (provider === 'gemini' ? entry.supportedGenerationMethods?.includes('generateContent') : entry.active !== false && !/(?:whisper|tts|guard|audio|compound)/i.test(id)) models.add(id);
    }
    next = provider === 'gemini' && typeof value.nextPageToken === 'string' ? value.nextPageToken : '';
    if (!next) break;
    if (page === 9) throw fail(502, 'Catálogo excedeu o limite de paginação.');
  }
  if (!models.size) throw fail(422, 'A chave foi aceita, mas nenhum modelo de geração compatível foi encontrado.');
  return [...models].sort();
}
export async function prepareAccount(input, request = fetch) {
  if (!input || !Object.hasOwn(providerNames, input.provider) || typeof input.label !== 'string' || !input.label.trim() || input.label.length > 80 || input.freeTierConfirmed !== true) throw fail(400, 'Informe provedor e nome da conexão.');
  const models = await discoverModels(input.provider, input.apiKey, request);
  return { id: randomUUID(), provider: input.provider, label: input.label.trim(), apiKey: input.apiKey.trim(), models, model: null, createdAt: new Date().toISOString(), revision: randomUUID(), freeTierConfirmed: true };
}
export function publicAccount(account) {
  return { id: account.id, provider: account.provider, label: account.label, models: account.models, model: account.model, createdAt: account.createdAt, revision: account.revision, requiresApiConsent: true, freeTierConfirmed: account.freeTierConfirmed === true };
}
export async function executeAccount(account, task, instruction, request = fetch) {
  if (!account.model || !account.models.includes(account.model)) throw fail(409, 'Selecione e confirme um modelo para esta conexão.');
  if (task.freeTierConsent !== true || account.freeTierConfirmed !== true) throw fail(402, 'Confirme o uso da cota gratuita antes de enviar. Nenhum plano pago será escolhido como alternativa.');
  let url, headers, body;
  const material = JSON.stringify({ sourceFileId: task.sourceFileId, material: task.text });
  if (account.provider === 'gemini') {
    const parts = [{ text: material }];
    if (task.image) { const [, mimeType, data] = task.image.match(/^data:([^;]+);base64,(.+)$/); parts.push({ inlineData: { mimeType, data } }); }
    url = `${endpoints.gemini}/${encodeURIComponent(account.model)}:generateContent`;
    headers = { 'Content-Type': 'application/json', 'x-goog-api-key': account.apiKey };
    body = { systemInstruction: { parts: [{ text: instruction }] }, contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096, temperature: 0 } };
  } else {
    const content = [{ type: 'text', text: material }];
    if (task.image) content.push({ type: 'image_url', image_url: { url: task.image } });
    url = 'https://api.groq.com/openai/v1/chat/completions'; headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${account.apiKey}` };
    body = { model: account.model, messages: [{ role: 'system', content: instruction }, { role: 'user', content }], max_completion_tokens: 4096, response_format: { type: 'json_object' }, temperature: 0 };

  }
  const envelope = await readJson(await request(url, { method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(110_000), body: JSON.stringify(body) }));
  const text = account.provider === 'gemini' ? envelope.candidates?.[0]?.content?.parts?.filter(part => typeof part.text === 'string').map(part => part.text).join('') : envelope.choices?.[0]?.message?.content;
  let result;
  try { result = JSON.parse(text); } catch { throw fail(502, 'O modelo não retornou conteúdo JSON completo.'); }
  if (account.provider === 'gemini' ? envelope.candidates?.[0]?.finishReason !== 'STOP' : envelope.choices?.[0]?.finish_reason !== 'stop') throw fail(502, 'O provedor interrompeu ou bloqueou a resposta; nada foi salvo como conclusão.');
  const usage = account.provider === 'gemini' ? { inputTokens: envelope.usageMetadata?.promptTokenCount, outputTokens: envelope.usageMetadata?.candidatesTokenCount } : { inputTokens: envelope.usage?.prompt_tokens, outputTokens: envelope.usage?.completion_tokens };
  return { result, ...(Number.isSafeInteger(usage.inputTokens) && usage.inputTokens >= 0 && Number.isSafeInteger(usage.outputTokens) && usage.outputTokens >= 0 ? { usage } : {}) };
}
