# Dependências de terceiros

Dependências de desenvolvimento usadas no build e nos testes. Nenhuma biblioteca é incluída no código entregue ao usuário, exceto o que aparece no site gerado.

| Pacote | Uso | Versão | Licença | Situação |
|---|---|---|---|---|
| typescript | compilação | ~6.0.3 | Apache-2.0 | verificar com `npm ls --long` após a instalação |
| @types/node | tipos para testes | ~25.6.0 | MIT | verificar com `npm ls --long` após a instalação |

Dependências de runtime no navegador: nenhuma. O aplicativo usa apenas APIs nativas do navegador (IndexedDB, Web Crypto, Service Worker, Cache API).

Qualquer nova dependência precisa ser registrada aqui com a licença verificada antes de ser adicionada.

- PDF.js (`pdfjs-dist`): Apache-2.0. Used locally in the browser to extract selectable text from PDF files; no document content is sent to a remote service.
