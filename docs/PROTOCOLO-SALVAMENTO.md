# Protocolo de salvamento e recuperação — Alfred

## Objetivo

Evitar perda de trabalho quando uma sessão de Claude, ChatGPT ou Codespace for interrompida, atingir limite de uso ou for substituída por outra conta.

## Regra principal

O GitHub é a fonte oficial do projeto. Um arquivo aberto ou alterado no editor não está automaticamente salvo no GitHub. O Codespace pode manter alterações locais, mas elas não ficam protegidas como histórico remoto até serem commitadas e enviadas com push.

## Frequência dos checkpoints

Criar checkpoints pequenos e frequentes:
- Depois de uma correção concluída.
- Depois de uma funcionalidade pequena.
- Depois de um conjunto coerente de arquivos.
- Sempre antes de trocar de conta, encerrar sessão ou mudar de ferramenta.

Não esperar terminar um módulo inteiro.

## Procedimento de cada checkpoint

1. Verificar `git status`.
2. Revisar `git diff` e identificar arquivos novos/alterados.
3. Executar testes aplicáveis e build quando possível.
4. Verificar que nenhum segredo, token, arquivo .env ou dado pessoal será enviado.
5. Fazer commit em branch de trabalho.
6. Fazer `git push`.
7. Confirmar o push e conferir novamente `git status`.
8. Atualizar `CONTINUIDADE.md` com branch, commit, resumo, testes e próximo passo.

Só declarar “salvo no GitHub” após confirmar o push.

## Quando o push falhar

- Não descartar, resetar ou limpar alterações.
- Não trocar de Codespace nem apagar o ambiente.
- Criar um patch local com as alterações não commitadas e staged.
- Informar o caminho exato do backup e que ele ainda não está no GitHub.
- Retomar o envio assim que a conexão/permissão voltar.

## Segurança

Nunca commitar credenciais, tokens, senhas, chaves privadas, arquivos .env ou dados pessoais. Nunca executar `git reset --hard`, `git clean -fd` ou force push para “resolver” uma árvore de trabalho suja.

## Papel do CI

O GitHub Actions executa testes e build sobre commits/pull requests já enviados. CI não faz autosave e não protege alterações que ficaram apenas no computador/Codespace.

## Regra para agentes

Claude e ChatGPT devem ler este protocolo no início de cada sessão e segui-lo. A documentação de continuidade deve ser atualizada em cada checkpoint relevante.
