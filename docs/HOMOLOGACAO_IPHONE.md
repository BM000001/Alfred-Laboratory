# Homologação iPhone — Alfred-Laboratory

Relacionado: #8. Branch de validação: `fix/iphone-preview-main-20261108`. Esta proposta usa `main` como base funcional do Laboratório.

## O que acontece com esta proposta
- O workflow de validação executa testes e build no PR e guarda o artefato por 7 dias.
- O workflow existente `deploy-pages.yml` publica a aplicação no GitHub Pages quando mudanças chegam a `main`. Este PR não publica enquanto estiver aberto; o deploy só ocorre após merge.
- Antes de liberar testes no Safari, confirmar a URL pública gerada pelo Pages e validar carregamento, navegação e atualização.

## Isolamento de dados
- Produção: `https://bm000001.github.io/Alfred/`.
- Laboratório: `https://bm000001.github.io/Alfred-Laboratory/`.
- Esses endereços compartilham a origem `bm000001.github.io`; IndexedDB é isolado por origem, não por caminho. Portanto, **não use dados pessoais reais** no Laboratório. Teste apenas com dados fictícios até haver isolamento por domínio ou namespace de armazenamento implementado e verificado.
- Antes do teste, auditar escopo do service worker, manifest, caches, links absolutos, importação/exportação e recuperação por backup.

## Testes manuais após publicação autorizada
- Abrir a URL do Laboratório no Safari do iPhone; conferir navegação e atualização sem tela branca.
- Criar dados fictícios, recarregar e confirmar persistência.
- Conferir que dados do Alfred principal não aparecem no Laboratório e vice-versa; se aparecerem, interromper o teste e corrigir o isolamento.
- Verificar instalação PWA, modo offline e restauração de backup de teste.
- Confirmar que integrações não escrevem no calendário sem consentimento.

Este fluxo não inicia agentes autônomos. O PR continua sujeito a revisão; não autoriza merge ou uso de dados reais.
