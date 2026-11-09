# Equipe de desenvolvimento Alfred

O agente principal coordena e integra resultados. Os oito especialistas são perfis locais personalizados para Alfred, seguindo o mecanismo do Codex e complementando as skills do ECC; não são oito processos permanentes.

| Papel | Quando acionar | Entrega |
|---|---|---|
| explorer | Mapeia código e dependências antes de mudanças. | Evidências, resultado e limitações |
| planner | Planeja mudanças e critérios de aceite. | Evidências, resultado e limitações |
| implementer | Implementa funcionalidades e correções no escopo atribuído. | Evidências, resultado e limitações |
| reviewer | Revisa regressões e correção de um diff definido. | Evidências, resultado e limitações |
| qa | Valida critérios de aceite, testes e fluxos no navegador. | Evidências, resultado e limitações |
| security_reviewer | Revisa privacidade, armazenamento e integrações. | Evidências, resultado e limitações |
| ux_reviewer | Revisa usabilidade, acessibilidade e identidade visual. | Evidências, resultado e limitações |
| docs_researcher | Confirma documentação oficial e compatibilidade. | Evidências, resultado e limitações |

## Protocolo de delegação
Cada tarefa deve informar objetivo, branch/SHA, arquivos permitidos, critérios de aceite, dependências e ações proibidas. Resultado deve registrar papel, estado (concluído/bloqueado/não executado), arquivos ou referências, comandos e resultados reais, riscos e próximo responsável.

No mesmo checkout, apenas um agente escreve por vez. Implementer termina e entrega o diff antes de QA escrever testes. Principal não edita enquanto um auxiliar possui a escrita. Revisores recebem um SHA estável; se o diff mudar, reveja as partes afetadas. Não sobrescreva trabalho de outras sessões.

Até três auxiliares simultâneos; nenhum auxiliar redelega. Acione somente papéis úteis. Mudança pequena: implementer, QA e reviewer em sequência. Mudança complexa: planner/explorer primeiro. Rede/dados: security_reviewer. Interface: ux_reviewer. API incerta: docs_researcher. Após duas tentativas sem progresso, devolva diagnóstico ao coordenador em vez de repetir indefinidamente.

## Critério de conclusão
Requisitos satisfeitos, diff revisado, validação pertinente executada, limitações registradas e PR contra main. Nenhum merge ou deploy sem autorização. O coordenador publica um resumo único; não transfere ao usuário a fiscalização de cada agente.

## Validação do carregamento dos perfis

Antes de iniciar o piloto de navegação, abra uma sessão nova do Codex a partir do checkout da branch do PR. Registre a versão do Codex e o SHA do checkout. Peça ao coordenador para iniciar `explorer` e `reviewer` pelos nomes configurados, em tarefas somente de leitura sobre o mesmo SHA.

| Resultado observado | Registro |
|---|---|
| A sessão inicia os dois perfis pelos nomes e cada um devolve evidência da tarefa | Carregamento e execução validados para esses dois perfis |
| A sessão só inicia agentes genéricos e o coordenador fornece as instruções manualmente | Piloto manual concluído, carregamento dos perfis pendente |
| A sessão não consegue iniciar um dos perfis | Registre qual perfil falhou, a mensagem observada e o ambiente |

Use a identificação do perfil retornada pela sessão como evidência. Se o ambiente só exibir o texto da resposta, registre o carregamento como inconclusivo. Registre separadamente a execução da automação em segundo plano, com horário e link para o resultado ou PR quando houver. Um disparo do agendamento confirma que a automação iniciou, e o resultado da execução mostra o que ela realizou.

## Codespaces pronto para os agentes (configuração opcional)

Para reduzir comandos manuais, o PR #20 inclui a configuração **Alfred Laboratory - Codex agents (opt-in)** em `.devcontainer/agents/devcontainer.json`. Abra um *novo* Codespace do repositório `BM000001/Alfred-Laboratory`, selecionando **a branch `feat/ecc-codex-multiagent-20261109`** e essa configuração de devcontainer. Não use por engano a branch `main`: os arquivos ainda estão apenas no PR. A configuração é opcional e não altera outros Codespaces por padrão.

O `postCreateCommand` instala dependências do projeto e `@openai/codex@0.167.0`, confere os perfis e roda somente o modo `--check`. O Codex **não** inicia agentes nem autentica a conta automaticamente. O ambiente precisa de internet para instalar os pacotes; a criação do Codespace está sujeita aos limites/cobrança do GitHub Codespaces.

No editor Codespaces, use **Terminal → Run Task** (ou **Tasks: Run Task** na paleta de comandos) e siga esta sequência:

1. **Alfred: 1. Verificar ambiente de agentes (sem IA)** — confirma a preparação sem executar modelo.
2. **Alfred: 2. Conectar Codex à conta (ação humana)** — inicia o login por código no navegador; não cole códigos de autenticação no GitHub, nos PRs ou nesta conversa.
3. **Alfred: 3. Testar explorer + reviewer (somente leitura)** — após login, tenta a delegação e salva trilha privada em um diretório temporário. Consome a franquia de uso do Codex ou pode gerar custo **se** a conta estiver usando API paga; confira a autenticação antes de executar.

O piloto tem prazo limite, não faz alterações no repositório e **não** equivale ao GitHub Actions executando agentes a cada 30 minutos. Ele apenas prepara a prova de funcionamento de dois subagentes nativos.

## Piloto executável em Codex (sem alteração de código)

O script `scripts/pilot-codex-agents.sh` executa uma tentativa **real** e limitada de delegação `explorer` + `reviewer` via `codex exec` em um Codespace Linux ou checkout confiável. Ele **não** instala Codex, não autentica contas, não faz merge, não habilita o agendamento de 30 minutos e não usa o ECC automaticamente.

1. Na branch deste PR e com `python3`, `git` e checkout disponível, `bash scripts/pilot-codex-agents.sh --check` verifica perfis e pré-requisitos **sem consumir tokens**.
2. Num ambiente com `codex` autenticado (`codex login status`), execute `bash scripts/pilot-codex-agents.sh --run` apenas quando autorizado. É exigido checkout limpo e GNU `timeout`; o processo Codex tem limite de 600 segundos. A chamada pode consumir franquia de uso do plano ou gerar custo se o Codex estiver configurado com API paga; confira a conta antes de executar.
3. O script aplica sandbox de leitura, aprovações desabilitadas para escalonamento e máximo de dois subagentes. Salva saída e JSONL num diretório privado temporário fora do repositório. **Resultado textual do modelo não comprova por si só o spawn dos subagentes**: confira as threads e a trilha real. Formatos JSONL podem mudar entre versões.
4. O GitHub Actions apenas roda `bash -n` e `--check` sem Codex; CI verde comprova preflight, não execução nativa. Não alegar que o ECC ou os dois perfis executaram sem evidência concreta.

## Primeiro piloto
Use a pendência real de melhoria de navegação mobile do Alfred: explorer identifica redundâncias e ux_reviewer avalia ações e acessibilidade; planner propõe uma melhoria pequena com critérios. Mudança de identidade visual ampla exige decisão do usuário. Implementer executa o escopo autorizado, QA verifica e reviewer examina o diff. Segurança entra se persistência ou rede mudar.

Registre: SHA inicial/final, agentes efetivamente executados, problemas encontrados, arquivos alterados, verificações aprovadas/falhas/não executadas. Não confunda configuração pronta com execução validada.
