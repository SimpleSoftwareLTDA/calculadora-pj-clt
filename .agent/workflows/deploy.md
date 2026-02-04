---
description: Como implantar o projeto no Cloudflare Pages
---

Este workflow descreve o processo de implantação da calculadora no Cloudflare Pages.

### Pré-requisitos
1. Uma conta no [Cloudflare](https://dash.cloudflare.com/).
2. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) instalado (`npm install -g wrangler`).

### Passos de Implantação

#### Opção 1: Automático (GitHub/GitLab) - Recomendado
1. Suba o código para um repositório Git.
2. No painel do Cloudflare Pages, selecione **Connect to Git**.
3. Escolha o repositório `calculadora-pj-clt`.
4. Configurações de Build:
   - **Framework preset**: `None`
   - **Build command**: `echo "No build step"` (ou deixe em branco)
   - **Build output directory**: `.` (raiz do projeto)
5. Clique em **Save and Deploy**.

#### Opção 2: Manual via Wrangler CLI
Se preferir implantar diretamente do seu terminal:

// turbo
1. Faça login no Cloudflare:
```bash
npx wrangler login
```

// turbo
2. Implante o projeto:
```bash
npm run deploy
```

### Configurações Ativas
- **Headers**: O arquivo `_headers` configura CSP, HSTS e cache.
- **Redirects**: O arquivo `_redirects` está pronto para futuras rotas.
- **Wrangler**: O arquivo `wrangler.toml` define o nome do projeto e a compatibilidade.
