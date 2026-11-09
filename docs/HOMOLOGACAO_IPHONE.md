# Homologação iPhone — Alfred-Laboratory

Relacionado: #8. Branch de validação: `fix/iphone-preview-main-20261108`. Esta proposta usa `main` como base funcional do Laboratório.

## O que acontece com esta proposta
- O workflow de validação executa testes e build no PR e guarda o artefato por 7 dias.
- O workflow existente `deploy-pages.yml` publica a aplicação no GitHub Pages quando mudanças chegam a `main`. Este PR não publica enquanto estiver aberto; o deploy só ocorre após merge.
- Antes de liberar testes no Safari, confirmar a URL pública gerada pelo Pages e validar carregamento, navegação e atualização.

## Isolamento de dados
- Produção: `https://bm000001.github.io/Alfred/`.
- Laboratório: `https://bm000001.github.io/Alfred-Laboratory/`.
- Esses endereços compartilham a origem `bm000001.github.io`; IndexedDB e localStorage são isolados por origem, não por caminho. Este PR atribui à build do Laboratório um banco IndexedDB e chaves localStorage próprios, e usa caches com prefixo fora do espaço `alfred-*` que o service worker de produção limpa.
- A separação está coberta por testes unitários de namespace, mas ainda exige uma verificação manual no Safari com dados fictícios antes de considerar o isolamento homologado. Não use dados pessoais reais até essa verificação terminar.
- Dados gravados antes desta correção podem já estar misturados no banco compartilhado `alfred`. A mudança não migra nem apaga esses registros: após a atualização, o Laboratório usa um banco novo e começa sem eles; o banco antigo continua intacto e pode conter dados de ambos os apps. Não importar, apagar ou migrar esses registros automaticamente.
- Antes do teste, conferir o escopo do service worker, manifest, caminhos absolutos, importação/exportação e recuperação por backup.

## Testes manuais após publicação autorizada
- Abrir a URL do Laboratório no Safari do iPhone; conferir navegação e atualização sem tela branca.
- Criar dados fictícios, recarregar e confirmar persistência.
- Conferir que dados do Alfred principal não aparecem no Laboratório e vice-versa; se aparecerem, interromper o teste e corrigir o isolamento.
- Verificar instalação PWA, modo offline e restauração de backup de teste.
- Confirmar que integrações não escrevem no calendário sem consentimento.

Este fluxo não inicia agentes autônomos. O PR continua sujeito a revisão; não autoriza merge ou uso de dados reais.
