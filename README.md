# Alfred Laboratory

Ambiente independente para experimentar, testar e revisar melhorias do Alfred sem alterar o repositório principal.

## Repositórios

- **Projeto original:** [BM000001/Alfred](https://github.com/BM000001/Alfred)
- **Laboratório:** [BM000001/Alfred-Laboratory](https://github.com/BM000001/Alfred-Laboratory)

## Branches

- `main`: regras e documentação estáveis do laboratório.
- `develop-app`: integração de alterações no código do Alfred; deriva da baseline importada.
- `baseline/alfred-main`: snapshot de referência importado do Alfred original. Trate como somente leitura.
- `experiment/<assunto>`: implementação isolada de uma melhoria.
- `fix/<assunto>`: correção isolada.

A baseline foi importada. Seu commit de referência é `51c3b4fdaacbaa3a6259aecf5e480ed58257877d`.

## Processo de desenvolvimento com IAs (v2.2)

A referência canônica para tarefas, reservas, checkpoints, testes, PRs, aprovações e limpeza é [docs/PROCESSO_IAS.md](docs/PROCESSO_IAS.md). O ponto de entrada curto para agentes é [AGENTS.md](AGENTS.md).

1. Identifique a Issue, verifique trabalhos existentes e registre plano e reserva antes de programar.
2. Escolha **explicitamente** a branch-base na Issue; não iniciar automaticamente a partir da baseline ou da `main`. Crie branch de tarefa antes do código (`codex/<issue>-resumo` ou `ia/<issue>-resumo`).
3. Desenvolva e teste, faça checkpoints remotos, abra Draft PR para a base indicada e registre Handoff.
4. Aguarde testes, revisão e aprovação antes de qualquer merge. Promover o Laboratório ao [Alfred principal](https://github.com/BM000001/Alfred) é uma operação separada.
5. Atualize somente a documentação impactada e avalie limpeza sem exclusões não autorizadas.

O fluxo anterior de `experiment/` ou `fix/` continua sendo referência para branches legadas. O [fluxo técnico do Laboratório](docs/AI_WORKFLOW.md) complementa o processo v2.2. Branch/PR não gera automaticamente prévia no iPhone.

## Regras de segurança

- Nunca faça push de experimentos diretamente para o repositório original.
- Não altere nem exclua a branch `baseline/alfred-main`.
- Não faça merge, force-push ou exclusão de branches sem autorização explícita.
- Preserve APIs, componentes, rotas, estilos, dados e integrações existentes.
- Não remova funcionalidades não relacionadas à tarefa.
- Nunca versione tokens, chaves, certificados, cookies ou dados pessoais reais.
- Não declare testes aprovados sem executá-los.

## Documentação

Leia [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md) antes de iniciar um trabalho com agentes de IA. Use o [template de Pull Request](.github/PULL_REQUEST_TEMPLATE.md) para registrar escopo, testes, riscos e plano de reversão.
