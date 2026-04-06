# CINEfy Brand Guide

## Logo
- **Arquivo**: `assets/img/logo.svg`
- **Formato**: SVG (vetorial, escalável)
- **Fonte**: Sora (Google Fonts)
- **Cores**: Gradiente de #e83b24 para #9f170d
- **Uso**: Centralizado no footer, como link para index.html

## Fontes
- **Display**: Sora (Google Fonts) - Usada em títulos principais
- **Body**: Outfit (Google Fonts) - Usada no texto do corpo
- **Pesos**: 300, 400, 500, 600, 700, 800
- **Links**:
  - https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Sora:wght@400;600;700;800&display=swap

## Paleta de Cores
- **Primary**: #e83b24 (Vermelho principal)
- **Primary Deep**: #9f170d (Vermelho escuro)
- **Background Dark**: #14090a (Fundo escuro)
- **Panel**: rgba(33, 14, 15, 0.72) (Painéis com transparência)
- **Texto**: Branco (#ffffff), Cinza claro (#f4f4f5), Cinza médio (#a1a1aa), Cinza escuro (#71717a)

## Estilos Gerais
- **Tema**: Dark mode por padrão (class="dark")
- **Gradientes de Fundo**:
  - Radial no topo esquerdo: rgba(232, 59, 36, 0.22)
  - Radial no topo direito: rgba(255, 255, 255, 0.07)
  - Linear vertical: rgba(20, 9, 10, 0.96) para rgba(20, 9, 10, 1)
- **Bordas**: border-white/10 (transparente)
- **Sombras**: backdrop-filter: blur(18px), box-shadow com rgba(0,0,0,0.34)
- **Scrollbars**: Personalizados com cores da paleta

## Componentes
- **Navbar**: Links em branco, hover em vermelho
- **Footer**: Centralizado, logo em vermelho, links em cinza, powered by TMDB
- **Botões**: Gradiente primary, hover brightness-110
- **Painéis**: glass-panel com fundo semi-transparente e blur

## Tecnologias
- **CSS Framework**: Tailwind CSS (via CDN)
- **Ícones**: Material Symbols Outlined
- **Backend**: Firebase (Auth, Firestore)
- **API**: TMDB (The Movie Database)

Este guia pode ser usado para manter consistência visual em futuras atualizações ou repositórios no GitHub.