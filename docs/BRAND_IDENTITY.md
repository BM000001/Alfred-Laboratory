# Identidade visual do Alfred

## Direção aprovada

A identidade do Alfred combina um conselheiro sábio e discreto com uma figura modular, geométrica e acolhedora. A referência é conceitual: não reproduzir personagens, uniformes, minifiguras, logotipos ou elementos visuais proprietários de terceiros.

## Sistema de marca

- **Marca principal:** mascote + wordmark ALFRED.
- **Marca secundária:** wordmark ALFRED.
- **Símbolo reduzido:** letra A geométrica com estrela central.
- **Ícone de aplicativo:** símbolo A em fundo grafite/preto.
- **Mascote:** personagem humanoide compacto, cabeça geométrica angular, olhos luminosos simples, ombros estruturados e roupa formal estilizada.

## Paleta inicial

| Token | Cor | Uso |
|---|---|---|
| Grafite | #101116 | Fundo escuro e superfícies |
| Preto | #08090C | Contraste e ícone |
| Ouro | #D9A64E | Símbolo e destaques |
| Ouro claro | #F7D99A | Realces |
| Prata | #AEB3BD | Elementos neutros |

## Arquivos

- `public/brand/alfred-mark.svg`: símbolo A.
- `public/brand/alfred-wordmark.svg`: assinatura tipográfica.
- `public/brand/alfred-mascot.svg`: mascote vetorial conceitual.

## Regras de uso

1. Preferir o símbolo A em espaços pequenos.
2. Usar o conjunto mascote + wordmark em apresentações e telas de boas-vindas.
3. Manter contraste suficiente em fundos claros e escuros.
4. Não depender de efeitos 3D, brilho ou gradientes para reconhecer o símbolo.
5. Preservar a legibilidade em tamanhos reduzidos.
6. Tratar estes SVGs como primeira versão vetorial de trabalho; validar proporções, acessibilidade e aplicação real antes de substituir todos os ícones e assets do aplicativo.

## Próxima etapa

Integrar o símbolo ao cabeçalho, favicon e ícones PWA; revisar o mascote e validar visualmente as telas em celular e desktop sem alterar fluxos funcionais.


## Refinamento de direção — mascote e aplicações

### Silhueta aprovada para exploração
- Cabeça facetada e compacta, com topo levemente inclinado e laterais estruturadas; evitar aparência de capacete ou esfera genérica.
- Olhos simples e luminosos, sem boca detalhada obrigatória.
- Ombros largos em relação ao tronco, postura vertical e base firme para transmitir presença.
- Roupa formal estilizada: gola/colarinhos e gravata como assinatura visual, sem copiar uniformes de personagens existentes.
- Detalhes dourados devem funcionar como acentos, não como contorno em todas as peças.

### Regras para o símbolo A
- O A deve continuar legível em monocromia e em 16–24 px.
- A estrela central é um detalhe secundário; testar também uma versão sem estrela para tamanhos muito pequenos.
- Não usar gradiente como requisito para reconhecimento: preparar versões flat dourada, branca e preta.
- O ícone deve ter margem de segurança e fundo sólido para boa leitura em telas pequenas.

### Próxima validação visual
1. Conferir a cabeça e a silhueta em tamanhos 24 px, 48 px e 256 px.
2. Conferir contraste em tema claro e escuro.
3. Comparar o símbolo A com e sem estrela.
4. Verificar se o mascote funciona em uma cor só antes de aprovar animações.
5. Só então substituir os demais elementos da interface e os ícones PNG do PWA.

### Estado
Esta é uma proposta inicial de identidade, ainda sujeita a revisão visual e validação técnica. A arte conceitual de apresentação não substitui os arquivos vetoriais de produção.
