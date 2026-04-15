# Cinefy Club Brand Guide

## Brand
- **Name**: Cinefy Club
- **Slogan**: Sua curadoria social de filmes
- **Positioning**: plataforma social de descoberta, organizacao, curadoria e compartilhamento de filmes

## Active Assets
- **Primary wordmark (SVG)**: `public/assets/img/logo.svg`
- **Primary wordmark (PNG)**: `public/assets/img/logo.png`
- **Favicon**: `public/assets/img/favicon-club.svg`
- **GitHub / social cover**: `public/assets/img/github-cover.svg`

## Usage Notes
- Use `logo.svg` by default inside the product whenever possible.
- Use `logo.png` for contexts that require raster fallback or external upload flows.
- Use `favicon-club.svg` as the browser tab icon.
- Use `github-cover.svg` for Open Graph, Twitter cards and repository presentation when a wide cover image is needed.

## Naming Guidance
- Public-facing copy should use **Cinefy Club**.
- The preferred supporting line is **Sua curadoria social de filmes**.
- Some internal technical identifiers may still use `Cinefy` for compatibility:
  - local storage keys
  - Firebase project names
  - JS globals already wired into the app
- Do not rename those internal identifiers unless there is a specific migration plan.

## Typography
- **Display**: Sora
- **Body**: Outfit
- **Recommended weights**:
  - Sora: 600, 700, 800
  - Outfit: 400, 500, 600, 700
- **Google Fonts source**:
  - `https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Sora:wght@400;600;700;800&display=swap`

## Core Palette
- **Brand Ember**: `#e83b24`
- **Brand Deep Ember**: `#9f170d`
- **Warm Highlight**: `#f15b3a`
- **Ink Background**: `#14090a`
- **Panel Surface**: `rgba(33, 14, 15, 0.72)`
- **Soft Border**: `rgba(255, 255, 255, 0.10)`
- **Primary Text**: `#ffffff`
- **Secondary Text**: `#d4d4d8`
- **Muted Text**: `#a1a1aa`

## Product Visual Language
- Dark cinematic atmosphere by default
- Glassmorphism panels with blur and soft borders
- Rounded containers with generous radius
- Warm ember gradients for brand emphasis
- Theme-aware UI accents across cards, pills, buttons and section markers

## Voice And Tone
- Warm
- Social
- Curated
- Cinematic
- Confident without sounding formal or corporate

## UI Guidance
- Section titles should feel editorial, not generic.
- Primary CTAs should be short and high-clarity.
- Social actions should minimize clicks and show state clearly:
  - `Adicionar amigo`
  - `Pedido enviado`
  - `Amigo`
  - `Adicionado`
- Public profile and collaborative list flows should always privilege clarity over density.

## Current Product Themes
- The application supports multiple themes chosen by the user.
- Brand assets should remain recognizable across themes.
- Shared assets such as the logo, favicon and cover should not depend on a runtime theme to remain legible.

## Repository Safety Notes
- Brand assets in this folder are public-safe.
- Do not store:
  - API keys
  - exported user data
  - private screenshots with real personal information
  - credential files
- `robots.txt`, `sitemap.xml` and `.gitignore` are expected repository files and are not sensitive by themselves.

## Quick Reference
- **Use in app header/footer**: `logo.svg`
- **Use for external uploads / fallback image fields**: `logo.png`
- **Use in browser tabs**: `favicon-club.svg`
- **Use in GitHub README cards / social embeds**: `github-cover.svg`

This guide reflects the active Cinefy Club identity currently shipped in the repository and in production.
