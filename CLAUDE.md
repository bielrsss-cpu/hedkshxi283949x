# Instruções para o Claude Code

Este repositório é um **modelo de caderno de estudos para concurso**, preenchido com um exemplo (TJ-SP Escrevente).

- Se o usuário pedir para adaptar a outro concurso, siga o **ADAPTAR.md** à risca, começando por um plano curto e esperando o ok.
- Tudo o que muda entre concursos fica em `concurso.config.json`. Não espalhe valores fixos pelo código.
- Nunca altere o texto de leis em `caderno/03-lei-seca/`: grifos e anotações são dados separados.
- Conteúdo em `caderno/` (Markdown). Site em `src/` (Astro + Preact). Funções em `netlify/`.
- Antes de concluir uma etapa: `npx tsc --noEmit` e `npm run build`. Faça um commit por etapa, com mensagem em português.
- Responda e escreva textos em português do Brasil.
