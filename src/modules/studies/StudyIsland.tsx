import { useEffect, useRef, useState } from 'react';
import { studyFlashcardRepository, studyQuizAttemptRepository } from '../../storage/repositories';
import type { StudyTopic } from './types';
import type { StudyQuizAttempt } from './questionTypes';
import { passed, type IslandActivity } from './islandActivities';
import { readQuizDraft } from './quizDraft';
import './studyIsland.css';

const destinations = [
  { name: 'Biblioteca', action: 'Aprender', detail: 'Abrir os materiais da disciplina', view: 'materiais', x: 35, y: 81 },
  { name: 'Campo de Alvos', action: 'Praticar', detail: 'Responder a um simulado', view: 'praticar', practice: 'questions', activity: 'practice', x: 74, y: 63 },
  { name: 'Baú de Flashcards', action: 'Memorizar', detail: 'Revisar os flashcards', view: 'praticar', practice: 'cards', activity: 'memory', x: 28, y: 49 },
  { name: 'Laboratório', action: 'Aplicar', detail: 'Abrir o estudo guiado da disciplina', view: 'aprender', activity: 'lab', x: 76, y: 40 },
  { name: 'Castelo', action: 'Dominar', detail: 'Consultar o desempenho e revisar erros', view: 'praticar', practice: 'performance', activity: 'castle', x: 51, y: 22 },
] as const;
export type Destination = typeof destinations[number];

export function StudyIsland({ disciplineId, unit, topics, onOpen, onChallenge }: {
  disciplineId: string; unit?: StudyTopic; topics: StudyTopic[];
  onOpen: (destination: Destination) => void; onChallenge: (activity: IslandActivity) => void;
}) {
  const [selected, setSelected] = useState<number>();
  const [history, setHistory] = useState<StudyQuizAttempt[]>([]);
  const [reviews, setReviews] = useState(0);
  const [load, setLoad] = useState('Carregando progresso…');
  const controls = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    let active = true;
    Promise.all([studyQuizAttemptRepository.getAll(), studyFlashcardRepository.getAll()]).then(([attempts, cards]) => {
      if (!active) return;
      setHistory(attempts.filter(a => a.disciplineId === disciplineId && (!unit || a.answers.every(item => item.questionSnapshot?.topicId === unit.id)))
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt)));
      setReviews(cards.filter(c => c.disciplineId === disciplineId && (!unit || c.topicId === unit.id)).reduce((n,c) => n + c.reviewCount, 0));
      setLoad('');
    }).catch(() => { if (active) setLoad('Progresso indisponível neste dispositivo.'); });
    return () => { active = false; };
  }, [disciplineId, unit]);
  function progress(destination: Destination) {
    if (load) return load;
    if (!('activity' in destination)) {
      const units = unit ? [unit] : topics;
      return units.filter(t => t.status === 'completed').length + '/' + units.length + ' unidades concluídas';
    }
    const activity = destination.activity;
    const key = 'alfred:quiz-draft:v1:' + JSON.stringify([disciplineId, unit?.id ?? null]) + (activity === 'practice' ? '' : ':' + activity);
    if (readQuizDraft(key, disciplineId, unit?.id)) return 'Em andamento';
    const attempts = history.filter(a => (a.activity ?? 'practice') === activity);
    const latest = attempts[0];
    if (latest) return (passed(latest) ? 'Aprovado' : 'Revisão recomendada') + ' · ' + latest.correctAnswers + '/' + latest.totalQuestions + ' acertos · ' + attempts.length + ' tentativa(s)';
    return activity === 'memory' && reviews ? reviews + ' revisões · desafio não iniciado' : 'Não iniciado';
  }
  const destination = selected === undefined ? undefined : destinations[selected];
  function close() {
    if (selected !== undefined) controls.current[selected]?.focus();
    setSelected(undefined);
  }
  return <nav className="study-island" aria-label="Ilha de aprendizagem">
    <h3>Ilha de aprendizagem</h3>
    <div className="study-terrain" onKeyDown={e => { if (e.key === 'Escape') close(); }}>
      <img alt="" width="800" height="1200" src={import.meta.env.BASE_URL + 'studies/island.webp'} />
      {destinations.map((item,i) => <button key={item.name} type="button" className="study-landmark"
        style={{left: item.x + '%', top: item.y + '%'}} aria-expanded={selected === i}
        ref={node => { controls.current[i] = node; }} onClick={() => setSelected(selected === i ? undefined : i)}>
        <span>{item.name} · {item.action}</span>
        {!load && <small>{progress(item)}</small>}
      </button>)}
      {destination && <section className="study-island-panel" style={{top: (destination.y > 55 ? destination.y - 30 : destination.y + 5) + '%'}} aria-label={destination.name}>
        <button className="island-close" aria-label="Fechar painel" type="button" onClick={close}>×</button>
        <h4>{destination.name}</h4><p>{progress(destination)}</p>
        <button type="button" className="text-action" onClick={() => onOpen(destination)}>{destination.detail}</button>
        {'activity' in destination && destination.activity !== 'practice' && <button className="primary-action" type="button" onClick={() => onChallenge(destination.activity)}>
          {{ memory: 'Iniciar desafio de três cartões', lab: 'Resolver atividade com fonte', castle: 'Abrir simulado final' }[destination.activity]}
        </button>}
      </section>}
    </div>
  </nav>;
}
