---
titulo: "Provas anteriores e gabaritos"
---

# Provas anteriores e gabaritos

Coloque aqui os PDFs das provas e gabaritos (`AAAA-prova.pdf`, `AAAA-gabarito.pdf`) e peça ao Claude Code a conversão para `AAAA-questoes.md`. O site lê automaticamente todo arquivo `*-questoes.md` desta pasta.

> **EXEMPLO:** `2025-questoes.md` tem 11 das 70 questões da prova VUNESP 2025 do TJ-SP, só para mostrar o formato. Apague-o ao adaptar.

## Situação

| Ano | PDFs | Questões no site |
|---|---|---|
| (preencher na adaptação) | | |

## Formato de `AAAA-questoes.md`

```markdown
---
titulo: "BANCA AAAA · ÓRGÃO · Cargo"
ano: AAAA
data: "AAAA-MM-DD"
banca: "BANCA"
questoes: 70
gabarito: "oficial definitivo / preliminar (dizer qual)"
fonte_prova: "url"
fonte_gabarito: "url"
---

## Texto para as questões 01 a 05 {#texto-01-05}

Texto de apoio...

### Q01 {#q01}
disciplina: portugues · assunto: interpretacao · gabarito: C · lei: 03-lei-seca/arquivo.md#art-n

Enunciado...

- (A) ...
- (B) ...
- (C) ...
- (D) ...
- (E) ...
```

- `disciplina` é um slug de `concurso.config.json`. `lei:` é opcional.
- Questão anulada: `gabarito: X` (qualquer resposta conta como acerto).
- Termos destacados na prova vão em **negrito**, e lacunas viram `______`.
- Figuras ficam em `public/provas/AAAA-qNN.png` e são citadas com `![descrição](/provas/AAAA-qNN.png)`. Tabelas viram tabela Markdown.
