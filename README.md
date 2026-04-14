# CINEfy

<p align="center">
  <img src="public/assets/img/github-cover.svg" alt="Capa do projeto CINEfy" width="100%">
</p>

<p align="center">
  Plataforma web social para descobrir filmes, montar listas, compartilhar curadorias, publicar reviews e navegar por perfis cinefilos com uma interface tematica.
</p>

<p align="center">
  <a href="https://cinefy3-83a9a.web.app">Demo online</a>
  &middot;
  <a href="https://github.com/Felipe53650/cinefy">Repositorio</a>
  &middot;
  <a href="./docs/architecture.md">Arquitetura</a>
</p>

## Visao geral

O CINEfy e um produto web focado em curadoria cinematografica com camada social. A aplicacao permite descobrir filmes, montar listas proprias, compartilhar selecoes por link, navegar em perfis publicos, publicar reviews e interagir com outras pessoas da comunidade.

Mais do que uma landing page ou um CRUD simples, o projeto foi trabalhado como um produto real:

- fluxo publico e autenticado
- identidade visual consistente
- descoberta de conteudo com baixo atrito
- recursos sociais distribuidos por varias telas
- infraestrutura real com Firebase e Cloud Functions

## O que este projeto demonstra

Para recrutadores, avaliadores ou clientes, o CINEfy mostra:

- construcao de produto end-to-end com foco em UX
- frontend em JavaScript vanilla organizado em escala de aplicacao
- integracao real com Auth, Firestore, Storage, Hosting e Functions
- hardening de seguranca em app web ja em producao
- capacidade de evoluir uma base vibecodada para um produto mais consistente e mais vendavel

## O que a aplicacao entrega hoje

- autenticacao com email e senha, Google e Facebook
- home publica com recomendacoes, carrosseis e busca acessivel
- busca com filtros, classificacao etaria e resultados integrados ao TMDB
- multiplas listas por usuario
- compartilhamento de listas em modo leitor ou edicao colaborativa
- perfil proprio editavel
- perfil publico de usuarios
- reviews publicas do CINEfy e camada social nos detalhes do filme
- sistema de amizades com pedidos, aceite e navegacao entre perfis
- temas visuais globais
- upload de avatar e poster manual com Firebase Storage
- proxy seguro do TMDB via Cloud Functions

## O que faz o CINEfy se destacar

- busca global persistente no cabecalho
- recomendacoes personalizadas baseadas no comportamento do usuario
- perfis publicos navegaveis por clique em cards, reviews e amizades
- lista compartilhada com permissao de leitura ou edicao colaborativa
- fluxo social com baixa friccao em desktop e mobile
- cuidado tecnico com acessibilidade, contraste, feedbacks e responsividade

## Features em destaque

- descoberta de filmes com busca, filtros e leitura de metadados relevantes
- curadoria pessoal com multiplas listas e posters manuais
- compartilhamento por link com modo leitor ou edicao colaborativa
- perfis publicos com reviews, listas abertas e camada social
- recomendacoes iniciais personalizadas com base no comportamento do usuario

## Casos de uso

O CINEfy pode ser posicionado para:

- cinefilos que querem organizar e compartilhar curadorias
- criadores de conteudo que desejam publicar listas tematicas
- clubes de cinema e comunidades fechadas
- produtos white-label de curadoria cultural

## Evolucao recente

Algumas entregas mais relevantes das ultimas iteracoes:

- proxy do TMDB via Cloud Functions
- upload real de avatar e poster no Storage
- perfis publicos navegaveis
- lista compartilhada com permissao de edicao
- reviews publicas e interacao social em detalhes e perfis

## Capturas da aplicacao

Esses prints mostram alguns fluxos principais da interface atual.

A galeria abaixo privilegia telas publicas e neutras, sem expor dados pessoais reais de usuarios do projeto.

<p align="center">
  <img src="public/assets/img/screenshots/home.png" alt="Home do CINEfy" width="90%">
</p>

<p align="center">
  <img src="public/assets/img/screenshots/login.png" alt="Tela de login do CINEfy" width="44%">
  <img src="public/assets/img/screenshots/cadastro.png" alt="Tela de cadastro do CINEfy" width="44%">
</p>

### Outros fluxos importantes da interface atual

Mesmo sem expor dados sensiveis no repositório, a versao atual do produto ja inclui estes percursos relevantes:

- busca com cabecalho persistente, filtros, classificacao etaria e cards com estado `Na lista`
- detalhes do filme com diretores, streaming, reviews da comunidade e acoes sociais
- perfil publico navegavel com amizade, listas abertas e reviews publicas
- listas compartilhadas com permissao de leitura ou edicao colaborativa

Para uma visao mais completa da estrutura do produto, vale abrir tambem:

- [Arquitetura do projeto](./docs/architecture.md)
- [Demo online](https://cinefy3-83a9a.web.app)

## Stack

### Frontend

- HTML multipagina
- CSS global + CSS por pagina
- Tailwind CSS compilado localmente
- JavaScript vanilla modularizado por tela

### Plataforma

- Firebase Hosting
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Cloud Functions for Firebase

### Integracoes externas

- TMDB como fonte principal de catalogo, metadados, streaming e IDs externos
- links auxiliares para IMDb, Letterboxd e AdoroCinema

## Decisoes tecnicas importantes

- TMDB saiu do frontend e passou a ser consumido por um proxy em Cloud Function
- regras de Firestore e Storage foram endurecidas para reduzir confianca excessiva no cliente
- uploads de avatar e poster passaram a usar Storage
- a camada social foi distribuida por perfil publico, reviews, amizades e listas compartilhadas
- o design system ficou orientado por tema, com variaveis globais e componentes reutilizaveis

## Desafios tecnicos resolvidos

- transformar uma base inicial mais improvisada em uma aplicacao com fluxo social consistente
- reduzir atrito de descoberta com busca global, filtros, indicadores de estado e atalhos contextuais
- migrar a integracao do TMDB para backend sem quebrar a experiencia do usuario
- sair de persistencia fraca de imagens para um fluxo real com Firebase Storage
- criar perfis publicos, reviews publicas e amizades sem perder clareza entre o que e publico e o que e privado
- reforcar seguranca com rules, headers, CSP, sanitizacao e menor confianca no frontend

## Antes e depois

No inicio, o projeto funcionava mais como uma interface de curadoria com autenticacao e algumas telas principais. Ao longo da evolucao, o CINEfy ganhou camadas mais proximas de produto:

- de listas simples para listas compartilhadas com leitura e edicao colaborativa
- de perfil apenas proprio para perfis publicos navegaveis
- de reviews locais para reviews publicas da comunidade
- de busca isolada para descoberta integrada por home, busca, detalhes e perfis
- de integracao externa direta no cliente para proxy seguro via Cloud Functions

O resultado hoje e um produto bem mais coerente, navegavel e apresentavel tanto tecnicamente quanto comercialmente.

## Roadmap comercial do produto

Hoje o CINEfy ja pode ser entendido em tres camadas de valor:

- portfolio tecnico forte, mostrando construcao real de produto com Firebase, UX e camada social
- base white-label para nichos ligados a cinema, creators, clubes e curadoria cultural
- ponto de partida para uma evolucao futura em modelo SaaS com descoberta personalizada e features sociais mais profundas

Do ponto de vista de negocio, os proximos incrementos com mais potencial seriam:

- analytics de uso e retencao
- recomendacao personalizada mais sofisticada
- onboarding social com importacao de gostos ou interesses
- camada premium para curadores, criadores ou comunidades fechadas

## Seguranca do repositorio

### O que deve continuar publico no repo

- `robots.txt`
- `sitemap.xml`
- `.gitignore`
- `firebase.json`
- `firestore.rules`
- `storage.rules`

Esses arquivos nao sao segredos. Eles fazem parte da configuracao normal do projeto e devem ser versionados.

### O que nao deve ser publicado

- chaves privadas e segredos em `.env`
- tokens de servico
- dumps de usuario
- dados pessoais exportados do Firestore
- logs com credenciais
- segredos do TMDB ou de qualquer outra integracao paga

### Como isso esta tratado hoje

- a chave do TMDB nao fica mais exposta no frontend
- o projeto usa `TMDB_API_KEY` como secret nas Cloud Functions
- o `.gitignore` foi reforcado para ignorar `.env`, `.env.*` e arquivos locais de segredo
- o README evita expor dados sensiveis de usuarios reais

## Estrutura do projeto

```text
public/
  assets/
    css/
    img/
    js/
  components/
  *.html
functions/
  index.js
firestore.rules
storage.rules
firebase.json
docs/
  architecture.md
```

## Como executar localmente

### 1. Instale as dependencias do frontend

```powershell
npm install
```

### 2. Gere o CSS compilado

```powershell
npm run build:css
```

### 3. Instale as dependencias das Functions

```powershell
cd functions
npm install
cd ..
```

### 4. Suba os emuladores

Para a experiencia mais completa:

```powershell
firebase emulators:start
```

Tambem e possivel servir apenas a pasta `public`, mas os fluxos com rewrite `/api/tmdb`, Auth, Storage e regras do Firebase ficam melhores com os emuladores.

## Deploy

### Hosting

```powershell
firebase deploy --only "hosting"
```

### Backend e regras

```powershell
firebase deploy --only "functions,firestore:rules,storage"
```

## Documentacao adicional

- [Arquitetura do projeto](./docs/architecture.md)

## Estado atual do produto

O CINEfy ja esta acima de um MVP visual. Hoje ele tem base funcional para:

- portfolio tecnico forte
- produto white-label para nichos ligados a cinema
- evolucao para SaaS social de curadoria cinematografica

## Proximos passos naturais

- aprofundar ranking de recomendacao personalizada
- ampliar analytics e observabilidade
- enriquecer dados externos sem quebrar a base TMDB
- adicionar cobertura automatizada de testes para fluxos criticos
- evoluir a camada social com mais sinais de conexao entre usuarios

## Autor

Felipe De Oliveira Santos
