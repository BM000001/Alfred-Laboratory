import { Compiler } from 'inkjs/full';

export const content = {
  source: 'Explicação autoral simplificada para esta demonstração; valide com o material acadêmico da disciplina.',
  concepts: [
    { id: 'compare', title: 'Comparar', fact: 'A passagem compara cada par de posições vizinhas.' },
    { id: 'swap', title: 'Trocar', fact: 'Se o valor da esquerda for maior, os dois valores trocam de posição.' },
    { id: 'repeat', title: 'Repetir', fact: 'O laço repete passagens até que não seja preciso trocar.' },
  ],
  questions: [
    { id: 'compare', prompt: 'Em [4, 2, 3], qual par é comparado primeiro?', options: ['4 e 2', '2 e 3', '4 e 3'], answer: 0, explanation: 'O algoritmo começa pelo par vizinho nas posições 0 e 1: 4 e 2.' },
    { id: 'swap', prompt: 'Ao comparar 4 e 2 em ordem crescente, o que ocorre?', options: ['Troca, pois 4 > 2', 'Fica igual, pois 4 > 2', 'Apaga o 4'], answer: 0, explanation: 'O par troca para 2 e 4; o conjunto de valores não muda.' },
    { id: 'repeat', prompt: 'Por que o laço precisa de outra passagem?', options: ['Para verificar os pares restantes', 'Para criar novos valores', 'Para inverter o objetivo'], answer: 0, explanation: 'Uma passagem percorre os pares vizinhos; outras verificam os valores que ainda não chegaram à posição final.' },
  ],
  flashcards: [
    { front: 'O que um algoritmo de ordenação transforma?', back: 'Reorganiza os mesmos valores segundo uma ordem escolhida.' },
    { front: 'Quando o par vizinho troca?', back: 'Quando está fora da ordem pretendida; em ordem crescente, esquerda > direita.' },
    { front: 'O que faz um laço?', back: 'Repete instruções enquanto a condição de repetição continuar válida.' },
  ],
};

export function routeStory(choice) {
  if (choice === 'scan') return { correct: true, text: 'Correto: o laço examina os pares e usa a condição para decidir quando trocar.' };
  if (choice === 'always') return { correct: false, text: 'Não. Trocar sempre também desordenaria pares que já estão corretos.' };
  return { correct: false, text: 'Ainda não. O vetor precisa ser percorrido e comparado; escolher só o primeiro valor ignora os demais.' };
}

export function createInkStory() {
  const inkSource = `* [Compare 4 and 2; swap because 4 > 2.]
    Correct: bubble sort compares adjacent values, then swaps an inverted pair.
    -> END
* [Swap every pair whether it is ordered or not.]
    Not quite: only swap when the pair is out of order. An unconditional swap can undo earlier progress.
    -> END`;
  return new Compiler(inkSource).Compile();
}

export function nextQuestion(progress) {
  return [...content.questions].sort((a, b) => {
    const aRate = (progress[a.id]?.correct ?? 0) / Math.max(1, progress[a.id]?.seen ?? 0);
    const bRate = (progress[b.id]?.correct ?? 0) / Math.max(1, progress[b.id]?.seen ?? 0);
    return aRate - bRate || a.id.localeCompare(b.id);
  })[0];
}

export function hintFor(question, level) {
  const hints = {
    compare: ['Observe as posições vizinhas no início do vetor.', 'O par inicial contém o primeiro e o segundo valores.'],
    swap: ['A meta é ordem crescente.', 'Se o primeiro for maior, a troca coloca o menor à esquerda.'],
    repeat: ['Uma passagem não examina todos os possíveis pares do vetor.', 'O laço percorre os pares restantes até uma condição de parada.'],
  }[question.id];
  return hints[Math.min(Math.max(level, 0), hints.length - 1)];
}

export function bubbleStep(values, cursor) {
  const next = [...values], compared = [cursor.i, cursor.i + 1];
  const swapped = next[compared[0]] > next[compared[1]];
  if (swapped) [next[compared[0]], next[compared[1]]] = [next[compared[1]], next[compared[0]]];
  const endOfPass = cursor.i === next.length - 2;
  const swappedThisPass = cursor.swappedThisPass || swapped;
  const done = endOfPass && !swappedThisPass;
  const following = endOfPass ? { i: 0, pass: cursor.pass + 1, swappedThisPass: false } : { i: cursor.i + 1, pass: cursor.pass, swappedThisPass };
  return { values: next, cursor: following, done, compared, swapped };
}

export function scheduleInterval(previous, rating) {
  return ({ again: 0, hard: Math.max(1, Math.round(previous ? previous * 1.2 : 1)), good: previous ? Math.max(3, Math.round(previous * 2)) : 3, easy: previous ? Math.max(7, Math.round(previous * 2.5)) : 7 })[rating];
}
