# Arquitetura de agentes acionados por eventos

## Objetivo

Transformar eventos verificáveis do Alfred-Laboratory em missões pequenas, rastreáveis e seguras. Esta primeira entrega implementa detecção, classificação e enfileiramento como artefato. Ela **não executa um modelo de IA**.

## Fluxo

1. **Event Watcher** — GitHub Actions recebe eventos selecionados do repositório.
2. **Event Analyzer** — `.github/scripts/alfred-agent-event-router.mjs` valida o repositório, filtra ações e classifica o evento.
3. **Task Envelope** — gera JSON versionado, com identificador determinístico, origem, revisão, agentes sugeridos e limites.
4. **Orchestrator (próxima etapa)** — consumirá a missão e delegará aos perfis locais do Codex/ECC ou a um runtime de agentes aprovado.
5. **Validator (próxima etapa)** — verificará evidências, testes, escopo e riscos.
6. **Action Gateway (próxima etapa)** — permitirá somente ações explicitamente aprovadas.

## Eventos suportados nesta primeira entrega

| Evento | Condição | Papéis sugeridos |
|---|---|---|
| Pull Request | opened, reopened, synchronize, ready_for_review; não draft | explorer, reviewer, qa |
| Workflow run | completed com conclusion=failure | qa, explorer, reviewer |
| Issue | label agent:triage ou agent:investigate adicionado | planner, explorer |

Outras ações são ignoradas. O roteador não interpreta conteúdo externo como instruções de sistema: título, corpo, comentários, nomes de branch e logs são dados não confiáveis.

## Contrato da missão

Cada missão inclui:
- `schema_version`, `task_id` determinístico e `created_at`;
- repositório de destino fixo;
- evento de origem e referência ao objeto/revisão;
- tipo, título, justificativa e agentes recomendados;
- `execution_mode=queued_proposal`;
- `permissions=read-only`;
- `requires_human_approval=true`;
- `auto_merge=false` e `auto_deploy=false`.

O JSON é publicado como artefato GitHub Actions por 14 dias e resumido no job summary. A chave determinística ajuda a reconhecer reexecuções da mesma revisão; a persistência/deduplicação central será adicionada quando houver um executor.

## Segurança e limites

- Repositório permitido: `BM000001/Alfred-Laboratory`.
- O workflow faz checkout de `main`, não do código do PR, e usa `persist-credentials: false`.
- Permissões de GitHub somente leitura; sem tokens de provedor de IA, sem chamadas a APIs de modelos.
- O roteador não escreve no repositório, não cria branches/PRs, não comenta issues, não faz merge nem deploy.
- O artefato contém metadados do evento; não deve incluir segredos ou dados pessoais.
- O texto de issues/PRs/logs é entrada não confiável e nunca pode alterar permissões ou regras.
- Um evento só cria uma proposta de missão; não autoriza execução de código ou ações externas.

## Próximas etapas

1. Integrar este roteador com os perfis locais Codex do PR #20 após revisão e integração autorizada.
2. Implementar um executor isolado que consuma o envelope e produza evidências; exigir autenticação e orçamento aprovados.
3. Adicionar fila persistente, idempotência transacional, limites por evento, retries com backoff e dead-letter queue.
4. Adicionar validação independente e Action Gateway com permissões mínimas.
5. Testar eventos reais via workflow_dispatch/replay controlado antes de ativar qualquer ação de escrita.

## Critério de conclusão desta etapa

A etapa está concluída quando os testes unitários cobrem os eventos suportados e os casos ignorados, o workflow tem permissões somente leitura e cada execução gera artefato apenas para missões válidas. Isso comprova roteamento, não execução autônoma de agentes.
