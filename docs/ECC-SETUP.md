# ECC no fluxo de desenvolvimento do Alfred

## O que esta configuração faz

Este repositório define três papéis locais do Codex — explorador, revisor e pesquisador de documentação — em `.codex/agents/`. Eles são auxiliares de leitura; o agente principal continua responsável pelas alterações e pelo PR.

O plugin ECC fornece skills e instruções adicionais ao Codex. A configuração do repositório, sozinha, não instala o plugin no perfil do Codex. A instalação nativa é feita uma vez no ambiente em que o Codex CLI roda. Se o ECC já estiver instalado e aparecer na sessão, não repita a instalação.

## Instalação nativa, se ainda não estiver disponível

No terminal do Codespace em que este repositório está aberto, confira o Codex:

```bash
codex --version
codex plugin list --json
```

Se o plugin ECC não aparecer, adicione o marketplace e instale-o:

```bash
codex plugin marketplace add affaan-m/ECC
codex plugin add ecc@ecc
codex plugin list --json
```

Depois, reinicie a sessão do Codex e reabra este repositório. A instalação altera o perfil do Codex daquele ambiente, não o código do Alfred. Os comandos de instalação são necessários apenas nesse perfil; não precisam ser colados a cada tarefa.

Se for oferecida a ativação de hooks, revise o que cada hook executa antes de confiar nele. O uso dos papéis locais e das skills não exige aceitar hooks sem revisão.

## Como usar numa tarefa

Dê uma tarefa concreta ao Codex. Ele pode consultar os papéis locais para perguntas independentes, por exemplo: pedir ao explorador que trace o fluxo de persistência enquanto o pesquisador verifica a API usada; depois pedir ao revisor que examine o diff. A configuração permite até três agentes auxiliares, com profundidade um. Os papéis locais são somente leitura.

Para mudanças de código, use as skills ECC relevantes quando aparecerem na sessão: TDD para orientar o ciclo de teste, revisão de segurança para mudanças sensíveis e verificação final antes de propor o PR. O Codex deve confirmar quais papéis e skills realmente foram usados.

## Limites

- O catálogo aberto do ECC não disponibiliza computação de IA gratuita por si só; os agentes usam o Codex e o modelo disponíveis na sua sessão.
- Esses agentes não ficam rodando em segundo plano. Eles trabalham quando o Codex recebe uma tarefa numa sessão ativa.
- Os três papéis locais são deliberadamente poucos e especializados; não são uma cópia de todo o catálogo do ECC.
- As sugestões dos agentes precisam ser verificadas em código, documentação e CI. PRs continuam direcionados a `main`, e merge depende de autorização explícita.
- Esta configuração do repositório não instala nem altera o Alfred no dispositivo e não ativa provedores remotos no app.
