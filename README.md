# Alfred Laboratory

Ambiente independente para experimentar, testar e revisar melhorias do Alfred sem alterar o repositório principal.

## Repositórios

- **Projeto original:** [BM000001/Alfred](https://github.com/BM000001/Alfred)
- **Laboratório:** [BM000001/Alfred-Laboratory](https://github.com/BM000001/Alfred-Laboratory)

## Branches

- `main`: base padrão de código, testes, regras e documentação do laboratório; não é a `main` do Alfred principal.
- `develop-app`: base **legada** com histórico independente; manter para referência e migração seletiva, sem novos desenvolvimentos por padrão.
- `baseline/alfred-main`: snapshot de referência importado do Alfred original. Trate como somente leitura.
- `experiment/<assunto>`: implementação isolada de uma melhoria.
- `fix/<assunto>`: correção isolada.

A baseline foi importada. Seu commit de referência é `51c3b4fdaacbaa3a6259aecf5e480ed58257877d`.

## Fluxo de desenvolvimento com IAs

O processo canônico está em [AGENTS.md](AGENTS.md) e [docs/PROCESSO_IAS.md](docs/PROCESSO_IAS.md). Antes de codificar, consulte a Issue e os PRs existentes, registre a reserva de execução e a base/destino corretos. Crie branch isolada antes de editar e faça handoff verificável ao interromper.

- **Documentação estável:** branch a partir de `main` do Laboratory, PR para `main` do Laboratory.
- **Mudanças no aplicativo:** **branch a partir de `main` do Laboratory**, PR para essa `main`; exceções de PRs empilhados exigem dependência explicitamente aprovada na Issue. Não partir da baseline nem de `develop-app` por padrão.
- **Migração de legado:** `develop-app` não compartilha ancestral Git com `main`. Nunca executar merge direto, reset ou force-push; comparar módulos e portar somente diferenças úteis em PRs pequenos criados a partir da `main`.
- **Promoção ao Alfred original:** etapa separada com PR e aprovação explícita; aprovação de merge no Laboratory não autoriza o merge no principal.
- Após publicação, confirmar CI e URL/commit da prévia quando existirem. Somente o proprietário aprova o destino e a integração.
- Branches e arquivos somente são excluídos depois de verificação de dependências e autorização aplicável.

## Regras de segurança

- Nunca faça push de experimentos diretamente para o repositório original.
- Não altere nem exclua a branch `baseline/alfred-main`.
- Não faça merge, force-push ou exclusão de branches sem autorização explícita.
- Preserve APIs, componentes, rotas, estilos, dados e integrações existentes.
- Não remova funcionalidades não relacionadas à tarefa.
- Nunca versione tokens, chaves, certificados, cookies ou dados pessoais reais.
- Não declare testes aprovados sem executá-los.

## Documentação

- [AGENTS.md](AGENTS.md): instruções rápidas comuns a todos os agentes.
- [docs/PROCESSO_IAS.md](docs/PROCESSO_IAS.md): processo v2.2, estados, reserva, handoff, PR, aprovação e encerramento.
- [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md): detalhes de branches, validação e proteções (complementar ao processo).
- [CLAUDE.md](CLAUDE.md): instruções específicas de continuidade e segurança.
- [Modelo de Issue](.github/ISSUE_TEMPLATE/ia-tarefa.md) e [modelo de Pull Request](.github/PULL_REQUEST_TEMPLATE.md).
