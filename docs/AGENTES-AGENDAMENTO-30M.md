# Gatilhos de agentes do Alfred Laboratory

## Estado real

Workflow: .github/workflows/alfred-agent-30m.yml.

O mesmo workflow recebe dois tipos de ativação:

- **Programada/manual:** cron 13,43 * * * * (UTC) e workflow_dispatch, protegidos por ALFRED_LAB_AGENT_30M_APPROVED.
- **Orientada a eventos:** pull_request_target em PRs para develop-app, issues e conclusão do workflow Validate Alfred, protegidos por ALFRED_LAB_EVENT_ROUTER_APPROVED.

Os dois gates são independentes e desabilitados por padrão. O agendamento só opera quando o workflow está na branch padrão main. O workflow pode ser testado manualmente, mas a execução manual também exige a branch main e o gate programado.

## O que acontece quando um gate é habilitado

O workflow faz checkout exclusivamente da branch confiável main, executa os testes do roteador e gera um envelope JSON normalizado. O envelope é armazenado como artefato por sete dias para inspeção.

O evento pull_request_target é usado somente para metadados. O workflow nunca faz checkout nem executa código do head de um pull request. O roteador não copia corpos de issues/PRs, comentários ou arquivos.

## Limite importante

**Isto ainda não executa modelos de IA nem agentes Codex.** É a infraestrutura segura de entrada e normalização de eventos. O artefato JSON é uma fila temporária de inspeção, não uma fila durável nem uma delegação multiagente.

Não existe .github/scripts/alfred-agent-executor.sh nem runtime de IA autenticado nesta etapa. Os perfis em .codex/agents são instruções de papéis, não iniciam agentes por conta própria. A assinatura ChatGPT Plus não fornece automaticamente uma chave de API gratuita para GitHub Actions.

## Segurança e custo

- Repositório exclusivo BM000001/Alfred-Laboratory.
- Permissões do workflow limitadas a contents: read.
- Checkout sem credenciais persistentes.
- Concorrência impede execuções simultâneas do mesmo grupo.
- Nenhuma API key, secret de provedor ou cobrança é configurada.
- Nenhuma escrita no repositório, criação de PR, merge, deploy ou ação no Alfred original.
- Futuras escritas exigirão proposta e aprovação humana explícita.

## Próxima etapa

Após validar os artefatos, escolher um runtime de IA e aprovar provedor, custo máximo por execução e armazenamento de credenciais. Só então implementar fila persistente, deduplicação, executor em checkout descartável e piloto somente leitura com Explorer + Reviewer. Não habilitar os gates antes da revisão de segurança e do custo.
