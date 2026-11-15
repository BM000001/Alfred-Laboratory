import { useEffect, useRef, useState } from 'react';
import { disciplineRepository, fileRepository } from '../../storage/repositories';
import { createFileService } from '../files/fileService';
import type { ProviderConnection, AITask } from './contracts';
import { aiCentral } from './taskService';
import { validateEndpoint } from './providers';
import { buildStudyPrompt } from './prompts';

interface Props { endpoint: string; token: string; onChange: () => Promise<void>; }
const names = { gemini: 'Gemini', groq: 'Groq' };
const comparisonTasks = (tasks: AITask[]) => tasks.filter(task => task.input.comparisonId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export function VisionLab({ endpoint, token, onChange }: Props) {
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [provider, setProvider] = useState<'gemini' | 'groq'>('gemini');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [free, setFree] = useState(false);
  const [models, setModels] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [disciplines, setDisciplines] = useState<Array<{ id: string; name: string }>>([]);
  const [disciplineId, setDisciplineId] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [consent, setConsent] = useState(false);
  const [jobs, setJobs] = useState<AITask[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const controller = useRef<AbortController | null>(null);
  const selection = useRef(0);
  useEffect(() => {
    let disposed = false;
    void Promise.all([disciplineRepository.getAll(), aiCentral.list()]).then(([items, tasks]) => {
      if (!disposed) { setDisciplines(items); setJobs(comparisonTasks(tasks)); }
    }).catch(() => { if (!disposed) setNotice('Não foi possível ler as comparações salvas.'); });
    return () => { disposed = true; controller.current?.abort(); };
  }, []);
  useEffect(() => { controller.current?.abort(); setConnections([]); setConsent(false); setApiKey(''); setFree(false); selection.current++; }, [endpoint, token]);
  useEffect(() => {
    if (!photo) { setPreview(''); return; }
    const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url);
  }, [photo]);
  async function request(path: string, init: RequestInit = {}) {
    const url = validateEndpoint(endpoint.trim());
    if (!token.trim()) throw new Error('Informe o token do serviço da Central acima.');
    const response = await fetch(`${url}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.any([controller.current!.signal, AbortSignal.timeout(60_000)]) });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error?.message ?? `Falha na Central (HTTP ${response.status}).`);
    return value;
  }
  async function refresh() {
    const tasks = await aiCentral.list(); setJobs(comparisonTasks(tasks)); await onChange();
  }
  async function manage(action: () => Promise<void>) {
    setBusy(true); setNotice(''); controller.current = new AbortController();
    try { await action(); } catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível concluir.'); }
    finally { setBusy(false); }
  }
  async function loadConnections() {
    const current = selection.current;
    const value = await request('/v1/connections');
    if (!Array.isArray(value.connections)) throw new Error('Atualize o servidor da Central para configurar APIs.');
    if (current === selection.current) setConnections(value.connections);
  }
  async function addConnection() {
    const key = apiKey; setApiKey('');
    await request('/v1/connections', { method: 'POST', body: JSON.stringify({ provider, label, apiKey: key, freeTierConfirmed: free }) });
    setFree(false); setLabel(''); await loadConnections(); setNotice('Chave aceita para consultar o catálogo. Selecione um modelo com visão e confirme a cota no painel do provedor. Ainda não houve análise.');
  }
  async function runJobs(tasks: AITask[]) {
    const url = validateEndpoint(endpoint.trim());
    for (const task of tasks) {
      if (controller.current!.signal.aborted) break;
      try {
        await aiCentral.run(task.id, controller.current!.signal, { endpoint: url, token, freeTierConsent: true, consent: { taskId: task.id, endpoint: url, includeImage: true } });
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Uma análise falhou; os outros resultados foram preservados.');
      }
      await refresh();
    }
    setConsent(false);
  }
  async function compare() {
    if (!photo || !disciplineId || !consent) return;
    const url = validateEndpoint(endpoint.trim());
    const pair = (['gemini', 'groq'] as const).map(name => connections.find(item => item.id === selected[name] && item.provider === name && item.model && item.freeTierConfirmed));
    if (pair.some(item => !item)) throw new Error('Selecione uma conexão configurada de cada provedor.');
    if (!/^image\/(jpeg|png|webp)$/.test(photo.type) || photo.size > 8 * 1024 * 1024 || !photo.size) throw new Error('Escolha JPG, PNG ou WebP de até 8 MB. Fotos HEIC precisam ser convertidas antes.');
    const file = await createFileService(fileRepository).add(photo, disciplineId);
    const comparisonId = crypto.randomUUID();
    const tasks: AITask[] = [];
    // Persist both jobs before either provider receives the image.
    for (const connection of pair as ProviderConnection[]) {
      tasks.push(await aiCentral.enqueue(crypto.randomUUID(), 'studies.analyze', { sourceFileId: file.id, disciplineId, text: '', confidence: 0, profile: 'board', includeImage: true, comparisonId, connection: { id: connection.id, revision: connection.revision, provider: connection.provider, label: connection.label, model: connection.model!, endpoint: url } }, 'gateway'));
    }
    await refresh(); await runJobs(tasks);
  }
  const comparisons = [...new Set(jobs.map(task => task.input.comparisonId!))].slice(0, 30);
  const ready = ['gemini', 'groq'].every(name => connections.some(item => item.id === selected[name] && item.provider === name && item.model && item.freeTierConfirmed));
  return <section aria-label="Comparar Gemini e Groq" className="ai-vision-lab">
    <h3>Gemini e Groq · comparar uma foto</h3>
    <p>Configure o serviço da Central acima. As chaves de API são guardadas no servidor, fora do navegador e do GitHub. Isso usa APIs, não a assinatura do aplicativo de chat.</p>
    <p>Use contas Free sem faturamento ativado. O catálogo não confirma preço, cota ou suporte a imagens; confira essas condições no painel. O Alfred não ativa cobrança nem troca para outro modelo quando a cota acaba.</p>
    <p><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Criar chave Gemini</a> · <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Criar chave Groq</a></p>
    <button type="button" disabled={busy || !endpoint || !token} onClick={() => void manage(loadConnections)}>Carregar conexões de API</button>
    <details><summary>Adicionar conexão de API</summary>
      <label>Provedor<select aria-label="Provedor" value={provider} disabled={busy} onChange={event => { setProvider(event.target.value as 'gemini' | 'groq'); setApiKey(''); setFree(false); }}><option value="gemini">Gemini API</option><option value="groq">Groq API</option></select></label>
      <label>Nome da conexão<input value={label} maxLength={80} disabled={busy} onChange={event => setLabel(event.target.value)} /></label>
      <label>Chave de API<input type="password" autoComplete="off" value={apiKey} disabled={busy} onChange={event => setApiKey(event.target.value)} /></label>
      <label><input type="checkbox" checked={free} disabled={busy} onChange={event => setFree(event.target.checked)} />Conferi que esta conta usa o plano gratuito e não tem faturamento ativado. Permito enviar a chave ao meu serviço da Central e consultar o catálogo do provedor.</label>
      <button type="button" disabled={busy || !free || !label.trim() || !apiKey || !endpoint || !token} onClick={() => void manage(addConnection)}>Salvar chave e consultar modelos</button>
    </details>
    {connections.map(item => <article className="ai-central-task" key={item.id}>
      <strong>{names[item.provider]} · {item.label}</strong><span>{item.model ? `Modelo confirmado: ${item.model}` : 'Modelo ainda não selecionado'}</span>
      <label>Modelo de {item.label}<select aria-label={`Modelo de ${item.label}`} disabled={busy} value={models[item.id] ?? item.model ?? ''} onChange={event => { setModels({ ...models, [item.id]: event.target.value }); setConfirmed({ ...confirmed, [item.id]: false }); setConsent(false); }}><option value="">Selecione um modelo</option>{item.models.map(model => <option key={model}>{model}</option>)}</select></label>
      <label><input type="checkbox" checked={!!confirmed[item.id]} disabled={busy} onChange={event => setConfirmed({ ...confirmed, [item.id]: event.target.checked })} />Conferi que este modelo aceita imagens e tem cota gratuita nesta conta.</label>
      <div className="ai-central-actions"><button type="button" disabled={busy || !confirmed[item.id] || !(models[item.id] ?? item.model)} onClick={() => void manage(async () => { await request(`/v1/connections/${item.id}`, { method: 'PATCH', body: JSON.stringify({ model: models[item.id] ?? item.model, freeTierConfirmed: true }) }); setConsent(false); await loadConnections(); })}>Confirmar modelo</button>
      <button type="button" disabled={busy} onClick={() => void manage(async () => { await request(`/v1/connections/${item.id}`, { method: 'DELETE' }); setConsent(false); await loadConnections(); })}>Remover conexão</button></div>
    </article>)}
    <div className="ai-central-fields">{(['gemini', 'groq'] as const).map(name => <label key={name}>Conexão {names[name]}<select aria-label={`Conexão ${names[name]}`} value={selected[name] ?? ''} disabled={busy} onChange={event => { setSelected({ ...selected, [name]: event.target.value }); setConsent(false); }}><option value="">Selecione</option>{connections.filter(item => item.provider === name && item.model).map(item => <option key={item.id} value={item.id}>{item.label} · {item.model}</option>)}</select></label>)}</div>
    <label>Disciplina da foto<select aria-label="Disciplina da foto" value={disciplineId} disabled={busy} onChange={event => { setDisciplineId(event.target.value); setConsent(false); }}><option value="">Selecione</option>{disciplines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {!disciplines.length && <p>Crie uma disciplina em Estudos antes de selecionar sua foto.</p>}
    <label>Foto do material<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { setPhoto(event.target.files?.[0] ?? null); setConsent(false); }} /></label>
    {preview && <img className="ai-vision-preview" src={preview} alt="Foto selecionada para comparação" />}
    <details><summary>Ver instrução enviada aos dois modelos</summary><pre>{buildStudyPrompt('studies.analyze')}</pre></details>
    <label><input type="checkbox" disabled={busy} checked={consent} onChange={event => setConsent(event.target.checked)} />Autorizo o envio da foto selecionada para Gemini e Groq via {endpoint || 'meu serviço da Central'}. Conferi as cotas gratuitas e as políticas de uso de dados dessas contas.</label>
    <button type="button" disabled={busy || !consent || !ready || !photo || !disciplineId || !token} onClick={() => void manage(compare)}>Salvar foto e comparar</button>
    {busy && <button type="button" onClick={() => controller.current?.abort()}>Cancelar comparação</button>}
    {notice && <p role="status">{notice}</p>}
    <p>As análises são propostas independentes. Concordância entre modelos não comprova precisão. Nenhum flashcard ou questão é salvo por esta comparação. Cancelar preserva resultados concluídos; o provedor pode continuar uma análise já iniciada.</p>
    {comparisons.map(id => <section key={id} className="ai-comparison" aria-label="Comparação salva"><h4>Comparação · {new Date(jobs.find(task => task.input.comparisonId === id)!.createdAt).toLocaleString('pt-BR')}</h4>
      <div className="ai-comparison-results">{jobs.filter(task => task.input.comparisonId === id).map(task => <article className="ai-central-task" key={task.id}>
        <strong>{task.input.connection?.provider} · {task.input.connection?.model}</strong><span>{task.status === 'completed' ? 'Concluída' : task.status === 'queued' ? 'Aguardando envio' : task.status === 'running' ? 'Interrompida ou em execução' : task.status === 'failed' ? 'Falhou' : 'Cancelada'}</span>
        {task.error && <p>{task.error.message}</p>}{task.result?.analysis && <><pre>{task.result.analysis.text}</pre><p>Incertezas informadas pelo modelo:</p><ul>{task.result.analysis.uncertainties.map((item, index) => <li key={index}>{item}</li>)}</ul>{!task.result.analysis.uncertainties.length && <p>Nenhuma informada; isso não garante leitura correta.</p>}</>}
        {task.result?.usage && <span>Tokens: {task.result.usage.inputTokens} de entrada · {task.result.usage.outputTokens} de saída</span>}
        {task.status !== 'completed' && <button type="button" disabled={busy || !consent || !token || task.input.connection?.endpoint !== endpoint} onClick={() => void manage(() => runJobs([task]))}>Retomar esta análise com autorização acima</button>}
      </article>)}</div>
    </section>)}
  </section>;
}
