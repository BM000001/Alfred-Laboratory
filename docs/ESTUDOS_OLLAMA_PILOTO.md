# Piloto local de exercícios com Ollama

O banco de questões aceita sugestões de até três questões de múltipla escolha a partir de arquivos já processados e vinculados a uma unidade. O piloto está disponível somente no servidor de desenvolvimento em `http://127.0.0.1:5173`, quando habilitado explicitamente. O navegador envia até três trechos do texto extraído ao Ollama no mesmo computador. A geração começa por ação do usuário. Apenas questões aprovadas individualmente são salvas no banco local.

## Executar no computador

1. Instale o [Ollama](https://ollama.com/download) e o Node.js 22 ou superior. Use um perfil de navegador de teste e material sintético.
2. Pare qualquer instância do Ollama que já esteja ouvindo na porta 11434. Em um terminal, inicie o serviço local:

   ```sh
   OLLAMA_HOST=127.0.0.1:11434 OLLAMA_ORIGINS=http://127.0.0.1:5173 OLLAMA_NO_CLOUD=1 OLLAMA_DEBUG_LOG_REQUESTS=0 ollama serve
   ```

3. Em outro terminal, na raiz do Laboratory, baixe o modelo e inicie o Alfred. O modelo ocupa aproximadamente 986 MB. O download inicial precisa de rede.

   ```sh
   ollama pull qwen2.5:1.5b-instruct-q4_K_M
   npm install
   VITE_ALFRED_LOCAL_OLLAMA=1 npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
   ```

   Em PowerShell, atribua as variáveis com `$env:NOME = 'valor'` antes de executar o respectivo comando.

4. Abra `http://127.0.0.1:5173` nesse computador. Em **Aprender**, crie uma disciplina, importe um TXT sintético pelo menu **Criar → Adicionar material** e espere o processamento. Em **Unidades**, abra **Praticar** na unidade do arquivo.
5. Clique em **Gerar e revisar questões no Ollama**. A execução pode levar alguns minutos em CPU e pode ser cancelada. Confira enunciado, alternativas, resposta, explicação e citação. Se a citação sustentar a resposta e a explicação, clique em **Aprovar e salvar**. Caso contrário, descarte a sugestão.
6. Inicie um simulado e corrija uma resposta. Recarregue a página, volte à unidade e confira a questão e o histórico. Encerre o Ollama ao terminar o teste.

Exemplo de `terra.txt`:

```text
A rotação da Terra é o movimento da Terra em torno do seu próprio eixo.

Uma rotação da Terra leva aproximadamente 24 horas.

A rotação da Terra explica a alternância entre o dia e a noite.
```

A validação automática confirma o formato, os vínculos e a presença literal das citações. A revisão humana confirma se elas sustentam as questões. A seleção inicial usa os primeiros trechos aproveitáveis da extração. Conflitos de definição detectados pelas regras existentes bloqueiam a geração. Outros tipos de contradição podem depender de revisão. A ausência do Ollama afeta somente a geração opcional.

## Testes

```sh
npm test
npm run build
npm run build:pages
VITE_ALFRED_OLLAMA_LIVE=1 npx vitest run --disableConsoleIntercept src/modules/studies/ollamaStudyEnhancement.live.test.ts
```

A suíte padrão usa respostas controladas para testar material insuficiente, contradição, citação, JSON, cancelamento, repetição, aprovação, persistência e indisponibilidade. O teste opcional chama o runtime real no loopback e imprime versão, digest, duração e quantidades geradas e aceitas pela validação, junto das sugestões sintéticas.

## Evidência do piloto em 20/11/2026

Em Chromium, o aplicativo importou `terra.txt` pela interface, processou o material localmente e chamou o Ollama 0.40.16 em loopback com `qwen2.5:1.5b-instruct-q4_K_M`. O digest do modelo foi `65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b`.

O Ollama registrou **59,4 s** para a chamada. Das **3 sugestões** geradas, **2 passaram pelo filtro e foram aprovadas e salvas no teste**. A terceira repetia a resposta correta em uma alternativa errada. As duas aprovadas perguntavam o que é a rotação da Terra e quantas horas ela leva. A segunda citava literalmente “Uma rotação da Terra leva aproximadamente 24 horas.” O teste recarregou o aplicativo, encontrou as duas questões, respondeu uma delas num simulado e confirmou o histórico de **1/1** após uma segunda recarga.
