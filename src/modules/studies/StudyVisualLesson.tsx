import { useState } from 'react';
import type { MaterialProcessingState } from './materialProcessor';

type Lesson = NonNullable<MaterialProcessingState['aiLessons']>[number];

const sections = [
  { id: 'explanation', label: 'Explicação' },
  { id: 'example', label: 'Exemplo' },
  { id: 'check', label: 'Verificação' },
  { id: 'source', label: 'Material de origem' },
] as const;

/** Presents only text already stored with a reviewed AI lesson; it does not generate or grade content. */
export function StudyVisualLesson({ lesson, learned, onComplete }: {
  lesson: Lesson;
  learned: boolean;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const current = sections[step];
  const [showMap, setShowMap] = useState(false);
  const [draft, setDraft] = useState('');

  return <div className="study-visual-lesson">
    <div className="study-quiz-progress" aria-live="polite">
      <span>Etapa {step + 1} de {sections.length}</span>
      <progress aria-label="Progresso da aula visual" value={step + 1} max={sections.length} />
    </div>
    <button type="button" className="text-action" aria-expanded={showMap} onClick={() => setShowMap(!showMap)}>
      Mapa da aula
    </button>
    {showMap && <section aria-label="Mapa da aula" className="study-lesson-map">
      <h5>{lesson.title}</h5>
      <ul>{sections.map((section, index) => <li key={section.id}>
        <button type="button" onClick={() => { setStep(index); setShowMap(false); }}>
          {section.label}
        </button>
      </li>)}</ul>
    </section>}
    <nav className="study-visual-steps" aria-label="Etapas da aula">
      {sections.map((section, index) => <button key={section.id} type="button"
        aria-current={step === index ? 'step' : undefined}
        aria-label={`Etapa ${index + 1}: ${section.label}`}
        onClick={() => setStep(index)}>{index + 1}. {section.label}</button>)}
    </nav>
    <section className="study-visual-stage" aria-labelledby={`visual-lesson-${current.id}`}>
      <span className="card-label">CONTEÚDO ELABORADO POR IA</span>
      <h5 id={`visual-lesson-${current.id}`}>{current.label}</h5>
      {current.id === 'explanation' && <p>{lesson.explanation}</p>}
      {current.id === 'example' && <><h5>Exemplo contextual da IA</h5><p>{lesson.example}</p></>}
      {current.id === 'check' && <>
        <h5>Verificação de compreensão</h5>
        <p>{lesson.check}</p>
        <label>Sua resposta
          <textarea value={draft} maxLength={2000} onChange={event => setDraft(event.target.value)} />
        </label>
        <details><summary>Conferir resposta fundamentada no material</summary><p>{lesson.answer}</p></details>
        <p className="field-label">Rascunho temporário para comparar com o material. O texto não é enviado nem corrigido automaticamente.</p>
      </>}
      {current.id === 'source' && <details open><summary>Consultar material de origem</summary>
        <blockquote>{lesson.sourceExcerpt}</blockquote>
      </details>}
    </section>
    <div className="study-visual-controls">
      <button type="button" className="text-action" onClick={() => setStep(value => Math.max(0, value - 1))} disabled={step === 0}>Etapa anterior</button>
      {step < sections.length - 1
        ? <button type="button" className="primary-action" onClick={() => setStep(value => Math.min(sections.length - 1, value + 1))}>Próxima etapa</button>
        : <button type="button" className="primary-action" onClick={onComplete} disabled={learned}>{learned ? 'Aula concluída' : 'Marcar como aprendido'}</button>}
    </div>
  </div>;
}
