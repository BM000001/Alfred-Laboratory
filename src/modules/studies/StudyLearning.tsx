import { useEffect, useMemo, useState } from 'react';
import type { StudyFlashcard } from './flashcardTypes';
import type { StudyQuestion, StudyQuizAttempt } from './questionTypes';
import type { StudyTopic } from './types';
import { fileRepository, studyFlashcardRepository, studyLearningProgressRepository, studyQuestionRepository, studyQuizAttemptRepository } from '../../storage/repositories';
import type { MaterialProcessingState } from './materialProcessor';
import { buildStudyLearningUnits, createLearningProgress } from './studyLearning';
import { studyLearningContexts, type StudyLearningContext, type StudyLearningProgress } from './learningTypes';

import { getAlfredLocalStorageKey } from '../../storage/namespace';
import { displayStudyTitle } from './displayStudyTitle';
import { StudyVisualLesson } from './StudyVisualLesson';

const contextStorageKey = getAlfredLocalStorageKey('alfred-study-learning-context');
type AILesson = NonNullable<MaterialProcessingState['aiLessons']>[number];

export function StudyLearning({ disciplineId, topics, topicId, refreshToken = 0, aiOnly = false }: { disciplineId: string; topics: StudyTopic[]; topicId?: string; refreshToken?: number; aiOnly?: boolean }) {
  const [cards, setCards] = useState<StudyFlashcard[]>([]);
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [aiLessons, setAILessons] = useState<AILesson[]>([]);
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
      studyQuizAttemptRepository.getAll(), studyLearningProgressRepository.getAll(), fileRepository.getAll(),
    ]).then(([allCards, allQuestions, allAttempts, allProgress, allFiles]) => {
      if (!active) return;
      setCards(allCards.filter((item) => item.disciplineId === disciplineId && (!topicId || item.topicId === topicId)));
      setQuestions(allQuestions.filter((item) => item.disciplineId === disciplineId && (!topicId || item.topicId === topicId)));
      setAttempts(allAttempts.filter((item) => item.disciplineId === disciplineId));
      setProgress(allProgress.filter((item) => item.disciplineId === disciplineId));
      setAILessons(allFiles.filter((file) => file.disciplineId === disciplineId &&
        (!topicId || file.processing?.topicId === topicId))
        .flatMap(file => file.processing?.aiLessons ?? []));
    }).catch(() => { if (active) setError('Não foi possível carregar o conteúdo guiado desta disciplina.'); })
      .finally(() => { if (active) setLoading(false); });
    setExpandedId('');
    return () => { active = false; };
  }, [disciplineId, topicId, refreshToken]);

  const units = useMemo(() => buildStudyLearningUnits({ cards, questions, attempts, topics: topics.filter((topic) => topic.disciplineId === disciplineId), progress, context }), [cards, questions, attempts, topics, progress, context, disciplineId]);
  const readyUnits = aiOnly ? [] : units.filter((unit) => unit.didactic && !unit.needsReview);
  const completedCount = readyUnits.filter((unit) => unit.completed).length + aiLessons.filter(lesson => progress.some(item => item.lessonId === 'lesson:' + lesson.id)).length;
  const focusCount = readyUnits.filter((unit) => unit.reviewReason === 'weak-topic').length;

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
      <div><span className="card-label">ENSINO CONTEXTUALIZADO</span><h3>Aprender antes de praticar</h3><p>Consulte os conceitos extraídos e pratique com exemplos quando houver evidência suficiente.</p></div>
      <div className="study-learning-count"><strong>{completedCount}/{readyUnits.length + aiLessons.length}</strong><span>explicações vistas</span></div>
    </div>
    {!aiOnly && <div className="study-learning-contexts" aria-label="Escolher contexto da explicação">
      <span className="study-learning-context-label">Como você quer aprender?</span>
      {studyLearningContexts.map((option) => <button key={option.value} type="button" className={context === option.value ? 'selected' : ''} aria-pressed={context === option.value} onClick={() => changeContext(option.value)}>{option.label}</button>)}
    </div>}
    {!aiOnly && contextDescription(context) && <p className="study-learning-context-description">{contextDescription(context)}</p>}
    {focusCount > 0 && <div className="study-learning-focus" role="status"><strong>Alfred priorizou {focusCount} conceito(s).</strong><span> Eles aparecem primeiro porque você teve pelo menos metade de erros nas questões vinculadas a esses tópicos.</span></div>}
    {error && <p className="module-error" role="alert">{error}</p>}
    {loading ? <p className="module-feedback">Preparando suas explicações...</p> : readyUnits.length === 0 && aiLessons.length === 0 ? <div className="study-learning-empty"><strong>Ainda não há conteúdo guiado.</strong><p>Ainda não há aulas completas e verificadas. Adicione um material; quando a IA estiver disponível, o Alfred poderá complementar o conteúdo. Respostas curtas de flashcards não serão apresentadas como aulas prontas.</p></div> : <div className="study-learning-list">
      {aiLessons.map((lesson, index) => {
        const learned = progress.some(item => item.lessonId === 'lesson:' + lesson.id);
        return <article className={learned ? 'study-learning-card completed' : 'study-learning-card'} key={lesson.id}>
          <div className="study-learning-card-heading">
            <div><div className="study-learning-meta"><span className="study-learning-step">{index + 1}</span><span className="study-learning-reason">Aula com IA</span></div>
              <h4>{displayStudyTitle(lesson.title)}</h4></div>
            <button type="button" className="text-action" aria-expanded={expandedId === lesson.id}
              onClick={() => setExpandedId(current => current === lesson.id ? '' : lesson.id)}>
              {expandedId === lesson.id ? 'Fechar' : 'Abrir aula'}
            </button>
          </div>
          {expandedId === lesson.id && <div className="study-learning-body">
            <StudyVisualLesson lesson={lesson} learned={learned}
              onComplete={() => void markComplete('lesson:' + lesson.id)} />
          </div>}
        </article>;
      })}
      {readyUnits.map((unit, index) => <article className={unit.completed ? 'study-learning-card completed' : 'study-learning-card'} key={unit.id}>
        <div className="study-learning-card-heading"><div><div className="study-learning-meta"><span className="study-learning-step">{index + 1}</span><span className="study-learning-reason">{reasonLabel(unit.reviewReason)}</span></div><h4>{displayStudyTitle(unit.concept)}</h4></div><button type="button" className="text-action" aria-expanded={expandedId === unit.id} onClick={() => setExpandedId((current) => current === unit.id ? '' : unit.id)}>{expandedId === unit.id ? 'Fechar' : 'Abrir aula'}</button></div>
        {expandedId === unit.id && <div className="study-learning-body">
          <section><span className="card-label">{unit.didactic ? 'Conceito usado na aula' : unit.sourceExcerpt ? 'Explicação extrativa' : 'Resposta do cartão'}</span><p>{unit.formalExplanation}</p></section>
          {unit.needsReview && <p role="status">Revisão recomendada. Este cartão salvo pode descrever uma situação específica em vez de um conceito.</p>}
          {unit.didactic ? <>
            <section><h5>Como funciona</h5><p>{unit.didactic.mechanism}</p></section>
            <section><h5>Exemplo didático</h5><pre>{unit.didactic.example}</pre></section>
            <section><h5>Aplicação e cuidado</h5><p>{unit.didactic.application}</p><p>{unit.didactic.pitfall}</p></section>
            <details><summary>Verificação de compreensão</summary><p>{unit.didactic.check}</p>
              <details><summary>Conferir resposta</summary><p>{unit.didactic.answer}</p></details>
            </details>
          </> : <p className="study-learning-source">A explicação detalhada fica pendente de enriquecimento. Use a fonte para conferir o contexto.</p>}
          {unit.analogy && <section className="study-learning-analogy"><span className="card-label">Analogia em {contextLabel(context)}</span><p>{unit.analogy}</p></section>}
          {unit.sourceExcerpt && <details><summary>Trecho de origem{unit.sourceFileName ? ` · ${unit.sourceFileName}` : ''}</summary>
            {unit.sourceExcerpt !== unit.formalExplanation && <blockquote>{unit.sourceExcerpt}</blockquote>}
            {unit.sourceExcerpt === unit.formalExplanation && <p>O trecho está reproduzido acima.</p>}
          </details>}
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
