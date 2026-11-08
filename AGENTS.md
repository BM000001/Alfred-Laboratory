# Instruções para Codex e ECC

Estas regras complementam `CLAUDE.md` e `docs/AI_WORKFLOW.md`; não substituem as decisões do produto nem as regras de segurança do laboratório.

## Contexto obrigatório

Antes de alterar código, leia `README.md`, `CLAUDE.md`, `CONTINUIDADE.md` e `docs/AI_WORKFLOW.md`. Consulte `docs/ECC-PILOTO.md` ao usar o plugin ECC. Confira a branch, o estado do Git e PRs abertos antes de começar.

## Uso dos agentes ECC

- Use ECC como caixa de ferramentas para desenvolvimento. ECC não é um serviço de execução contínua nem um agente de runtime dentro do Alfred.
- Para mudanças de código, use os fluxos ECC de TDD, revisão de segurança e verificação final quando estiverem instalados e disponíveis.
- Escolha apenas os agentes e skills relevantes à tarefa. Não carregue ou copie todo o catálogo para o repositório.
- Trate saídas dos agentes como sugestões: inspecione o diff, execute as verificações e preserve o fluxo de PR deste laboratório.
- Não confie hooks, MCPs, comandos ou permissões adicionais sem revisar o que será executado e qual acesso solicita.
- Se o plugin ECC não estiver disponível na sessão, siga o fluxo de validação deste arquivo e informe que o agente ECC não foi executado.

## Limites do Alfred

- Preserve o funcionamento local-first, a privacidade, o armazenamento local e as confirmações explícitas descritas em `CLAUDE.md` e nos documentos de arquitetura.
- Não introduza chamadas remotas, telemetria, credenciais, backend ou dependências no app como parte do piloto ECC.
- Mantenha a implementação do Alfred separada das ferramentas usadas para desenvolver o Alfred.

## Entrega

Trabalhe em branch de experimento baseada em `develop-app`; nunca altere `main`, `baseline/alfred-main` ou `BM000001/Alfred` diretamente. Execute `npm test` e `npm run build` quando houver mudanças de código. Antes de propor integração, revise o diff, registre testes e limitações em `CONTINUIDADE.md` e abra PR para `develop-app`. Não faça merge sem autorização explícita.
