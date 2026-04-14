# CINEfy

<p align="center">
  <img src="public/assets/img/github-cover.svg" alt="Capa do projeto CINEfy" width="100%">
</p>

<p align="center">
  Plataforma web social para descobrir filmes, montar listas, compartilhar curadorias, publicar reviews e navegar por perfis cinefilos com uma interface temática.
</p>

<p align="center">
  <a href="https://cinefy3-83a9a.web.app">Demo online</a>
  &middot;
  <a href="https://github.com/Felipe53650/cinefy">Repositorio</a>
  &middot;
  <a href="./docs/architecture.md">Arquitetura</a>
</p>

## Visao geral

O CINEfy evoluiu de uma ideia de curadoria pessoal para um produto web com camada social real. Hoje ele permite descobrir filmes, criar listas proprias, compartilhar listas por link, navegar em perfis publicos, acompanhar reviews da comunidade e manter uma identidade visual personalizada por tema.

O projeto foi desenvolvido com foco em:

- experiencia de uso em desktop e mobile
- descoberta cinematografica com baixo atrito
- compartilhamento social de listas e opinioes
- arquitetura simples de manter, com frontend em JavaScript vanilla e Firebase como base de produto

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

## Capturas da aplicacao

Esses prints mostram os fluxos principais da interface atual do projeto no GitHub.

<p align="center">
  <img src="public/assets/img/screenshots/home.png" alt="Home do CINEfy" width="90%">
</p>

<p align="center">
  <img src="public/assets/img/screenshots/login.png" alt="Tela de login do CINEfy" width="44%">
  <img src="public/assets/img/screenshots/cadastro.png" alt="Tela de cadastro do CINEfy" width="44%">
</p>

## Stack e arquitetura

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

## Diferenciais tecnicos do projeto

- busca global persistente no cabecalho
- listas compartilhadas com niveis diferentes de acesso
- perfis publicos navegaveis por clique em cards, reviews e amizades
- motor inicial de recomendacao baseado em comportamento do usuario
- hardening de seguranca com CSP, HSTS, rules de Firestore/Storage e proxy do TMDB no backend
- tratamento de UX com foco em friccao baixa, responsividade e coerencia visual entre telas

## Seguranca do repositório

### O que e publico por natureza e pode continuar no repo

- `robots.txt`
- `sitemap.xml`
- `.gitignore`
- `firebase.json`
- `firestore.rules`
- `storage.rules`

Esses arquivos nao sao segredos. Pelo contrario: fazem parte da configuracao normal do projeto e devem ser versionados.

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
- o README nao expoe dados sensiveis de usuarios reais

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

## Rodando localmente

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

### 4. Rode localmente

Para uma experiencia completa com Hosting, Firestore, Auth, Storage e Functions:

```powershell
firebase emulators:start
```

Se quiser apenas abrir a interface rapidamente, tambem e possivel servir a pasta `public`, mas recursos que dependem do rewrite `/api/tmdb` e das regras do Firebase funcionam melhor com os emuladores.

## Deploy

### Hosting

```powershell
firebase deploy --only "hosting"
```

### Regras e backend

```powershell
firebase deploy --only "functions,firestore:rules,storage"
```

## Documentacao adicional

- [Arquitetura do projeto](./docs/architecture.md)

## Estado atual do produto

O CINEfy ja esta acima de um MVP visual. Hoje ele tem base funcional para:

- portfólio tecnico forte
- produto white-label para nichos ligados a cinema
- evolucao para SaaS social de curadoria cinematografica

## Proximos passos naturais

- aprofundar ranking de recomendacao personalizada
- adicionar mais acoes sociais em pontos de descoberta
- evoluir analiticos e observabilidade
- enriquecer dados externos com mais fontes sem quebrar a base TMDB
- adicionar cobertura automatizada de testes para fluxos criticos

## Autor

Felipe De Oliveira Santos
