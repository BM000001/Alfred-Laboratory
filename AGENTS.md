# Instruções para agentes — Alfred-Laboratory

Este arquivo é o ponto de entrada curto para Codex e outras IAs. A política operacional canônica está em [docs/PROCESSO_IAS.md](docs/PROCESSO_IAS.md) (v2.2). Orientações complementares: [CLAUDE.md](CLAUDE.md), [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md) e [docs/PROTOCOLO-SALVAMENTO.md](docs/PROTOCOLO-SALVAMENTO.md). Em caso de divergência de fluxo, prevalece PROCESSO_IAS.md; regras de segurança mais restritivas continuam válidas.

## Antes de editar
1. Confirmar a Issue acionada pelo proprietário, **repositório de trabalho**, branch base e destino. Nunca presumir que Alfred-Laboratory é uma branch de Alfred: são repositórios diferentes.
2. Conferir Issues, PRs, branches e código correlatos, dependências, mudanças locais e reservas de execução; não duplicar uma implementação ativa.
3. Registrar na Issue o objetivo, critérios de aceite, módulos envolvidos e responsável/sessão. Para trabalho de maior risco, pedir a aprovação do plano técnico, conforme o processo.
4. Criar branch isolada **antes** de alterar código; padrão `codex/<issue>-resumo` ou `ia/<issue>-resumo`. Respeitar a base definida na Issue.

## Durante
- Preservar código existente, dados e privacidade. Sem segredos, tokens, dados reais de usuários, force push, reset destrutivo, exclusões ou merges não autorizados.
- Fazer checkpoints com commits pequenos e, quando possível, push confirmado. Código somente no container **não** está salvo no GitHub.
- Para mudanças no app, executar os comandos existentes: `npm test` e `npm run build`; não há script `lint` declarado no package.json atual. Registrar falhas e testes não executados sem inventar resultados.
- Após três tentativas consecutivas **sem progresso mensurável sobre a mesma causa**, parar, registrar evidências no handoff e sinalizar bloqueio; não repetir infinitamente.

## Entrega
- Abrir/atualizar Draft PR, incluir vínculo com a Issue e Handoff (repo, branch, base, commit SHA, PR, estado publicado, testes, pendências e próxima ação).
- Verificar CI/revisão/preview disponíveis; **não** presumir que existe link Safari ou revisão automática.
- **Não** mesclar nem apagar branches sem aprovação explícita. Merge no Laboratório não equivale a promoção ao repositório `BM000001/Alfred`.
- Fazer manutenção como tarefa rastreável, evitando limpeza destrutiva automática.
