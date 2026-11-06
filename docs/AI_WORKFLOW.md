# Fluxo de trabalho para agentes de IA

## Objetivo
Permitir que várias IAs trabalhem em paralelo no Alfred sem colocar o repositório principal em risco.

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
1. Abra PR da branch de experimento para `develop-app`.
2. Aguarde revisão e resolva os comentários.
3. Faça merge somente após aprovação e validação.
4. A promoção para `main` do laboratório é uma etapa separada.
5. A integração no Alfred original exige PR próprio e autorização explícita.

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
