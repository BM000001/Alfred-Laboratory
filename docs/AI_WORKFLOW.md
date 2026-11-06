# Fluxo de trabalho para agentes de IA

## Objetivo

Permitir que várias IAs trabalhem em paralelo no Alfred sem colocar o repositório principal em risco.

## Antes de começar

1. Confirme em qual repositório e branch está trabalhando.
2. Leia o README e este documento.
3. Identifique a branch de origem e o escopo exato da tarefa.
4. Não presuma que arquivos ou funcionalidades podem ser removidos.

## Branches

- `main`: versão validada do laboratório.
- `develop`: integração contínua de mudanças já revisadas.
- `baseline/alfred-main`: snapshot importado do Alfred original; referência somente leitura.
- `experiment/<assunto>`: trabalho isolado por tarefa ou agente.
- `fix/<assunto>`: correções isoladas.

Não faça commits diretamente em `baseline/alfred-main`. Crie experimentos a partir dela somente depois que a importação for concluída e verificada.

## Regras para agentes

- Trabalhe apenas no escopo solicitado.
- Preserve APIs, componentes, rotas, estilos, dados e integrações existentes.
- Não substitua arquivos inteiros quando uma alteração localizada for suficiente.
- Não faça merge, rebase destrutivo, force-push ou exclusão de branches sem autorização explícita.
- Não altere o repositório `BM000001/Alfred`; o laboratório é o único destino de experimentos.
- Não inclua tokens, chaves, certificados, cookies ou dados pessoais reais.
- Se encontrar conflito ou dúvida arquitetural, documente e peça revisão em vez de apagar código para resolver.

## Validação obrigatória

Antes de abrir um Pull Request:

1. Execute os testes, lint e build disponíveis no projeto.
2. Informe os comandos executados e seus resultados reais.
3. Liste os arquivos alterados.
4. Explique impacto visual e funcional.
5. Registre riscos, limitações e como reverter.
6. Confirme que nenhuma funcionalidade não relacionada foi removida.

Se algum teste não puder ser executado, declare isso claramente. Nunca informe que passou sem ter executado.

## Integração

1. Abra PR da branch de experimento para `develop` ou `main` do laboratório, conforme a tarefa.
2. Aguarde revisão.
3. Resolva comentários sem descartar mudanças de outros agentes.
4. Faça merge somente após aprovação e validação.
5. A integração no Alfred original deve ser uma etapa separada, por PR próprio e autorização do responsável.

## Modelo de entrega do agente

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
