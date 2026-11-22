# Alfred Studies 2.2 — Especificação mestra de produto e design

**Versão:** 1.0 — consolidação de planejamento  
**Data:** 22/11/2026  
**Situação:** especificação em consolidação; **não implementada**  
**Repositório de testes previsto:** `BM000001/Alfred-Laboratory`  
**Produção:** `BM000001/Alfred` — não alterar sem autorização explícita.

> **Regra de governança:** este documento registra decisões de produto e critérios de aceitação. Não é evidência de código implementado, testes executados ou design final aprovado. A implementação depende de autorização explícita e deve ocorrer incrementalmente no Laboratory.

## 1. Visão e princípios

Alfred Studies 2.2 é a evolução da Central de Estudos do Alfred: um ambiente de aprendizagem adaptativa, organizado em trilhas visuais por disciplina, que reutiliza materiais fornecidos pelo aluno, complementa lacunas com IA quando apropriado e preserva a continuidade do estudo mesmo sem internet ou IA disponível.

Princípios inegociáveis:

- **Minimalismo funcional:** pouco ruído visual; informação e ações prioritárias evidentes.
- **Identidade do Alfred:** grafite esverdeado, verde sálvia, dourado e branco suave. Não usar roxo como cor de identidade.
- **Uma trilha vertical sinuosa por disciplina**, com capítulos e navegação rápida discreta.
- **Liberdade:** atividades podem ser puladas sem penalidade ou bloqueio de progressão.
- **Progresso ≠ domínio:** conclusão de etapas e domínio estimado são métricas distintas.
- **Fonte identificável:** distinguir conteúdo do material original e complementos produzidos por IA.
- **Offline-first e proteção de dados:** usar conteúdo preparado localmente, preservar histórico e sincronizar quando viável.
- **Reutilização e economia:** evitar processamento de IA desnecessário, respeitar limites autorizados.
- **Preservação:** não remover funcionalidades e dados existentes na Central de Estudos.

## 2. Direção visual aprovada e limites do mockup

### 2.1 Paleta de referência

| Uso | Cor | Código |
|---|---|---|
| Fundo principal | Grafite esverdeado | `#171B18` |
| Superfícies secundárias | Verde-grafite | `#282E29` |
| Texto principal | Branco suave | `#F3F1EA` |
| Destaques e detalhes | Dourado suave | `#D8C293` |
| Estados positivos e elementos de trilha | Verde sálvia | `#8FAE83` |

A paleta acima é referência de direção; contraste, acessibilidade e uso exato por componente devem ser validados no protótipo. Outros tons do design system original podem complementar sem descaracterizar a identidade.

### 2.2 Tela da disciplina / trilha

- Cabeçalho **compacto**: voltar, nome da disciplina, capítulo ou atalho de navegação e indicadores discretos de progresso/domínio; não criar barra de abas excessiva.
- **Uma trilha contínua, vertical e sinuosa**, ocupando o foco da tela; navegação entre capítulos sem transformar a tela em um painel complexo.
- **Cinco construções funcionais na V1, sempre visíveis**: **Biblioteca** (aulas e ensino), **Campo de Alvos** (exercícios), **Baú de Flashcards** (memorização/revisão), **Laboratório** (prática/aplicação), **Castelo** (avaliação ou desafio de consolidação).
- Intercalar **pequenos blocos simples** de desafios rápidos (tipicamente três questões), flashcards e revisões entre as construções. Construções maiores são marcos visuais, não cinco etapas únicas e exclusivas.
- Ilustrações **2D com leve profundidade/efeito 3D**, sem cenário de floresta, árvores abundantes, brilhos excessivos ou ornamentação que concorra com as atividades.
- Estados discretos para concluído, atual, pulado, pendente, revisão sugerida e offline. **Não usar cadeados que impliquem bloqueio por nível ou pontuação.**
- Construções permanecem visíveis mesmo com conteúdo insuficiente; diferenciar **disponível**, **preparação necessária**, **conteúdo insuficiente** e **offline**.
- Retornar à posição anterior da trilha após sair de uma atividade.

### 2.3 Navegação e mascote

- Não multiplicar abas dentro da trilha; preferir ações contextuais e navegação curta.
- Atividades rápidas podem abrir no contexto da trilha; aulas, simulados e fluxos maiores usam telas focadas.
- Mascote original do Alfred deve ser **preservado**, não redesenhado ou substituído. Seu uso na interface geral deve ser discreto e útil.
- Temática de cenário de fantasia/aprendizagem fica **restrita à área de estudos**; não espalhar floresta ou construções pelas outras páginas do Alfred.
- **Mockups gerados até aqui são exploratórios.** O usuário gostou da direção mais recente, mas solicitou mais fidelidade ao minimalismo e às cores. **A tela final da trilha ainda precisa de aprovação visual específica.**

## 3. Registro de decisões aprovadas

| ID | Tema | Decisão aprovada |
|---|---|---|
| Base-01 | Desafios rápidos | Em geral, três questões, explicação de respostas, progresso independente da nota e revisão posterior dos erros. |
| Base-02 | Atividades intercaladas | Flashcards e desafios entre construções, com reforço de flashcards antes de provas. |
| Base-03 | Liberdade | Todas as atividades, inclusive avaliações, podem ser puladas. |
| EST-TRILHA-006 | Organização de conteúdo | Acrescentar materiais estende capítulos existentes ou cria novos, sem apagar progresso. |
| EST-TRILHA-007 | Geração inicial | IA híbrida: disponibilizar trilha e atividades iniciais cedo; preparar próximas gradualmente, respeitando cotas e offline. |
| EST-TRILHA-008 | Ensino adaptativo | Biblioteca oferece explicações, analogias, exemplos e interações adaptadas. |
| EST-TRILHA-009 | Assistente contextual | IA integrada discretamente à aula, sem sair da atividade. |
| EST-TRILHA-010 | Avaliações | Provas tradicionais fixas e simulados adaptativos de prática. |
| EST-TRILHA-011 | Revisão | Revisões curtas integradas à trilha e área própria de revisão. |
| EST-TRILHA-012 | Navegação | Trilha vertical contínua, organizada por capítulos, com navegação rápida. |
| EST-TRILHA-013 | Edição da trilha | Organização automática com possibilidade de ajustes manuais; preservar alterações e progresso. |
| EST-TRILHA-014 | Métricas | Conclusão da trilha e domínio estimado separados; não inventar domínio sem evidências. |
| EST-TRILHA-015 | Cabeçalho | Entrada compacta na disciplina, com título, progresso, domínio, edição e trilha logo abaixo. |
| EST-TRILHA-016 | Hierarquia visual | Blocos pequenos para desafios; nós discretos para revisão/flashcards; construções maiores para marcos. |
| EST-TRILHA-017 | Estados visuais | Cores suaves e símbolos discretos para conclusão, atual, pulado, pendente e revisão. |
| EST-TRILHA-018 | Telas de atividades | Desafios rápidos na trilha; aulas, flashcards e provas em telas focadas; restaurar rolagem. |
| EST-TRILHA-019 | Continuação | Após atividade, oferecer Continuar ou Voltar à trilha; sem avanço forçado. |
| EST-TRILHA-020 | Importação | Integrar materiais automaticamente, resumir mudanças e permitir edição posterior. |
| EST-TRILHA-021 | Fontes | Biblioteca de originais por disciplina e links contextuais nas atividades. |
| EST-TRILHA-022 | Duplicatas e conflitos | Mesclar sobreposições compatíveis; sinalizar contradições reais sem falsos positivos de contexto. |
| EST-TRILHA-023 | Lacunas | IA pode complementar, com atribuição clara e sem fingir que é conteúdo do professor. |
| EST-TRILHA-024 | Dificuldades | Explicações alternativas e exercícios/flashcards de reforço opcionais. |
| EST-TRILHA-025 | Preparação para provas | Planejamento opcional integrado ao calendário; não presumir conteúdo da prova. |
| EST-TRILHA-026 | Replanejamento | Ajustar planos após dias perdidos, explicar mudanças e permitir correção manual. |
| EST-TRILHA-027 | Tempo disponível | Considerar preferências, calendário, histórico e edição manual; lacuna na agenda não significa tempo livre. |
| EST-TRILHA-028 | Sessões | Sugerir atividades conforme tempo disponível; cronômetro opcional; pausar, trocar ou pular. |
| EST-TRILHA-029 | Registro de tempo | Automático com detecção de inatividade, edição manual e opção de desligar; estimativa ≠ confirmação. |
| EST-TRILHA-030 | Análises | Indicadores compactos na disciplina e área detalhada para gráficos/histórico. |
| EST-TRILHA-031 | Offline | Conteúdo preparado acessível offline, progresso local e fila de IA para quando houver conexão. |
| EST-TRILHA-032 | Sincronização | Mesclar alterações compatíveis; preservar históricos; pedir resolução apenas para conflito real. |
| EST-TRILHA-033 | Correção de questões | Reportar, solicitar correção por IA ou editar manualmente; guardar versão/histórico e avaliar recálculo. |
| EST-TRILHA-034 | Qualidade da geração | Validação automática por níveis; revisão adicional por IA em casos suspeitos/complexos. |
| EST-TRILHA-035 | IA indisponível | Continuar com atividades existentes; registrar e retomar gerações pendentes sem duplicar. |
| EST-TRILHA-036 | Consumo de IA | Gerenciar automaticamente dentro dos limites autorizados; exibir consumo e permitir ajuste/pausa. |
| EST-TRILHA-037 | Recomendações | Sugestões contextuais discretas na matéria; recomendações secundárias em área separada. |

**Observação de rastreabilidade:** os IDs 006–037 foram definidos durante a conversa de planejamento. A tabela é uma consolidação do conteúdo aprovado, não uma transcrição literal de cada mensagem.

## 4. Comportamentos e critérios de aceitação essenciais

### Trilha e progressão

1. O aluno pode abrir qualquer uma das cinco construções, inclusive quando uma atividade anterior foi pulada.
2. A interface não confunde **atividade ainda não preparada** com **atividade bloqueada**.
3. Ao concluir ou pular, o aluno escolhe continuar ou voltar; posição da trilha é preservada.
4. Ao importar novos materiais, capítulos podem mudar sem apagar resultados e edições manuais.
5. A trilha diferencia atividade concluída de domínio estimado e apresenta estimativas com transparência.

### Conteúdo e IA

1. Material original é consultável, e cada complemento de IA é identificável.
2. Questões geradas passam por checagem estrutural; casos ambíguos/complexos recebem verificação adicional conforme disponibilidade e limites.
3. Questões potencialmente incorretas não recebem selo de validação enquanto pendentes.
4. Quando a IA falha ou a cota acaba, atividades existentes continuam acessíveis; novas gerações ficam pendentes com estado claro.
5. Fila de retomada evita duplicação, respeita limites e não exige pagamento automático.

### Offline, dados e sincronização

1. Estudar offline não pode apagar progresso local.
2. Sincronização deve preservar histórico e resolver automaticamente apenas conflitos realmente compatíveis.
3. O aluno pode corrigir tempo de estudo estimado e desativar rastreamento automático.
4. Nenhuma alteração em armazenamento deve ser feita sem estratégia de migração, compatibilidade e recuperação.

### Design e usabilidade

1. Validar o layout no **Safari do iPhone** e em larguras menores.
2. Cabeçalho compacto e trilha visível logo após entrar na disciplina.
3. Pouca decoração; textos, controles e ilustrações legíveis e com contraste adequado.
4. As cinco construções aparecem sempre, com função inequívoca.
5. O mascote existente não é alterado.

## 5. Fases de implementação propostas — ainda não autorizadas

**Fase 0 — Aprovação do design e auditoria:** finalizar mockup da trilha; conferir componentes, dados e funcionalidades reais do Studies atual; estabelecer plano de preservação e testes.

**Fase 1 — Interface e navegação:** implementar trilha vertical, capítulos, construções, estados, desafios intercalados, telas focadas e retorno à rolagem, reutilizando a base existente.

**Fase 2 — Conteúdo e aprendizagem:** importação, geração incremental, ensino adaptativo, revisões, simulados, validação de questões, fontes e contingência de IA.

**Fase 3 — Integrações e acompanhamento:** calendário, sessões, estatísticas, sincronização robusta e aprimoramentos offline.

Cada fase requer validação funcional e visual, especialmente no iPhone. **Não fazer merge em produção sem autorização.** Evitar grandes mudanças simultâneas e novas dependências pagas.

## 6. Pontos pendentes — não confundir com decisões aprovadas

- **Aprovação final da tela da trilha:** espaçamento, tamanho das cinco construções, ilustração minimalista e posição exata dos desafios intermediários.
- **Comportamento detalhado da navegação entre capítulos** e eventual atalho de capítulo.
- **Revisão do estado real do repositório** antes de prometer compatibilidade ou cronograma.
- **Estratégia técnica de migração de dados e sincronização**, dependente da arquitetura real existente.
- **Critérios e limites quantitativos de consumo de IA** a configurar após inspecionar provedores e disponibilidade.
- **Métricas e critérios pedagógicos para estimar domínio**, sem apresentar precisão não sustentada.

Esses itens podem ser resolvidos durante a Fase 0 e o planejamento técnico, sem reabrir decisões já aprovadas.

## 7. Referências visuais e alertas

Foram gerados mockups exploratórios com três telas e versões posteriores da trilha. **Não são especificações pixel-perfect**. Algumas versões contrariaram decisões ao usar roxo, excesso de abas, cenário de floresta e/ou simplificação indevida das atividades intermediárias. Não copiar esses erros para o produto.

A última direção visual aproximou a paleta e simplificou o mapa, mas o usuário reforçou que **minimalismo e fidelidade às decisões prevalecem sobre o visual chamativo**. O próximo protótipo deve concentrar-se na trilha, sem redesenhar o mascote.

## 8. Registro de mudanças

| Data | Versão | Mudança | Status |
|---|---|---|---|
| 22/11/2026 | 1.0 | Consolidação de princípios, decisões EST-TRILHA-006 a 037, requisitos visuais e fases propostas. | Documento criado; sem implementação. |

---

**Próximo passo recomendado:** validar um mockup dedicado à trilha minimalista; depois auditar o Studies existente no `Alfred-Laboratory` e preparar tarefas pequenas para a Fase 1, mediante autorização explícita.
