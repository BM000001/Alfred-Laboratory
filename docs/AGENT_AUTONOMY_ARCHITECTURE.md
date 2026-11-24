# Alfred Laboratory — arquitetura de autonomia dos agentes

## Objetivo

Unificar dois modos de ativação sob um contrato de eventos comum:

1. **Programado:** verificações periódicas e tarefas de manutenção iniciadas por schedule.
2. **Orientado a acontecimentos:** atividades relevantes do GitHub iniciadas por pull requests, issues e conclusão de CI.

Os dois modos devem alimentar o mesmo formato de evento. O agendamento é um gatilho, não um modelo de IA; os perfis em .codex/agents são instruções de especialização, não processos autônomos por si só.

## Arquitetura lógica

    GitHub schedule ───────┐
                          │
    pull_request_target ──┤
    issues ────────────────┼──> Trigger workflow
    workflow_run ─────────┤          │
    workflow_dispatch ────┘          v
                             Event Router
                                   │
                                   v
                        Event Envelope (JSON)
                                   │
                                   v
                        Policy / Deduplication
                                   │
                                   v
                         Task Queue (future)
                                   │
                                   v
                         Orchestrator (future)
                           /      |       \
                      Explorer  QA     Reviewer
                                   │
                                   v
                         Report / Pull Request
                                   │
                          Human approval required

## Eventos aceitos nesta primeira etapa

| Origem | Evento | Intenção |
|---|---|---|
| GitHub Actions | schedule | Revisão periódica de saúde do laboratório |
| GitHub Actions | workflow_dispatch | Diagnóstico manual |
| Pull requests | opened, synchronize, reopened, closed, ready_for_review, converted_to_draft | Identificar trabalho novo ou mudança de estado |
| Issues | opened, reopened, labeled, unlabeled, closed | Identificar solicitações e prioridades |
| GitHub Actions | workflow_run.completed | Reagir ao resultado de CI |

O workflow usa pull_request_target somente para ler metadados. Ele faz checkout do código confiável da branch main, nunca do head de um pull request. Corpos de issues e pull requests não são copiados para o envelope.

## Contrato do evento

O roteador .github/scripts/agent-event-router.mjs gera um envelope versionado com:

- schemaVersion: versão do contrato.
- id: SHA-256 determinístico dos identificadores do evento/execução.
- status: queued ou ignored.
- kind: categoria normalizada.
- source: repositório, evento, ação, ref, SHA e execução do workflow.
- occurredAt: horário do objeto de origem, quando fornecido pelo GitHub.
- subject: somente metadados mínimos necessários para classificar a ocorrência.
- policy: declara que escrita exige aprovação humana e que execução de modelo ainda não está configurada.

O envelope não inclui corpo de issue/PR, comentários, arquivos, segredos ou dados pessoais. Ele é publicado como artefato temporário do workflow, com retenção curta.

## Limites de segurança

- Escopo exclusivo: BM000001/Alfred-Laboratory.
- baseline/alfred-main é somente leitura.
- Nunca acessar ou modificar BM000001/Alfred.
- Checkout de eventos externos usa somente a branch confiável main; não executar código enviado pelo head de PR.
- Permissões do workflow limitadas a leitura.
- Dois gates independentes e desabilitados por padrão:
  - ALFRED_LAB_AGENT_30M_APPROVED=true habilita o gatilho programado/manual.
  - ALFRED_LAB_EVENT_ROUTER_APPROVED=true habilita a captura de eventos.
- Não configurar API key, secret de provedor, billing ou execução de modelo nesta etapa.
- Nenhuma escrita, merge, deploy, publicação ou ação em sistemas externos.
- Toda futura escrita exige proposta, validação, aprovação humana e trilha de auditoria.
- Concorrência do workflow impede execuções sobrepostas do mesmo grupo.

## O que está implementado nesta etapa

- Workflow único com gatilho programado e gatilhos de eventos.
- Roteador determinístico sem dependências externas.
- Contrato JSON e testes de contrato embutidos no roteador.
- Artefato de evento para inspeção e futura integração com uma fila.

## O que ainda não está implementado

- Não há chamada a modelo de IA nem executor de agentes nesta etapa.
- Não há fila durável, banco de deduplicação ou reprocessamento.
- Não há spawn real de subagentes Codex.
- Não há criação automática de branches ou pull requests.
- Não há notificações ao usuário.
- Não há orçamento de inferência configurado.

## Próximas etapas

1. Validar CI e inspecionar artefatos de workflow_dispatch com os gates desligados.
2. Escolher o runtime de IA e aprovar explicitamente provedor, custo, limite por execução e armazenamento de credenciais.
3. Implementar fila persistente e deduplicação por id.
4. Integrar o Codex CLI/Agents SDK em checkout descartável, com concorrência limitada e um único escritor por checkout.
5. Começar em modo somente leitura: Explorer + Reviewer.
6. Só depois permitir que o Implementer prepare branch e PR; nunca fazer merge automaticamente.
7. Medir custo, latência, falhas e falsos positivos antes de habilitar rotinas frequentes.

## Critérios de aceite

- O roteador rejeita qualquer repositório diferente do laboratório.
- Eventos aceitos geram envelope válido e versionado.
- Eventos não aceitos são marcados como ignorados.
- O corpo de issues/PRs nunca aparece no envelope.
- O workflow não executa o head de pull requests.
- Gates desligados por padrão.
- CI confirma a sintaxe e os testes do roteador.
- Nenhuma chamada a IA, escrita no repositório ou alteração no Alfred original.
