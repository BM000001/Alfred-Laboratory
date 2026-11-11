# Identidade visual experimental — integração segura
Fonte de referência: PR #7 (`experiment/alfred-brand-identity`), cujo histórico não é comum ao da `main` atual. Esta branch **não faz merge integral** do PR #7, pois isso poderia sobrescrever calendário, persistência e navegação recentes.

## Portado
- Marca A, wordmark e mascote em `public/brand/`.
- Símbolo no cabeçalho com caminho independente da hospedagem (base do Vite) e favicon.
- Mascote no assistente reagindo a processamento, proposta pendente, erro e repouso; não afirma escuta ou fala.
- Acessibilidade, aria-label e respeito a `prefers-reduced-motion`.
- Testes de existência/visibilidade da identidade na navegação.

## Preservado
- Calendário central do PR #36, seus registros e integrações.
- Banco local, backups, permissões e comportamento pré-existente.
- Nenhuma alteração ao repositório principal `BM000001/Alfred`.

## Não concluído
- Atualização dos ícones binários PWA e identidade final, sujeitas a validação visual.
- Testes manuais em iPhone Safari, acessibilidade por leitor de tela e animações.
- Port completo do manual e variantes de layout do designer; PR #7 continua histórico experimental.

## Portões
Rodar testes e build, revisar diffs, mesclar apenas no laboratório, confirmar GitHub Pages com a versão publicada e abrir o site no Safari com dados fictícios.
