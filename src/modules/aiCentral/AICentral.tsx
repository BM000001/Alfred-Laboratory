import { useEffect, useRef, useState } from 'react';
import { aiCentralSettingsRepository, fileRepository } from '../../storage/repositories';
import type { StoredFile } from '../files/types';
import type { AITask, AIOperation } from './contracts';
import { AI_LABELS } from './contracts';
import { aiCentral } from './taskService';
import { validateEndpoint } from './providers';
import { buildStudyPrompt } from './prompts';
import { assessMaterial } from '../studies/materialReliability';
import './aiCentral.css';

const statuses: Record<AITask['status'], string> = { queued: 'Na fila', running: 'Interrompida ou em execução em outra aba', completed: 'Concluída', failed: 'Falhou', cancelled: 'Cancelada' };
export function AICentral() {
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [operation, setOperation] = useState<AIOperation>('studies.analyze');
  const [provider, setProvider] = useState<AITask['provider']>('local');
  const [endpoint, setEndpoint] = useState('');
  const [token, setToken] = useState('');
  const [includeImage, setIncludeImage] = useState(false);
  const [prepared, setPrepared] = useState<AITask | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const controller = useRef<AbortController | null>(null);
  const source = files.find(file => file.id === sourceId);
  async function refresh() { const [jobs, originals] = await Promise.all([aiCentral.list(), fileRepository.getAll()]); setTasks(jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))); setFiles(originals.filter(file => file.disciplineId)); }
  useEffect(() => {
    let disposed = false;
    void Promise.all([aiCentral.list(), fileRepository.getAll(), aiCentralSettingsRepository.getById('central')]).then(([jobs, originals, config]) => {
      if (disposed) return;
      setTasks(jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))); setFiles(originals.filter(file => file.disciplineId)); setEndpoint(config?.endpoint ?? '');
    }).catch(() => { if (!disposed) setNotice('Não foi possível ler a Central neste dispositivo.'); });
    return () => { disposed = true; controller.current?.abort(); };
  }, []);
  function resetPreview() { setPrepared(null); setConsent(false); setNotice(''); }
  async function saveEndpoint() {
    try { const normalized = endpoint.trim() ? validateEndpoint(endpoint.trim()) : ''; await aiCentralSettingsRepository.save({ id: 'central', endpoint: normalized }); setEndpoint(normalized); resetPreview(); setNotice(normalized ? 'Endereço salvo. Isso não envia materiais nem ativa um modelo.' : 'Conexão remota removida.'); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Endereço inválido.'); }
  }
  async function prepare() {
    if (!source?.disciplineId) return;
    try {
      const state = source.processing;
      const text = state?.corrected ?? source.extraction?.text ?? '';
      if (!text.trim() && !(provider === 'gateway' && includeImage && operation === 'studies.analyze')) throw new Error('Este arquivo ainda não possui texto. Processe-o em Estudos ou escolha análise remota com a imagem.');
      const extraction = source.extraction;
      const ocr = extraction?.format === 'image' || extraction?.extractionMethod === 'ocr';
      const confidence = state?.assessment?.score ?? assessMaterial(text, ocr ? extraction?.confidence ?? 0 : undefined, extraction?.imageQuality).score;
      const task = await aiCentral.enqueue(crypto.randomUUID(), operation, { sourceFileId: source.id, disciplineId: source.disciplineId, text, confidence, profile: state?.profile ?? 'printed', ...(includeImage && provider === 'gateway' && operation === 'studies.analyze' ? { includeImage: true } : {}) }, provider);
      setPrepared(task); setConsent(false); await refresh();
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Não foi possível preparar.'); }
  }
  async function execute() {
    if (!prepared || busy) return;
    setBusy(true); setNotice(''); controller.current = new AbortController();
    try {
      const remote = prepared.provider === 'gateway' ? { endpoint: validateEndpoint(endpoint.trim()), token, consent: { taskId: prepared.id, endpoint: validateEndpoint(endpoint.trim()), includeImage: !!prepared.input.includeImage } } : undefined;
      if (remote && !consent) throw new Error('Autorize o envio do conteúdo exibido.');
      await aiCentral.run(prepared.id, controller.current.signal, remote);
      setPrepared(null); setNotice('Tarefa concluída. Os resultados estão no histórico; propostas remotas não alteram o material original.');
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Falha ao executar tarefa.'); }
    finally { setBusy(false); setConsent(false); try { await refresh(); } catch { setNotice('Não foi possível atualizar o histórico. Reabra as configurações.'); } }
  }
  async function testConnection() {
    setBusy(true); controller.current = new AbortController();
    try {
      const url = validateEndpoint(endpoint.trim());
      if (!token) throw new Error('Informe o token da Central para testar a conexão.');
      const response = await fetch(`${url}/health`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.any([controller.current.signal, AbortSignal.timeout(10_000)]), redirect: 'error' });
      if (!response.ok) throw new Error(`Central indisponível (HTTP ${response.status}).`);
      const health: unknown = await response.json();
      if (!health || typeof health !== 'object' || !('version' in health) || health.version !== 1 || !('ready' in health) || typeof health.ready !== 'boolean') throw new Error('O endereço não oferece uma Central compatível.');
      setNotice(health.ready ? 'Conexão confirmada; o serviço informa um modelo configurado. Nenhum material foi enviado.' : 'Central acessível, mas nenhum modelo foi configurado no servidor.');
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Falha ao conectar.'); }
    finally { setBusy(false); }
  }
  return <section className="ai-central" aria-label="Central de IAs">
    <header><span className="card-label">CENTRAL DE IAS · PRIMEIRA ETAPA</span><h2>Central de IAs</h2><p>Análise de materiais e geração de recursos, com histórico e retomada. O modo local já funciona; modelos com visão exigem um serviço configurado.</p></header>
    <details><summary>Conectar modelo open source</summary>
      <p>Informe o endereço do seu serviço da Central. Ele conecta o modelo; o GitHub Pages continua hospedando o Alfred. Nenhum serviço pago é ativado aqui.</p>
      <label>Endereço da Central<input type="url" value={endpoint} disabled={busy} placeholder="https://sua-central.exemplo" onChange={event => { setEndpoint(event.target.value); resetPreview(); }} /></label>
      <label>Token da Central<input type="password" autoComplete="off" value={token} disabled={busy} onChange={event => { setToken(event.target.value); setConsent(false); }} /></label>
      <p>O token fica somente na memória desta tela e será descartado ao sair. O serviço precisa de HTTPS para uso pelo iPhone. Localhost se refere ao dispositivo que está usando o Alfred.</p>
      <div className="ai-central-actions"><button type="button" disabled={busy} onClick={() => void saveEndpoint()}>Salvar endereço</button><button type="button" disabled={busy || !endpoint} onClick={() => void testConnection()}>Testar conexão</button></div>
    </details>
    <div className="ai-central-fields">
      <label>Material<select aria-label="Material" value={sourceId} disabled={busy} onChange={event => { setSourceId(event.target.value); setIncludeImage(false); resetPreview(); }}><option value="">Selecione um material salvo</option>{files.map(file => <option key={file.id} value={file.id}>{file.name}</option>)}</select></label>
      <label>Solicitação<select aria-label="Solicitação" value={operation} disabled={busy} onChange={event => { setOperation(event.target.value as AIOperation); setIncludeImage(false); resetPreview(); }}>{Object.entries(AI_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Processamento<select aria-label="Processamento" value={provider} disabled={busy} onChange={event => { setProvider(event.target.value as AITask['provider']); setIncludeImage(false); resetPreview(); }}><option value="local">Local · sem modelo de IA</option><option value="gateway">Modelo open source conectado</option></select></label>
    </div>
    {provider === 'gateway' && operation === 'studies.analyze' && source?.type.startsWith('image/') && <label><input type="checkbox" disabled={busy} checked={includeImage} onChange={event => { setIncludeImage(event.target.checked); resetPreview(); }} />Incluir a imagem original para reconhecimento visual</label>}
    <button type="button" className="primary-action" disabled={busy || !sourceId || (provider === 'gateway' && !endpoint)} onClick={() => void prepare()}>Preparar solicitação</button>
    {prepared && <section className="ai-central-preview" aria-label="Revisão da solicitação">
      <h3>{AI_LABELS[prepared.operation]}</h3><p>{prepared.provider === 'local' ? 'Execução no dispositivo; nada será enviado.' : `Destino: ${endpoint}. Conteúdo: ${prepared.input.text.length} caracteres${prepared.input.includeImage ? ' e imagem original' : ', sem o arquivo original'}. Finalidade: ${AI_LABELS[prepared.operation].toLocaleLowerCase('pt-BR')}.`}</p>
      <details><summary>Ver instrução e texto completo</summary><pre>{buildStudyPrompt(prepared.operation)}</pre><pre>{prepared.input.text || '(somente imagem selecionada)'}</pre></details>
      {prepared.input.includeImage && <p>Imagem: {files.find(file => file.id === prepared.input.sourceFileId)?.name ?? prepared.input.sourceFileId}. O original permanece salvo no dispositivo.</p>}
      {prepared.provider === 'gateway' && <label><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />Autorizo enviar este conteúdo acadêmico ao destino exibido.</label>}
      <button type="button" disabled={busy || (prepared.provider === 'gateway' && (!consent || !token))} onClick={() => void execute()}>{prepared.provider === 'local' ? 'Executar no dispositivo' : 'Enviar esta solicitação'}</button>
    </section>}
    {busy && <button type="button" onClick={() => controller.current?.abort()}>Cancelar solicitação</button>}
    {notice && <p role="status">{notice}</p>}
    <h3>Histórico de solicitações</h3><p>As tarefas locais de Estudos também aparecem aqui. Retomar reutiliza os resultados concluídos. Cancelar um envio não garante interromper uma inferência já iniciada no servidor.</p>
    {!tasks.length && <p>Ainda não há solicitações.</p>}
    {tasks.slice(0, 30).map(task => <article key={task.id} className="ai-central-task"><strong>{AI_LABELS[task.operation]}</strong><span>{statuses[task.status]} · {task.provider === 'local' ? 'local' : 'modelo conectado'} · {task.attempts} tentativa(s)</span><span>{files.find(file => file.id === task.input.sourceFileId)?.name ?? 'Material de origem indisponível'}</span>
      {task.error && <p>{task.error.message}</p>}
      {task.status !== 'completed' && <button type="button" disabled={busy} onClick={() => { setPrepared(task); setConsent(false); setNotice('Revise a solicitação para retomar.'); }}>Revisar para retomar</button>}
      {task.result && <details><summary>Ver resultado</summary>{task.result.analysis?.requiresReview && <p>Transcrição proposta pelo modelo: precisa de verificação contra a imagem antes de servir como fonte. Não substituiu o original nem gerou recursos automaticamente.</p>}<pre>{JSON.stringify(task.result, null, 2)}</pre></details>}
    </article>)}
    <p>Custos monetários ainda não são calculados. Quando informados pelo serviço, os tokens usados ficam registrados no resultado. Nenhum modelo é baixado no seu computador por esta tela.</p>
  </section>;
}
