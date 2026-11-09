# Equipe de desenvolvimento Alfred

O agente principal coordena e integra resultados. Os oito especialistas são perfis locais personalizados para Alfred, seguindo o mecanismo do Codex e complementando as skills do ECC; não são oito processos permanentes.

| Papel | Quando acionar | Entrega |
|---|---|---|
| explorer | Mapeia código e dependências antes de mudanças. | Evidências, resultado e limitações |
| planner | Planeja mudanças e critérios de aceite. | Evidências, resultado e limitações |
| implementer | Implementa funcionalidades e correções no escopo atribuído. | Evidências, resultado e limitações |
| reviewer | Revisa regressões e correção de um diff definido. | Evidências, resultado e limitações |
| qa | Valida critérios de aceite, testes e fluxos no navegador. | Evidências, resultado e limitações |
| security_reviewer | Revisa privacidade, armazenamento e integrações. | Evidências, resultado e limitações |
| ux_reviewer | Revisa usabilidade, acessibilidade e identidade visual. | Evidências, resultado e limitações |
| docs_researcher | Confirma documentação oficial e compatibilidade. | Evidências, resultado e limitações |

## Protocolo de delegação
Cada tarefa deve informar objetivo, branch/SHA, arquivos permitidos, critérios de aceite, dependências e ações proibidas. Resultado deve registrar papel, estado (concluído/bloqueado/não executado), arquivos ou referências, comandos e resultados reais, riscos e próximo responsável.

No mesmo checkout, apenas um agente escreve por vez. Implementer termina e entrega o diff antes de QA escrever testes. Principal não edita enquanto um auxiliar possui a escrita. Revisores recebem um SHA estável; se o diff mudar, reveja as partes afetadas. Não sobrescreva trabalho de outras sessões.

Até três auxiliares simultâneos; nenhum auxiliar redelega. Acione somente papéis úteis. Mudança pequena: implementer, QA e reviewer em sequência. Mudança complexa: planner/explorer primeiro. Rede/dados: security_reviewer. Interface: ux_reviewer. API incerta: docs_researcher. Após duas tentativas sem progresso, devolva diagnóstico ao coordenador em vez de repetir indefinidamente.

## Critério de conclusão
Requisitos satisfeitos, diff revisado, validação pertinente executada, limitações registradas e PR contra main. Nenhum merge ou deploy sem autorização. O coordenador publica um resumo único; não transfere ao usuário a fiscalização de cada agente.

## Primeiro piloto
Use a pendência real de melhoria de navegação mobile do Alfred: explorer identifica redundâncias e ux_reviewer avalia ações e acessibilidade; planner propõe uma melhoria pequena com critérios. Mudança de identidade visual ampla exige decisão do usuário. Implementer executa o escopo autorizado, QA verifica e reviewer examina o diff. Segurança entra se persistência ou rede mudar.

Registre: SHA inicial/final, agentes efetivamente executados, problemas encontrados, arquivos alterados, verificações aprovadas/falhas/não executadas. Não confunda configuração pronta com execução validada.
