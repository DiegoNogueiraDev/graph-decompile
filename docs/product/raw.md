Sim — dá para atacar isso de forma **híbrida**, e a literatura atual aponta exatamente nessa direção: usar um pipeline **determinístico** para tudo que envolve semântica observável do binário e deixar a **IA** para reconstruir o que a compilação destruiu ou tornou ambíguo, como nomes, tipos ricos, intenções e estrutura mais “humana” do código. Trabalhos recentes sobre decompilação neural destacam explicitamente que a compilação é um processo “lossy”, então a recuperação completa do fonte original não é totalmente resolvível de modo determinístico. ([arXiv][1])

O que hoje parece mais sólido para a sua ideia é este princípio: **binário → lifting/IR → normalização/validação formal → IA apenas no gap residual**. A base clássica continua sendo recuperação de fluxo de controle, lifting para IR e preservação semântica; a base nova adiciona LLMs para recuperar legibilidade, tipos compostos e identificadores. Os papers de decompilação com LLM mostram melhora forte em reexecutabilidade e legibilidade, mas também deixam claro o risco de alucinação e a necessidade de avaliação por equivalência semântica, não só por similaridade textual. 

O mapa de pesquisa que eu montaria para vocês atacar é este.

**1. Base clássica e determinística da decompilação**

A linha mais importante é a de **structuring e abstraction recovery**. O paper de 2013 da USENIX mostra que algoritmos anteriores de structuring não eram semanticamente preservadores e, por isso, não podiam ser usados com segurança em decompilação sem adaptações. Já o DREAM propõe structuring independente de padrões para reduzir saídas cheias de `goto`, e o trabalho de 2024 mostra que compiladores modernos distorcem a estrutura de controle a ponto de muitos casos ficarem “unstructurable” para abordagens antigas. Em outras palavras: recuperar `if/else`, `while`, `switch`, `break/continue`, regiões e laços ainda é uma parte central e altamente determinística do problema. 

**2. Binary lifting / IR como espinha dorsal**

Se vocês querem plugar isso em MCP + GenAI, a melhor forma é não expor assembly cru para o modelo como representação principal. A literatura e as ferramentas práticas convergem em fazer lifting para uma IR. O SoK sobre binary lifters mostra que IRs levantadas de binários já são bastante úteis para downstream tasks como decompilação e compreensão de código, ainda que nem sempre sejam suficientemente fiéis para análises estáticas rigorosas como pointer analysis pesada. angr, por exemplo, já oferece lifting, CFG recovery, symbolic/concolic analysis e decompilação para AIL e pseudocódigo C, então ele é uma base muito plausível para o núcleo determinístico. 

**3. Validação e garantia semântica**

Aqui está um ponto muito forte para diferenciar a sua solução. Em vez de confiar no texto gerado, vocês podem adotar **translation validation** e **equivalence checking** por etapa. O paper clássico de translation validation argumenta que, se não dá para provar que o compilador todo é correto, ainda assim dá para checar cada transformação individualmente. Isso casa muito bem com um pipeline de decompilação híbrido: cada estágio gera uma hipótese e um verificador decide se a hipótese é semanticamente aceitável. Em 2025, o trabalho `codealign` reforça exatamente isso para decompiladores neurais, propondo uma checagem fina de equivalência em nível de instrução. 

**4. Testar o decompilador como sistema, não só medir BLEU / edit distance**

A pesquisa mais útil para produto, na minha visão, é a que mede **recompilabilidade, reexecutabilidade e discrepância semântica**, não só semelhança textual. O LLM4Decompile já criticava avaliações token-level e introduziu uma avaliação voltada à executabilidade. O D-HELIX vai além: recompila a saída decompilada em nível de função, extrai modelos simbólicos da função original e da reconstruída, compara semanticamente e usa isso para achar bugs reais em decompiladores. Em testes com Ghidra e angr, eles encontraram milhares de funções incorretamente decompiladas e 17 bugs distintos desconhecidos. Esse paper é ouro para o seu desenho porque mostra um padrão de produto: **gerar → recompilar → simbolizar → comparar → corrigir**. ([arXiv][2])

**5. Onde a IA realmente agrega**

A parte probabilística entra onde a compilação destruiu abstrações de autor. O paper `Idioms` é bem claro: decompiladores determinísticos focam em semântica, mas deixam o código duro de ler porque não recuperam bem nomes e tipos; já decompiladores neurais podem preencher esses detalhes estatisticamente. Esse trabalho também ataca um gargalo importante para uso real: tipos compostos e definições de tipos, e reporta ganho sobre ExeBench e RealType. O SK2Decompile segue linha parecida ao separar “skeleton” semântico de “skin” com identificadores e refinamentos. ([arXiv][3])

**6. Benchmarks e datasets que valem estudar**

Hoje você já tem uma pequena trilha de benchmarks útil. ExeBench foi um dos primeiros datasets em escala com funções C executáveis e exemplos de I/O. LLM4Decompile e Idioms usam ExeBench como benchmark importante. Mais recentemente, Decompile-Bench ampliou a escala para **2 milhões** de pares binário–fonte, construídos a partir de **100 milhões** de pares brutos via um pipeline `Compile-Trace-Filter`, e reportou ganho de mais de **20% em reexecutabilidade** em relação a benchmarks anteriores. Isso é muito relevante porque mostra que qualidade do dataset muda mais o jogo do que só trocar o modelo. ([ACM Digital Library][4])

**7. Modelos matemáticos e formais para a parte determinística**

Aqui está o conjunto que eu usaria como fundamento teórico do seu projeto:
SSA e dataflow analysis para uso-def, propagação, eliminação de temporários e reconstrução de expressões; abstract interpretation para reconstrução de fluxo de controle e análise estática de baixo nível; symbolic execution / concolic execution para equivalência e geração de contraprovas; graph theory sobre CFG/DFG/PDG para segmentação estrutural; translation validation e equivalence checking para checar transformações; e equality saturation / e-graphs para explorar múltiplas formas equivalentes antes de escolher a melhor representação de alto nível. Cada uma dessas famílias aparece com força em papers centrais da área. ([Plai][5])

**8. Onde equality saturation pode entrar no seu caso**

Isso pode virar um diferencial enorme. Equality saturation foi criada para otimização, mas a ideia geral serve muito bem para “descompilar” sem se prender cedo demais a uma única reconstrução sintática. Em vez de decidir logo “isso é um `for`” ou “isso é um `while`”, você pode manter várias representações equivalentes no e-graph e escolher depois a forma mais legível, mais recompilável ou mais próxima do estilo da linguagem-alvo. A própria literatura cita uso de e-graphs para translation validation e busca entre programas equivalentes. ([arXiv][6])

**9. O que eu classificaria como determinístico vs. não determinístico**

Determinístico: parsing do binário; disassembly; lifting para IR; CFG; DFG/use-def; SSA; constante folding; simplificações algébricas seguras; detecção de idioms compilador→IR conhecidos; recovery de calling convention; resolução de blocos básicos e edges; reconstrução de loops/regiões quando houver evidência suficiente; translation validation; symbolic equivalence; emissão de pseudocódigo canônico; reranking por métricas objetivas. Isso tudo deve rodar sem LLM. ([Angr][7])

Não determinístico, logo bom candidato para IA: nomes de variáveis e funções; escolha entre várias formas sintáticas equivalentes; inferência de tipos de alto nível quando o binário perdeu essa informação; reconstituição de structs/enums/typedefs; comentários, intenção e documentação; reconstrução de APIs sem assinatura explícita; mapeamento para domínios semânticos; explicação humana do código; e remendo de casos em que a IR preserva semântica mas não recupera uma forma idiomática. Os trabalhos de neural decompilation destacam exatamente esse espaço. ([arXiv][3])

**10. Uma arquitetura prática para você conectar via MCP com GenAI**

Eu faria assim:
um **MCP server** expõe ferramentas decompiladoras modulares; o núcleo determinístico usa Ghidra/angr/um lifter próprio para gerar IR, CFG, SSA, DFG e uma forma canônica; em seguida um módulo de **normalização/verificação** aplica reescritas seguras e checks de equivalência; depois um módulo de **orquestração** decide quais “gaps” mandar para a IA; o LLM recebe apenas um recorte bem estruturado — por exemplo IR anotada, assinaturas prováveis, grafo da função, símbolos externos, strings, call graph local e constraints de equivalência; a saída do modelo volta como hipótese; então um validador recompila ou traduz para IR novamente e roda equivalence/symdiff; se passar, promove; se não passar, rejeita ou pede nova hipótese. MCP entra muito bem aqui porque ele foi feito justamente para conectar aplicações de IA a ferramentas externas e esquemas tipados de contexto. ([GitHub][8])

**11. O recorte de pesquisa mais promissor para vocês**

Na prática, eu não tentaria “decompilar tudo com LLM”. Eu miraria primeiro um produto em que o LLM é um **semantic recovery/refinement engine**. O pipeline seria:
`binary -> IR canônica -> invariantes/constraints -> hipótese LLM -> validação -> promoção`.
Isso reduz custo, reduz alucinação e cria um produto auditável. A literatura recente em benchmarks e equivalence checking sugere que esse é o caminho mais sólido para sair do “demo bonito” e virar ferramenta séria. ([arXiv][9])

**12. Papers e itens que eu colocaria no backlog imediato**

Comecem por estes blocos:
Schwartz/Brumley/Woo 2013 sobre semantics-preserving structural analysis; DREAM 2015 para structuring goto-free; Basque et al. 2024 para compiler-aware structuring; LLM4Decompile 2024; D-HELIX 2024; Idioms 2025; Decompile-Bench 2025; ExeBench; translation validation de Necula 2000; equality saturation de Tate et al.; SoK sobre binary lifters; e o trabalho de binary lifting verificado para P-Code/Ghidra. Esse conjunto já dá uma base excelente de teoria, avaliação e engenharia. 

Minha conclusão fria: **sim, a direção certa é separar o problema em duas camadas**. A camada 1 é um “decompiler core” determinístico, com IR, grafos, regras, structuring, validação e equivalência. A camada 2 é uma “semantic reconstruction layer” com GenAI, usada apenas onde o binário não carrega informação suficiente ou onde existem muitas formas humanas aceitáveis do mesmo programa. Isso é coerente com o estado da arte e, mais importante, é um caminho que permite construir algo confiável e evolutivo. ([arXiv][3])

Posso transformar isso agora em um **estudo técnico estruturado para o seu mcp-graph**, já com: objetivo, arquitetura, backlog de pesquisa, módulos determinísticos vs módulos GenAI, e um plano MVP v1.

[1]: https://arxiv.org/html/2501.04811v1 "Fast, Fine-Grained Equivalence Checking for Neural Decompilers"
[2]: https://arxiv.org/html/2403.05286v1 "LLM4Decompile: Decompiling Binary Code with Large Language Models"
[3]: https://arxiv.org/html/2502.04536v2 "Idioms: Neural Decompilation With Joint Code and Type Definition Prediction"
[4]: https://dl.acm.org/doi/10.1145/3520312.3534867?utm_source=chatgpt.com "ExeBench: an ML-scale dataset of executable C functions"
[5]: https://www.plai.ifi.lmu.de/publications/vmcai09-cfr.pdf?utm_source=chatgpt.com "An Abstract Interpretation-Based Framework for Control ..."
[6]: https://arxiv.org/abs/1012.1802 "[1012.1802] Equality Saturation: A New Approach to Optimization"
[7]: https://angr.io/ "angr"
[8]: https://github.com/modelcontextprotocol/modelcontextprotocol "GitHub - modelcontextprotocol/modelcontextprotocol: Specification and documentation for the Model Context Protocol · GitHub"
[9]: https://arxiv.org/html/2505.12668v1 "Decompile-Bench: Million-Scale Binary-Source Function Pairs for Real-World Binary Decompilation"
