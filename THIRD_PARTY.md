# Dependências de terceiros

Dependências diretas de runtime incluídas no Alfred-Laboratory. Licenças consultadas nos metadados dos pacotes instalados em 11/11/2026; esta lista não substitui uma auditoria das dependências transitivas.

| Pacote | Uso | Versão | Licença |
|---|---|---:|---|
| react | Interface | 19.3.1 | MIT |
| react-dom | Renderização da interface | 19.3.1 | MIT |
| pdfjs-dist | Extração local de PDFs e renderização para OCR | 6.5.438 | Apache-2.0 |
| tesseract.js | OCR local opcional no navegador | 7.0.0 | Apache-2.0 |
| tesseract.js-core | Núcleo WebAssembly do OCR | 7.0.0 | Apache-2.0 |
| @tesseract.js-data/por | Modelo português para OCR offline | 1.0.0 | MIT |
| fflate | Leitura local dos pacotes ZIP OOXML DOCX/PPTX | 0.8.3 | MIT |

PDFs, DOCX, PPTX e texto são processados no navegador. A extração, a geração local de recursos e os materiais não são enviados a provedores externos. O OCR utiliza assets locais do próprio Alfred e só começa mediante ação explícita na área Arquivos.

O pacote `@tesseract.js-data/por` e os núcleos WebAssembly representam download significativo quando o OCR é utilizado; não são necessários para ler DOCX/PPTX nem entram no fluxo inicial de geração de recursos.

## Identidade visual
- Mascote dourado: arte aprovada pelo proprietário e hospedada localmente em `src/assets/alfred.png`.
- Fontes Noto: arquivos e licença original estão em `src/assets/fonts/`; nenhuma fonte é carregada de um serviço externo.
