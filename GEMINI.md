# Projeto: Calculadora PJ vs CLT - Descomplica DEV Na Gringa

Este projeto é uma ferramenta web interativa projetada para ajudar desenvolvedores brasileiros a comparar contratos de trabalho PJ (Pessoa Jurídica) e CLT (Consolidação das Leis do Trabalho), com um foco especial em profissionais que buscam o mercado internacional ("Dev na Gringa").

## Visão Geral do Projeto

A aplicação é uma ferramenta de página única (SPA) que utiliza tecnologias web puras para fornecer cálculos em tempo real de impostos, benefícios e ganhos líquidos anuais. Ela é otimizada para SEO e AEO (Answer Engine Optimization) para atrair tráfego orgânico interessado em transição de carreira e planejamento financeiro para desenvolvedores.

### Tecnologias Principais

- **Frontend:** HTML5, CSS3 (Custom Properties, Glassmorphism, Keyframe Animations).
- **Lógica:** Vanilla JavaScript (ES6+).
- **SEO/AEO:** JSON-LD para dados estruturados (Person, Organization, SoftwareApplication, FAQPage), Sitemap.xml e Robots.txt configurado para crawlers de IA.
- **Design:** Inspirado em princípios modernos de UI/UX, com elementos visuais dinâmicos ("blobs" de fundo) e tipografia Inter.

## Estrutura de Arquivos

- `index.html`: Estrutura principal, metadados de SEO e seções de conteúdo (calculadora, comparativo, FAQ, glossário).
- `index.js`: Motor de cálculo contendo tabelas de impostos de 2024 (INSS, IRPF, Simples Nacional) e lógica de manipulação do DOM.
- `index.css`: Estilização completa, incluindo variáveis de tema e design responsivo.
- `sitemap.xml` & `robots.txt`: Arquivos de configuração para indexação e visibilidade em motores de busca e assistentes de IA.

## Funcionalidades de Cálculo

A lógica reside em `index.js` e cobre:
1.  **CLT:** Cálculo de INSS, IRPF (tabelas progressivas), 13º salário, Férias (1/3) e FGTS (8%).
2.  **PJ:** Simulação de Simples Nacional (Anexo III e V), impacto do Fator R (folha > 28% do faturamento), Pro-labore, INSS/IRPF sobre Pro-labore e custos fixos de contabilidade.
3.  **Comparação:** Ponto de equilíbrio (Break-even), diferença anual líquida e veredito percentual.

## Guia de Desenvolvimento e Execução

Como este é um projeto estático puro, não há etapa de build ou dependências de pacote.

- **Para rodar localmente:** Basta abrir o arquivo `index.html` em qualquer navegador moderno.
- **Para desenvolvimento:** Recomenda-se o uso de uma extensão como "Live Server" no VS Code ou similar para hot-reload.
- **Testes:** Atualmente não há um framework de testes automatizados. A verificação é feita manualmente através da interface do usuário.

## Convenções do Projeto

- **Estilo de Código:** JavaScript funcional e manipulativo do DOM de forma imperativa simples.
- **Comentários:** Usados para documentar seções de lógica de cálculo e tabelas de referência.
- **SEO:** Manter os dados estruturados em `index.html` sincronizados com o conteúdo visível para melhor performance em AEO.

---
*Este arquivo serve como contexto de instrução para o Gemini CLI e outros agentes de IA que operam neste repositório.*
