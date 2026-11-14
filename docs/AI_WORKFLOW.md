# Fluxo de trabalho para agentes de IA

**Política canônica:** [PROCESSO_IAS.md](PROCESSO_IAS.md), com instruções rápidas em [AGENTS.md](../AGENTS.md). Este arquivo contém detalhes complementares do Laboratory; em caso de conflito, prevalece o processo v2.2. Concorrência de implementações exige autorização e reserva verificável, não apenas consulta às branches.

## Objetivo
Coordenar desenvolvimento no Laboratory sem retrabalho e sem colocar `BM000001/Alfred` em risco.

## Branches
- `main`: regras e documentação estáveis do laboratório.
- `develop-app`: integração de mudanças no código do Alfred; deriva da baseline importada.
- `baseline/alfred-main`: snapshot de referência, somente leitura.
- `experiment/<assunto>`: trabalho isolado por tarefa ou agente.
- `fix/<assunto>`: correções isoladas.

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
1. Execute os testes e build aplicáveis disponíveis (lint somente quando configurado; `package.json` atual não define `npm run lint`).
2. Informe os comandos executados e resultados reais.
3. Liste os arquivos alterados.
4. Explique impacto visual e funcional.
5. Registre riscos, limitações e plano de reversão.
6. Confirme que nenhuma funcionalidade não relacionada foi removida.

Se algum teste não puder ser executado, declare isso. Nunca informe que passou sem executar.

## Integração

1. Registre na Issue o repositório, a base real e o destino do PR. Para mudanças incrementais no app, `develop-app` pode ser a base, mas confira dependências; para documentação estável, `main` do Laboratory pode ser apropriada.
2. Abra branch isolada antes de editar; não use `baseline/alfred-main` como destino de alterações.
3. Abra Draft PR para a branch de destino definida na Issue, registrando SHA, testes, CI e `## Handoff`.
4. Aguarde revisão e aprovação do proprietário; resolva ajustes preferencialmente no mesmo PR.
5. Faça merge somente após aprovação explícita, verificações aplicáveis e checagem de dependências.
6. Uma promoção de `develop-app` a `main` do Laboratory, quando necessária, é decisão e PR separados.
7. A integração no `BM000001/Alfred` exige PR e autorização próprios. Nenhuma regra aqui a executa automaticamente.
8. Limpeza de branches/arquivos somente após auditoria de dependências e aprovação para ações destrutivas.

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
