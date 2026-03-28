# PDR — GenAI Decompiler MCP

## 1. Visão geral

O **GenAI Decompiler MCP** é uma plataforma local, instalável via **npm global**, projetada para orquestrar análise de binários, decompilação híbrida e reconstrução semântica assistida por IA por meio de uma interface compatível com **MCP (Model Context Protocol)**.

A proposta central não é reinventar um decompilador completo em JavaScript/TypeScript, mas sim construir uma **camada moderna de produto e orquestração** sobre motores já maduros de análise binária, especialmente **Ghidra** e **angr**, usando **TypeScript/Node.js** como espinha dorsal para CLI, servidor MCP, normalização de artefatos, persistência local, governança de contexto e integração com modelos generativos.

A arquitetura é baseada em uma separação explícita entre:

* **camada determinística**, responsável por lifting, CFG, call graph, simplificações seguras, coleta estrutural e verificação;
* **camada probabilística/GenAI**, responsável por reconstrução semântica de alto nível, sugestão de nomes, hipóteses de tipos, explicações e refinamento de pseudocódigo;
* **camada de validação**, responsável por impedir que hipóteses da IA sejam promovidas sem consistência estrutural e semântica mínima.

O objetivo do sistema é reduzir o custo cognitivo e operacional da engenharia reversa, permitindo que agentes e usuários humanos interajam com binários de forma incremental, contextual e validável.

---

## 2. Problema que o produto resolve

A engenharia reversa tradicional é poderosa, porém fragmentada, pesada e pouco integrada a fluxos modernos de IA.

Os principais problemas observados são:

1. **Ferramentas clássicas não foram desenhadas para workflows MCP/GenAI**

   * Ghidra e angr são excelentes como motores, mas não oferecem, por padrão, uma camada de orquestração orientada a agentes.

2. **A decompilação clássica preserva semântica parcial, mas nem sempre recupera legibilidade**

   * nomes, tipos de domínio, estruturas compostas, intenção e narrativa do código frequentemente se perdem.

3. **LLMs puros não são confiáveis como motor principal de reverse engineering**

   * eles podem produzir reconstruções plausíveis, porém semanticamente incorretas.

4. **Não há uma interface local simples, npm-friendly e MCP-native**

   * especialmente para times que querem rodar tudo localmente, sem depender de infraestrutura remota.

5. **O contexto de análise se perde entre interações**

   * cada consulta ao binário tende a reconstituir informações já extraídas, desperdiçando tempo e tokens.

O GenAI Decompiler MCP resolve isso ao combinar:

* motores binários maduros;
* uma IR canônica própria;
* cache persistente por hash do binário;
* ferramentas MCP para interação iterativa;
* uma camada GenAI controlada e validada.

---

## 3. Objetivos do produto

### 3.1 Objetivo principal

Criar um sistema local que permita analisar e decompilar binários com suporte a IA, expondo ferramentas via MCP para agentes e usuários, com foco em **factibilidade, confiabilidade e extensibilidade**.

### 3.2 Objetivos secundários

* Permitir instalação simples via npm global.
* Rodar localmente em Linux e Windows.
* Reaproveitar motores maduros como Ghidra e angr.
* Criar uma IR canônica para normalização entre backends.
* Fornecer tools MCP para exploração, decompilação e explicação.
* Usar IA apenas onde há real ambiguidade ou perda de abstração.
* Implementar mecanismos de validação para reduzir alucinação.
* Persistir artefatos e contexto localmente para reutilização futura.
* Servir de base para evolução futura em diff binário, patching e workflows mais autônomos.

### 3.3 Não objetivos iniciais

* Não substituir Ghidra ou angr como motor de baixo nível.
* Não suportar todas as arquiteturas e formatos no MVP.
* Não prometer equivalência formal completa para todo caso no MVP.
* Não depender de cloud obrigatória.
* Não empacotar tudo em um único binário monolítico no MVP.

---

## 4. Hipóteses estratégicas

1. **TypeScript é excelente como camada de orquestração, mas não como motor de reverse engineering profundo.**
2. **O maior ganho de produto está na ponte entre motores binários e GenAI, e não na reimplementação do core clássico.**
3. **Uma IR canônica própria é essencial para desacoplar backends e facilitar validação e prompting.**
4. **O uso de IA deve ser restrito a gaps semânticos e refinamento humano, nunca ao parsing estrutural primário do binário.**
5. **Adoção inicial será maior se o produto funcionar localmente com instalação previsível e UX de CLI simples.**

---

## 5. Personas e cenários reais

### 5.1 Analista de segurança

Precisa identificar funções sensíveis, persistência, anti-debug, network beacons e fluxo de execução suspeito em um sample.

### 5.2 Engenheiro de manutenção de legado

Precisa entender binários sem fonte, encontrar funções de negócio e reconstruir intenção de módulos críticos.

### 5.3 Pesquisador de engenharia reversa

Quer inspecionar IR, CFG, pseudocódigo e comparar múltiplas hipóteses de reconstrução.

### 5.4 Time que usa agentes/LLMs

Quer conectar uma IA ao contexto do binário sem despejar assembly cru a cada pergunta.

### 5.5 Equipe de produto ou plataforma interna

Quer usar binários e artefatos compilados como fontes de verdade para análise, diff e auditoria técnica.

---

## 6. Proposta de valor

O GenAI Decompiler MCP entrega:

* **decompilação híbrida local**, com motores maduros e IA controlada;
* **integração MCP-native**, pronta para agentes;
* **persistência contextual**, evitando retrabalho;
* **melhor legibilidade e explicabilidade** sobre o binário;
* **base validável**, e não apenas texto gerado por modelo;
* **instalação moderna**, via npm global, com DX alinhada a ferramentas de desenvolvimento.

---

## 7. Arquitetura de alto nível

A arquitetura será composta por sete camadas principais.

### 7.1 Camada de distribuição e CLI

Responsável por instalação global, bootstrap, UX de terminal, configuração e comandos de entrada.

Exemplos de comandos:

* `gdmcp doctor`
* `gdmcp analyze <binary>`
* `gdmcp decompile <binary> --function <name>`
* `gdmcp explain <binary> --function <name>`
* `gdmcp diff <old> <new>`
* `gdmcp serve`

### 7.2 Camada MCP

Servidor MCP implementado em TypeScript, expondo tools e resources consumíveis por hosts compatíveis.

### 7.3 Camada de orquestração

Responsável por coordenar jobs, chamar backends locais, aplicar fallback, consolidar artefatos e acionar a IA apenas quando necessário.

### 7.4 Camada determinística

Executa lifting, coleta estrutural, simplificação segura, normalização e enriquecimento heurístico sem IA.

### 7.5 Camada GenAI

Executa reconstrução semântica assistida, renomeação, explicação, refinamento de pseudocódigo e geração de hipóteses.

### 7.6 Camada de validação

Aplica regras, checagens estruturais, coerência com IR, ranking de hipóteses e futuras validações semânticas mais fortes.

### 7.7 Camada de persistência

Armazena cache local, metadados, hipóteses, artefatos e relatórios por hash de binário.

---

## 8. Decisão tecnológica principal

### 8.1 TypeScript / Node.js

Será a linguagem principal do produto.

**Motivos:**

* excelente suporte ao SDK oficial do MCP;
* distribuição fácil via npm global;
* ótima produtividade para CLI, schemas e IO local;
* facilidade de integração com LLMs;
* ecossistema forte para ferramentas de automação.

### 8.2 Ghidra

Será um backend estratégico primário para importação, autoanálise, pseudocódigo, P-Code, símbolos, strings e scripting headless.

### 8.3 angr

Será um backend estratégico complementar para lifting, CFG, AIL, simplificações, symbolic/concolic analysis e validação futura.

### 8.4 SQLite

Será usado para persistência local de índice, cache e histórico.

### 8.5 Python bridge

Será usado para o worker local do angr.

### 8.6 Java runtime

Será requerido para o Ghidra.

---

## 9. Estrutura detalhada do sistema

```text
genai-decompiler-mcp/
  packages/
    cli/
    mcp-server/
    core-contracts/
    orchestration/
    storage/
    validation/
    llm-adapter/
    ghidra-adapter/
    angr-adapter/
    reporting/
  python/
    angr-worker/
  ghidra/
    scripts/
    extractors/
  samples/
  docs/
  tests/
```

### 9.1 `packages/cli`

Contém o entrypoint global da ferramenta, parser de argumentos, comandos e bootstrap do ambiente.

### 9.2 `packages/mcp-server`

Expõe tools e resources MCP, com schemas tipados e contratos estáveis.

### 9.3 `packages/core-contracts`

Define os tipos centrais do sistema, incluindo IR canônica, resultados, erros, diagnósticos e scores de confiança.

### 9.4 `packages/orchestration`

Coordena pipelines, workers, retries, timeouts, fallback entre backends e seleção de estratégias.

### 9.5 `packages/storage`

Gerencia SQLite, diretórios de artefatos, versionamento local e indexação por hash.

### 9.6 `packages/validation`

Contém o motor de validação de hipóteses, consistência estrutural e score semântico incremental.

### 9.7 `packages/llm-adapter`

Concentra prompts estruturados, interfaces com modelos, escolha de provider e tratamento de respostas.

### 9.8 `packages/ghidra-adapter`

Invoca scripts headless do Ghidra, coleta JSON estruturado e converte para a IR canônica.

### 9.9 `packages/angr-adapter`

Fala com o worker Python do angr e converte AIL/CFG/metadata para a IR canônica.

### 9.10 `packages/reporting`

Gera relatórios Markdown, JSON e futuros exportadores visuais.

---

## 10. IR canônica do produto

A IR canônica será a língua franca interna do produto. Seu objetivo não é substituir a IR do Ghidra ou do angr, mas permitir uma representação unificada para prompting, validação, cache e tools MCP.

Estrutura inicial sugerida:

```ts
export type CanonicalFunction = {
  id: string
  binaryHash: string
  backendSources: string[]
  arch: "x86_64" | "x86" | "arm64" | "armv7"
  address: string
  rawName?: string
  normalizedName?: string
  confidence: number
  blocks: CanonicalBlock[]
  edges: CanonicalEdge[]
  variables: CanonicalVariable[]
  calls: CanonicalCallSite[]
  strings: CanonicalStringRef[]
  imports: CanonicalImportRef[]
  typeHints: CanonicalTypeHint[]
  pseudocode?: string
  semantics: CanonicalSemanticFacts
  diagnostics: CanonicalDiagnostic[]
}
```

### 10.1 Benefícios da IR canônica

* desacopla backends;
* facilita prompts estruturados;
* permite comparação entre versões;
* permite score de qualidade por função;
* viabiliza evolução futura para diff, patching e equivalência.

---

## 11. Separação determinístico vs. GenAI

### 11.1 Determinístico

Fica sob responsabilidade da camada determinística:

* identificação do formato do binário;
* importação do binário;
* detecção de arquitetura;
* análise de funções;
* CFG;
* call graph;
* coleta de strings e imports;
* simplificações seguras;
* normalização de artefatos;
* heurísticas de score;
* armazenamento de artefatos;
* filtros e ranking baseados em evidência.

### 11.2 GenAI

Fica sob responsabilidade da camada GenAI:

* sugerir nomes melhores;
* gerar explicações em alto nível;
* formular hipóteses de tipos de domínio;
* reescrever pseudocódigo para legibilidade;
* identificar padrões conceituais;
* produzir descrições por função ou módulo;
* resumir mudanças em diffs binários.

### 11.3 Regra de governança

A IA não deve ser usada para substituir a camada de parsing, lifting ou coleta estrutural primária.

---

## 12. Fluxo operacional detalhado

### 12.1 Ingestão

1. receber caminho do binário;
2. validar existência e permissões;
3. calcular hash SHA-256;
4. criar workspace local do artefato;
5. registrar metadados iniciais em SQLite.

### 12.2 Análise primária

1. chamar Ghidra headless;
2. chamar angr worker;
3. coletar saídas brutas;
4. converter para IR canônica;
5. armazenar artefatos intermediários.

### 12.3 Enriquecimento determinístico

1. correlacionar funções entre backends;
2. gerar score de confiança;
3. detectar imports críticos;
4. agrupar funções por relevância;
5. marcar funções elegíveis para IA.

### 12.4 Enriquecimento GenAI

1. selecionar uma função ou conjunto de funções;
2. montar prompt estruturado com contexto mínimo útil;
3. solicitar hipóteses de nome/tipo/explicação;
4. receber múltiplas hipóteses ranqueadas.

### 12.5 Validação

1. validar formato da resposta;
2. comparar coerência com IR;
3. rejeitar inconsistências óbvias;
4. promover hipótese aprovada ao cache;
5. registrar score e justificativa.

### 12.6 Exposição MCP

1. disponibilizar resultados como tools/resources;
2. suportar interações incrementais;
3. evitar retrabalho via cache local.

---

## 13. Ferramentas MCP previstas

### 13.1 Tools iniciais

* `analyze_binary`
* `list_functions`
* `get_function`
* `decompile_function`
* `explain_function`
* `recover_names`
* `recover_types`
* `export_cfg`
* `compare_binaries`
* `summarize_binary`

### 13.2 Resources iniciais

* relatório do binário
* índice de funções
* call graph resumido
* strings relevantes
* hipóteses de IA por função
* artefatos de backend

---

## 14. Cenários reais de uso

### 14.1 Entendimento de binário legado

Usuário aponta um executável antigo sem fonte. O sistema extrai funções, destaca módulos candidatos e usa IA para explicar a intenção provável das funções mais relevantes.

### 14.2 Triagem de malware

Usuário quer identificar persistência, rede, anti-debug e criptografia. O sistema cruza imports, strings, padrões e fluxo de controle, e a IA traduz isso em narrativa acionável.

### 14.3 Diff entre versões

Usuário compara duas DLLs ou dois ELF. O sistema identifica funções alteradas, resume o que mudou e aponta possíveis impactos técnicos.

### 14.4 Reconstrução guiada por domínio

Usuário possui contexto adicional do sistema. A IA usa imports, strings, convenções e hints para melhorar nomes e explicações.

### 14.5 Assistente técnico via MCP

Um host com LLM consulta o servidor MCP e responde perguntas sobre o binário sem precisar repetir toda a engenharia reversa a cada prompt.

---

## 15. Experiência do desenvolvedor

### 15.1 Instalação

```bash
npm install -g genai-decompiler-mcp
```

### 15.2 Primeira configuração

```bash
gdmcp doctor
```

O comando deverá:

* verificar Node;
* verificar Java;
* verificar Ghidra;
* verificar Python;
* verificar angr;
* salvar paths em configuração local.

### 15.3 Uso básico

```bash
gdmcp analyze ./sample.bin
gdmcp decompile ./sample.bin --function main
gdmcp explain ./sample.bin --function sub_401000
gdmcp serve
```

---

## 16. Estratégia de distribuição

### 16.1 MVP

A estratégia principal será:

* distribuição do orquestrador via npm global;
* Ghidra instalado separadamente;
* Python/angr instalados separadamente ou preparados por bootstrap local;
* scripts de diagnóstico e configuração automática.

### 16.2 Motivo da decisão

Empacotar Java, Python, Ghidra e Node em um único executável no MVP aumentaria complexidade operacional, risco e fragilidade de build.

### 16.3 Evolução futura

No futuro pode-se avaliar:

* bundlers nativos;
* installers específicos por plataforma;
* wrappers com setup guiado;
* distribuição híbrida com assets opcionais.

---

## 17. Requisitos funcionais

### 17.1 Requisitos do MVP

1. Instalar via npm global.
2. Rodar em Linux e Windows.
3. Detectar dependências locais.
4. Analisar um binário PE ou ELF simples.
5. Coletar funções, strings, imports e pseudocódigo básico.
6. Persistir resultado localmente.
7. Expor um servidor MCP funcional.
8. Permitir que um LLM host consulte funções e explicações.
9. Aplicar prompts estruturados para enriquecimento de IA.
10. Registrar e recuperar hipóteses por função.

### 17.2 Requisitos pós-MVP

1. Diff entre binários.
2. Scoring semântico mais forte.
3. Patching assistido.
4. Melhor recuperação de tipos compostos.
5. Suporte expandido de arquiteturas.

---

## 18. Requisitos não funcionais

* operar localmente sem cloud obrigatória;
* ser observável por logs e diagnósticos;
* ter contratos estáveis entre módulos;
* suportar timeout e retry controlados;
* evitar reprocessamento desnecessário;
* ser extensível por novos backends;
* manter custo de contexto baixo para LLMs.

---

## 19. Riscos principais

### 19.1 Risco técnico

Diferenças grandes entre Ghidra e angr podem dificultar a normalização inicial.

**Mitigação:** começar com subconjunto reduzido da IR e expandir incrementalmente.

### 19.2 Risco operacional

Usuários podem ter dificuldade com Java/Python/Ghidra locais.

**Mitigação:** criar `doctor`, bootstrap e documentação forte.

### 19.3 Risco de alucinação

IA pode produzir reconstruções plausíveis, porém incorretas.

**Mitigação:** IA sempre subordinada à camada determinística e à validação.

### 19.4 Risco de escopo

O projeto pode crescer rápido demais para um MVP.

**Mitigação:** foco inicial em análise + explicação + MCP, sem tentar patching completo no começo.

### 19.5 Risco de DX ruim

Se a instalação for pesada demais, a adoção cai.

**Mitigação:** reduzir o atrito do primeiro uso ao máximo.

---

## 20. Roadmap de construção

### Sprint 0 — prova de realidade

**Objetivo:** provar que a arquitetura roda localmente.

**Entregas:**

* monorepo TS inicial;
* CLI com `doctor`;
* detecção de Ghidra/Java/Python;
* chamada headless ao Ghidra;
* chamada mínima ao angr worker;
* persistência de JSON bruto.

**Critério de pronto:** analisar um binário simples e salvar artefatos.

### Sprint 1 — contratos e persistência

**Objetivo:** criar base estável do sistema.

**Entregas:**

* schemas centrais com zod;
* SQLite inicial;
* workspace por hash;
* IR canônica v0;
* mapeadores básicos Ghidra→IR e angr→IR.

### Sprint 2 — pipeline de análise

**Objetivo:** consolidar análise de binário com normalização.

**Entregas:**

* `analyze` funcional;
* listagem de funções;
* score inicial por função;
* coleta de strings/imports;
* relatórios JSON.

### Sprint 3 — servidor MCP

**Objetivo:** disponibilizar o sistema a hosts compatíveis.

**Entregas:**

* `serve` via stdio;
* tools iniciais;
* resources iniciais;
* integração mínima com host MCP.

### Sprint 4 — GenAI controlada

**Objetivo:** adicionar valor sem perder governança.

**Entregas:**

* prompts estruturados;
* rename de funções/variáveis;
* explicação em alto nível;
* hipóteses de tipos;
* score de confiança.

### Sprint 5 — validação e diff

**Objetivo:** dar robustez e casos de uso fortes.

**Entregas:**

* validação estrutural;
* comparação entre hipóteses;
* `compare_binaries`;
* relatório de mudanças.

### Sprint 6 — DX e adoção

**Objetivo:** tornar o produto utilizável por terceiros.

**Entregas:**

* documentação completa;
* samples;
* scripts de bootstrap;
* smoke tests por plataforma;
* exemplos de uso via MCP.

---

## 21. Backlog inicial de tasks e subtasks

### EPIC 1 — Foundation

**Task 1.1:** criar monorepo TS

* configurar workspace
* configurar tsconfig base
* configurar lint e format
* configurar build

**Task 1.2:** criar CLI inicial

* comando `doctor`
* comando `analyze`
* parser de argumentos
* output padronizado

**Task 1.3:** criar config local

* arquivo de configuração
* resolução de paths
* persistência segura

### EPIC 2 — Ghidra adapter

**Task 2.1:** scripts headless

* importar binário
* rodar autoanálise
* extrair funções
* extrair strings/imports

**Task 2.2:** serialização

* converter resultados para JSON
* mapear pseudocódigo básico
* capturar erros e timeouts

### EPIC 3 — angr adapter

**Task 3.1:** worker Python

* bootstrap de ambiente
* comando de análise
* extração de CFG/AIL

**Task 3.2:** bridge Node↔Python

* contrato de entrada/saída
* tratamento de falhas
* logs estruturados

### EPIC 4 — IR canônica

**Task 4.1:** modelar tipos

* função
* bloco
* edge
* variável
* call site
* imports
* strings

**Task 4.2:** criar normalizadores

* Ghidra→IR
* angr→IR
* score de convergência

### EPIC 5 — Persistência

**Task 5.1:** SQLite

* schema inicial
* binários
* funções
* artefatos
* hipóteses

**Task 5.2:** workspace local

* hash do binário
* diretórios por artefato
* versionamento mínimo

### EPIC 6 — MCP server

**Task 6.1:** servidor MCP

* registrar tools
* registrar resources
* schemas de input/output

**Task 6.2:** tools MVP

* analyze_binary
* list_functions
* get_function
* explain_function
* decompile_function

### EPIC 7 — GenAI layer

**Task 7.1:** prompt contracts

* prompt de explicação
* prompt de renomeação
* prompt de tipo
* prompt de diff

**Task 7.2:** provider abstraction

* adapter de modelo
* timeout
* retries
* validação da resposta

### EPIC 8 — Validation

**Task 8.1:** checks estruturais

* coerência de nomes
* coerência com imports
* coerência com CFG
* detecção de inconsistências óbvias

**Task 8.2:** ranking

* score por hipótese
* descarte de saídas ruins
* justificativa de decisão

### EPIC 9 — Reporting

**Task 9.1:** relatórios

* resumo do binário
* resumo por função
* relatório de diff

### EPIC 10 — QA

**Task 10.1:** unit tests

* schemas
* parsers
* score
* config

**Task 10.2:** integration tests

* Ghidra adapter
* angr adapter
* SQLite
* pipeline analyze

**Task 10.3:** e2e tests

* CLI
* MCP
* binários de exemplo

---

## 22. Estratégia de testes

### 22.1 Unitários

Cobrir contracts, normalizadores, utilitários, parsing, config e scoring.

### 22.2 Integração

Cobrir invocação real de Ghidra, angr worker, persistência, e pipeline de análise.

### 22.3 E2E

Cobrir o fluxo completo do CLI e do servidor MCP.

### 22.4 Golden tests

Usar binários pequenos e previsíveis para congelar saídas mínimas esperadas.

### 22.5 Smoke tests

Executar checks rápidos por plataforma e por presença/ausência de dependências.

---

## 23. Métricas de sucesso

### 23.1 Métricas técnicas

* tempo médio de análise por binário;
* taxa de sucesso de ingestão;
* cobertura de funções extraídas;
* taxa de hipóteses aprovadas após validação;
* percentual de cache hit;
* taxa de falha por dependência ausente.

### 23.2 Métricas de produto

* tempo até primeira análise útil;
* número de interações MCP reutilizando contexto;
* adoção dos comandos principais;
* satisfação com legibilidade e explicações.

---

## 24. Evoluções futuras

* diff estrutural avançado entre binários;
* validação semântica mais forte;
* integração com Triton;
* suporte expandido a Mach-O e outras arquiteturas;
* geração de patch candidates;
* integração com graph workflows para roteirização de investigação;
* uso de memória persistente entre análises multi-binário.

---

## 25. Conclusão

O caminho mais realista, sólido e de maior alavancagem para o GenAI Decompiler MCP é usar **TypeScript como camada de produto e orquestração** e combinar isso com **motores maduros de análise binária** como Ghidra e angr.

Essa decisão reduz risco, acelera o MVP e permite construir uma solução realmente utilizável por agentes e humanos. O valor do produto não está em reimplementar lifting e decompilação clássica do zero, mas em:

* normalizar artefatos complexos;
* governar o uso de IA;
* persistir contexto localmente;
* validar hipóteses;
* expor tudo isso via MCP de forma moderna e reutilizável.

O resultado esperado é uma plataforma local de reverse engineering assistido por IA, com arquitetura factível, evolução incremental e base forte para casos de uso reais.
