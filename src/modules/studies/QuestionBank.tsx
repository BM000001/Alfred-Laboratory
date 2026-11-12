import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { studyQuestionRepository, studyQuizAttemptRepository } from '../../storage/repositories';
import type { StudyTopic } from './types';
import type { StudyQuestion, StudyQuizAnswer, StudyQuizAttempt, StudyQuestionDifficulty, StudyQuestionSnapshot } from './questionTypes';
import { createQuestionService, gradeStudyAnswer, summarizeQuiz, selectQuizQuestions } from './questionService';

const service = createQuestionService(studyQuestionRepository, studyQuizAttemptRepository);
const emptyOptions = ['', '', '', ''];
const difficultyLabels: Record<StudyQuestionDifficulty, string> = { easy: 'Fácil', medium: 'Média', hard: 'Difícil' };

export function QuestionBank({ disciplineId, topics, refreshToken = 0, onAttemptSaved }: { disciplineId: string; topics: StudyTopic[]; refreshToken?: number; onAttemptSaved?: () => void }) {
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [history, setHistory] = useState<StudyQuizAttempt[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState<string[]>(emptyOptions);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [topicId, setTopicId] = useState('');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState<StudyQuestionDifficulty>('medium');
  const [quizTopicFilter, setQuizTopicFilter] = useState('all');
  const [quizDifficultyFilter, setQuizDifficultyFilter] = useState<StudyQuestionDifficulty | 'all'>('all');
  const [quizQuestionCount, setQuizQuestionCount] = useState(10);
  const [phase, setPhase] = useState<'idle' | 'quiz' | 'result'>('idle');
  const [quizQuestions, setQuizQuestions] = useState<StudyQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<StudyQuizAnswer[]>([]);
  const [quizStartedAt, setQuizStartedAt] = useState('');
  const [lastAttempt, setLastAttempt] = useState<StudyQuizAttempt | null>(null);
  const [historyAttemptId, setHistoryAttemptId] = useState('');
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
    setTopicId('');
    setQuizTopicFilter('all');
    setQuizDifficultyFilter('all');
    setPhase('idle');
    setQuizQuestions([]);
    setQuizAnswers([]);
    setLastAttempt(null);
    setHistoryAttemptId('');
    return () => { active = false; };
  }, [disciplineId, refreshToken]);

  const availableQuizQuestions = useMemo(() => selectQuizQuestions(questions, {
    topicId: quizTopicFilter === 'all' ? undefined : quizTopicFilter,
    difficulty: quizDifficultyFilter,
    limit: 50,
    random: () => 0.5,
  }), [questions, quizTopicFilter, quizDifficultyFilter]);
  const currentQuestion = quizQuestions[questionIndex];
  const currentFeedback = currentQuestion && revealed ? gradeStudyAnswer(currentQuestion, selectedOptionIndex) : false;
  const resultSummary = useMemo(() => lastAttempt ? summarizeQuiz(lastAttempt.answers) : null, [lastAttempt]);

  async function createQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      const existing = questions.find((question) => question.id === editingQuestionId);
      const input = {
        disciplineId,
        ...(topicId ? { topicId } : {}),
        prompt,
        options,
        correctOptionIndex,
        explanation,
        difficulty,
        ...(existing?.sourceFileId ? { sourceFileId: existing.sourceFileId } : {}),
        ...(existing?.sourceFileName ? { sourceFileName: existing.sourceFileName } : {}),
        ...(existing?.subject ? { subject: existing.subject } : {}),
      };
      if (editingQuestionId) await service.update(editingQuestionId, input);
      else await service.create(input);
      setEditingQuestionId('');
      setPrompt('');
      setOptions(emptyOptions);
      setCorrectOptionIndex(0);
      setTopicId('');
      setExplanation('');
      setDifficulty('medium');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a questão.');
    }
  }

  function editQuestion(question: StudyQuestion) {
    setEditingQuestionId(question.id);
    setPrompt(question.prompt);
    setOptions([...question.options]);
    setCorrectOptionIndex(question.correctOptionIndex);
    setTopicId(question.topicId ?? '');
    setExplanation(question.explanation ?? '');
    setDifficulty(question.difficulty);
  }

  function cancelQuestionEdit() {
    setEditingQuestionId('');
    setPrompt('');
    setOptions(emptyOptions);
    setCorrectOptionIndex(0);
    setTopicId('');
    setExplanation('');
    setDifficulty('medium');
  }

  async function deleteQuestion(question: StudyQuestion) {
    if (!window.confirm('Excluir esta questão do banco?')) return;
    try { await service.delete(question.id); await refresh(); }
    catch { setError('Não foi possível excluir a questão.'); }
  }

  function startQuiz() {
    const session = selectQuizQuestions(questions, {
      topicId: quizTopicFilter === 'all' ? undefined : quizTopicFilter,
      difficulty: quizDifficultyFilter,
      limit: quizQuestionCount,
    });
    if (!session.length) return;
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
    if (!currentQuestion || selectedOptionIndex === null) return;
    const answer: StudyQuizAnswer = {
      questionId: currentQuestion.id,
      selectedOptionIndex,
      isCorrect: gradeStudyAnswer(currentQuestion, selectedOptionIndex),
      questionSnapshot: snapshotQuestion(currentQuestion),
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
      id: crypto.randomUUID(),
      disciplineId,
      startedAt: quizStartedAt,
      completedAt: new Date().toISOString(),
      totalQuestions: updatedAnswers.length,
      correctAnswers: summary.correct,
      answers: updatedAnswers,
    };
    try {
      await service.saveAttempt(attempt);
      setQuizAnswers(updatedAnswers);
      setLastAttempt(attempt);
      setPhase('result');
      await refresh();
      onAttemptSaved?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o resultado do simulado.');
    }
  }

  function exitQuiz() {
    setPhase('idle');
    setQuizQuestions([]);
    setQuizAnswers([]);
    setSelectedOptionIndex(null);
    setRevealed(false);
  }

  return <section className="study-question-bank" aria-label="Banco de questões e simulados">
    <div className="study-question-header">
      <div><span className="card-label">PRÁTICA E AUTOAVALIAÇÃO</span><h3>Questões e simulados</h3><p>{questions.length} questão(ões) cadastrada(s) · simulados com até 50 questões</p></div>
      {phase === 'idle' && <button className="study-quiz-start" type="button" disabled={!availableQuizQuestions.length} onClick={startQuiz}>Iniciar simulado</button>}
      {phase !== 'idle' && <button className="study-quiz-start secondary" type="button" onClick={exitQuiz}>Sair do simulado</button>}
    </div>
    {phase === 'idle' && <div className="study-quiz-filters">
      <label htmlFor="study-quiz-topic-filter">Tópico do simulado
        <select id="study-quiz-topic-filter" value={quizTopicFilter} onChange={event => setQuizTopicFilter(event.target.value)}><option value="all">Todos os tópicos</option>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
      </label>
      <label htmlFor="study-quiz-difficulty-filter">Dificuldade
        <select id="study-quiz-difficulty-filter" value={quizDifficultyFilter} onChange={event => setQuizDifficultyFilter(event.target.value as StudyQuestionDifficulty | 'all')}><option value="all">Todas</option><option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option></select>
      </label>
      <label htmlFor="study-quiz-question-count">Quantidade de questões
        <input id="study-quiz-question-count" type="number" min="1" max={Math.min(50, availableQuizQuestions.length)} value={Math.min(quizQuestionCount, Math.max(1, availableQuizQuestions.length))} onChange={(event) => setQuizQuestionCount(Math.max(1, Math.min(50, Number(event.target.value) || 1)))} disabled={!availableQuizQuestions.length} />
      </label>
      <span>{availableQuizQuestions.length} questão(ões) disponíveis</span>
    </div>}
    {error && <p className="module-error" role="alert">{error}</p>}

    {phase === 'quiz' && currentQuestion && <article className="study-quiz-card">
      <div className="study-quiz-progress"><span>Questão {questionIndex + 1} de {quizQuestions.length}</span><span>{difficultyLabels[currentQuestion.difficulty]}</span></div>
      <div className="progress-track"><span style={{ width: `${((questionIndex + 1) / quizQuestions.length) * 100}%` }} /></div>
      <h4>{currentQuestion.prompt}</h4>
      <div className="study-quiz-options">
        {currentQuestion.options.map((option, index) => <label key={index} className={revealed && index === currentQuestion.correctOptionIndex ? 'correct' : revealed && index === selectedOptionIndex ? 'incorrect' : ''}>
          <input type="radio" name="study-quiz-answer" value={index} checked={selectedOptionIndex === index} disabled={revealed} onChange={() => setSelectedOptionIndex(index)} />
          <span>{String.fromCharCode(65 + index)}.</span>{option}
        </label>)}
      </div>
      {revealed && <div className={currentFeedback ? 'study-quiz-feedback correct' : 'study-quiz-feedback incorrect'}>
        <strong>{currentFeedback ? 'Resposta correta.' : `Resposta incorreta. Alternativa correta: ${String.fromCharCode(65 + currentQuestion.correctOptionIndex)}.`}</strong>
        {currentQuestion.explanation && <p>{currentQuestion.explanation}</p>}
      </div>}
      {!revealed ? <button className="primary-action" type="button" onClick={revealAnswer}>Corrigir resposta</button> : <button className="primary-action" type="button" onClick={() => void advanceQuiz()}>{questionIndex + 1 === quizQuestions.length ? 'Finalizar simulado' : 'Próxima questão'}</button>}
    </article>}

    {phase === 'result' && lastAttempt && resultSummary && <article className="study-quiz-result">
      <span className="card-label">RESULTADO DO SIMULADO</span>
      <strong className="study-quiz-score">{resultSummary.percentage}%</strong>
      <p>{resultSummary.correct} acerto(s) de {resultSummary.total} questão(ões) · {resultSummary.incorrect} erro(s)</p>
      <div className="progress-track"><span style={{ width: `${resultSummary.percentage}%` }} /></div>
      <div className="study-quiz-result-actions"><button className="primary-action" type="button" onClick={startQuiz}>Refazer simulado</button><button className="text-action" type="button" onClick={exitQuiz}>Voltar ao banco</button></div>
      <details className="study-quiz-review"><summary>Revisar respostas e explicações</summary>
        {lastAttempt.answers.map((answer, index) => {
          const question = answer.questionSnapshot ?? quizQuestions.find((item) => item.id === answer.questionId);
          if (!question) return <article key={`${answer.questionId}:${index}`}><strong>{index + 1}. Questão original indisponível</strong><p>Esta tentativa foi criada em uma versão anterior que não guardava uma cópia da questão.</p></article>;
          return <article key={`${answer.questionId}:${index}`}>
            <strong>{index + 1}. {question.prompt}</strong>
            <p>Sua resposta: {answer.selectedOptionIndex === null || answer.selectedOptionIndex === undefined ? 'Sem resposta' : question.options[answer.selectedOptionIndex] ?? 'Alternativa não disponível'}</p>
            <p>Correta: {question.options[question.correctOptionIndex] ?? 'Alternativa não disponível'}</p>
            {question.explanation && <p>{question.explanation}</p>}
          </article>;
        })}
      </details>
    </article>}

    {phase === 'idle' && <>
      <form className="study-question-form" onSubmit={createQuestion}>
        {editingQuestionId && <strong>Editar questão do banco</strong>}
        <label htmlFor="study-question-prompt">Enunciado da questão</label>
        <textarea id="study-question-prompt" rows={3} maxLength={1000} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Digite uma pergunta objetiva..." required />
        <div className="study-question-form-grid">
          <label htmlFor="study-question-topic">Vincular a tópico <span>· opcional</span>
            <select id="study-question-topic" value={topicId} onChange={(event) => setTopicId(event.target.value)}><option value="">Sem tópico específico</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
          </label>
          <label htmlFor="study-question-difficulty">Dificuldade
            <select id="study-question-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value as StudyQuestionDifficulty)}><option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option></select>
          </label>
        </div>
        <fieldset className="study-question-options-field">
          <legend>Alternativas — marque a correta</legend>
          {options.map((option, index) => <div className="study-question-option-input" key={index}>
            <input aria-label={`Alternativa ${String.fromCharCode(65 + index)}`} value={option} maxLength={300} onChange={(event) => setOptions((current) => current.map((value, optionIndex) => optionIndex === index ? event.target.value : value))} placeholder={`Alternativa ${String.fromCharCode(65 + index)}`} required />
            <label><input type="radio" name="study-correct-option" checked={correctOptionIndex === index} onChange={() => setCorrectOptionIndex(index)} /> Correta</label>
            {options.length > 2 && <button className="text-action study-remove-option" type="button" aria-label={`Remover alternativa ${String.fromCharCode(65 + index)}`} onClick={() => {
              setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index));
              setCorrectOptionIndex((current) => current === index ? 0 : current > index ? current - 1 : current);
            }}>Remover</button>}
          </div>)}
          <button className="text-action study-add-option" type="button" disabled={options.length >= 6} onClick={() => setOptions((current) => [...current, ''])}>Adicionar alternativa {options.length < 6 ? `(${options.length}/6)` : '(limite atingido)'}</button>
        </fieldset>
        <label htmlFor="study-question-explanation">Explicação da resposta <span>· opcional</span>
          <textarea id="study-question-explanation" rows={2} maxLength={2000} value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Explique por que a alternativa está correta..." />
        </label>
        <button className="primary-action" type="submit">{editingQuestionId ? 'Salvar alterações' : 'Salvar questão'}</button>
        {editingQuestionId && <button className="text-action" type="button" onClick={cancelQuestionEdit}>Cancelar edição</button>}
      </form>
      {loading ? <p className="module-feedback">Carregando questões...</p> : questions.length ? <div className="study-question-list">
        <div className="study-question-list-heading"><strong>Banco desta disciplina</strong><span>As questões mais recentes aparecem primeiro</span></div>
        {questions.map((question) => <article className="study-question-item" key={question.id}>
          <div><span className="study-question-difficulty">{difficultyLabels[question.difficulty]}</span><strong>{question.prompt}</strong><p>{question.options.length} alternativas{question.topicId ? ` · ${topics.find((topic) => topic.id === question.topicId)?.title ?? 'Tópico vinculado'}` : ''}</p></div>
          <div><button className="text-action" type="button" onClick={() => editQuestion(question)}>Editar</button><button className="text-action" type="button" onClick={() => void deleteQuestion(question)}>Excluir</button></div>
        </article>)}
      </div> : <div className="study-flashcard-empty">Cadastre questões objetivas acima. Depois, inicie um simulado para responder e receber a correção automaticamente.</div>}
      {history.length > 0 && <div className="study-quiz-history"><strong>Histórico de simulados</strong>{history.map((attempt) => <div key={attempt.id}>
        <span>{new Date(attempt.completedAt).toLocaleDateString('pt-BR')} · {attempt.totalQuestions} questões</span>
        <strong>{attempt.correctAnswers}/{attempt.totalQuestions} acertos · {attempt.totalQuestions ? Math.round(attempt.correctAnswers / attempt.totalQuestions * 100) : 0}%</strong>
        <button className="text-action" type="button" aria-expanded={historyAttemptId === attempt.id} onClick={() => setHistoryAttemptId((current) => current === attempt.id ? '' : attempt.id)}>{historyAttemptId === attempt.id ? 'Fechar revisão' : 'Revisar'}</button>
      </div>)}
        {history.find((attempt) => attempt.id === historyAttemptId) && <details className="study-quiz-review" open>
          <summary>Respostas desta tentativa</summary>
          {history.find((attempt) => attempt.id === historyAttemptId)!.answers.map((answer, index) => {
            const question = answer.questionSnapshot ?? questions.find((item) => item.id === answer.questionId);
            if (!question) return <article key={`${answer.questionId}:${index}`}><strong>{index + 1}. Questão original indisponível</strong><p>Esta tentativa antiga não contém uma cópia da questão.</p></article>;
            return <article key={`${answer.questionId}:${index}`}>
              <strong>{index + 1}. {question.prompt}</strong>
              <p>Sua resposta: {answer.selectedOptionIndex === null ? 'Sem resposta' : question.options[answer.selectedOptionIndex] ?? 'Alternativa não disponível'}</p>
              <p>Correta: {question.options[question.correctOptionIndex] ?? 'Alternativa não disponível'}</p>
              {question.explanation && <p>{question.explanation}</p>}
            </article>;
          })}
        </details>}
      </div>}
    </>}
  </section>;
}

function snapshotQuestion(question: StudyQuestion): StudyQuestionSnapshot {
  return {
    prompt: question.prompt,
    options: [...question.options],
    correctOptionIndex: question.correctOptionIndex,
    ...(question.explanation ? { explanation: question.explanation } : {}),
    difficulty: question.difficulty,
    ...(question.topicId ? { topicId: question.topicId } : {}),
    ...(question.sourceFileName ? { sourceFileName: question.sourceFileName } : {}),
    ...(question.subject ? { subject: question.subject } : {}),
  };
}
