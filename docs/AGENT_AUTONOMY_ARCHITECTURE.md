# Alfred Laboratory — agentes programados e orientados a eventos

## Objetivo

Os dois modelos de ativação usam o mesmo roteador e o mesmo envelope de tarefa:

- **Programado:** cron a cada 30 minutos e execução manual, produzindo uma proposta de revisão de saúde do repositório.
- **Orientado a eventos:** PRs não-draft, falhas do workflow de homologação e issues que recebam um rótulo de agente aprovado.

## Fluxo

```text
schedule / workflow_dispatch ─┐
pull_request ─────────────────┤
workflow_run (failure) ───────┼─> event router -> task envelope -> artifact
issues (approved label) ─────┘
                                                   |
                                            future durable queue
                                                   |
                                           future Codex executor
                                                   |
                                      Explorer / QA / Reviewer
                                                   |
                                    report or proposed pull request
                                                   |
                                      human approval required
```

## Tipos de tarefa

| Evento | Tarefa | Especialistas sugeridos |
|---|---|---|
| schedule | scheduled_repository_review | explorer, reviewer |
| workflow_dispatch | manual_repository_review | explorer, reviewer |
| pull_request | pull_request_review | explorer, reviewer, qa; security_reviewer quando indicado |
| workflow_run com falha | ci_failure_investigation | qa, explorer, reviewer |
| issue com rótulo agent:triage ou agent:investigate | issue_triage | planner, explorer |

O roteador ignora eventos não selecionados, PRs em rascunho, execuções CI bem-sucedidas e issues sem rótulo explícito.

## Contrato e deduplicação

Cada proposta inclui schema_version, task_id, created_at, target_repository, source_event e task. A tarefa contém event_kind, título sanitizado e limitado, referência de origem, agentes sugeridos, rationale, execução queued_proposal, permissões read-only, requires_human_approval=true, auto_merge=false e auto_deploy=false.

O ID de PR é estável para a mesma revisão (repositório + ação + número + SHA); retries da mesma revisão não criam IDs diferentes. Execuções programadas usam o ID da execução GitHub para gerar uma tarefa distinta por rodada.

## Segurança

- Repositório permitido: BM000001/Alfred-Laboratory.
- Checkout exclusivamente da branch confiável main, com persist-credentials=false.
- Permissões GitHub somente leitura.
- Gatilhos programados/manual e gatilhos por evento têm variáveis de repositório independentes, ambas desligadas por padrão: ALFRED_LAB_AGENT_30M_APPROVED e ALFRED_LAB_EVENT_ROUTER_APPROVED.
- O roteador não inclui corpo de issue/PR no envelope. O texto do PR é usado apenas para recomendar especialistas; títulos são sanitizados antes de serem incluídos no resumo.
- Nenhuma chave de API, inferência, execução Codex, escrita, comentário, branch, PR, merge ou deploy nesta fase.
- O Alfred original e a baseline não são acessados nem modificados.

## Estado e limitações

Implementado: gatilhos, classificação determinística, envelope de proposta, IDs de deduplicação, artefato temporário de 14 dias, testes Node.js e documentação.

Ainda pendente: fila durável, executor autenticado Codex, armazenamento de estado, orçamento de inferência e execução real de subagentes. Artefato do GitHub é armazenamento temporário de inspeção, não fila persistente.

## Próximas etapas

1. Validar os testes e workflow após esta atualização.
2. Habilitar os gatilhos apenas após revisar as variáveis de opt-in.
3. Escolher o runtime de IA e aprovar limite de custo e credenciais.
4. Implementar fila persistente e consumidor idempotente.
5. Piloto Codex somente leitura com Explorer e Reviewer.
6. Depois habilitar implementação em branch descartável e revisão por QA/Security; merge permanece manual.
