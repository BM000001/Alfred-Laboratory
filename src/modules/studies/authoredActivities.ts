import type { StudyQuestionDifficulty } from './questionTypes';

// A scene can describe a diagram, an experiment, a text or a worked example.
export interface LearningScene {
  id: string;
  title: string;
  material: string;
  steps: ReadonlyArray<{
    difficulty: StudyQuestionDifficulty;
    prompt: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
  }>;
}

type Prediction = [prompt: string, answer: string, distractor: string, explanation: string];
function scene(id: string, title: string, material: string, predictions: [Prediction, Prediction, Prediction]): LearningScene {
  const levels = ['easy', 'medium', 'hard'] as const;
  return { id, title, material, steps: predictions.map(([prompt, answer, distractor, explanation], i) => {
    const correctOptionIndex = (id.length + i) % 2;
    return { difficulty: levels[i], prompt, options: correctOptionIndex ? [distractor, answer] : [answer, distractor], correctOptionIndex, explanation };
  }) };
}

export const authoredActivities = [
  scene('saldo', 'Variáveis', 'let saldo = 4;\nlet anterior = saldo;\nsaldo += 3;', [
    ['Qual é o saldo inicial?', '4', '3', 'A atribuição inicial guarda 4.'],
    ['Quanto vale anterior ao final?', '4', '7', 'A cópia do número preserva o valor anterior à soma.'],
    ['Se a cópia vier depois da soma, qual será saldo − anterior?', '0', '3', 'Ambas passam a guardar 7.'],
  ]),
  scene('faixa', 'Condicionais', 'const nota = 7;\nconst faixa = nota >= 7 ? "A" : "B";', [
    ['Qual é a nota observada?', '7', '6', 'A constante fornece a entrada.'],
    ['Qual faixa é selecionada?', 'A', 'B', 'A igualdade satisfaz o limite inclusivo.'],
    ['Se o operador mudar para >, qual entrada troca de faixa?', '7', '8', 'Somente a igualdade deixa de satisfazer o teste.'],
  ]),
  scene('voltas', 'Laços', 'let soma = 0;\nfor (let i = 1; i < 4; i++) soma += i;', [
    ['Qual é o primeiro valor adicionado?', '1', '0', 'O contador começa em 1.'],
    ['Quanto vale soma ao sair do laço?', '6', '10', 'São somados 1, 2 e 3.'],
    ['Se o incremento passar a i += 2, qual será a soma?', '4', '6', 'A sequência passa a ser 1 e 3.'],
  ]),
  scene('grade', 'Vetores e matrizes', 'const grade = [[2, 5], [3, 7]];\nconst linha = grade[1];', [
    ['Quantas linhas há na grade?', '2', '4', 'Cada vetor interno representa uma linha.'],
    ['Quanto vale linha[0]?', '3', '5', 'A segunda linha começa em 3.'],
    ['Após linha[0] = 9, quanto vale grade[1][0]?', '9', '3', 'linha referencia o mesmo vetor interno.'],
  ]),
  scene('dobro', 'Funções', 'function dobro(x) { return 2 * x; }\nconst a = dobro(3);', [
    ['Qual é o argumento da chamada?', '3', '2', 'O número entre parênteses alimenta o parâmetro.'],
    ['Quanto vale a?', '6', '5', 'A função retorna duas vezes o argumento.'],
    ['Quanto retorna dobro(dobro(2) + 1)?', '10', '9', 'A chamada interna retorna 4. A externa recebe 5.'],
  ]),
  scene('texto', 'Strings', 'const nome = "Alfred";\nconst prefixo = nome.slice(0, 3);', [
    ['Qual é o primeiro caractere de nome?', 'A', 'l', 'O índice zero aponta para A.'],
    ['Qual texto fica em prefixo?', 'Alf', 'Alfr', 'O limite final de slice é exclusivo.'],
    ['Após nome.toUpperCase() sem atribuição, quanto vale nome?', 'Alfred', 'ALFRED', 'A conversão devolve outra string.'],
  ]),
  scene('objetos', 'Objetos e classes', 'class Caixa { valor = 1; }\nconst a = new Caixa();\nconst b = a;\nb.valor++;', [
    ['Qual valor inicia cada nova Caixa?', '1', '0', 'O campo é inicializado na construção.'],
    ['Quanto vale a.valor após o incremento?', '2', '1', 'As duas variáveis apontam para a mesma instância.'],
    ['Se b recebesse new Caixa(), qual seria a.valor ao final?', '1', '2', 'O incremento ocorreria na outra instância.'],
  ]),
  scene('pagina', 'HTML, CSS e JavaScript', '<p class="aviso">Olá</p>\n<style>.aviso { color: green }</style>\n<script>document.querySelector("p").textContent = "Pronto";</script>', [
    ['Qual elemento contém a mensagem?', 'p', 'style', 'O parágrafo guarda o conteúdo textual.'],
    ['Qual mensagem fica visível após o script?', 'Pronto', 'Olá', 'A atribuição substitui o texto do parágrafo.'],
    ['Se a classe for removida, qual efeito desse exemplo permanece?', 'A alteração do texto', 'A regra verde no parágrafo', 'O script seleciona pelo nome do elemento. O CSS depende da classe.'],
  ]),
  scene('lista-dom', 'Manipulação do DOM', 'const lista = document.createElement("ul");\nconst item = document.createElement("li");\nlista.append(item);\nlista.append(item);', [
    ['Qual elemento representa um item?', 'li', 'ul', 'li é um item da lista.'],
    ['Quantos filhos há em lista após os dois append?', '1', '2', 'Reinserir o mesmo nó move sua posição.'],
    ['Como criar um segundo filho com a mesma estrutura?', 'Adicionar item.cloneNode(true)', 'Adicionar item de novo', 'Um clone tem identidade própria.'],
  ]),
  scene('fila', 'Estruturas de dados', 'const fila = ["Ana", "Bia"];\nfila.push("Caio");\nconst atendida = fila.shift();', [
    ['Quem entra por último?', 'Caio', 'Ana', 'push acrescenta ao final.'],
    ['Quem foi atendida?', 'Ana', 'Caio', 'shift remove o primeiro elemento.'],
    ['Se shift fosse pop, qual regra seria demonstrada nesta retirada?', 'Último a entrar, primeiro a sair', 'Primeiro a entrar, primeiro a sair', 'pop remove o último elemento inserido.'],
  ]),
];
