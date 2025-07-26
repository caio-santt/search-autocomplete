# COMMENTS/README markdown <br>Desafio: Auto-completar na Busca - Jusbrasil

> Participante: Caio Santana Trigueiro.

> Este arquivo é o registro de decisões de implementação, comentários gerais e até mesmo instruções de uso para o que foi implementado no desafio, o arquivo deve ser lido usando algum visualizador de Markdown (no GitHub ou usando uma extensão própria em IDEs).

> Instruções rápidas para rodar o programa (Ubuntu):<br># na raiz do repositório<br>docker compose up --build<br># Acessar o Web: http://localhost:3000

---

## 1) Domínio escolhido

Apesar da temática da empresa e do exemplo dado no desafio, não existe uma especificação qual universo semântico deve alimentar o autocomplete.  

Então optei por fugir um pouco do mundo jurídico ir para **um domínio fechado de Cinema Brasileiro**, abrangendo:

* **Filmes brasileiros** — título original em PT‑BR + título internacional em EN;  
* **Diretores(as)**;  
* **Atores e atrizes** (elenco principal).

### 1.1 Por que cinema brasileiro?

| Aspecto | Justificativa |
|---|---|
| **Base própria** | Dados previamente coletados localmente (da rede Letterboxd, utilizando scraping): integração simples, sem dependência de APIs externas, e demonstração da minha experiência com ETL. |
| **Foco bem delimitado** | Mantém o escopo enxuto, ideal para um desafio pontual que não exige escala massiva. |
| **Volume controlado** | O número de termos cabe confortavelmente nos limites (≤ 20 sugestões por requisição). |
| **Robustez linguística** | O tema permite lidar com **acentuação** e variações (ex.: “José”/“Jose”), reforçando normalização e busca *case/diacritics‑insensitive*. |

### 1.2 Desvantagens

* **Escalabilidade limitada** — um conjunto menor pode esconder gargalos que surgiriam em bases muito maiores; restringe a demonstração de indexação/caching em alta escala.

---

## 2) Dataset e geração do `suggestions.json`

**Objetivo:** transformar o JSON bruto (com metadados completos) em uma lista simples, otimizada para autocompletar.

**Observação:** para reprodutibilidade/avaliação do desafio o suggestions.json vai ser fornecido já criado na pasta backend.db, e não haverá acesso à base original.

### 2.1 Passos executados
1. **Leitura do raw JSON** contendo metadados dos filmes.  
2. **Extração e normalização**  
   - Para cada filme → entrada `type: "movie"` com `text` (título PT‑BR) e `alias` (título EN).  
   - Para cada diretora/or → entrada `type: "director"`.  
   - Para cada integrante do elenco principal → entrada `type: "actor"`.  
   - Geração da versão sem acentuação em `norm` para buscas tolerantes a acentos e caixa.  
3. **Deduplicação** de diretores/atores por *slug* normalizado.  
4. **Persistência** em `suggestions.json` (≈ 9 000 sugestões; ≈ 67 000 linhas).  
5. **Ranking implícito** — mantida a **ordem do JSON original** (popularidade), dispensando campo de score.

### 2.2 Antes → Depois (exemplo ilustrativo)

**Raw (trecho do JSON original coletado)**

    {
      "movies": {
        "city-of-god": {
          "info": {
            "page": 1,
            "name": "City of God",
            "originalName": "Cidade de Deus",
            "releaseYear": 2002,
            "language": "Portuguese",
            "durationMin": 129,
            "directors": ["Fernando Meirelles"],
            "genres": ["Drama", "Crime"],
            "cast": ["Alexandre Rodrigues", "Leandro Firmino", "Phellipe Haagensen"],
            "letterboxdRatingAvg": 4.54,
            "trueRatingAvg": 4.52,
            "totalReviewsCount": 109689
          },
        }
      }
    }

**Transformado (trechos do `suggestions.json`)**

    [
      {
        "id": "city-of-god",
        "text": "Cidade de Deus",
        "type": "movie",
        "alias": ["City of God"],
        "norm": "cidade de deus"
      },
      {
        "id": "fernando-meirelles",
        "text": "Fernando Meirelles",
        "type": "director",
        "alias": [],
        "norm": "fernando meirelles"
      },
      {
        "id": "alexandre-rodrigues",
        "text": "Alexandre Rodrigues",
        "type": "actor",
        "alias": [],
        "norm": "alexandre rodrigues"
      }
      // …demais atores/atrizes e outros filmes
    ]

**Mapeamento essencial**
- `info.originalName` → `text` (exibição)  
- `info.name` → `alias[0]` (título EN)  
- `info.directors[]` → entradas `type: "director"`  
- `info.cast[]` → entradas `type: "actor"`  
- `text` normalizado (sem acento, minúsculas) → `norm`  
- **Demais metadados** (ano, duração, ratings etc.) **não entram** no autocompletar para manter o payload enxuto.

### 2.3 Justificativas (por que este formato)
- **Simplicidade para o algoritmo** — viabiliza *prefix search* rápido e highlight simples.  
- **Portabilidade do seed** — arquivo único e pequeno; pode ser lido em memória ou semeado em DB.  
- **Ranking implícito** — aproveitar a ordenação já presente na coleta evita criar e manter um campo de score separado.


---

## 3) Serviço de sugestões (API)

**Stack:** Python 3.12 • FastAPI • SQLite (FTS5).

### 3.1 Implementação
- **Seed automatizado no build:** `scripts/seed_db.py` lê `suggestions.json`, cria `db/suggestions.db` (FTS5) e insere os registros (com `norm` pré‑processado).
- **Busca:** `GET /suggest?term=` (validação `minLength=4`); consulta `WHERE norm MATCH 'term*' LIMIT 20`; resposta `[ { text, type }, … ]`.
- **Execução:** `uvicorn` na porta 8000; imagem *slim*.

### 3.2 Justificativas
- **SQLite FTS5** dá *full‑text* e *prefix* nativos, com ótima latência e sem operações externas.  
- **FastAPI** agiliza o protótipo com validação automática e tipagem clara.  
- **Atende ao requisito de execução simples** do desafio (rodável via Docker/compose).

---

## 4) Gateway GraphQL

**Stack:** Node 20 • Apollo Server 4.x.

### 4.1 Implementação
- **Schema:**
  
        type Suggestion { text: String!, type: String! }
        type Query { suggestions(term: String!): [Suggestion!]! }

- **Resolver:** faz `fetch` em `http://api:8000/suggest?term=…` e repassa o array sem transformação.
- **Execução:** container Node (TS compilado em *build*).

### 4.2 Justificativas
- **Exigência do desafio:** o front deve se comunicar com **GraphQL**, e o GraphQL com o back‑end.  
- **Separação nítida:** regra de negócio de busca fica centralizada no serviço Python; o Gateway apenas reexpõe em GraphQL.

---

## 5) Front‑end (React + Vite + Apollo Client)

### 5.1 Implementação
- **Cliente Apollo** apontando para `/graphql` (via proxy no Nginx).  
- **Componente `Autocomplete`** com *debounce* de 300 ms; exibe sugestões quando `term.length ≥ 4`; destaque do prefixo em **negrito**; clique preenche o campo.  
- **Nginx (runtime):** `try_files $uri $uri/ /index.html` para SPA e `location /graphql` → `gateway:4000`.

### 5.2 Justificativas
- **Vite + TS**: DX simples e build estático leve (Nginx).  
- **Apollo Client**: integração GraphQL idiomática com possibilidade de expansão (ex.: `fetchMore`).  
- **Proxy `/graphql`**: simplifica CORS e configuração no navegador.

---

## 6) Orquestração (Docker Compose)

    services:
      api:
        build: ./backend
        ports: ["8000:8000"]

      gateway:
        build: ./gateway
        ports: ["4000:4000"]
        depends_on: [api]

      web:
        build: ./frontend
        ports: ["3000:80"]
        depends_on: [gateway]
---

## 7) Como rodar (para avaliação)

    # na raiz do repositório
    docker compose up --build
    # Acessar Web:   http://localhost:3000

    # Sugestões rápidas e edge cases para testar o Autocomplete (digite 4+ letras):
    - Acentos:  "joao" e "joão" devem trazer resultados equivalentes
    - Caixa-alta: "FERNANDA" funciona igual a "fernanda"
    - Scroll:   termos com muitos matches (ex.: "fern" + mais letras) mostram 10 e permitem rolar até 20
    - Sem res.: termos aleatórios (ex.: "xyzq") não exibem a lista




---

## 8) Conformidade com o desafio (status)

Tabela criada para organização pessoal ao longo do desenvolvimento!

| Requisito | Como foi atendido | Status |
|---|---|---|
| **Front em React** | Vite + React + TS | **OK** |
| **Front → GraphQL** | Apollo Client → `/graphql` → Apollo Server | **OK** |
| **GraphQL → Back‑end** | Resolver chama `api:8000/suggest` | **OK** |
| **Campo de busca + título/placeholder** | Implementados | **OK** |
| **Responsivo** | Layout fluido | **OK** |
| **Sugestões apenas após ≥ 4 caracteres** | Validação no front e no back | **OK** |
| **Se não houver sugestões, não exibir elemento** | Render condicional da lista | **OK** |
| **Back‑end retorna no máx. 20** | SQL com `LIMIT 20` | **OK** |
| **Exibir 10; demais via scroll dentro do componente** | Estado atual: lista limitada visualmente (altura/scroll). | **OK**|
| **Negrito no trecho que coincide** | Função de highlight | **OK** |
| **Hover/Touch destacado** | Estilo visual de item ativo | **OK** |
| **Clique atualiza o campo principal** | `onClick` → `setTerm(s.text)` | **OK** |
| **Execução simples (Ubuntu/macOS)** | `docker compose up --build` sobe front + GraphQL + back | **OK** |
| **Documentação das decisões** | Este `COMMENTS.md` | **OK** |

---

## 9) Testes 

Pelo site ser **simples**, a base **não tão extensa** e o projeto ser um **desafio pontual**, optei por realizar **testes manuais** ao longo do desenvolvimento, o que pareceu ser mais produtivo nesse caso. O foco foi garantir que o comportamento estivesse correto do ponto de vista do usuário e que os contratos entre as camadas se mantivessem estáveis.

**O que foi verificado manualmente:**

- **Rankeamento/Scoring**
  - Conferi que a **ordem das sugestões** respeita a ordenação do seed (popularidade do dataset), isto é, a API devolve os itens **já ranqueados** e o front apenas **renderiza na ordem**.
  - Amostrei buscas típicas (ex.: prefixos de nomes e títulos) para checar a **consistência da ordenação** entre chamadas sucessivas.

- **Deduplicação**
  - Validei que **diretores/atores repetidos** em filmes diferentes aparecem aparecem apenas uma vez no conjunto de sugestões, mesmo quando presentes em múltiplos filmes vez no conjunto de sugestões, mesmo quando presentes em múltiplos filmes.
  - Testes por amostragem de nomes com acentuação e sem acento para garantir que o **slug/`norm`** evita duplicatas.

- **Regras funcionais pedidas no desafio**
  - **≥ 4 caracteres** para começar a sugerir: o front **só chama** o GraphQL após o *debounce* e a API também **restringe** (validação).
  - **Limite de 20** itens no backend: conferido por `curl` na API e pela rede no navegador.
  - **Exibir 10** itens visíveis imediatamente e **scroll** para ver até 20 dentro do componente (altura da lista fixa + `overflow-y`).
  - **Highlight** do trecho coincidente em **negrito** no texto da sugestão.
  - **Hover** de item com fundo e **barra azul** à esquerda, sem “pular” layout.
  - **Clique** em uma sugestão **preenche** o campo de busca.
  - **Não exibir lista** quando não há sugestões.

- **Contratos entre camadas**
  - **Front → GraphQL**: verificação do shape da query `suggestions(term)` e do array retornado.
  - **GraphQL → API**: conferência do *pass‑through* de campos (`text`, `type`) e do manuseio de erros.
  - **Nginx**: proxy de `/graphql` para o gateway e `try_files` da SPA funcionando (sem 404 em reload).

> Observação: Não foram implementados testes unitários/integrados/E2E automatizados, como não foi exigido no escopo e não parecia ser essencial para o desafio.

## 10) Implementações adicionais (fora do escopo estrito do desafio)

Para além do que foi explicitamente solicitado, implementei um pequeno “refino de produto” para o domínio escolhido (Cinema Brasileiro):

- **Estilização contextual do front-end**
  - Tipografia e hierarquia visual ajustadas para leitura confortável.
  - Paleta com **azul de destaque** coerente entre hover, botão e elementos de ênfase.

- **Tooltip/“i” informativo no título**
  - Ícone com *hover* que explica rapidamente o propósito da página (o que pode ser buscado e a natureza do domínio).

- **FlipWord no título**
  - Animação de palavra-chave (“filmes, atores, diretores, …”) que alterna a cada 4s, com slide horizontal e fade.
  - Medição dinâmica para evitar *layout shift* ou corte da fonte.

- **Lista de sugestões mais rica**
  - Exibição da **categoria** da sugestão (ex.: “actor”, “director”, “movie”) ao lado do texto.

- **Modo escuro (toggle)**
  - **Switch** com sol/lua nas extremidades e **controle deslizante**.
  - Alterna a paleta global (fundo, texto, bordas, sombras) e mantém legibilidade do conteúdo.

---

## 11) Extensões planejáveis (se o desafio fosse mais extenso)

Abaixo, ideias priorizadas que evoluiriam o protótipo para um “MVP de busca”:

1. **Resultados e navegação**
   - Dar função ao botão **BUSCAR** (Enter/click) com *routing* para páginas de resultado.
   - **Páginas dedicadas** por tipo:
     - **/filmes/:id** com pôster, ano, sinopse, diretores e elenco.
     - **/atores/:id** com filmografia.
     - **/diretores/:id** com lista de trabalhos.
   - Estado de **“sem resultados”** com sugestões alternativas.

2. **Aprimoramentos de busca**
   - **Fuzzy matching** (edições e transposições) + sinônimos e apelidos.
   - **Relevância/score** (popularidade, cliques, histórico) e *boost* por tipo.
   - **Sinônimos/aliases enriquecidos** (ex.: nomes artísticos, títulos alternativos).
   - **Correção ortográfica** / “Você quis dizer…”.

3. **Acessibilidade & UI/UX**
   - Padrões **ARIA** (listbox/option), **navegação por teclado** (↑/↓/Enter/Esc) e leituras de *screen reader*.
   - **Persistência** de preferências (ex.: tema escuro) em `localStorage`.
   - **Polir animação** do FlipWord no título principal. 

4. **Arquitetura e performance**
   - **Cache** no Gateway e/ou no cliente (Apollo) com *stale-while-revalidate*.
   - **Virtualização** da lista para bases maiores.

---

## 12) Considerações finais

Este desafio foi **estimulante** e me permitiu exercitar ponta a ponta competências de desenvolvimento **full‑stack**: modelagem de dados, API rápida com FastAPI/SQLite FTS, um **Gateway GraphQL** leve e um **front React** com foco em usabilidade.

Fiquei particularmente feliz em **reaproveitar parte de trabalhos anteriores** (coleta/normalização de dados do domínio de cinema), o que acelerou a etapa de conteúdo. Para fins de avaliação, o desenvolvimento foi concluído em **aproximadamente 4 dias**. Reorientei partes da camada de front-end com auxílio pontual de IA generativa, especialmente para animações e estilos — aspectos em que eu tinha menos familiaridade no início do desafio.

Por fim, gostaria de pontuar que **valorizo muito** o formato com **alta reprodutibilidade via Docker**: `docker compose up --build`, levantando todo o stack de forma previsível, facilitando o desenvolvimento, a avaliação além da evolução futura e também que aprendi bastante através do desafio.

Obrigado pela oportunidade!

