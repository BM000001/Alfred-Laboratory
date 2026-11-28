import { useState } from 'react';
import { Compiler } from 'inkjs/full';

const script = `Nina precisa organizar os cartões 4 e 2 em ordem crescente.
* [Trocar os cartões]
    Certo. Como 4 é maior que 2, a troca coloca o menor à esquerda.
    ** [E se o próximo par for 2 e 4?]
        Mantenha a ordem. Uma passagem inteira sem trocas mostra que a fila está ordenada.
        -> END
* [Manter a ordem]
    Repare que o menor valor está à direita. Uma troca é necessária neste par.
    -> END`;

export default function SortingStory() {
  function start() {
    const story = new Compiler(script).Compile();
    return { story, text: story.ContinueMaximally() };
  }
  const [{ story, text }, setState] = useState(start);
  return <section className="entry-panel" aria-label="História interativa">
    <p role="status">{text}</p>
    {story.currentChoices.map(choice => <button type="button" key={choice.index} onClick={() => {
      story.ChooseChoiceIndex(choice.index);
      setState({ story, text: story.ContinueMaximally() });
    }}>{choice.text}</button>)}
    {!story.currentChoices.length && <button type="button" onClick={() => setState(start())}>Recomeçar história</button>}
  </section>;
}
