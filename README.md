# Alfred Laboratory

Ambiente independente de experimentação e validação do Alfred.

## Objetivo

Este repositório é destinado a testes de interface, integrações, automações e novas funcionalidades sem alterar o repositório principal `BM000001/Alfred`.

## Regra de segurança

- O repositório `BM000001/Alfred` continua sendo a referência estável.
- Nenhuma alteração neste laboratório modifica automaticamente o Alfred principal.
- Experimentos devem ser feitos em branches próprias e submetidos a revisão antes de qualquer integração.
- Não remover nem substituir funcionalidades existentes sem autorização explícita.
- Antes de propor integração, executar os testes disponíveis e registrar arquivos alterados, riscos e plano de reversão.
- Segredos, tokens, certificados e dados pessoais reais não devem ser versionados.

## Fluxo recomendado

1. Criar uma branch `experiment/<assunto>` a partir de `main`.
2. Implementar e testar a mudança isoladamente.
3. Registrar resultados, limitações e possíveis regressões.
4. Abrir Pull Request para `main` deste laboratório.
5. Somente depois de validado, preparar uma proposta de integração para `BM000001/Alfred` por Pull Request — nunca por push direto.

## Estado da cópia-base

O repositório foi inicializado como laboratório independente. A importação integral do snapshot do Alfred principal ainda precisa ser concluída e verificada antes de iniciar experimentos sobre o código-fonte.
