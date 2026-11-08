# Guia de animação e comportamento do mascote Alfred

## Objetivo

Dar vida ao mascote sem torná-lo invasivo. A animação deve reforçar estados reais do assistente, manter a leitura da interface e respeitar preferências de movimento reduzido.

## Estados visuais

| Estado | Gatilho de interface | Movimento sugerido | Duração |
|---|---|---|---|
| Idle | Sem atividade | Respiração quase imperceptível e brilho suave dos olhos | Loop lento |
| Listening | Captura de voz ativa | Leve inclinação da cabeça; pulso discreto nos olhos | 500–800 ms |
| Thinking | Processamento iniciado | Inclinação curta da cabeça e pequenos pontos/anel de progresso | 1–2 s, sem loop acelerado |
| Speaking | Resposta falada | Pequena oscilação de cabeça/ombros sincronizada com a fala, se houver áudio | Conforme áudio |
| Success | Ação concluída | Aceno curto ou brilho dourado único | 400–700 ms |
| Warning | Atenção necessária | Inclinação curta e mudança sutil de luz, sem alarme agressivo | 400–600 ms |
| Sleeping | Assistente inativo, se aplicável | Olhos fechados e movimento suspenso | Loop muito lento |

## Regras de produto

1. Não simular escuta, processamento ou conclusão quando esses estados não estiverem realmente ativos.
2. Não bloquear ações nem atrasar respostas para exibir animações.
3. Evitar movimento constante em áreas de leitura.
4. Respeitar `prefers-reduced-motion`: substituir deslocamentos e loops por transições estáticas ou breves fades.
5. Manter o mascote opcional e permitir desativar animações.
6. Em telas pequenas, preferir o símbolo A ao mascote completo.
7. Não usar a estrela como indicador de estado se isso puder ser confundido com notificações do sistema.

## Princípios de implementação

- Preferir SVG/CSS para estados simples e leves.
- Separar o componente visual do estado funcional do assistente.
- Usar uma única máquina de estados ou fonte de verdade para os estados do mascote.
- Não introduzir dependências de animação antes de avaliar o bundle atual.
- Não animar automaticamente em todas as rotas; limitar o mascote às áreas em que agrega contexto.

## Checklist de aceitação

- [ ] O personagem é reconhecível em repouso e em monocromia.
- [ ] Os estados correspondem a eventos reais da aplicação.
- [ ] Movimento reduzido foi testado.
- [ ] As animações não causam layout shift.
- [ ] O desempenho foi conferido em dispositivo móvel.
- [ ] O símbolo A continua legível a 16, 24 e 32 px.
- [ ] A versão final foi comparada em fundos claros e escuros.

## Estado atual

Este documento especifica a próxima etapa. Não significa que as animações já estejam implementadas ou conectadas aos estados funcionais.


## Estados integrados na interface (primeira versão)

O componente `AlfredMascot` está conectado aos estados já existentes na tela do Assistente:

- `idle`: disponível quando não há processamento, proposta pendente ou erro.
- `thinking`: durante processamento ou confirmação/salvamento em andamento.
- `curious`: enquanto existe uma proposta aguardando confirmação explícita do usuário.
- `warning`: quando a interface apresenta um erro.

A implementação atual altera aura, indicador e inclinação sutil. Não afirma que o mascote escuta ou fala; esses estados só devem ser adicionados quando houver captura de voz ou reprodução de áudio efetivamente conectadas.


## Microanimações implementadas

- Piscada periódica dos olhos no SVG do mascote.
- Respiração visual quase imperceptível no estado `idle`.
- Inclinação/oscillação curta durante `thinking`.
- As animações são desativadas ou reduzidas com `prefers-reduced-motion: reduce`.
- Nenhum estado novo foi inventado: as animações usam as classes de humor já conectadas aos estados reais da interface.

A piscada é parte do SVG externo. Caso um navegador ou contexto bloqueie animação SMIL/CSS em imagens SVG, o mascote continua estático e funcional; verificar esse comportamento em Safari iOS e navegadores desktop.
