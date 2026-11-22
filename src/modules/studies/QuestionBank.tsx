import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { studyQuestionRepository, studyQuizAttemptRepository } from '../../storage/repositories';
import type { StudyTopic } from './types';
import type { StudyQuestion, StudyQuizAnswer, StudyQuizAttempt, StudyQuestionDifficulty } from './questionTypes';
import { createQuestionService, gradeStudyAnswer, getQuestionSnapshot, summarizeQuiz, selectQuizQuestions } from './questionService';

import { LocalQuestionPilot } from './LocalQuestionPilot';
import { clearQuizDraft, readQuizDraft, writeQuizDraft } from './quizDraft';

const service = createQuestionService(studyQuestionRepository, studyQuizAttemptRepository);
const emptyOptions = ['', '', '', ''];
const difficultyLabels: Record<StudyQuestionDifficulty, string> = { easy: 'Fácil', medium: 'Média', hard: 'Difícil' };

export function QuestionBank({ disciplineId, topics, unitId, refreshToken = 0, trailMode, onFinished, onChanged }: { disciplineId: string; topics: StudyTopic[]; unitId?: string; refreshToken?: number; trailMode?: 'quick' | 'quiz' | 'lab' | 'final'; onFinished?: () => void; onChanged?: () => void }) {
  const pilotTopic = import.meta.env.DEV && import.meta.env.VITE_ALFRED_LOCAL_OLLAMA === '1' &&
    window.location.origin === 'http://127.0.0.1:5173'
    ? topics.find(topic => topic.id === unitId && topic.sourceFileId)
    : undefined;
  const draftKey = 'alfred:quiz-draft:v1:' + JSON.stringify([disciplineId, unitId ?? null]) + (trailMode ? ':' + trailMode : '');
  const [draftWarning, setDraftWarning] = useState(false);
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [history, setHistory] = useState<StudyQuizAttempt[]>([]);
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState<string[]>(emptyOptions);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [topicId, setTopicId] = useState('');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState<StudyQuestionDifficulty>('medium');
  const [quizTopicFilter, setQuizTopicFilter] = useState('all');
  const [quizDifficultyFilter, setQuizDifficultyFilter] = useState<StudyQuestionDifficulty | 'all'>('all');
  const [quizQuestionCount, setQuizQuestionCount] = useState(trailMode === 'quick' ? 3 : trailMode === 'final' ? 50 : 10);
  const [phase, setPhase] = useState<'idle' | 'quiz' | 'result'>('idle');
  const [quizQuestions, setQuizQuestions] = useState<StudyQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<StudyQuizAnswer[]>([]);
  const [quizStartedAt, setQuizStartedAt] = useState('');
  const [lastAttempt, setLastAttempt] = useState<StudyQuizAttempt | null>(null);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const attemptId = useRef('');
  const restoredDraft = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    const [allQuestions, allAttempts] = await Promise.all([service.list(), service.listAttempts()]);
    setQuestions(allQuestions.filter((item) => item.disciplineId === disciplineId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setHistory(allAttempts.filter((item) => item.disciplineId === disciplineId).sort((a, b) => b.completedAt.localeCompare(a.completedAt)));
  }

  useEffect(() => {
    let active = true;
    Promise.all([service.list(), service.listAttempts()])
      .then(([allQuestions, allAttempts]) => {
        if (!active) return;
        setQuestions(allQuestions.filter((item) => item.disciplineId === disciplineId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setHistory(allAttempts.filter((item) => item.disciplineId === disciplineId).sort((a, b) => b.completedAt.localeCompare(a.completedAt)));
      })
      .catch(() => { if (active) setError('Não foi possível carregar o banco de questões.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [disciplineId, refreshToken]);

  useEffect(() => {
    if (loading || restoredDraft.current) return;
    restoredDraft.current = true;
    const draft = readQuizDraft(draftKey, disciplineId, unitId);
    if (!draft || history.some(attempt => attempt.id === draft.id)) return;
    attemptId.current = draft.id;
    setQuizStartedAt(draft.startedAt);
    setQuizQuestions(draft.questions);
    setQuizAnswers(draft.answers);
    setQuestionIndex(draft.answers.length);
    setSelectedOptionIndex(draft.selected);
    setRevealed(draft.revealed);
    setPhase('quiz');
  // Load only after the initial history is available, including after remount.
  }, [loading, draftKey, disciplineId, unitId, history]);

  useEffect(() => {
    if (phase !== 'quiz') return;
    setDraftWarning(!writeQuizDraft(draftKey, {
      id: attemptId.current, startedAt: quizStartedAt, questions: quizQuestions,
      answers: quizAnswers, selected: selectedOptionIndex, revealed,
    }));
  }, [phase, draftKey, quizStartedAt, quizQuestions, quizAnswers, selectedOptionIndex, revealed]);

  const unitQuestions = useMemo(() => questions.filter(q => (!unitId || q.topicId === unitId) && (trailMode !== 'lab' || q.sourceExcerpt)), [questions, unitId, trailMode]);
  const unitHistory = useMemo(() => {
    if (!unitId) return history;
    const questionIds = new Set(unitQuestions.map((question) => question.id));
    return history.filter((attempt) => attempt.answers.some((answer) => {
      const snapshot = getQuestionSnapshot(answer, disciplineId);
      return snapshot ? snapshot.topicId === unitId : questionIds.has(answer.questionId);
    }));
  }, [disciplineId, history, unitId, unitQuestions]);

  const availableQuizQuestions = useMemo(() => selectQuizQuestions(unitQuestions, {
    topicId: quizTopicFilter === 'all' ? undefined : quizTopicFilter,
    difficulty: quizDifficultyFilter,
    limit: 50,
    random: () => 0.5,
  }), [unitQuestions, quizTopicFilter, quizDifficultyFilter]);
  const currentQuestion = quizQuestions[questionIndex];
  const currentFeedback = currentQuestion && revealed ? gradeStudyAnswer(currentQuestion, selectedOptionIndex) : false;
  const resultSummary = useMemo(() => lastAttempt ? summarizeQuiz(lastAttempt.answers) : null, [lastAttempt]);

  async function createQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await service.create({
        disciplineId,
        topicId: unitId ?? (topicId || undefined),
        prompt,
        options,
        correctOptionIndex,
        explanation,
        difficulty,
      });
      setPrompt('');
      setOptions(emptyOptions);
      setCorrectOptionIndex(0);
      setTopicId('');
      setExplanation('');
      setDifficulty('medium');
      await refresh();
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a questão.');
    }
  }

  async function deleteQuestion(question: StudyQuestion) {
    if (!window.confirm('Excluir esta questão do banco?')) return;
    try { await service.delete(question.id); await refresh(); onChanged?.(); }
    catch { setError('Não foi possível excluir a questão.'); }
  }

  function startQuiz() {
    const session = selectQuizQuestions(unitQuestions, {
      topicId: quizTopicFilter === 'all' ? undefined : quizTopicFilter,
      difficulty: quizDifficultyFilter,
      limit: quizQuestionCount,
      recentQuestionIds: history.slice(0, 5).flatMap(attempt => attempt.answers.map(answer => answer.questionId)),
    });
    if (!session.length) return;
    attemptId.current = crypto.randomUUID();
    setError('');
    setQuizQuestions(session);
    setQuestionIndex(0);
    setSelectedOptionIndex(null);
    setRevealed(false);
    setQuizAnswers([]);
    setQuizStartedAt(new Date().toISOString());
    setLastAttempt(null);
    setPhase('quiz');
  }

  function revealAnswer() {
    if (selectedOptionIndex === null) {
      setError('Selecione uma alternativa antes de corrigir.');
      return;
    }
    setError('');
    setRevealed(true);
  }

  async function advanceQuiz() {
    if (!currentQuestion || selectedOptionIndex === null || !revealed || saveInFlight.current) return;
    const answer: StudyQuizAnswer = {
      questionId: currentQuestion.id,
      selectedOptionIndex,
      isCorrect: gradeStudyAnswer(currentQuestion, selectedOptionIndex),
      questionSnapshot: currentQuestion,
    };
    const updatedAnswers = [...quizAnswers, answer];
    if (questionIndex + 1 < quizQuestions.length) {
      setQuizAnswers(updatedAnswers);
      setQuestionIndex((value) => value + 1);
      setSelectedOptionIndex(null);
      setRevealed(false);
      return;
    }

    const summary = summarizeQuiz(updatedAnswers);
    const attempt: StudyQuizAttempt = {
      id: attemptId.current,
      disciplineId,
      startedAt: quizStartedAt,
      completedAt: new Date().toISOString(),
      totalQuestions: updatedAnswers.length,
      correctAnswers: summary.correct,
      answers: updatedAnswers,
    };
    saveInFlight.current = true;
    setSaving(true);
    setError('');
    try {
      let saved = attempt;
      try {
        await service.saveAttempt(attempt);
      } catch (cause) {
        if (!(cause instanceof DOMException) || cause.name !== 'ConstraintError') throw cause;
        const existing = await studyQuizAttemptRepository.getById(attempt.id);
        if (!existing || existing.disciplineId !== disciplineId) throw cause;
        saved = existing;
      }
      clearQuizDraft(draftKey, attempt.id);
      setQuizAnswers(updatedAnswers);
      setLastAttempt(saved);
      setPhase('result');
      onFinished?.();
      setHistory((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)]);
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o resultado do simulado.');
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  function openAttempt(attempt: StudyQuizAttempt) {
    setQuizQuestions([]);
    setLastAttempt(attempt);
    setPhase('result');
  }

  function exitQuiz() {
    if (phase === 'quiz' && !window.confirm('Descartar o simulado em andamento?')) return;
    if (phase === 'quiz') clearQuizDraft(draftKey, attemptId.current);
    setPhase('idle');
    setQuizQuestions([]);
    setQuizAnswers([]);
    setSelectedOptionIndex(null);
    setRevealed(false);
  }

  return <section className="study-question-bank" aria-label="Banco de questões e simulados">
    <div className="study-question-header">
      <div><span className="card-label">PRÁTICA E AUTOAVALIAÇÃO</span><h3>Questões e simulados</h3><p>{unitQuestions.length} questão(ões) cadastrada(s) · simulados com até 50 questões</p></div>
      {phase === 'idle' && <button className="study-quiz-start" type="button" disabled={loading || !availableQuizQuestions.length} onClick={startQuiz}>Iniciar simulado</button>}
      {phase !== 'idle' && <button className="study-quiz-start secondary" type="button" onClick={exitQuiz} disabled={saving}>Sair do simulado</button>}
    </div>
    {phase === 'idle' && <div className="study-quiz-filters">
      {!unitId && <label htmlFor="study-quiz-topic-filter">Tópico do simulado
        <select id="study-quiz-topic-filter" value={quizTopicFilter} onChange={event => setQuizTopicFilter(event.target.value)}><option value="all">Todos os tópicos</option>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
      </label>}
      <label htmlFor="study-quiz-difficulty-filter">Dificuldade
        <select id="study-quiz-difficulty-filter" value={quizDifficultyFilter} onChange={event => setQuizDifficultyFilter(event.target.value as StudyQuestionDifficulty | 'all')}><option value="all">Todas</option><option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option></select>
      </label>
      <label htmlFor="study-quiz-question-count">Quantidade de questões
        <input id="study-quiz-question-count" type="number" min="1" max={Math.min(50, availableQuizQuestions.length)} value={Math.min(quizQuestionCount, Math.max(1, availableQuizQuestions.length))} onChange={(event) => setQuizQuestionCount(Math.max(1, Math.min(50, Number(event.target.value) || 1)))} disabled={!availableQuizQuestions.length} />
      </label>
      <span>{availableQuizQuestions.length} questão(ões) disponíveis</span>
    </div>}
    {error && <p className="module-error" role="alert">{error}</p>}

    {phase === 'quiz' && draftWarning && <p role="status">O navegador não conseguiu guardar este simulado em andamento.</p>}
    {phase === 'quiz' && currentQuestion && <article className="study-quiz-card">
      <div className="study-quiz-progress"><span>Questão {questionIndex + 1} de {quizQuestions.length}</span><span>{difficultyLabels[currentQuestion.difficulty]}</span></div>
      <div className="progress-track"><span style={{ width: `${((questionIndex + 1) / quizQuestions.length) * 100}%` }} /></div>
      {trailMode === 'lab' && <blockquote>{currentQuestion.sourceExcerpt}</blockquote>}
      <h4>{currentQuestion.prompt}</h4>
      <div className="study-quiz-options">
        {currentQuestion.options.map((option, index) => <label key={index} className={revealed && index === currentQuestion.correctOptionIndex ? 'correct' : revealed && index === selectedOptionIndex ? 'incorrect' : ''}>
          <input type="radio" name="study-quiz-answer" value={index} checked={selectedOptionIndex === index} disabled={revealed} onChange={() => setSelectedOptionIndex(index)} />
          <span>{String.fromCharCode(65 + index)}.</span>{option}
        </label>)}
      </div>
      {revealed && <div role="status" className={currentFeedback ? 'study-quiz-feedback correct' : 'study-quiz-feedback incorrect'}>
        <strong>{currentFeedback ? 'Resposta correta.' : `Resposta incorreta. Alternativa correta: ${String.fromCharCode(65 + currentQuestion.correctOptionIndex)}.`}</strong>
        {currentQuestion.explanation && <p>{currentQuestion.explanation}</p>}
        {currentQuestion.sourceExcerpt && <p>Fonte: {currentQuestion.sourceFileName} · “{currentQuestion.sourceExcerpt}”</p>}
      </div>}
      {!revealed ? <button className="primary-action" type="button" onClick={revealAnswer}>Corrigir resposta</button> : <button className="primary-action" type="button" onClick={() => void advanceQuiz()} disabled={saving}>{questionIndex + 1 === quizQuestions.length ? 'Finalizar simulado' : 'Próxima questão'}</button>}
    </article>}

    {phase === 'result' && lastAttempt && resultSummary && <article className="study-quiz-result">
      <span className="card-label">RESULTADO DO SIMULADO</span>
      <strong className="study-quiz-score">{resultSummary.percentage}%</strong>
      <p>{resultSummary.correct} acerto(s) de {resultSummary.total} questão(ões) · {resultSummary.incorrect} erro(s)</p>
      <div className="progress-track"><span style={{ width: `${resultSummary.percentage}%` }} /></div>
      <div className="study-quiz-result-actions"><button className="primary-action" type="button" onClick={startQuiz}>Refazer simulado</button><button className="text-action" type="button" onClick={exitQuiz}>Voltar ao banco</button></div>
      <details className="study-quiz-review"><summary>Revisar respostas e explicações</summary>
        {lastAttempt.answers.map((answer, index) => {
          const question = getQuestionSnapshot(answer, lastAttempt.disciplineId) ?? quizQuestions.find((item) => item.id === answer.questionId);
          if (!question) return <p key={index}>Questão {index + 1} · {answer.isCorrect ? 'Acerto' : 'Erro'} · enunciado original indisponível</p>;
          return <article key={index}>
            <strong>{index + 1}. {question.prompt}</strong>
            <p>Sua resposta: {answer.selectedOptionIndex === null ? 'Sem resposta' : question.options[answer.selectedOptionIndex]}</p>
            <p>Correta: {question.options[question.correctOptionIndex]}</p>
            {question.explanation && <p>{question.explanation}</p>}
          </article>;
        })}
      </details>
    </article>}

    {phase === 'idle' && <>
      {pilotTopic && <LocalQuestionPilot key={pilotTopic.id + ':' + pilotTopic.sourceFileId} topic={pilotTopic}
        onSaved={async () => { await refresh(); onChanged?.(); }} />}
      <form className="study-question-form" onSubmit={createQuestion}>
        <label htmlFor="study-question-prompt">Enunciado da questão</label>
        <textarea id="study-question-prompt" rows={3} maxLength={1000} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Digite uma pergunta objetiva..." required />
        <div className="study-question-form-grid">
          {!unitId && <label htmlFor="study-question-topic">Vincular a tópico <span>· opcional</span>
            <select id="study-question-topic" value={topicId} onChange={(event) => setTopicId(event.target.value)}><option value="">Sem tópico específico</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
          </label>}
          <label htmlFor="study-question-difficulty">Dificuldade
            <select id="study-question-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value as StudyQuestionDifficulty)}><option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option></select>
          </label>
        </div>
        <fieldset className="study-question-options-field">
          <legend>Alternativas — marque a correta</legend>
          {options.map((option, index) => <div className="study-question-option-input" key={index}>
            <input aria-label={`Alternativa ${String.fromCharCode(65 + index)}`} value={option} maxLength={300} onChange={(event) => setOptions((current) => current.map((value, optionIndex) => optionIndex === index ? event.target.value : value))} placeholder={`Alternativa ${String.fromCharCode(65 + index)}`} required />
            <label><input type="radio" name="study-correct-option" checked={correctOptionIndex === index} onChange={() => setCorrectOptionIndex(index)} /> Correta</label>
          </div>)}
        </fieldset>
        <label htmlFor="study-question-explanation">Explicação da resposta <span>· opcional</span>
          <textarea id="study-question-explanation" rows={2} maxLength={2000} value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Explique por que a alternativa está correta..." />
        </label>
        <button className="primary-action" type="submit">Salvar questão</button>
      </form>
      {loading ? <p className="module-feedback">Carregando questões...</p> : unitQuestions.length ? <div className="study-question-list">
        <div className="study-question-list-heading"><strong>Banco desta disciplina</strong><span>As questões mais recentes aparecem primeiro</span></div>
        {unitQuestions.map((question) => <article className="study-question-item" key={question.id}>
          <div><span className="study-question-difficulty">{difficultyLabels[question.difficulty]}</span><strong>{question.prompt}</strong><p>{question.options.length} alternativas{question.topicId ? ` · ${topics.find((topic) => topic.id === question.topicId)?.title ?? 'Tópico vinculado'}` : ''}</p></div>
          <button className="text-action" type="button" onClick={() => void deleteQuestion(question)}>Excluir</button>
        </article>)}
      </div> : <div className="study-flashcard-empty">Cadastre questões objetivas acima. Depois, inicie um simulado para responder e receber a correção automaticamente.</div>}
      {unitHistory.length > 0 && <div className="study-quiz-history"><strong>Histórico de simulados</strong>{unitHistory.slice(0, 5).map((attempt) => <div key={attempt.id}><span>{new Date(attempt.completedAt).toLocaleDateString('pt-BR')}</span><strong>{attempt.correctAnswers}/{attempt.totalQuestions} acertos · {summarizeQuiz(attempt.answers).percentage}%</strong><button type="button" className="text-action" onClick={() => openAttempt(attempt)}>Ver correção</button></div>)}</div>}
    </>}
  </section>;
}
