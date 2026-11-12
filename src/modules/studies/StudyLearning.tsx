import { useEffect, useMemo, useState } from 'react';
import type { StudyFlashcard } from './flashcardTypes';
import type { StudyQuestion, StudyQuizAttempt } from './questionTypes';
import type { StudyTopic } from './types';
import { studyFlashcardRepository, studyLearningProgressRepository, studyQuestionRepository, studyQuizAttemptRepository } from '../../storage/repositories';
import { buildStudyLearningUnits, createLearningProgress } from './studyLearning';
import { studyLearningContexts, type StudyLearningContext, type StudyLearningProgress } from './learningTypes';

const contextStorageKey = 'alfred-study-learning-context';

export function StudyLearning({ disciplineId, topics, refreshToken = 0 }: { disciplineId: string; topics: StudyTopic[]; refreshToken?: number }) {
  const [cards, setCards] = useState<StudyFlashcard[]>([]);
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [attempts, setAttempts] = useState<StudyQuizAttempt[]>([]);
  const [progress, setProgress] = useState<StudyLearningProgress[]>([]);
  const [context, setContext] = useState<StudyLearningContext>(() => readContext());
  const [expandedId, setExpandedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      studyFlashcardRepository.getAll(), studyQuestionRepository.getAll(),
      studyQuizAttemptRepository.getAll(), studyLearningProgressRepository.getAll(),
    ]).then(([allCards, allQuestions, allAttempts, allProgress]) => {
      if (!active) return;
      setCards(allCards.filter((item) => item.disciplineId === disciplineId));
      setQuestions(allQuestions.filter((item) => item.disciplineId === disciplineId));
      setAttempts(allAttempts.filter((item) => item.disciplineId === disciplineId));
      setProgress(allProgress.filter((item) => item.disciplineId === disciplineId));
    }).catch(() => { if (active) setError('Não foi possível carregar o conteúdo guiado desta disciplina.'); })
      .finally(() => { if (active) setLoading(false); });
    setExpandedId('');
    return () => { active = false; };
  }, [disciplineId, refreshToken]);

  const units = useMemo(() => buildStudyLearningUnits({ cards, questions, attempts, topics: topics.filter((topic) => topic.disciplineId === disciplineId), progress, context }), [cards, questions, attempts, topics, progress, context, disciplineId]);
  const completedCount = units.filter((unit) => unit.completed).length;
  const focusCount = units.filter((unit) => unit.reviewReason === 'weak-topic').length;

  function changeContext(value: StudyLearningContext) {
    setContext(value);
    try { window.localStorage.setItem(contextStorageKey, value); } catch { /* Safari private mode may block localStorage. */ }
  }

  async function markComplete(unitId: string) {
    try {
      const saved = createLearningProgress(disciplineId, unitId, context);
      await studyLearningProgressRepository.save(saved);
      setProgress((current) => [...current.filter((item) => item.id !== saved.id), saved]);
    } catch { setError('Não foi possível salvar o progresso da explicação.'); }
  }

  return <section className="study-learning" aria-label="Aprender o conteúdo">
    <div className="study-learning-header">
      <div><span className="card-label">ENSINO CONTEXTUALIZADO</span><h3>Aprender antes de praticar</h3><p>Alfred explica o conceito formal e depois cria uma ponte com um contexto escolhido por você. A analogia ajuda a visualizar; o material continua sendo a fonte da resposta.</p></div>
      <div className="study-learning-count"><strong>{completedCount}/{units.length}</strong><span>explicações vistas</span></div>
    </div>
    <div className="study-learning-contexts" aria-label="Escolher contexto da explicação">
      <span className="study-learning-context-label">Como você quer aprender?</span>
      {studyLearningContexts.map((option) => <button key={option.value} type="button" className={context === option.value ? 'selected' : ''} aria-pressed={context === option.value} onClick={() => changeContext(option.value)}>{option.label}</button>)}
    </div>
    {contextDescription(context) && <p className="study-learning-context-description">{contextDescription(context)}</p>}
    {focusCount > 0 && <div className="study-learning-focus" role="status"><strong>Alfred priorizou {focusCount} conceito(s).</strong><span> Eles aparecem primeiro porque você teve pelo menos metade de erros nas questões vinculadas a esses tópicos.</span></div>}
    {error && <p className="module-error" role="alert">{error}</p>}
    {loading ? <p className="module-feedback">Preparando suas explicações...</p> : units.length === 0 ? <div className="study-learning-empty"><strong>Ainda não há conteúdo guiado.</strong><p>Adicione um material com definições explícitas e salve. O Alfred usará os conceitos extraídos como base para ensinar e depois praticar.</p></div> : <div className="study-learning-list">
      {units.map((unit, index) => <article className={unit.completed ? 'study-learning-card completed' : 'study-learning-card'} key={unit.id}>
        <div className="study-learning-card-heading"><div><span className="study-learning-step">{index + 1}</span><span className="study-learning-reason">{reasonLabel(unit.reviewReason)}</span><h4>{unit.concept}</h4></div><button type="button" className="text-action" aria-expanded={expandedId === unit.id} onClick={() => setExpandedId((current) => current === unit.id ? '' : unit.id)}>{expandedId === unit.id ? 'Fechar' : 'Abrir aula'}</button></div>
        {expandedId === unit.id && <div className="study-learning-body">
          <section><span className="card-label">CONCEITO FORMAL</span><p>{unit.formalExplanation}</p></section>
          <section className="study-learning-analogy"><span className="card-label">PONTE COM {contextLabel(context).toUpperCase()}</span><p>{unit.analogy}</p></section>
          <section><span className="card-label">LIGAÇÃO COM A MATÉRIA</span><p>{unit.bridge}</p></section>
          {unit.sourceExcerpt && <p className="study-learning-source">Fonte associada: {unit.sourceFileName ?? 'material salvo'} · trecho usado: “{unit.sourceExcerpt}”</p>}
          <button type="button" className="primary-action" onClick={() => void markComplete(unit.id)} disabled={unit.completed}>{unit.completed ? 'Explicação concluída' : 'Marcar como aprendido'}</button>
        </div>}
      </article>)}
    </div>}
  </section>;
}

function readContext(): StudyLearningContext {
  try {
    const value = window.localStorage.getItem(contextStorageKey);
    if (studyLearningContexts.some((item) => item.value === value)) return value as StudyLearningContext;
  } catch { /* Use the technical default when storage is unavailable. */ }
  return 'technical';
}

function contextLabel(context: StudyLearningContext): string {
  return studyLearningContexts.find((item) => item.value === context)?.label ?? 'Técnico';
}

function contextDescription(context: StudyLearningContext): string {
  return studyLearningContexts.find((item) => item.value === context)?.description ?? '';
}

function reasonLabel(reason: 'new' | 'weak-topic' | 'due-review'): string {
  return reason === 'weak-topic' ? 'Prioridade por dificuldade' : reason === 'due-review' ? 'Revisão recomendada' : 'Novo conceito';
}
