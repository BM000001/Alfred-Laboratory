import { Component, lazy, Suspense, useState, type FormEvent, type ReactNode } from 'react';
import { comicPanels, createBubbleTrace } from '../../../visual-learning-poc/src/core.js';
import { studyLearningProgressRepository } from '../../storage/repositories';
import { createLearningProgress } from './studyLearning';

const SortingBlockly = lazy(() => import('./SortingBlockly'));
const SortingConceptMap = lazy(() => import('./SortingConceptMap'));
const SortingStory = lazy(() => import('./SortingStory'));

class LearningResourceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed
      ? <p role="alert">Não foi possível abrir este recurso. Se estiver offline, conecte-se e recarregue o Alfred.</p>
      : this.props.children;
  }
}

const activityId = 'practice:bubble-sort:v1';

export function sortingLabLessonId(topicId?: string) {
  return activityId + ':' + (topicId ?? '');
}

export function SortingLab({ disciplineId, topicId, onSaved }: {
  disciplineId: string;
  topicId?: string;
  onSaved: () => void;
}) {
  const [resource, setResource] = useState<'map' | 'story' | 'blocks'>();
  const [input, setInput] = useState('4, 2, 3, 1');
  const [trace, setTrace] = useState(() => createBubbleTrace([4, 2, 3, 1]));
  const [cursor, setCursor] = useState(0);
  const [predictions, setPredictions] = useState<Record<number, boolean>>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const step = trace.actions[cursor];
  const values = step?.before ?? trace.sorted;
  const correct = Object.values(predictions).filter(Boolean).length;
  const score = Math.floor(80 * correct / trace.actions.length) + (step ? 0 : 20);

  function useVector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parts = input.split(',').map(part => part.trim());
    if (parts.some(part => !/^-?\d+$/.test(part))) {
      setError('Separe os números inteiros por vírgulas.');
      return;
    }
    try {
      setTrace(createBubbleTrace(parts.map(Number)));
      setCursor(0);
      setPredictions({});
      setSaved(false);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Vetor inválido.');
    }
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const progress = createLearningProgress(disciplineId, sortingLabLessonId(topicId), 'technical');
      await studyLearningProgressRepository.save({ ...progress, id: crypto.randomUUID(), practiceScore: score });
      setSaved(true);
      onSaved();
    } catch {
      setError('Não foi possível salvar a prática neste dispositivo.');
    } finally {
      setSaving(false);
    }
  }

  return <section className="entry-panel sorting-lab" aria-label="Prática de ordenação">
    <h4>Ordenação por bolhas</h4>
    <p>Prática complementar de autoria do Alfred. Compare vizinhos e preveja as trocas.</p>
    <details>
      <summary>Roteiro da atividade</summary>
      <ol>{comicPanels.map(panel => <li key={panel.stage}><strong>{panel.title}</strong><p>{panel.text}</p></li>)}</ol>
    </details>
    <div className="trail-actions" role="group" aria-label="Recursos da prática">
      {([['map', 'Mapa conceitual'], ['story', 'História interativa'], ['blocks', 'Programar com blocos']] as const).map(([id, label]) =>
        <button type="button" key={id} aria-pressed={resource === id}
          onClick={() => setResource(resource === id ? undefined : id)}>{label}</button>)}
    </div>
    <LearningResourceBoundary key={resource}><Suspense fallback={<p role="status">Abrindo recurso…</p>}>
      {resource === 'map' && <SortingConceptMap />}
      {resource === 'story' && <SortingStory />}
      {resource === 'blocks' && <SortingBlockly />}
    </Suspense></LearningResourceBoundary>
    <form className="study-question-form" onSubmit={useVector}>
      <label htmlFor="lab-vector">Vetor de 2 a 8 inteiros, separados por vírgulas</label>
      <input id="lab-vector" value={input} onChange={event => setInput(event.target.value)} maxLength={48} />
      <button type="submit" disabled={saving}>Aplicar vetor e reiniciar</button>
    </form>
    <ul className="sorting-vector" aria-label="Valores na ordem atual">
      {values.map((value, index) => <li key={index} className={index === step?.leftIndex || index === step?.rightIndex ? 'compared' : undefined}>{value}</li>)}
    </ul>
    {step ? <>
      <p>Passo {cursor + 1} de {trace.actions.length} · comparar {values[step.leftIndex]} e {values[step.rightIndex]}</p>
      <div className="trail-actions">
        {[true, false].map(swap => <button key={String(swap)} type="button"
          disabled={predictions[cursor] !== undefined}
          onClick={() => setPredictions(previous => ({ ...previous, [cursor]: swap === step.swapped }))}>
          {swap ? 'Trocar vizinhos' : 'Manter posições'}
        </button>)}
      </div>
      {predictions[cursor] !== undefined && <p role="status">
        {predictions[cursor] ? 'Correto. ' : 'Previsão incorreta. '}{step.explanation}
      </p>}
    </> : <div role="status">
      <strong>{score}/100 · {score >= 80 ? 'Aprovado' : 'Nota insuficiente'}</strong>
      <p>{correct} de {trace.actions.length} previsões corretas · vetor final ordenado</p>
    </div>}
    <p>Rubrica: até 80 pontos pelas previsões e 20 por concluir o percurso. A aprovação exige 80 pontos.</p>
    <div className="trail-actions">
      <button type="button" disabled={cursor === 0 || saving} onClick={() => setCursor(cursor - 1)}>Passo anterior</button>
      {step ? <button type="button" disabled={predictions[cursor] === undefined} onClick={() => setCursor(cursor + 1)}>Próximo passo</button>
        : <button type="button" className="primary-action" disabled={saved || saving} onClick={() => void save()}>
          {saved ? 'Resultado salvo' : 'Salvar resultado'}
        </button>}
    </div>
    {error && <p className="module-error" role="alert">{error}</p>}
  </section>;
}
