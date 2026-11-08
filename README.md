# Alfred

Assistente pessoal de produtividade e estudos, com foco em **privacidade** e **funcionamento local**.

> Status: **Etapa 1** (base técnica do MVP). Ainda não é uma versão de uso diário.

## O que o Alfred faz nesta etapa

- Tarefas, disciplinas e notas, armazenadas **no próprio aparelho** (IndexedDB).
- Exportação e importação de backup (arquivo JSON, opcionalmente criptografado com senha).
- Adaptador **Manual** para IA: o Alfred gera um texto que você copia para o serviço de IA de sua escolha e, depois, cola a resposta de volta como nota.
- Interface responsiva, instalável como PWA, para computador e iPhone, servida por HTTPS.

## O que o Alfred não faz (ainda)

- Não possui backend nem login remoto. A versão publicada no GitHub Pages é estática e funciona localmente no dispositivo.

- Não envia dados a nenhum serviço de IA automaticamente. A conexão direta com provedores externos não está implementada.
- Não integra com o Canvas LMS (planejado, aguardando verificação das políticas institucionais).
- Não sincroniza entre dispositivos (planejado para etapa futura, com a estrutura de dados já preparada).
- Não usa modelo local nem voz.
- Não exige nenhuma assinatura ou API paga.

## Princípios

1. **Dados pessoais ficam no aparelho.** Nenhum dado do usuário passa pela hospedagem do site, que entrega apenas arquivos públicos.
2. **Nada sai sem ação explícita.** A exportação manual exige revisão e confirmação das classes de dados antes de copiar; o Alfred não faz envio de rede.
3. **Sem dependência obrigatória de serviço pago.**
4. **Arquitetura independente de provedor de IA.** O núcleo não importa SDK de nenhum serviço.

## Desenvolvimento

Requisitos: Node.js 20 ou superior.

```
npm install
npm test       # executa os testes automatizados
npm run build  # verifica os tipos e gera o site estático em dist/
```

Para testar localmente, sirva a pasta `site/` por qualquer servidor estático. Para instalar no iPhone, é preciso HTTPS (ver `docs/testes-manuais-iphone.md`).

## Documentação

- `docs/decisoes.md`: decisões registradas e seus motivos.
- `docs/arquitetura.md`: camadas, formato de backup e regras de privacidade.
- `docs/status-etapa-1.md`: o que foi feito, testes executados e limitações conhecidas.
- `docs/testes-manuais-iphone.md`: roteiro de testes que exigem dispositivo real.
- `docs/ECC-PILOTO.md`: instalação e avaliação do ECC como ferramenta opcional de desenvolvimento no Codex.
- `NOTICE.md` e `THIRD_PARTY.md`: atribuições e licenças de dependências.

## Licença

**Pendente de decisão.** Veja `docs/decisoes.md`.
