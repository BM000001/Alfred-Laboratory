# Formato de conteúdo educacional Alfred Learning Content

Versão inicial: **1.0.0**. Documento normativo da POC; exemplo completo em `content/ordenacao-bolhas.v1.json` e validador executável em `src/content-engine.js`.

## Contrato

Um conteúdo tem identificador estável e versão semântica próprios. Os campos obrigatórios são `objectives`, `explanations`, `interactions`, `visuals`, `completion` e `references`. `metadata.contentStatus` informa se o material é uma demonstração ou foi revisado. Uma referência autoral é explícita e não simula citação acadêmica.

| Campo | Uso | Regras de integração |
|---|---|---|
| `objectives[]` | O que o estudante deve demonstrar | `id` estável e resultado observável |
| `explanations[]` | Explicação em etapas | Texto sem HTML executável; componentes escolhem apresentação |
| `conceptMap` | `rootId`, nós com `parentId`/`explanationId` e relações tipadas por rótulo | IDs devem apontar para conceitos e explicações presentes; pai deve ser acíclico |
| `interactions[]` | Perguntas, escolhas ou ações | Respostas são identificadores de opção; nunca código livre executável |
| feedback | Retorno por resposta | Texto específico sobre a regra, não só “certo/errado” |
| `visuals[]` | SVG, diagrama ou mídia local | `alt` obrigatório; `src` é local ou uma chave lógica conhecida |
| `completion.rules[]` | Evidência verificável de conclusão | Apenas tipos conhecidos pelo runtime; tipo desconhecido falha fechado |
| `references[]` | Fonte acadêmica ou autoria demonstrativa | Guardar dados bibliográficos/página/trecho quando disponíveis; não inventar referências |

Progresso usa `alfred.learning-progress@1.0.0`, guarda somente IDs, respostas selecionadas e acerto; o formato não determina storage. A integração futura deve adaptar esse objeto ao store acadêmico existente e à política de privacidade vigente, sem criar banco paralelo.

## Compatibilidade e segurança

- Mudança aditiva opcional pode incrementar patch/minor conforme política do produto; remover/alterar semântica de campos requer nova versão major.
- Validar conteúdo ao importar e antes de renderizar. Rejeitar versão desconhecida, regras de conclusão desconhecidas e objetivos referenciados inexistentes.
- Tratar texto como texto (`textContent`), nunca como HTML confiável. URL externa não é requisito; esta POC usa recursos locais.
- Blockly e respostas estruturadas viram dados tipados. O conteúdo não pode fornecer JavaScript, Python, HTML, callbacks ou expressões a `eval`, `Function`, `innerHTML` ou import dinâmico.
- Questões geradas futuramente por IA precisam de fonte vinculada, validação estrutural, revisão factual/pedagógica e critério de conclusão independente do texto gerado.

## Interfaces para a Central de Estudos

```ts
validateLearningContent(content): { ok: boolean; errors: string[] }
gradeChoice(interaction, selectedOptionId): { correct: boolean; feedback: string }
evaluateCompletion(rules, evidence): boolean
createProgressRecord(content, evidence?): LearningProgressV1
```

A Central fornece `contentId`, versão, material de origem e implementação de persistência. Os componentes de aula, Blockly, mapa e história recebem conteúdo validado e emitem eventos de interação/conclusão; o contrato não exige mudanças no modelo da Fase 1. O mapa desta POC usa `conceptMap` com disclosures HTML nativos; o mapa Markmap, InkJS e TS-FSRS permanecem experimentos do PR #88 e não foram removidos nem migrados para este contrato.

## Plano de integração

1. Após autorização de integração, importar o contrato em um pacote isolado da Central e validar o sample com referências reais da disciplina.
2. Criar adaptador entre progresso V1 e entidades acadêmicas existentes; provar migração/retrocompatibilidade antes de salvar dados reais.
3. Integrar uma experiência por vez atrás de feature flag: aula manipulável → história → Blockly (lazy load) → mapa interativo.
4. Validar Safari/iPhone físico, acessibilidade com VoiceOver, leitura offline e consumo de memória antes de ampliar o público.
5. Só então avaliar conteúdo de múltiplas disciplinas, revisão espaçada e geração assistida.
