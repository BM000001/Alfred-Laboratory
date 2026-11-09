# Preparação do gatilho GitHub Actions a cada 30 minutos

## Estado real

Workflow: `.github/workflows/alfred-agent-30m.yml`.
Agenda: `13,43 * * * *` (UTC), a cada 30 minutos. O GitHub pode atrasar ou omitir execuções sob carga. O agendamento só opera depois que este workflow estiver na branch padrão `main` (mediante merge autorizado).

**Isto não é, ainda, uma equipe de agentes em operação.** O workflow é um gatilho de integração intencionalmente desabilitado: a condição `vars.ALFRED_LAB_AGENT_30M_APPROVED == 'true'` não é atendida por padrão. Isso evita consumo acidental de API e rotinas que não possam produzir trabalho autorizado.

## Dependência que impede a execução autônoma

Ainda não existe `.github/scripts/alfred-agent-executor.sh` neste PR nem runtime de IA aprovado com autenticação e limites de custo. Mesmo com a variável ativada, o workflow falha explicitamente antes de alegar execução de agentes. Os perfis em `.codex/agents` (PR #20) descrevem papéis; não instalam nem autenticam um executor. A automação do ChatGPT não é disparada automaticamente por um cron do GitHub Actions. A assinatura ChatGPT Plus não constitui, por si, uma chave de API gratuita para CI.

Antes de habilitar, escolher e validar um mecanismo de IA cujo custo e limites sejam aceitos, implementá-lo em PR separado com testes e limites de permissão, e adicionar o script executável acima. Não guardar tokens em código ou arquivos do repositório. Se exigir uma chave/API paga, obter aprovação explícita do custo antes de configurar secrets ou habilitar a variável.

## Contrato exigido do futuro executor

- Repositório exclusivo `BM000001/Alfred-Laboratory`; base/destino `main`; nunca `develop-app` ou `baseline/alfred-main`.
- Consultar PRs, CI, `AGENTS.md`, `CONTINUIDADE.md` e tarefas autorizadas, sem duplicações ou relatórios repetitivos.
- No máximo uma tarefa pequena por rodada; no máximo três subagentes, um escritor por checkout e nenhuma redelegação. Não afirmar uso de ECC sem evidência de carregamento e execução.
- Criar branch específica, validar testes e build, revisar diff e abrir PR. Não fazer merge, deploy manual, mudanças no Alfred original, exclusões ou force-push.
- Chaves e permissões devem ficar isoladas. O gatilho atual tem `contents: read` e checkout sem credenciais persistentes; ampliar permissões somente após revisão de segurança.
- Sem tarefa autorizada ou sem executor apto: não fabricar trabalho ou relatórios. Logs devem distinguir pré-validação, execução real, CI, testes no dispositivo e integração.

## Próxima ação

Revisar o PR de agendamento. Não habilitar `ALFRED_LAB_AGENT_30M_APPROVED` ainda. Após selecionar um executor gratuito verificável (ou aprovar custos explícitos), criar um PR de integração do runtime; validar manualmente via `workflow_dispatch` e revisar logs e permissões. **Somente depois** ativar a frequência de 30 minutos e avaliar se a automação horária do ChatGPT deve ser desativada, evitando sobreposição.
