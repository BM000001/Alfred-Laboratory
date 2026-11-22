# Identidade visual obrigatória — Alfred / Central de Estudos

**Status:** decisão de design aprovada; referência para produção de artes, não confirmação de implementação no código.
**Referência:** imagem "Elementos de Cenário - Pixel Art" fornecida pelo responsável em 22/11/2026.

> **REGRA OBRIGATÓRIA:** O Alfred utiliza uma identidade **verde sálvia + dourado suave + preto esverdeado**. Não reduzir a marca a preto e dourado. Não substituir o verde por azul, roxo ou verde neon em artes da Central de Estudos sem aprovação explícita.

## Tokens de referência

| Uso | Claro | Escuro |
|---|---|---|
| Fundo principal | `#F3F1EA` | `#171B18` |
| Superfícies | `#FCFAF5` | `#282E29` |
| Texto / contraste | `#212720` | `#F3F1EA` |
| Dourado | `#D8C293` | `#D8C293` |
| Verde | `#5E7F52` | `#8FAE83` |
| Complementares | `#62675E`, `#DDDCD3` | `#B8ADB5`, `#BB4435`, `#3B443D` |

Esses HEX foram transcritos da imagem de referência. Conferir contraste e acessibilidade em interface real; não presumir que já estejam implementados como tokens CSS.

## Direção de arte — mapa de aprendizagem

- **Pixel art isométrica**, construções legíveis, texturas de pedra, madeira, vegetação e metais em tons coerentes com a paleta.
- Verde presente em vegetação, acabamentos e elementos de progresso; dourado em detalhes, recompensas e conquistas; grafite esverdeado em sombras e modo escuro.
- Versões claras e escuras devem parecer o mesmo universo; não apenas aplicar um filtro de cor.
- Evitar excesso de dourado, cores saturadas fora da paleta, fundos pretos puros sem necessidade e textos ilegíveis.
- Elementos devem continuar reconhecíveis em telas pequenas de iPhone; validar contraste, escala, rótulos e estados.
- A imagem de referência ilustra Biblioteca, Campo de Treinamento, Baú de Flashcards, Portal, Castelo e Bandeira. **Não confundir ilustrações exploratórias com o escopo funcional aprovado.**

## Escopo funcional V1 do mapa

Exatamente cinco construções funcionais: **Biblioteca, Campo de Alvos, Baú de Flashcards, Laboratório e Castelo**. Permanecem visíveis em todas as unidades. Oficina, Portal e Arena são ideias futuras, não construções funcionais da V1. O Portal ilustrado na referência visual não autoriza adicioná-lo à V1.

## Checklist obrigatório antes de aprovar uma nova arte

- [ ] Usa verde, dourado e preto esverdeado como identidade, sem substituir o verde?
- [ ] Mantém pixel art isométrica e coerência com a referência?
- [ ] Combina com as demais construções nos modos claro e escuro?
- [ ] Está legível no iPhone e em telas menores?
- [ ] Respeita as cinco construções funcionais da V1?
- [ ] Foi comparada visualmente com a referência aprovada?

**Regra de mudança:** qualquer revisão da paleta ou do estilo deve ser documentada e aprovada antes de gerar novos lotes de imagens. Esta documentação não altera automaticamente a interface nem os assets existentes.
