# Alfred Studies — preparação do redesign

Status: **preparação visual em branch isolada; nenhum tema do aplicativo foi alterado**.

## Objetivo

Organizar a próxima etapa do redesign usando as decisões já aprovadas pelo proprietário. Este documento registra o que existe, o que deve ser reaproveitado e como validar um protótipo sem dados pessoais. Não substitui revisão visual no iPhone nem autoriza merge ou publicação.

## Identidade e composição aprovadas

- Paleta escura: fundo `#171B18`, superfície `#282E29`, texto `#F3F1EA`, dourado `#D8C293` e verde `#8FAE83`; cores de estado e superfícies devem seguir a paleta completa já registrada nas decisões do produto.
- Dourado destaca ações principais; verde marca progresso e ícones; contraste deve permanecer legível nos temas claro e escuro.
- Um sistema compartilhado atende Hoje, Estudos, Organização, Alfred e Projetos. Cada espaço pode variar a composição sem criar outra identidade.
- Celular usa navegação inferior; desktop usa navegação lateral. Hoje, Estudos, Organização, Alfred e Projetos ficam acessíveis diretamente; Notas, Arquivos, Central de IA e Configurações ficam agrupados em Mais.
- Chat do Alfred fica separado do Hoje; Central de IA fica separada do chat.
- Densidade equilibrada, cantos moderados, animações discretas, movimento reduzido respeitado e duas fontes livres carregadas localmente. Não usar Playfair nem DM Sans.

## Inventário reaproveitável

| Área | Implementação atual | Direção para o redesign |
| --- | --- | --- |
| Shell e temas | `src/app/App.tsx`, `src/styles/design.css`, `src/styles/interface.css` | Reorganizar composição depois da revisão visual; manter tokens de tema e navegação acessível. |
| Estudos | `src/modules/Studies.tsx` | Preservar disciplina, unidade, importação, materiais e navegação contextual. |
| Mapa/trilha existente | `src/modules/studies/StudyTrail.tsx`, `trailModel.ts`, `studyTrail.css` | Reaproveitar as cinco construções e regras; adaptar apresentação somente após o redesenho. |
| Aula e prática | `StudyLearning.tsx`, `QuestionBank.tsx`, `StudyFlashcards.tsx`, `StudyPerformance.tsx` | Manter IndexedDB e vínculos com disciplina/unidade/material. |
| Preparação de material | `StudyMaterialImporter.tsx`, `materialProcessor.ts`, adaptadores de preparação | Continuar desacoplada da interface; estado pendente de IA nunca vira conteúdo fictício. |
| Experiências aprovadas | POCs dos PRs #88 e #90; aula em etapas implementada em #87 | Portar uma experiência de cada vez, somente sobre conteúdo validado e com persistência existente. |

## Protótipo estático

O arquivo `docs/prototypes/studies-redesign.html` é uma composição demonstrativa para comparar navegação e densidade mobile/desktop. O texto acadêmico aparece explicitamente como exemplo visual, não como material real nem saída de IA. O arquivo não importa serviços, não acessa IndexedDB, não coleta dados e não é carregado pelo aplicativo.

## Critérios de revisão do protótipo

- Tamanhos-alvo: 390×844 (celular), 320×568 (mínimo compacto) e 1280×800 (desktop).
- Sem overflow horizontal; títulos longos podem quebrar; controles de toque têm pelo menos 44 px.
- Teclado alcança todos os controles com foco visível; ordem de leitura segue a ordem visual; regiões e navegação têm rótulos acessíveis.
- Contraste de texto e controles atende WCAG AA nos dois temas. Não depender apenas de cor para indicar estado.
- Animação respeita `prefers-reduced-motion`; não há vídeo, fontes remotas ou imagens externas.
- Nenhum material pessoal, credencial, API, serviço pago ou chamada de rede entra no protótipo.

## Sequência de implementação

1. Revisar o protótipo e a hierarquia de telas em tamanhos celular e desktop.
2. Ajustar o sistema compartilhado e cada espaço, mantendo o conteúdo e os contratos atuais.
3. Validar persistência, navegação, PWA/offline, leitores de tela, teclado e Safari físico.
4. Depois do redesign, revisar o mapa existente e portar as lacunas usando a trilha e as POCs já aprovadas. Não repetir pesquisa open source, não alterar regras de pontuação sem autorização e não expor dados pessoais em prévias.

## Diferença conhecida a revisar

Os tokens atuais de `design.css` não coincidem integralmente com a paleta aprovada acima. Esta branch registra a diferença e mostra a direção em um protótipo isolado; não muda o app. A implementação visual deve ocorrer como etapa própria do Laboratory para revisão em PR e homologação antes de qualquer promoção.
