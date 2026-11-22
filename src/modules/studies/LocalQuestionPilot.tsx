import { StudyMascot } from './StudyMascot';
import { useEffect, useRef, useState } from 'react';
import { fileRepository, studyGeneratedQuestionRepository, studyQuizAttemptRepository, studyTopicRepository } from '../../storage/repositories';
import { generateLocalStudyQuestions, localQuestionId, prepareLocalStudyQuestions, type LocalQuestionSource } from './localStudyQuestions';
import { normalizeMaterial } from './materialReliability';
import { OllamaStudyEnhancementProvider } from './ollamaStudyEnhancement';
import { RemoteStudyEnhancementProvider } from './remoteStudyEnhancement';
import { createQuestionService } from './questionService';
import type { StudyEnhancementRequest, SuggestedQuestion } from './studyEnhancementProvider';
import type { StudyTopic } from './types';

const service = createQuestionService(studyGeneratedQuestionRepository, studyQuizAttemptRepository);
const localProvider = new OllamaStudyEnhancementProvider();
const remoteProvider = new RemoteStudyEnhancementProvider();

export function LocalQuestionPilot({ topic, onSaved, remote = false }: { topic: StudyTopic; onSaved: () => Promise<void>; remote?: boolean }) {
  const [focus, setFocus] = useState('');
  const [batch, setBatch] = useState(0);
  const [generation, configure] = useState<NonNullable<StudyEnhancementRequest['generation']>>({count:3,difficulty:'medium',goal:'comparar',kind:'conceitual'});
  const [input, setInput] = useState<LocalQuestionSource>();
  const [preview, setPreview] = useState<LocalQuestionSource>();
  const [consent, setConsent] = useState(false);
  const [questions, setQuestions] = useState<SuggestedQuestion[]>([]);
  const [busy, setBusy] = useState<'prepare' | 'generate' | 'save'>();
  const [status, setStatus] = useState('');
  const active = useRef<AbortController | null>(null);
  const saving = useRef(false);

  useEffect(() => () => active.current?.abort(), []);

  async function showPreview(selectedBatch = 0) {
    if (!topic.sourceFileId || saving.current || active.current) return;
    setConsent(false);
    setPreview(undefined);
    setQuestions([]);
    setBusy('prepare');
    setStatus('Preparando trechos do material…');
    try {
      const file = await fileRepository.getById(topic.sourceFileId);
      if (!file) throw new Error('O material de origem foi removido.');
      setBatch(selectedBatch);
      setPreview(prepareLocalStudyQuestions(file, topic, focus, selectedBatch));
      setStatus('Confira os trechos antes de autorizar o envio.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível abrir o material.');
    } finally {
      setBusy(undefined);
    }
  }

  async function generate() {
    if (active.current || saving.current || !topic.sourceFileId || (remote && (!consent || !preview))) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy('generate');
    setStatus(remote ? 'Gerando questões na Cloudflare. A resposta pode demorar…' : 'Gerando questões no Ollama local…');
    setQuestions([]);
    try {
      const file = await fileRepository.getById(topic.sourceFileId);
      if (!file) throw new Error('O material de origem foi removido.');
      const prepared = prepareLocalStudyQuestions(file, topic, focus, batch);
      if (remote) {
        setConsent(false);
        if (JSON.stringify(prepared.request.chunks) !== JSON.stringify(preview?.request.chunks)) {
          setPreview(prepared);
          throw new Error('Os trechos mudaram. Revise e autorize o envio novamente.');
        }
        prepared.request.generation = generation;
        prepared.request.consent = { externalProcessing: true, externalAi: true };
      }
      const existing = (await service.list()).filter(question => question.topicId === topic.id);
      const result = await generateLocalStudyQuestions(remote ? remoteProvider : localProvider, prepared,
        existing.map(question => question.prompt), controller.signal, remote ? 'remote' : 'local');
      setInput(prepared);
      setQuestions(result.questions);
      setStatus(result.generated
        ? `${result.questions.length} de ${result.generated} sugestão(ões) passaram pela validação. ${result.generated - result.questions.length} rejeitada(s). Confira as respostas e fontes antes de salvar.`
        : 'Os trechos não sustentaram questões para este pedido. Escolha outro tópico ou acrescente ao material relações, exemplos e evidências.');
    } catch (error) {
      setStatus(controller.signal.aborted ? 'Geração cancelada.' : error instanceof Error ? error.message : 'Não foi possível gerar questões.');
    } finally {
      active.current = null;
      setBusy(undefined);
    }
  }

  async function approve(question: SuggestedQuestion) {
    if (!input || saving.current || active.current) return;
    saving.current = true;
    setBusy('save');
    try {
      const [file, latestTopic, existing] = await Promise.all([
        fileRepository.getById(input.source.id), studyTopicRepository.getById(topic.id), service.list(),
      ]);
      if (!file || !latestTopic || latestTopic.disciplineId !== input.topic.disciplineId || latestTopic.sourceFileId !== input.source.id) throw new Error('O material ou a unidade foi removido.');
      const latest = prepareLocalStudyQuestions(file, latestTopic, input.focus, input.batch);
      const evidence = question.evidence[0];
      const sourceChunk = input.request.chunks.find(chunk => chunk.chunkId === evidence.chunkId);
      if (!sourceChunk || !latest.request.chunks.some(chunk => chunk.text === sourceChunk.text && chunk.pageNumber === sourceChunk.pageNumber)) {
        throw new Error('O trecho mudou. Gere as questões novamente.');
      }
      if (existing.some(item => item.topicId === topic.id && normalizeMaterial(item.prompt) === normalizeMaterial(question.prompt))) {
        setStatus('Esta questão já está no banco.');
      } else {
        const id = await localQuestionId(topic.id, question.prompt);
        try {
          await service.create({
            ...question, disciplineId: topic.disciplineId, topicId: topic.id, subject: latestTopic.title,
            sourceFileId: file.id, sourceFileName: file.name, sourceExcerpt: evidence.excerpt,
          }, id);
          setStatus('Questão aprovada e salva no banco.');
        } catch (error) {
          if (!(error instanceof DOMException) || error.name !== 'ConstraintError') throw error;
          setStatus('Esta questão já está no banco.');
        }
      }
      setQuestions(current => current.filter(item => item !== question));
      await onSaved();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível salvar a questão.');
    } finally {
      saving.current = false;
      setBusy(undefined);
    }
  }

  return <section aria-label={remote ? 'Exercícios com IA remota' : 'Exercícios com IA local'}>
    {remote ? <>
      <fieldset disabled={Boolean(busy) || questions.length > 0} onChange={() => { setPreview(undefined); setConsent(false); }}>
        <legend>Configurar exercícios</legend>
        <label>Tópico do material <input maxLength={100} value={focus} placeholder="Todos os tópicos" onChange={e => setFocus(e.target.value)} /></label>
        <label>Questões por lote <select value={generation.count} onChange={e => configure({...generation,count:Number(e.target.value)})}>{[1,2,3].map(n=><option key={n}>{n}</option>)}</select></label>
        <label>Dificuldade <select value={generation.difficulty} onChange={e=>configure({...generation,difficulty:e.target.value as typeof generation.difficulty})}><option value="easy">Básica</option><option value="medium">Intermediária</option><option value="hard">Avançada</option></select></label>
        <label>Objetivo <select value={generation.goal} onChange={e=>configure({...generation,goal:e.target.value as typeof generation.goal})}><option>recordar</option><option>comparar</option><option>aplicar</option></select></label>
        <label>Tipo <select value={generation.kind} onChange={e=>configure({...generation,kind:e.target.value as typeof generation.kind})}><option value="conceitual">Questão conceitual</option><option value="pratica">Atividade prática objetiva</option></select></label>
      </fieldset>
      <button className="text-action" type="button" onClick={() => void showPreview()} disabled={Boolean(busy) || questions.length > 0}>Gerar exercícios com IA</button>
      {preview && <>
        <p>Lote {batch + 1} de {preview.batches}. {preview.batches - batch - 1} lote(s) seguinte(s) disponíveis.</p>
        {batch + 1 < preview.batches && <button type="button" disabled={Boolean(busy) || questions.length > 0} onClick={() => void showPreview(batch + 1)}>Revisar próximo lote</button>}
        <p>Somente os trechos abaixo serão enviados à Cloudflare. Use material sintético nesta prévia.</p>
        {preview.request.chunks.map(chunk => <blockquote key={chunk.chunkId}>{chunk.text}</blockquote>)}
        <label><input type="checkbox" checked={consent} disabled={Boolean(busy)} onChange={event => setConsent(event.target.checked)} /> Autorizo o envio destes trechos e o processamento por IA.</label>
        <button className="text-action" type="button" onClick={() => void generate()} disabled={!consent || Boolean(busy) || questions.length > 0}>Enviar trechos e gerar exercícios</button>
      </>}
    </> : <>
    <p>O Ollama recebe neste computador trechos do material vinculado a esta unidade. Use material sintético no piloto.</p>
    <button className="text-action" type="button" onClick={() => void generate()} disabled={Boolean(busy)}>Gerar e revisar questões no Ollama</button>
    </>}
    {busy === 'generate' && <button className="text-action" type="button" onClick={() => active.current?.abort()}>Cancelar geração</button>}
    {status && <p role="status"><StudyMascot mood={busy ? 'thinking' : status.startsWith('Questão aprovada') ? 'complete' :
      questions.length ? 'happy' : preview && !consent && status.startsWith('Confira') ? 'neutral' : 'attention'} />{status}</p>}
    {questions.map(question => {
      const page = input?.request.chunks.find(chunk => chunk.chunkId === question.evidence[0].chunkId)?.pageNumber;
      return <article key={question.prompt}>
        <h4>{question.prompt}</h4>
        <ol>{question.options.map(option => <li key={option}>{option}</li>)}</ol>
        <p>Resposta proposta: {question.options[question.correctOptionIndex]}</p>
        <p style={{whiteSpace: 'pre-line'}}>{question.explanation}</p>
        <p>Fonte: {input?.fileName}{page ? ` · página ${page}` : ''}</p>
        <blockquote>{question.evidence[0].excerpt}</blockquote>
        <button className="text-action" type="button" disabled={Boolean(busy)} onClick={() => void approve(question)}>Aprovar e salvar</button>
        <button className="text-action" type="button" disabled={Boolean(busy)} onClick={() => setQuestions(current => current.filter(item => item !== question))}>Descartar sugestão</button>
    </article>;
    })}
  </section>;
}
