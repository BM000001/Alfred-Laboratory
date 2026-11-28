import { useState } from 'react';
import { authoredActivities } from './authoredActivities';

export function AuthoredPractice() {
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<number>();
  const activity = authoredActivities[index];
  const current = activity.steps[step];
  function navigate(next: number) {
    setStep(next);
    setChoice(undefined);
  }
  return <section className="entry-panel authored-practice" aria-label="Catálogo de atividades autorais">
    <h3>Práticas guiadas</h3>
    <label>Escolher prática <select value={index} onChange={event => {
      setIndex(Number(event.target.value)); navigate(0);
    }}>{authoredActivities.map((item, i) => <option value={i} key={item.id}>{item.title}</option>)}</select></label>
    <pre tabIndex={0} aria-label="Material da prática"><code>{activity.material}</code></pre>
    <fieldset><legend>{step + 1} de {activity.steps.length} · {current.prompt}</legend>
      {current.options.map((answer, i) => <button type="button" key={answer} aria-pressed={choice === i}
        onClick={() => setChoice(i)}>{answer}</button>)}
    </fieldset>
    <p role="status">{choice !== undefined && ((choice === current.correctOptionIndex ? 'Correto. ' : 'Reveja o material. ') + current.explanation)}</p>
    <div className="trail-actions"><button type="button" disabled={step === 0} onClick={() => navigate(step - 1)}>Voltar um passo</button>
      <button type="button" onClick={() => navigate((step + 1) % activity.steps.length)}>{step + 1 === activity.steps.length ? 'Revisar prática' : 'Avançar um passo'}</button></div>
  </section>;
}
