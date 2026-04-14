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

## Capturas da aplicacao

Esses prints mostram alguns fluxos principais da interface atual.

<p align="center">
  <img src="public/assets/img/screenshots/home.png" alt="Home do CINEfy" width="90%">
</p>

<p align="center">
  <img src="public/assets/img/screenshots/login.png" alt="Tela de login do CINEfy" width="44%">
  <img src="public/assets/img/screenshots/cadastro.png" alt="Tela de cadastro do CINEfy" width="44%">
</p>

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
