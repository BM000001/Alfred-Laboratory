# Instruções para Codex e agentes de IA

Antes de começar, leia `README.md`, `CLAUDE.md`, `CONTINUIDADE.md` e `docs/AI_WORKFLOW.md`. Confira a branch atual e os PRs abertos. Use `docs/ECC-SETUP.md` como referência para o ECC.

## Repositório e segurança

- Trabalhe neste repositório, `BM000001/Alfred-Laboratory`; nunca altere diretamente `BM000001/Alfred`.
- A base ativa é `main`. Crie uma branch por tarefa a partir de `main` e abra PR para `main`.
- `develop-app` é legada e não deve ser usada até ser reparada e validada.
- Trate `baseline/alfred-main` como somente leitura.
- Não faça merge, force-push, exclusão de branch ou publicação manual sem autorização explícita.
- Preserve as decisões de privacidade, local-first e confirmação descritas em `CLAUDE.md`.
- Não inclua credenciais, tokens, dados pessoais reais ou chamadas remotas sem necessidade e autorização.

## Uso de ECC e agentes do Codex

- Use apenas as skills e papéis relevantes à tarefa.
- Selecione os papéis em `.codex/agents/` conforme `docs/EQUIPE-AGENTES.md`. Delegue explicitamente as tarefas; não execute os oito papéis em toda mudança.
- O agente principal coordena escopo, arquivos, critérios de aceite e resultado. Apenas um escritor por checkout: principal, implementer e qa nunca editam simultaneamente. Leituras de revisão devem usar um SHA estável. Auxiliares não criam subagentes. As permissões são herdadas da sessão; instruções de leitura não são um sandbox.
- Para mudanças de código, use TDD quando a skill estiver disponível; use revisão de segurança para dados, autenticação, criptografia ou rede; faça verificação final antes do PR.
- Trate toda recomendação de agente como hipótese a verificar no código, nos testes e na documentação.
- Não afirme que ECC ou um papel foi executado se não esteve disponível na sessão.
- Agentes só rodam quando uma tarefa é iniciada numa sessão do Codex; não assumem execução contínua.

## Entrega

Siga `docs/AI_WORKFLOW.md`. Execute testes e build pertinentes a mudanças de aplicação, registre resultados reais, revise o diff e abra um PR para `main`. Não faça merge sem autorização explícita.
