import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  studyFlashcardRepository,
  studyQuestionRepository,
  studyQuizAttemptRepository,
} from '../../storage/repositories';
import { getAlfredLocalStorageKey } from '../../storage/namespace';
import { StudyLearning } from './StudyLearning';
import { StudyFlashcards } from './StudyFlashcards';
import { StudyPerformance } from './StudyPerformance';
import { QuestionBank } from './QuestionBank';
import { buildTrailChapter, summarizeTrailCompletion, type TrailCompletion } from './trailModel';
import type { Discipline, StudyTopic } from './types';
import './studyTrail.css';

const labels = {
  available: 'Disponível',
  'preparation-needed': 'Preparação necessária',
  'insufficient-content': 'Conteúdo insuficiente',
  offline: 'Offline',
};
const silhouettes: Record<string, string> = {
  library:
    'M2 13h2v-2h3V9h3V7h4V5h4v2h4v2h3v2h3v2h2v2H2z M5 16h4v10H5zm9 0h4v10h-4zm9 0h4v10h-4zM3 27h26v3H3z',
  targets: 'M6 6h16v2h3v3h2v12h-2v3h-3v2H8v-2H5v-3H3V11h3z M9 11v11h12V11z M13 14h5v5h-5z',
  'flashcard-chest': 'M4 11h3V8h18v3h3v8H4z M3 20h10v3h6v-3h10v8H3z M14 17h4v5h-4z',
  laboratory: 'M11 4h10v3h-2v7l8 11v4H5v-4l8-11V7h-2z M15 8v8l-4 6h10l-4-6V8z',
  castle: 'M2 7h3v4h3V7h3v9h3V8h4v8h3V7h3v4h3V7h3v21H19v-7h-6v7H2z',
};
const initialCounts = { lessons: false, questions: 0, cards: 0, sourced: 0, attempts: 0 };
type Props = {
  discipline: Discipline;
  topics: StudyTopic[];
  refreshToken: number;
  onManage: () => void;
  onMaterials: (unit: string) => void;
};

export function StudyTrail({ discipline, topics, refreshToken, onManage, onMaterials }: Props) {
  const [chapterId, selectChapter] = useState('');
  const topic = topics.find((t) => t.id === chapterId) ?? topics[0];
  const [active, select] = useState('');
  const [decision, setDecision] = useState(false);
  const [showResult, setShowResult] = useState(false);
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
    ])
      .then(([allQuestions, allCards, attempts]) => {
        if (!current) return;
        const questions = allQuestions.filter(matches),
          cards = allCards.filter(matches);
        setCounts({
          questions: questions.length,
          cards: cards.length,
          sourced: questions.filter((q) => q.sourceExcerpt).length,
          lessons: cards.length > 0,
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
    counts,
  );
  const hasLinkedMaterial = topics.some((entry) => Boolean(entry.sourceFileId));
  const nodes = chapter.nodes.map((node) => ({ ...node, completion: marks[node.id] ?? node.completion }));
  const summary = summarizeTrailCompletion(nodes);
  const index = nodes.findIndex((n) => n.id === active),
    node = nodes[index];
  useLayoutEffect(() => {
    if (!active && previous.current) {
      const { id, y } = previous.current;
      buttons.current.get(id)?.focus({ preventScroll: true });
      window.scrollTo(0, y);
      previous.current = undefined;
    }
  }, [active]);
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
      const updated = { ...stored, [active]: stored[active] === 'completed' ? 'completed' : completion };
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
      {!hasLinkedMaterial ? (
        <div className="empty-state" role="status">
          <strong>Adicione um material para começar</strong>
          <p>A trilha será preparada depois que você enviar um material da disciplina. Não vamos mostrar aulas ou desafios sem uma fonte.</p>
          <button type="button" className="primary-action" onClick={() => onMaterials('')}>Adicionar material</button>
        </div>
      ) : !node ? (
        <>
          <div className="trail-tools">
            <label>
              Capítulo{' '}
              <select value={topic?.id ?? ''} onChange={(e) => selectChapter(e.target.value)}>
                {!topics.length && <option value="">Toda a disciplina</option>}
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="text-action" onClick={onManage}>
              Unidades e materiais
            </button>
          </div>
          <p>
            {summary.completed} de {summary.total} etapas concluídas
            {summary.skipped ? ' · ' + summary.skipped + ' puladas' : ''}
          </p>
          <ol className="trail-course">
            {nodes.map((n, i) => (
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
      ) : (
        <>
          <button className="text-action" onClick={() => select('')}>
            Voltar à trilha
          </button>
          <h3>{node.title}</h3>
          <p>{chapter.title}</p>
          {(!decision || showResult) && (
            <>
              {(load || node.availability !== 'available') && (
                <p role="status">{load || labels[node.availability]}</p>
              )}
              {active === 'library' && (
                <>
                  <button className="text-action" onClick={() => onMaterials(topic?.id ?? '')}>
                    Abrir materiais
                  </button>
                  <StudyLearning
                    disciplineId={discipline.id}
                    topicId={topic?.id}
                    topics={topic ? [topic] : []}
                  />
                </>
              )}
              {(node.kind === 'flashcards' || active === 'flashcard-chest') && (
                <StudyFlashcards disciplineId={discipline.id} topicId={topic?.id} />
              )}
              {active === 'review' && (
                <StudyPerformance
                  disciplineId={discipline.id}
                  topics={topic ? [topic] : []}
                  unitId={topic?.id}
                />
              )}
              {['targets', 'castle', 'quick', 'laboratory'].includes(active) && (
                <QuestionBank
                  key={active}
                  onFinished={() => {
                    setShowResult(true);
                    finish('completed');
                  }}
                  trailMode={
                    active === 'quick'
                      ? 'quick'
                      : active === 'laboratory'
                        ? 'lab'
                        : active === 'castle'
                          ? 'final'
                          : 'quiz'
                  }
                  disciplineId={discipline.id}
                  topics={topics}
                  unitId={topic?.id}
                />
              )}
              {!decision && (
                <div className="trail-actions">
                  {!load && node.availability === 'available' && (
                    <button onClick={() => finish('completed')}>Marcar etapa como concluída</button>
                  )}
                  <button onClick={() => finish('skipped')}>Pular etapa</button>
                </div>
              )}
            </>
          )}
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
      )}
    </section>
  );
}
