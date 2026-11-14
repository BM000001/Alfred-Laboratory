# Fluxo técnico do Laboratório para agentes de IA

> **Processo canônico:** [PROCESSO_IAS.md](PROCESSO_IAS.md) (v2.2). Este arquivo preserva as políticas específicas de branches, revisão e proteção do Laboratório. Se houver diferenças sobre reservas, estados ou handoff, use PROCESSO_IAS.md; nenhuma proteção descrita aqui é assumida como já configurada.

## Objetivo
Permitir que várias IAs trabalhem em paralelo no Alfred sem colocar o repositório principal em risco.

## Branches
- `main`: regras e documentação estáveis do laboratório.
- `develop-app`: integração de mudanças no código do Alfred; deriva da baseline importada.
- `baseline/alfred-main`: snapshot de referência, somente leitura.
- `codex/<issue>-resumo` ou `ia/<issue>-resumo`: padrão v2.2 para trabalho novo em branch isolada.
- `experiment/<assunto>` e `fix/<assunto>`: branches legadas que podem continuar sendo usadas para PRs existentes.
- A origem e destino de cada tarefa devem constar na Issue; **não** assumir `develop-app` ou `main` sem conferir dependências.

## Regras
- Confirme repositório, branch e escopo antes de editar.
- Trabalhe somente no escopo solicitado.
- Preserve APIs, componentes, rotas, estilos, dados e integrações existentes.
- Não substitua arquivos inteiros quando uma alteração localizada for suficiente.
- Não faça merge, rebase destrutivo, force-push ou exclusão de branches sem autorização explícita.
- Não altere o repositório original `BM000001/Alfred`.
- Não inclua tokens, chaves, certificados, cookies ou dados pessoais reais.
- Se encontrar conflito arquitetural, documente e peça revisão em vez de apagar código.
- Não trate a branch `baseline/alfred-main` como destino de commits ou PRs.
- Não promova alterações de `develop-app` para `main` automaticamente.

## Validação obrigatória
Antes de abrir PR:
1. Execute os testes, lint e build disponíveis.
2. Informe os comandos executados e resultados reais.
3. Liste os arquivos alterados.
4. Explique impacto visual e funcional.
5. Registre riscos, limitações e plano de reversão.
6. Confirme que nenhuma funcionalidade não relacionada foi removida.

Se algum teste não puder ser executado, declare isso. Nunca informe que passou sem executar.

## Integração
1. Registre o planejamento e a reserva na Issue; crie branch de tarefa a partir da origem expressa na Issue (frequentemente `develop-app` ou `main`).
2. Abra Draft PR para a base de destino indicada na Issue, sem assumir `develop-app`.
3. Aguarde revisão e resolva os comentários.
4. Faça merge somente após aprovação e validação.
5. A promoção para `main` do laboratório é uma etapa separada.
6. A integração no Alfred original exige PR próprio e autorização explícita.

## Proteção recomendada para `develop-app`
Configure uma regra de branch no GitHub em **Settings → Rules → Rulesets** (ou **Settings → Branches**, conforme a interface disponível).

- Nome sugerido: `Protect develop-app`.
- Alvo: branch `develop-app`.
- Exigir pull request antes de mesclar.
- Exigir que as verificações passem antes de mesclar.
- Selecionar a verificação do workflow **Validate Alfred**, job **Tests and production build**.
- Bloquear force-push.
- Bloquear exclusão da branch.
- Não exigir quantidade de aprovações maior que zero sem antes garantir que haverá outro revisor; em repositório individual isso pode impedir o próprio autor de integrar PRs.

Depois de salvar, abra a regra novamente e confirme que o padrão de branch e a verificação obrigatória estão selecionados. A branch `baseline/alfred-main` deve continuar sendo tratada como referência somente leitura.

> Observação: a documentação não significa que a proteção já esteja ativa. A configuração precisa ser salva por uma conta com permissão administrativa no GitHub e verificada na interface do repositório.

## Modelo de entrega
- Objetivo:
- Branch de origem:
- Branch de trabalho:
- Arquivos alterados:
- Funcionalidades preservadas:
- Testes executados:
- Resultado do build:
- Riscos conhecidos:
- Plano de reversão:
- PR:
