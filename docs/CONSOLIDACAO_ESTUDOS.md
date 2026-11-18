# Consolidação de Estudos e backup

Base do Laboratory: `bc89dfe`, squash do #67, com fluxo validado pelo proprietário no Safari. Referências da consolidação: #65 `7d4c421`, #66 `bcbb166`, #43 `f9d75a3`, #52 `95ecc79` e #61, que corrige a escolha de OCR vazio no #43.

| Origem | Decisão |
| --- | --- |
| #65 e #66 | Reaproveitar ambos integralmente como base das proteções. A política de checkpoints do #66 evolui nesta consolidação. |
| #67 | Preservar a unidade existente e o fluxo Materiais → Praticar → Correção → Desempenho → Histórico. Mantém o gerador de questões e a unidade vinculada pelo importador. |
| #43 e #61 | Reaproveitar controlador, estado persistente, validação por fonte, perfis, OCR de imagem, correção de seleção vazia e explicações contextuais. O importador do #67 chama o controlador único. #40 e #42 já contribuíram com os ancestrais do #43. |
| #52 | Pendente. O branch propõe IndexedDB v14, automatiza análise/geração por fila da Central e exporta backup v1 sem as quatro coleções de Estudos. A integração precisa manter a entrada local validada, preservar tarefas quando a coleção estiver ausente, validar o esquema de tarefas e comprovar upgrade e rollback v13/v14. Conexões externas exigem origem, serviço, consentimento e homologação próprios. |

## Contratos para reorganização das telas

- `Studies.tsx` compõe disciplina, unidade e abas. `StudyTopic.id` é a unidade persistida. `sourceFileId` vincula o material e é validado pelo serviço de vínculo existente.
- `StudyMaterialImporter` orquestra seleção, recuperação e feedback. `materialProcessor` controla OCR, evidência, revisão e geração. `materialReliability` calcula sinais e valida os recursos contra o gerador já usado no #67. O parser de PDF e o de imagem usam o mesmo worker local.
- `QuestionBank`, `StudyFlashcards`, `StudyLearning` e `StudyPerformance` reutilizam repositórios, questão e cartões existentes. `studyPerformanceRules` fornece resultados por unidade e a agenda de revisão permanece no cartão. `lesson:<id-do-cartão>` identifica uma explicação e seu progresso persistido.
- Uma futura navegação ou mapa deve consumir estes IDs e projeções. Os fluxos de tarefas, agenda e projetos permanecem nas suas áreas. A preferência de contexto das aulas usa o namespace do Laboratory.

## Backup de checkpoints

JSON e AES-GCM mantêm v1/v2. O checkpoint portátil contém perfil, estágio, OCR bruto, texto corrigido e decisões de revisão; avaliação, estrutura e geração derivadas são recalculadas quando necessário. Uma cópia feita durante o processamento reabre como retomável. Checkpoints inválidos e backups que substituiriam evidência local são bloqueados. O backup v1 de uma distribuição sem estudos completos reabre checkpoints concluídos como retomáveis para permitir recuperar recursos ausentes. Backups com tarefas da Central aguardam versão compatível.

## Homologação

Em ambiente isolado, repetir com dados sintéticos no Safari e na PWA: anexar TXT a uma unidade, praticar, finalizar, recarregar e abrir a correção; abrir Aprender e verificar a conclusão após recarregar; importar uma imagem de quadro e confirmar ou retomar o texto; interromper processamento e recarregar; fazer round-trip JSON e AES-GCM com revisão pendente; tentar v1 incompatível em banco preenchido e conferir que os dados foram preservados.
