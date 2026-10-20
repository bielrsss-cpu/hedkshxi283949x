# Caderno de estudos (conteúdo)

Tudo aqui é Markdown com front matter YAML. O site lê estes arquivos no build. Os registros do usuário (sessões, erros, redações, simulados, tarefas marcadas, grifos) ficam no Netlify Blobs e voltam para cá, no mesmo formato dos modelos, pelo botão **Exportar**.

> O conteúdo atual é um **EXEMPLO** (TJ-SP Escrevente). Para adaptar a outro concurso, veja `../ADAPTAR.md`.

## Estrutura

```
caderno/
├── 00-edital/edital.md          texto integral do edital
├── 01-analise/analise.md        peso de cada disciplina e assunto nas provas anteriores, notas de corte
├── 02-cronograma/cronograma.md  semanas com tarefas em checklist e links para a lei seca
├── 03-lei-seca/                 só os artigos do recorte do edital, um arquivo por norma
├── 04-sessoes/_modelo-sessao.md         modelo de sessão de estudo
├── 05-caderno-de-erros/_modelo-erro.md  modelo de erro
├── 06-redacao/_modelo-redacao.md        modelo de redação
├── 07-simulados/_modelo-simulado.md     modelo de simulado
└── 08-provas/                   provas anteriores (PDFs) e AAAA-questoes.md
```

## Convenções

### Lei seca (`03-lei-seca/`)
- Front matter: `titulo`, `norma`, `recorte_edital`, `item_edital`, `disciplina` (slug de `concurso.config.json`), `artigos_extraidos`, `fonte_oficial`, `texto_obtido_em`, `status` (`ok` ou `PENDENTE`) e, quando houver, `origem_do_arquivo` e `observacoes`.
- Títulos estruturais: `####` (Título, Livro, Parte) e `#####` (Capítulo, Seção).
- Cada artigo é `###### Art. N {#art-n}`. A âncora usa o número sem ponto e o sufixo em minúsculas: `#art-1189`, `#art-311-a`.
- A rubrica, quando existe, vem em itálico logo abaixo do título. As notas de alteração são mantidas. O texto revogado (riscado) é removido.

### Cronograma (`02-cronograma/cronograma.md`)
- Cada semana é `## SNN · dd/mm – dd/mm/aaaa · Fase N`.
- Cada tarefa é `- [ ] \`ETIQUETA\` descrição → [lei seca](../03-lei-seca/arquivo.md#art-n)`. As etiquetas ficam em `concurso.config.json`.
- O ID de uma tarefa é `SNN-índice` (ex.: `S03-2`), e o das tarefas da seção "Prazos do edital" é `PRAZO-n`.

### Registros (pastas 04 a 07)
Um arquivo `.md` por registro, com o front matter do `_modelo-*.md` da pasta. Os blocos do simulado e os critérios da redação seguem `concurso.config.json`.
