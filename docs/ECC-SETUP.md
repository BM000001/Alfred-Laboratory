# Preparação da equipe Codex/ECC

A equipe tem oito papéis locais em `.codex/agents/`, detalhados em [EQUIPE-AGENTES.md](EQUIPE-AGENTES.md). A configuração segue o formato atual de arquivos TOML independentes com name, description e developer_instructions. O limite é de três auxiliares simultâneos, sem modelo fixado.

As permissões são herdadas da sessão principal. As instruções para não editar não constituem um sandbox por agente. Configure as permissões da sessão conforme a tarefa. Nenhum hook ou servidor MCP é ativado por estes arquivos.

## ECC
Os papéis locais funcionam independentemente do plugin ECC. Quando instalado, use suas skills pertinentes à tarefa. Não afirme uso de ECC sem carregar a skill.
Se o plugin já consta no perfil, não reinstale. Confira com:
```bash
codex --version
codex plugin list --json
```
Se ausente, o caminho documentado pelo ECC é:
```bash
codex plugin marketplace add affaan-m/ECC
codex plugin add ecc@ecc
```
Reinicie a sessão após instalar. A instalação pertence ao perfil daquele ambiente; não se repete por tarefa. Revise hooks separadamente.

## Aceite operacional
1. Abra a branch com a configuração num Codex compatível e confiável.
2. Solicite ao coordenador explorer e reviewer para analisar um arquivo existente sem editar.
3. Confira que ambos iniciaram e devolveram evidências reais. Registre versão do Codex, SHA e resultados.
4. Execute o piloto descrito no guia da equipe antes de declarar implantação validada.

Sintaxe válida e CI do app não provam carregamento ou execução dos agentes. Este PR não instala o Codex, não autentica contas e não fornece computação gratuita ou operação contínua.

Fontes consultadas em 2026-11-09:
- https://learn.chatgpt.com/docs/agent-configuration/subagents
- https://github.com/affaan-m/ECC
