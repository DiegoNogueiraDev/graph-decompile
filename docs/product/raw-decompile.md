Sim — **JavaScript/TypeScript é viável**, mas com um recorte muito claro: **TS/Node deve ser a camada de produto, orquestração e integração MCP**, enquanto o **core pesado de decompilação/análise binária** deve reaproveitar motores já maduros como **Ghidra** e **angr**, que já oferecem disassembly, decompilação, lifting/IR, CFG e análises de simplificação. O SDK oficial do MCP em TypeScript roda em Node.js, Bun e Deno, então a camada MCP em TS é um encaixe natural. Já o Ghidra é um framework de SRE com decompilação, scripting e modo headless; o angr já expõe lifting, AIL, CFG e pipeline de simplificação para pseudocódigo. ([GitHub][1])

A resposta prática é: **não tente escrever o decompilador inteiro em TS**. Isso te colocaria para reimplementar décadas de trabalho em lifting, recuperação de controle, calling conventions, arquiteturas e validação. O que faz sentido é construir um **“Decompilation Orchestrator MCP”** em TypeScript, instalado por `npm i -g`, que coordena binários locais e chama ferramentas nativas/headless por trás. Esse modelo já existe na prática: há projetos MCP conectando Ghidra a agentes via linha de comando, como o `pyghidra-mcp`, que usa `pyghidra`/`jpype` para expor a análise do Ghidra por MCP. ([GitHub][2])

## Julgamento frio sobre TS/JS

**TS é excelente para:**

* CLI global via npm
* servidor MCP
* coordenação de jobs
* cache local e indexação de artefatos
* serialização de IR/CFG/SSA em JSON
* integração com LLMs
* políticas de fallback e validação
* UX de linha de comando e configuração por projeto. ([GitHub][1])

**TS não é a melhor escolha para:**

* disassembler de múltiplas arquiteturas
* lifting para IR baixo nível
* symbolic execution sério
* equivalence checking profundo
* recuperação robusta de CFG complexa
* parsing PE/ELF/Mach-O com nível de maturidade comparável a Ghidra/angr. ([Angr Documentation][3])

Então a melhor arquitetura é esta:

# Arquitetura real proposta

## 1) Camada de distribuição e execução

Você publica um pacote global, por exemplo:

```bash
npm install -g genai-decompiler-mcp
```

Esse pacote instala um binário Node, algo como:

```bash
gdmcp
```

Ele sobe um servidor MCP via stdio/http e registra ferramentas como:

* `analyze_binary`
* `decompile_function`
* `recover_types`
* `explain_function`
* `validate_equivalence`
* `rename_symbols`
* `export_ir`
* `compare_variants`
* `triage_obfuscation`
* `build_patch_candidate`. ([GitHub][1])

Essa camada em TS usa o SDK oficial do MCP e roda muito bem como pacote npm global. ([GitHub][1])

## 2) Camada de motores locais

Aqui entram os backends reais:

* **Ghidra headless** para importação do binário, autoanálise, decompilação, acesso a P-Code, símbolos, strings, call graph e scripting. O Ghidra suporta modo headless e scripting; há exemplos e toolkits voltados a esse fluxo. ([GitHub][4])
* **angr** para lifting, CFG recovery, AIL, simplificação, symbolic/concolic execution e checks de consistência. ([Angr Documentation][3])
* **Triton** como opcional futuro para análise dinâmica/simbólica mais focada em verificação ou execução instrumentada; ele é frequentemente citado como base para construir ferramentas próprias de análise e verificação binária. ([GitHub][5])

O TS não reimplementa isso. Ele chama esses motores via:

* subprocesso CLI
* JSON over stdio
* arquivos temporários
* ou um pequeno daemon local Python/Java bridge. ([GitHub][2])

## 3) Camada de IR canônica do produto

Esse é o coração do seu produto.

Você cria uma **IR intermediária própria do produto**, não para substituir P-Code ou AIL, mas para **normalizar saídas heterogêneas**. Exemplo:

```ts
type CanonicalFunction = {
  id: string
  arch: "x86_64" | "arm64" | "armv7"
  address: string
  name?: string
  confidence: number
  blocks: BasicBlock[]
  edges: Edge[]
  variables: VarNode[]
  calls: CallSite[]
  strings: StringRef[]
  types: TypeHint[]
  pseudocode?: string
  sourceHints?: SourceHint[]
  semantics: SemanticFacts
}
```

Essa IR vira o contrato interno entre:

* Ghidra
* angr
* módulo de IA
* validador
* cache
* exportadores.

Isso é importante porque Ghidra e angr têm representações diferentes; seu sistema precisa de uma “língua franca” para o MCP e para o LLM. A ideia se apoia diretamente no valor prático de lifting/IR mostrado no SoK de binary lifters. ([Angr Documentation][3])

## 4) Camada determinística

Tudo que for estável fica aqui:

* parsing de binário
* identificação de arquitetura
* importação para projeto
* CFG
* call graph
* detecção de funções
* lifting
* simplificações seguras
* propagação de constantes
* copy propagation
* detecção de retornos
* construção de use-def
* recuperação de regiões estruturais quando possível
* extração de strings, imports e syscalls
* matching de idioms compilador→alto nível conhecidos. ([Angr Documentation][3])

O angr documenta explicitamente várias dessas simplificações no decompilador AIL, como constant folding, copy propagation, dead assignment elimination e peephole optimizations. ([Angr Documentation][3])

## 5) Camada GenAI

A IA entra depois que o sistema já possui:

* IR canônica
* pseudocódigo bruto
* fatos semânticos
* constraints
* imports/API usage
* strings
* contexto do projeto
* histórico do usuário
* regras de validação.

A IA fica responsável por:

* sugerir nomes de variáveis e funções
* reconstruir typedefs/structs/enums prováveis
* melhorar legibilidade
* explicar intenção
* mapear trechos para padrões conhecidos
* propor equivalentes idiomáticos
* gerar comentários
* comparar múltiplas hipóteses.

Isso é coerente com a literatura recente, que mostra que a parte “humana” e subespecificada do código é onde os decompiladores neurais/LLM mais agregam. ([GitHub][2])

## 6) Camada de validação

Esse ponto precisa ser obrigatório, senão vira demo.

Para cada hipótese gerada pela IA:

1. aplicar a transformação na IR/pseudocódigo
2. recompilar quando possível
3. comparar função original e reconstruída
4. rodar checks sintáticos/semânticos
5. aceitar apenas se a confiança passar do limiar.

Isso segue a linha defendida pelos trabalhos de equivalência/translation validation que discutimos antes e é o que separa um “copilot de reverse” de uma ferramenta séria. O valor do angr em symbolic analysis ajuda bastante aqui. ([GitHub][6])

---

# Cenários reais de uso

## Cenário 1: engenharia reversa de binário interno sem fonte

Uma empresa tem um agente legado em C/C++ sem fonte atualizado em campo. Ela precisa entender um módulo de atualização OTA.

Fluxo:

* usuário roda `gdmcp analyze ./agent.bin`
* TS aciona Ghidra headless e angr
* sistema produz call graph, lista de funções críticas e pseudocódigo
* LLM explica funções candidatas com base em strings, imports e fluxos
* usuário pede `explain_function update_firmware`
* sistema mostra fluxo de validação, checks de assinatura e possíveis pontos de rollback.

Aqui a parte determinística encontra as funções e estrutura; a IA ajuda na leitura e priorização. ([GitHub][4])

## Cenário 2: triagem de malware

Analista recebe um sample e quer isolar:

* anti-debug
* network beaconing
* persistence
* crypto usage.

Fluxo:

* backend extrai imports, strings, chamadas sensíveis, regiões suspeitas
* IA resume os comportamentos e produz um relatório narrativo
* Ghidra/angr sustentam a evidência concreta
* MCP permite que um agente faça perguntas iterativas sem reprocessar tudo. ([GitHub][4])

## Cenário 3: diff entre duas versões

Você tem `v1.dll` e `v2.dll` e quer saber o que mudou.

Fluxo:

* normaliza funções das duas builds
* faz diff estrutural em IR
* usa IA para explicar alterações em termos de negócio ou segurança
* mostra “essa função agora valida assinatura antes da gravação” em vez de apenas diff de assembly.

Esse é um caso excelente para produto porque entrega valor real e é mais controlável que “decompilar tudo perfeitamente”.

## Cenário 4: geração de patch candidate

Você detecta uma checagem incorreta numa função simples.

Fluxo:

* sistema identifica a função
* IA propõe reescrita de alto nível
* backend recompila ou traduz a mudança mínima
* validador checa equivalência parcial e side effects
* gera patch candidate ou script Ghidra para aplicar alteração.

Aqui a IA não toca o binário cru; ela propõe mudança em nível semântico.

## Cenário 5: decompilação guiada por contexto do projeto

Você pluga o servidor MCP a um workspace de código e documentação.

* O binário foi compilado a partir de um projeto conhecido.
* O sistema usa símbolos restantes, nomes de API, convenções do repo e docs internas.
* A IA melhora os nomes e tipos com contexto de domínio.

Esse cenário é muito forte para integração com o seu ecossistema mcp-graph/context layer.

---

# Avaliação de distribuição: npm global e pasta de binários

Para o que você quer, a forma mais realista é:

## Opção recomendada

**npm global + dependências externas opcionais detectadas em runtime**

Exemplo:

* `gdmcp` instala via npm
* no primeiro uso ele detecta:

  * Java/Ghidra
  * Python/angr
  * diretórios configurados
* guarda isso em `~/.gdmcp/config.json`
* faz download de scripts auxiliares ou valida caminhos.

Isso é bem mais sustentável que empacotar tudo em um único executável Node. O motivo é simples: empacotamento de apps Node em binário único existe, mas o `vercel/pkg` está arquivado desde janeiro de 2024, e o `nexe` ainda existe, porém há sinais de atrito/fragilidade em versões mais novas do Node e em fluxos TS modernos. Para um produto que depende de Java, Python e ferramentas nativas, “single binary” tende a piorar a operação, não melhorar. ([GitHub][7])

## Conclusão de distribuição

**Não recomendo perseguir single executable no MVP.**
Recomendo:

* npm global para o orquestrador
* Ghidra instalado separadamente ou apontado por config
* ambiente Python local isolado para angr
* scripts de bootstrap automáticos. ([GitHub][2])

---

# Stack sugerida

## Camada principal

* **Node.js 20+**
* **TypeScript**
* `@modelcontextprotocol/sdk`
* `zod` para schemas
* `commander` ou `yargs` para CLI
* `execa` para subprocessos
* `better-sqlite3` para cache local
* `pino` para logs
* `tsx`/`tsup` para build. ([GitHub][1])

## Backends

* **Ghidra headless**
* **Python 3.11+**
* **angr**
* opcional futuro: **Triton**. ([GitHub][4])

## Armazenamento local

* SQLite para catálogo e cache
* diretório de artefatos por hash do binário:

  * IR
  * CFG
  * pseudocódigo
  * embeddings/hints
  * relatórios
  * diffs.

---

# Estrutura de projeto recomendada

```text
genai-decompiler-mcp/
  packages/
    cli/
    mcp-server/
    core-contracts/
    orchestration/
    llm-adapter/
    validation/
    storage/
    ghidra-adapter/
    angr-adapter/
  python/
    angr_worker/
  ghidra/
    scripts/
    extensions/
  examples/
  docs/
```

## Papel dos módulos

### `cli`

Comandos globais:

* `gdmcp doctor`
* `gdmcp analyze <binary>`
* `gdmcp decompile <binary> --function main`
* `gdmcp explain <binary> --function sub_401200`
* `gdmcp diff old.bin new.bin`
* `gdmcp serve`

### `mcp-server`

Expõe tools e resources MCP.

### `core-contracts`

Schemas TS para IR canônica, jobs, resultados, erros e confiança.

### `orchestration`

Coordena pipeline, retries, timeouts, fallback entre Ghidra e angr.

### `ghidra-adapter`

Roda headless scripts, coleta JSON, converte P-Code/pseudocode/meta.

### `angr-adapter`

Aciona worker Python e converte AIL/CFG/analysis para contratos internos.

### `llm-adapter`

Conecta Gemini/OpenAI/Claude/local model, sempre com prompts estruturados.

### `validation`

Regras sintáticas, checks semânticos, diff de hipóteses, score final.

### `storage`

SQLite + cache de arquivos.

---

# Fluxo detalhado do pipeline

## Fase A — ingestão

1. usuário passa caminho do binário
2. calcula hash
3. detecta formato PE/ELF/Mach-O
4. detecta arquitetura e bits
5. cria workspace local.

## Fase B — análise determinística primária

1. Ghidra headless importa e analisa
2. angr carrega e tenta CFG/AIL
3. extrai funções, blocos, strings, imports, relocs
4. normaliza tudo na IR canônica. ([Angr Documentation][3])

## Fase C — enriquecimento

1. heurísticas de nomeação com imports/strings
2. clustering de funções por comportamento
3. detecção de idioms
4. score de confiabilidade por função.

## Fase D — IA controlada

1. seleciona funções onde IA pode agregar
2. envia contexto mínimo e estruturado
3. pede:

   * nomes
   * explicação
   * hipótese de tipo
   * pseudocódigo refinado
4. recebe múltiplas hipóteses ranqueadas.

## Fase E — validação

1. lint/parse
2. coerência com IR
3. checagem de invariantes
4. recompilação parcial quando suportado
5. score final e aceite/rejeição.

## Fase F — exposição MCP

1. tools retornam resposta estruturada
2. resources expõem relatórios, IR, grafos e histórico
3. prompts prontos permitem workflows iterativos com LLM host. ([GitHub][1])

---

# Plano detalhado de construção

## Sprint 0 — prova de realidade

Objetivo: provar que o stack roda local sem fantasia.

Entregas:

* CLI TS com `gdmcp doctor`
* detecção de Java, Ghidra, Python, angr
* comando `gdmcp analyze sample.bin`
* chamada real ao Ghidra headless
* chamada real ao worker angr
* salvar JSON bruto de ambos.

Critério de pronto:

* analisar um ELF ou PE simples e produzir artefatos locais válidos.

## Sprint 1 — contratos e normalização

Objetivo: criar a IR canônica.

Entregas:

* schemas `zod`
* mapeadores Ghidra→IR
* mapeadores angr→IR
* persistência SQLite
* diff de funções por hash/endereço.

Critério:

* abrir um binário e listar funções, blocos, imports e strings em um formato único.

## Sprint 2 — servidor MCP

Objetivo: expor valor real para agentes.

Entregas:

* `serve` via stdio
* tools:

  * `list_functions`
  * `get_function`
  * `decompile_function`
  * `explain_function`
  * `export_cfg`
* resources:

  * report do binário
  * índice de funções
  * artefatos de análise.

Critério:

* Claude/Desktop/host MCP consegue interagir e responder sobre o binário.

## Sprint 3 — camada de IA controlada

Objetivo: usar GenAI sem perder confiabilidade.

Entregas:

* prompts estruturados por tarefa
* contexto mínimo por função
* geração de nomes e comentários
* score de confiança
* storage de hipóteses.

Critério:

* melhorar legibilidade de funções selecionadas sem quebrar invariantes simples.

## Sprint 4 — validação séria

Objetivo: reduzir alucinação.

Entregas:

* checks estruturais
* comparação entre hipótese e IR
* ranking por consistência
* smoke tests em corpus local
* golden tests de saída.

Critério:

* hipóteses ruins são filtradas automaticamente.

## Sprint 5 — diff e casos de uso fortes

Objetivo: entregar valor comercial.

Entregas:

* `diff old.bin new.bin`
* triagem de risco
* relatório Markdown/JSON
* sumarização orientada a segurança/engenharia.

Critério:

* explicar mudanças entre duas versões de binário em linguagem útil.

## Sprint 6 — distribuição e DX

Objetivo: adoção.

Entregas:

* `npm i -g`
* bootstrap de dependências
* docs
* exemplos com Ghidra local
* telemetria opcional local-only
* templates MCP.

Critério:

* outro dev instala e roda em menos de 15 minutos.

---

# Estratégia de testes

## Unitários

* schemas
* mapeadores
* scoring
* parsers de saída
* resolução de config.

## Integração

* chamada real ao Ghidra headless
* chamada real ao worker angr
* persistência SQLite
* tools MCP fim a fim.

## E2E

* `gdmcp analyze ./samples/x`
* `gdmcp decompile ...`
* host MCP consulta e recebe resposta coerente.

## Golden tests

Corpus fixo de binários simples:

* funções aritméticas
* loops
* switch
* structs simples
* chamadas libc/winapi.

## Smoke tests

* Windows
* Linux
* diferentes versões de Node
* Ghidra presente/ausente
* Python presente/ausente.

---

# Repositórios e ideias aproveitáveis

Você não precisa copiar, mas pode se inspirar em padrões reais:

* **modelcontextprotocol/typescript-sdk** para a camada MCP em TS. ([GitHub][1])
* **pyghidra-mcp** como evidência de que Ghidra + MCP é um caminho real. ([GitHub][2])
* **GhidraSnippets** e toolkits headless para acelerar scripts de coleta. ([GitHub][8])
* **angr** como backend de lifting, CFG e simplificação. ([Angr Documentation][3])

---

# Recomendação final

Minha recomendação objetiva é esta:

**Sim, use TypeScript.**
Mas use TS como:

* CLI global
* servidor MCP
* orquestrador
* camada de contratos
* cache local
* UX
* integração com LLM. ([GitHub][1])

**Não use TS para reinventar o motor de reverse.**
Use:

* Ghidra como backend 1
* angr como backend 2
* validação própria
* IA apenas onde há ambiguidade semântica ou refinamento humano. ([Angr Documentation][3])

Isso te dá um produto **factível**, instalável por npm, com cara moderna de AI tooling, mas apoiado em motores reais e maduros.

Posso transformar isso no próximo passo em um **PDR/PRD técnico completo**, com tasks, subtasks, estrutura de pastas, comandos CLI, schemas iniciais e backlog de implementação.

[1]: https://github.com/modelcontextprotocol/typescript-sdk?utm_source=chatgpt.com "modelcontextprotocol/typescript-sdk: The official ..."
[2]: https://github.com/clearbluejar/pyghidra-mcp?utm_source=chatgpt.com "clearbluejar/pyghidra-mcp: Python Command-Line Ghidra ..."
[3]: https://docs.angr.io/en/latest/analyses/decompiler.html?utm_source=chatgpt.com "angr Decompiler"
[4]: https://github.com/nationalsecurityagency/ghidra?utm_source=chatgpt.com "Ghidra is a software reverse engineering (SRE) framework"
[5]: https://github.com/utensil/awesome-stars?utm_source=chatgpt.com "utensil/awesome-stars: A curated list of my ..."
[6]: https://github.com/MobSF/owasp-mstg/blob/master/Document/0x08a-Testing-Tools.md?utm_source=chatgpt.com "owasp-mstg/Document/0x08a-Testing-Tools.md at master"
[7]: https://github.com/vercel/pkg?utm_source=chatgpt.com "vercel/pkg: Package your Node.js project into an executable"
[8]: https://github.com/20urc3/sekiryu?utm_source=chatgpt.com "20urc3/Sekiryu: Comprehensive toolkit for Ghidra headless."
