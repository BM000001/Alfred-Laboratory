import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  fileRepository,
  studyLearningProgressRepository,
  studyFlashcardRepository,
  studyQuestionRepository,
  studyQuizAttemptRepository,
} from '../../storage/repositories';
import { getAlfredLocalStorageKey } from '../../storage/namespace';
import { StudyLearning } from './StudyLearning';
import { StudyFlashcards } from './StudyFlashcards';
import { StudyPerformance } from './StudyPerformance';
import { SortingLab, sortingLabLessonId } from './SortingLab';
import { QuestionBank } from './QuestionBank';
import { buildTrailChapter, passesTrailAttempt, summarizeTrailCompletion, TRAIL_DIFFICULTIES, unlockedTargetLevel, type TrailCompletion } from './trailModel';
import type { StudyQuestionDifficulty, StudyQuizAttempt } from './questionTypes';
import type { Discipline, StudyTopic } from './types';
import './studyTrail.css';
import { displayStudyTitle } from './displayStudyTitle';

const labels = {
  available: 'Disponível',
  'preparation-needed': 'Preparação necessária',
  'insufficient-content': 'Conteúdo insuficiente',
  offline: 'Offline',
  'progression-locked': 'Bloqueada pela progressão',
};
const silhouettes: Record<string, string> = {
  library:
    'M2 13h2v-2h3V9h3V7h4V5h4v2h4v2h3v2h3v2h2v2H2z M5 16h4v10H5zm9 0h4v10h-4zm9 0h4v10h-4zM3 27h26v3H3z',
  targets: 'M6 6h16v2h3v3h2v12h-2v3h-3v2H8v-2H5v-3H3V11h3z M9 11v11h12V11z M13 14h5v5h-5z',
  'flashcard-chest': 'M4 11h3V8h18v3h3v8H4z M3 20h10v3h6v-3h10v8H3z M14 17h4v5h-4z',
  laboratory: 'M11 4h10v3h-2v7l8 11v4H5v-4l8-11V7h-2z M15 8v8l-4 6h10l-4-6V8z',
  castle: 'M2 7h3v4h3V7h3v9h3V8h4v8h3V7h3v4h3V7h3v21H19v-7h-6v7H2z',
};
const initialCounts = { lessons: false, questions: 0, cards: 0, attempts: 0 };
type Props = {
  discipline: Discipline;
  topics: StudyTopic[];
  refreshToken: number;
  onManage: () => void;
  onMaterials: (unit: string) => void;
  onAddMaterial: (unit: string) => void;
};

export function StudyTrail({ discipline, topics, refreshToken, onManage, onMaterials, onAddMaterial }: Props) {
  const [chapterId, selectChapter] = useState('');
  const topic = topics.find((t) => t.id === chapterId) ?? topics.find((t) => Boolean(t.sourceFileId)) ?? topics[0];
  const [active, select] = useState('');
  const [decision, setDecision] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [level, setLevel] = useState<StudyQuestionDifficulty>('easy');
  const [targetCounts, setTargetCounts] = useState({ easy: 0, medium: 0, hard: 0 });
  const [cardsReviewed, setCardsReviewed] = useState(false);
  const [labPassed, setLabPassed] = useState(false);
  const [trailAttempts, setTrailAttempts] = useState<StudyQuizAttempt[]>([]);
  const [counts, setCounts] = useState(initialCounts);
  const [load, setLoad] = useState('Carregando recursos…');
  const [online, setOnline] = useState(navigator.onLine);
  const [revision, refresh] = useState(0);
  const key = getAlfredLocalStorageKey(
    'trail-visit-v1:' + JSON.stringify([discipline.id, topic?.id ?? null]),
  );
  const [marks, setMarks] = useState<Record<string, TrailCompletion>>({});
  const [warning, setWarning] = useState('');
  const previous = useRef<{ id: string; y: number } | undefined>(undefined);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    try {
      setMarks(JSON.parse(localStorage.getItem(key) ?? '{}') ?? {});
    } catch {
      setMarks({});
    }
  }, [key]);
  useEffect(() => {
    let current = true;
    setLoad('Carregando recursos…');
    const matches = (row: { disciplineId: string; topicId?: string }) =>
      row.disciplineId === discipline.id && (!topic || row.topicId === topic.id);
    Promise.all([
      studyQuestionRepository.getAll(),
      studyFlashcardRepository.getAll(),
      studyQuizAttemptRepository.getAll(),
      fileRepository.getAll(),
      studyLearningProgressRepository.getAll(),
    ])
      .then(([allQuestions, allCards, attempts, allFiles, progress]) => {
        if (!current) return;
        const questions = allQuestions.filter(matches),
          cards = allCards.filter(matches);
        setCardsReviewed(cards.some(card => card.reviewCount > 0));
        const aiLessonCount = allFiles.filter(file => file.disciplineId === discipline.id &&
          (!topic || file.processing?.topicId === topic.id))
          .reduce((count, file) => count + (file.processing?.aiLessons?.length ?? 0), 0);
        setTargetCounts({
          easy: questions.filter(q => q.difficulty === 'easy').length,
          medium: questions.filter(q => q.difficulty === 'medium').length,
          hard: questions.filter(q => q.difficulty === 'hard').length,
        });
        setTrailAttempts(attempts.filter(a => a.disciplineId === discipline.id &&
          a.trail && a.trail.topicId === topic?.id));
        setLabPassed(progress.some(item => item.disciplineId === discipline.id &&
          item.lessonId === sortingLabLessonId(topic?.id) && (item.practiceScore ?? 0) >= 80));
        setCounts({
          questions: questions.length,
          cards: cards.length,
          lessons: aiLessonCount > 0,
          attempts: attempts.filter(
            (a) =>
              a.disciplineId === discipline.id &&
              (!topic || a.answers.some((answer) => answer.questionSnapshot?.topicId === topic.id)),
          ).length,
        });
        setLoad('');
      })
      .catch(() => {
        if (current) setLoad('Não foi possível consultar os recursos locais.');
      });
    return () => {
      current = false;
    };
  }, [discipline.id, topic, revision, refreshToken]);
  const chapter = buildTrailChapter(
    topic?.id ?? '',
    discipline.id,
    topic?.title ?? 'Toda a disciplina',
    { ...counts, lessons: counts.lessons || Boolean(topic?.sourceFileId), targetQuestions: targetCounts[level], targetUnlocked: unlockedTargetLevel(level, trailAttempts) },
  );
  const hasLinkedMaterial = Boolean(topic?.sourceFileId);
  const hasActivities = counts.lessons || counts.questions > 0 || counts.cards > 0;
  const assessments = { targets: 'quiz', castle: 'final', 'flashcard-chest': 'verify' } as const;
  const nodes = chapter.nodes.map((node) => {
    const activity = assessments[node.id as keyof typeof assessments];
    const mark = marks[node.id === 'targets' ? 'targets:' + level : node.id];
    const passed = (node.id === 'laboratory' && labPassed) || (activity && trailAttempts.some(attempt => attempt.trail?.activity === activity &&
      (activity !== 'quiz' || attempt.trail.difficulty === level) && passesTrailAttempt(attempt)));
    const completion = passed ? 'completed' : mark === 'skipped' || (!activity && node.id !== 'laboratory') ? mark ?? node.completion : node.completion;
    return { ...node, completion };
  });
  const summary = summarizeTrailCompletion(nodes);
  const index = nodes.findIndex((n) => n.id === active),
    node = nodes[index];
  useLayoutEffect(() => {
    if (!active && !load && previous.current) {
      const { id, y } = previous.current;
      buttons.current.get(id)?.focus({ preventScroll: true });
      window.scrollTo(0, y);
      previous.current = undefined;
    }
  }, [active, load]);
  function open(id: string) {
    previous.current = { id, y: window.scrollY };
    select(id);
    setDecision(false);
    setShowResult(false);
    window.scrollTo(0, 0);
  }
  function finish(completion: TrailCompletion) {
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? '{}') ?? {};
      const markId = active === 'targets' ? 'targets:' + level : active;
      const updated = { ...stored, [markId]: stored[markId] === 'completed' ? 'completed' : completion };
      localStorage.setItem(key, JSON.stringify(updated));
      setMarks(updated);
    } catch {
      setWarning('Não foi possível salvar esta marcação no dispositivo.');
    }
    setDecision(true);
    refresh((v) => v + 1);
  }
  return (
    <section className="learning-trail" aria-label="Trilha de aprendizagem">
      {warning && <p role="alert">{warning}</p>}
      {!online && <p role="status">Offline · recursos locais disponíveis</p>}
      {load && <p role="status">{load}</p>}
      {!load && !hasLinkedMaterial && (
        <div className="empty-state" role="status">
          <strong>Adicione um material para começar</strong>
          <p>A trilha será preparada depois que você enviar um material da disciplina. Não vamos mostrar aulas ou desafios sem uma fonte.</p>
          <button type="button" className="primary-action" onClick={() => onAddMaterial(topic?.id ?? '')}>Adicionar material</button>
        </div>
      )}
      {!load && hasLinkedMaterial && !hasActivities && (
        <div className="empty-state" role="status">
          <strong>Material salvo. Preparação da trilha pendente</strong>
          <p>O material está na Biblioteca. Importe mais fontes ou cadastre atividades em Praticar. A preparação por IA depende da prévia autenticada.</p>
          <button type="button" className="primary-action" onClick={() => onMaterials(topic?.id ?? '')}>Ver material e preparação</button>
        </div>
      )}
      {!node && !load ? (
        <>
          <div className="trail-tools">
            <label>
              Capítulo{' '}
              <select value={topic?.id ?? ''} onChange={(e) => { selectChapter(e.target.value); setLevel('easy'); }}>
                {!topics.length && <option value="">Toda a disciplina</option>}
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {displayStudyTitle(t.title)}
                  </option>
                ))}
              </select>
            </label>
            <label>Nível do Campo de Alvos{' '}
              <select value={level} onChange={e => setLevel(e.target.value as StudyQuestionDifficulty)}>
                {TRAIL_DIFFICULTIES.map((difficulty, index) => <option key={difficulty} value={difficulty}>
                  {index + 1} · {['Fácil', 'Média', 'Difícil'][index]}
                </option>)}
              </select>
            </label>
            <button type="button" className="text-action" onClick={onManage}>
              Unidades e materiais
            </button>
          </div>
          {hasActivities && <p>
            {summary.completed} de {summary.total} etapas concluídas
            {summary.skipped ? ' · ' + summary.skipped + ' puladas' : ''}
          </p>}
          <ol className="trail-course">
            {(hasActivities ? nodes : nodes.filter(stop => stop.landmarkId)).map((n, i) => (
              <li
                key={n.id}
                style={{
                  marginInlineStart: ['7%', '22%', '38%', '28%', '12%', '24%', '40%', '27%', '9%'][i],
                }}
              >
                <button
                  type="button"
                  className={n.landmarkId ? 'trail-stop major' : 'trail-stop'}
                  ref={(el) => {
                    if (el) buttons.current.set(n.id, el);
                    else buttons.current.delete(n.id);
                  }}
                  onClick={() => open(n.id)}
                >
                  <span className="trail-piece" aria-hidden="true">
                    {n.landmarkId ? (
                      <svg viewBox="0 0 32 32" fill="currentColor" fillRule="evenodd">
                        <path d={silhouettes[n.landmarkId]} />
                      </svg>
                    ) : (
                      '◆'
                    )}
                  </span>
                  <span>
                    <strong>{n.title}</strong>
                    <small>
                      {load || labels[n.availability]}
                      {n.completion === 'completed'
                        ? ' · Concluída'
                        : n.completion === 'skipped'
                          ? ' · Pulada'
                          : ''}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : node ? (
        <>
          <button className="text-action" onClick={() => select('')}>
            Voltar à trilha
          </button>
          <h3>{node.title}</h3>
          <p>{displayStudyTitle(chapter.title)}</p>
          {(!decision || showResult) && (
            <>
              {(load || node.availability !== 'available') && (
                <p role="status">{load || labels[node.availability]}</p>
              )}
              {active === 'library' && (
                <>
                  <button className="text-action" onClick={() => hasLinkedMaterial ? onMaterials(topic?.id ?? '') : onAddMaterial(topic?.id ?? '')}>
                    {hasLinkedMaterial ? 'Abrir materiais' : 'Importar material'}
                  </button>
                  <StudyLearning
                    aiOnly
                    refreshToken={refreshToken + revision}
                    disciplineId={discipline.id}
                    topicId={topic?.id}
                    topics={topic ? [topic] : []}
                  />
                </>
              )}
              {(node.kind === 'flashcards' || active === 'flashcard-chest') && (
                <StudyFlashcards disciplineId={discipline.id} topicId={topic?.id} refreshToken={refreshToken + revision}
                  onReviewed={() => setCardsReviewed(true)} />
              )}
              {active === 'review' && (
                <StudyPerformance
                  refreshToken={refreshToken + revision}
                  disciplineId={discipline.id}
                  topics={topic ? [topic] : []}
                  unitId={topic?.id}
                />
              )}
              {active === 'targets' && node.availability === 'progression-locked' && <p>Conclua o nível anterior com pelo menos 8 acertos.</p>}
              {active === 'laboratory' && <SortingLab disciplineId={discipline.id} topicId={topic?.id}
                onSaved={() => refresh(value => value + 1)} />}
              {active === 'flashcard-chest' && !cardsReviewed && <p>Faça a autoavaliação de pelo menos um cartão para abrir a verificação.</p>}
              {(active === 'quick' || active === 'castle' || (active === 'flashcard-chest' && cardsReviewed) ||
                (active === 'targets' && node.availability !== 'progression-locked')) && (
                <QuestionBank
                  key={active}
                  refreshToken={refreshToken + revision}
                  onChanged={() => refresh(value => value + 1)}
                  onFinished={(attempt) => {
                    if (active === 'quick' || passesTrailAttempt(attempt)) {
                      setShowResult(true);
                      if (active === 'quick') finish('completed');
                      else setDecision(true);
                    }
                  }}
                  trailMode={active === 'quick' ? 'quick' : active === 'castle' ? 'final' :
                    active === 'flashcard-chest' ? 'verify' : 'quiz'}
                  trailDifficulty={active === 'targets' ? level : undefined}
                  disciplineId={discipline.id}
                  topics={topics}
                  unitId={topic?.id}
                />
              )}
              {!decision && (
                <div className="trail-actions">
                  {!load && node.availability === 'available' && active !== 'laboratory' && !assessments[active as keyof typeof assessments] && (
                    <button onClick={() => finish('completed')}>Marcar etapa como concluída</button>
                  )}
                  <button onClick={() => finish('skipped')}>Pular etapa</button>
                </div>
              )}
            </>
          )}
          {decision && active === 'targets' && node.completion === 'completed' && level !== 'hard' &&
            <button type="button" onClick={() => {
              setLevel(TRAIL_DIFFICULTIES[TRAIL_DIFFICULTIES.indexOf(level) + 1]);
              select('');
            }}>Ir ao próximo nível</button>}
          {decision && (
            <div className="trail-actions">
              <button
                onClick={() => {
                  if (index + 1 < nodes.length) {
                    select(nodes[index + 1].id);
                    setDecision(false);
                    setShowResult(false);
                    window.scrollTo(0, 0);
                  } else select('');
                }}
              >
                {index + 1 < nodes.length ? 'Continuar' : 'Finalizar percurso'}
              </button>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
