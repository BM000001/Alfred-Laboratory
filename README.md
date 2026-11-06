# Alfred Laboratory

Ambiente independente para experimentar, testar e revisar melhorias do Alfred sem alterar o repositório principal.

## Repositórios

- **Projeto original:** [BM000001/Alfred](https://github.com/BM000001/Alfred)
- **Laboratório:** [BM000001/Alfred-Laboratory](https://github.com/BM000001/Alfred-Laboratory)

## Branches

- `main`: regras e documentação estáveis do laboratório.
- `develop`: integração de alterações que passaram por revisão.
- `baseline/alfred-main`: snapshot de referência importado do Alfred original. Trate como somente leitura.
- `experiment/<assunto>`: implementação isolada de uma melhoria.
- `fix/<assunto>`: correção isolada.

A baseline foi importada. Seu commit de referência é `51c3b4fdaacbaa3a6259aecf5e480ed58257877d`.

## Fluxo recomendado

1. Crie uma branch `experiment/<assunto>` ou `fix/<assunto>` a partir de `baseline/alfred-main`.
2. Faça mudanças pequenas e limitadas ao objetivo da tarefa.
3. Execute testes e build; registre os comandos e resultados reais.
4. Abra um Pull Request da branch de trabalho para `develop`.
5. Revise o diff, os testes, os riscos e a preservação das funcionalidades existentes.
6. Depois da validação, promova as mudanças de `develop` para `main` por Pull Request.
7. Qualquer integração no repositório original deve ser uma etapa separada, por Pull Request próprio e autorização explícita.

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
