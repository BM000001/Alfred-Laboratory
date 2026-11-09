# Alfred Laboratory

Ambiente independente para experimentar, testar e revisar melhorias do Alfred sem alterar o repositório principal.

## Repositórios

- **Projeto original:** [BM000001/Alfred](https://github.com/BM000001/Alfred)
- **Laboratório:** [BM000001/Alfred-Laboratory](https://github.com/BM000001/Alfred-Laboratory)

## Branches

- `main`: base ativa do Alfred-Laboratory e destino dos PRs.
- `develop-app`: branch legada; não use como base nem destino enquanto não for reparada.
- `baseline/alfred-main`: snapshot de referência importado do Alfred original. Trate como somente leitura.
- `feat/<assunto>`, `fix/<assunto>` ou `experiment/<assunto>`: uma branch isolada por tarefa.

A baseline foi importada. Seu commit de referência é `51c3b4fdaacbaa3a6259aecf5e480ed58257877d`.

## Fluxo recomendado

1. Confira o estado do repositório e os PRs abertos.
2. Crie uma branch de trabalho a partir de `main`.
3. Faça mudanças pequenas e limitadas ao objetivo da tarefa.
4. Execute testes e build pertinentes; registre os comandos e resultados reais.
5. Abra um Pull Request da branch de trabalho para `main`.
6. Revise diff, verificações, riscos e preservação das funcionalidades antes de integrar.
7. Qualquer integração no repositório original deve ser uma etapa separada, por PR próprio e autorização explícita.

Mudanças integradas em `main` podem ser publicadas pelo GitHub Pages. Um PR aberto não publica a aplicação.

## Regras de segurança

- Nunca faça push de experimentos diretamente para o repositório original.
- Não altere nem exclua a branch `baseline/alfred-main`.
- Não faça merge, force-push ou exclusão de branches sem autorização explícita.
- Preserve APIs, componentes, rotas, estilos, dados e integrações existentes.
- Não remova funcionalidades não relacionadas à tarefa.
- Nunca versione tokens, chaves, certificados, cookies ou dados pessoais reais.
- Não declare testes aprovados sem executá-los.

## Documentação

Leia [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md) antes de iniciar um trabalho com agentes de IA. Veja [docs/ECC-SETUP.md](docs/ECC-SETUP.md) para configurar e usar o ECC no Codex. Use o [template de Pull Request](.github/PULL_REQUEST_TEMPLATE.md) para registrar escopo, testes, riscos e plano de reversão.
