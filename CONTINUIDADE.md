# Continuidade do Alfred

## Estado atual — 2026-11-04 (atualizado após PR #63)
- PR #58 — remoção da dependência da Vercel e manutenção da arquitetura local-first — integrada à `main` por squash merge; commit `ad5b47feb357bdf92a08df3b4e5af26e8c50c40d`.
- PR #59 — atualização deste documento após a remoção da Vercel — integrada; CI aprovado.
- PR #60 — recuperação contextual explicável de memórias — integrada por squash merge; commit `76fc8828c3121e99dcc8015f9dfd8f6609cc3758`; CI da PR aprovado (workflow run `41744682867`); CI da `main` aprovado (run `41744807746`) e GitHub Pages publicado (runs `41744807822` e `41744806967`).
- PR #61 — documentação do marco de memória contextual — integrada após CI verde; commit de merge `a0e32f8`.
- PR #62 — normalização conservadora de plurais comuns em português na busca lexical de memórias — integrada após CI verde; CI da PR aprovado (workflow run `41746233559`); CI da `main` aprovado (run `41746358115`) e GitHub Pages publicado (runs `41746357148` e `41746358082`).
- PR #63 — atualização do roadmap para refletir funcionalidades entregues e pendências reais — integrada após CI verde; commit `32650fb9a1433e71359ab35991fc7b3f4d388b66`; CI da PR aprovado (workflow run `41746527048`). CI e publicação da `main` após merge estão em execução (runs `41746683516` e `41746683604`).
- CI da `main` após a PR #58 aprovado: workflow run `41744079705`.
- Publicação do GitHub Pages após a PR #58 concluída com sucesso: workflow run `41744079731`; deploy do Pages `41744079350`.
- Aplicação publicada: https://bm000001.github.io/Alfred/.
- PRs #55 e #56 haviam introduzido uma integração remota específica da Vercel; essa implementação foi removida pela PR #58. Não há backend obrigatório nem provedor remoto ativo.
- `main` é a fonte da verdade; desenvolver em branches e PRs.
- PR #29 — análise arquitetural do Jarvis — integrada.
- PR #30 — fundação segura do assistente — integrada.
- PR #31 — interface conversacional local — integrada; CI aprovado (run #90).
- PR #34 — executor de ações com validação de aprovação — integrada; CI aprovado (run #95).
- PR #35 — proposta e confirmação explícita para concluir tarefas — integrada; CI aprovado (run #100).
- PR #36 — resumo Pomodoro pelo dia local e testes de fuso — integrada; CI aprovado (run #103).
- PR #38 — backup com senha e inclusão do histórico Pomodoro — integrada; CI aprovado (run #108).
- PR #40 — relatório detalhado de auditoria de dependências no CI — integrada.
- PR #41 — atualização de Vite/Vitest — integrada; CI aprovado (run #114), testes e build concluídos.
- PR #43 — criação de tarefas pelo assistente com confirmação explícita — integrada; CI aprovado (run #119).
- PR #47 — redesign da navegação, identidade visual e refinamentos do assistente — integrada; commit `2e7dd3e` na `main`.
- PR #49 — histórico local persistente do assistente — integrada em 2026-11-03 após CI verde (125 testes e build aprovados).
- PR #50 — memórias locais manuais — integrada; CI verde (134 testes, build aprovado e auditoria npm sem vulnerabilidades reportadas).
- PR #51 — política provider-neutral de consentimento para exportação manual — integrada; CI verde.
- PR #52 — painel de exportação manual — integrada após correção de teste de interface; CI verde.
- PR #48 — refinamento visual dos módulos internos — integrada em 2026-11-03 após CI verde; alterações somente em `src/styles/global.css`.
- Não criar dados fictícios ou de demonstração.

## Funcionalidades integradas
- Tarefas e projetos: cadastro, filtros, conclusão, arquivamento e progresso.
- Agenda: compromissos, visualizações Dia/Semana/Mês, detecção de conflitos, edição, cancelamento e persistência local.
- Importação iCalendar: arquivo .ics, prévia e confirmação explícita; eventos recorrentes são ignorados com aviso; sem sincronização direta com iCloud.
- Painel inicial: pendências, atrasos, compromissos próximos e briefing diário; somente leitura para recomendações.
- Estudos: disciplinas, conteúdos, anotações, filtros, conclusão e progresso.
- Arquivos: adicionar, pesquisar, baixar e excluir arquivos (limite de 10 MB por arquivo).
- Backup/restauração: JSON com arquivos em Base64, prévia e confirmação explícita para substituir dados locais; opção adicional de exportação protegida por senha. A senha não é armazenada; a perda impede a recuperação do backup criptografado.
- Novos backups incluem histórico Pomodoro; backups JSON antigos sem esse campo continuam sendo aceitos.
- Produtividade: Pomodoro, histórico de sessões e associação opcional com tarefas. O resumo de sessões diárias agora usa o fuso do dispositivo; a função aceita fuso explícito para testes determinísticos.
- Persistência local via IndexedDB, sem backend próprio.

## Assistente Alfred — estado real
- Contratos provider-independent para mensagens, contexto, providers, ferramentas, propostas e decisões de aprovação.
- Ferramentas locais somente leitura para tarefas pendentes, próximos compromissos e progresso dos estudos.
- Provider inicial baseado em regras locais; não chama APIs externas nem envia dados pessoais.
- Interface conversacional responsiva conectada aos dados reais do IndexedDB.
- Histórico de conversa local persistente em IndexedDB, limitado às 200 mensagens mais recentes, com ação explícita para apagar o histórico. Propostas aguardando confirmação não são restauradas após recarregar a página.
- Memórias explícitas em IndexedDB: cadastro, edição, exclusão e consulta manual; categorias de preferência, objetivo, projeto, rotina e outro. Recuperação contextual local prioriza correspondências no título, limita consultas específicas a três resultados, mostra os termos relacionados e não lista memórias sem relação com o assunto. Consultas gerais são explícitas e limitadas às dez memórias atualizadas mais recentemente. A busca é lexical, não semântica; não há extração automática nem armazenamento automático de dados sensíveis. Memórias permanecem locais e entram no backup JSON (também no backup criptografado); backups antigos sem o campo continuam compatíveis.
- Portão de exportação manual: permite selecionar tarefas, tópicos de estudo e memórias, revisar cada item, autorizar as classes pública/pessoal/acadêmica por operação e gerar prévia exata antes de copiar. Não há envio de rede nem provedor remoto conectado.
- A integração de IA remota por API/serverless foi removida pela PR #58 e a remoção está integrada na `main`; o assistente permanece local e a exportação manual continua sendo o único fluxo para usar conteúdo com outro serviço de IA.
- Controles de exportação: preferência global local para desativar/reabilitar novas preparações manuais. Desativar invalida a prévia e limpa seleções/autorizações da interface.
- Auditoria local: registra apenas data/hora, classes, quantidade de itens e caracteres, e ação de cópia para área de transferência; não armazena texto, títulos ou IDs dos conteúdos. Retenção limitada aos 100 registros mais recentes; pode ser apagada pelo usuário. Auditoria e preferência de bloqueio não entram nos backups. A auditoria registra cópia, não comprova envio a outro serviço. Desativar impede novas preparações neste painel, mas não apaga texto já copiado para a área de transferência ou colado em serviços externos.
- Executor de propostas verifica aprovação explícita para o ID correto, valida todas as ferramentas antes de começar e bloqueia ferramentas ausentes ou políticas inseguras.
- Ações de escrita disponíveis: `criar tarefa <título>`, `adicionar tarefa: <título>`, `concluir tarefa <título exato>` ou `marcar tarefa <título exato> como concluída`. O Alfred apresenta uma proposta e só grava após clique em “Confirmar alteração”. Cancelar não altera dados. A criação recusa títulos duplicados e títulos acima do limite; a conclusão recusa títulos ambíguos/inexistentes e exige que a tarefa ainda esteja pendente. Enquanto há uma proposta aberta, o campo de comando fica desativado até confirmar ou cancelar.
- A memória é manual e baseada em registros estruturados; recuperação contextual usa correspondência lexical explicável, com normalização de acentos e flexões regulares comuns de singular/plural em português (PR #62), não embeddings ou compreensão semântica. Ainda não há extração automática nem modelo de IA generativa. Também não há voz nem ações de escrita para compromissos/estudos. O assistente não é ainda um agente geral.

## Integração Jarvis — análise concluída, código não copiado
- Documento: `docs/ANALISE-JARVIS.md`.
- A análise identificou arquitetura e capacidades reutilizáveis, mas nenhum código do Jarvis foi copiado.
- Decisão: preservar React/Vite, IndexedDB e serviços existentes; manter provider independente, ferramentas com escopo, aprovação explícita e voz opcional.
- Riscos a tratar: credenciais no frontend, permissões de ferramentas, bridge/SSRF, privacidade de voz e licenças de assets/dependências.

## Etapa 1 recebida de implementação independente
- Os arquivos dessa etapa foram preservados na raiz.
- A PR #22 restaurou a configuração React/Vite que havia sido substituída por configuração TypeScript independente.
- Módulos independentes de domínio, armazenamento, privacidade e adaptador manual ainda NÃO estão integrados à aplicação React.
- A proteção por senha do backup está integrada no módulo atual; os módulos criptográficos independentes da Etapa 1 não foram incorporados.
- O consentimento atual cobre preparação/cópia manual, não chamadas a provedores externos. Não existe integração de IA remota nem envio de rede pelo painel.
- Testes independentes da Etapa 1 não fazem parte da suíte Vitest do app.

## Pontos de atenção conhecidos
- Rever o limite de tamanho do backup, pois Base64 aumenta os arquivos exportados.
- O ciclo de vida das URLs temporárias de download foi melhorado com revogação atrasada; validar em Safari/iPhone.
- Ampliar testes da edição de compromissos (conflito próprio, conflito com outro compromisso e limpeza de campos).
- A auditoria npm após atualizar Vite/Vitest reportou 0 vulnerabilidades no ambiente do CI (run #114). O CI agora imprime os detalhes de futuras ocorrências.
- A publicação do GitHub Pages foi confirmada após a PR #58 (workflow run `41744079731`); validar o funcionamento real em Safari/iPhone ainda está pendente.
- Verificar licenças e atribuições de dependências/assets antes de distribuir.

## Próximas etapas prioritárias
1. Executar e registrar os 11 testes manuais no Safari/iPhone; automação e deploy verde não comprovam funcionamento real no dispositivo.
2. Corrigir problemas encontrados em instalação PWA, navegação mobile, teclado, funcionamento offline, backup/restauração e persistência após períodos sem uso.
3. Ampliar testes da interface conversacional: consultas dos três domínios, erro de IndexedDB, mensagens longas, estado de carregamento, acessibilidade e mobile.
4. Melhorar a experiência de propostas de ação, incluindo estados de erro, prioridade configurável e recarga dos dados após uma escrita.
5. Avaliar integração futura com IA somente se houver arquitetura independente de hospedagem, credenciais fora do frontend, minimização de contexto, consentimento, limites de custo e tratamento de falhas.
6. Avaliar voz opcional e interrompível sem comprometer privacidade nem suporte mobile.
7. Verificar licenças e atribuições de dependências/assets antes de distribuir.

## Protocolo de trabalho
- Desenvolver em branches e PRs; não alterar `main` diretamente para código.
- Integrar após revisar o diff e confirmar CI verde.
- Não afirmar testes locais: validação oficial deve ser comprovada no GitHub Actions.
- Atualizar este documento em cada marco confirmado.
- Não criar registros fictícios nem incluir segredos ou dados pessoais.
