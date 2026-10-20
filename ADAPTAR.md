# Como adaptar este caderno a outro concurso

Este arquivo é o roteiro para o Claude Code. O usuário informa concurso, cargo, banca, edital, data da prova e tempo de estudo, e você transforma o modelo (hoje preenchido com o exemplo TJ-SP Escrevente) no caderno dele.

## Regras

1. **Mostre um plano curto antes de qualquer código ou download** e espere o ok do usuário. O plano lista: disciplinas, blocos e mínimos, normas a baixar (com o recorte de cada uma), fontes das provas e como fica o cronograma.
2. **Nunca altere o texto das leis.** Grifos, anotações e estados são dados separados. O texto revogado (riscado) é removido. As notas de alteração ("Redação dada pela…", "Incluído pela…") são mantidas.
3. **Sempre de fonte oficial.** Federal: Planalto. Estadual: Assembleia Legislativa ou site do governo. Atos internos: site do órgão. Registre a fonte e a data no front matter.
4. **Confira linha a linha** o texto convertido contra a fonte (`ferramentas/conferir.py`) e relate o resultado.
5. **Não contorne bloqueios** (Cloudflare, captcha, login). Se não conseguir baixar algo, diga o quê e peça o PDF ao usuário.
6. **Não invente** texto de lei, gabarito nem dados do edital. Se algo não estiver na fonte, registre em `observacoes` e avise.
7. **Faça um commit a cada etapa concluída**, com mensagem em português.
8. Interface e textos em português do Brasil.

## Passo a passo

### 1. Limpe o exemplo
Apague os arquivos marcados como **EXEMPLO**, mas guarde-os como referência de formato até terminar:
- `caderno/00-edital/edital.md`;
- `caderno/01-analise/analise.md`;
- `caderno/03-lei-seca/*.md` (o `02-penal-cp.md` é o exemplo completo de formato; o `09-…estatuto-sp.md`, de arquivo PENDENTE);
- `caderno/08-provas/2025-questoes.md` e `public/provas/2025-q53.png`.

Mantenha os `_modelo-*.md` e os READMEs, ajustando-os ao novo concurso (passo 3).

### 2. Edital
- Baixe o PDF oficial do edital, ou use o que o usuário colocou em `caderno/00-edital/`.
- Extraia o texto integral para `caderno/00-edital/edital.md`, com front matter `titulo` e `fonte`. Use `pdftotext -layout` ou `-raw`, e confira se a ordem do texto está certa.
- Identifique e anote para o plano:
  - cargo, banca, datas (inscrição, prova, gabarito);
  - composição da prova: número de questões, blocos, questões por disciplina, mínimos para não ser eliminado, nota máxima;
  - redação: se existe, escala, nota mínima, critérios de correção e regras de linhas;
  - **conteúdo programático completo**, com o recorte de cada norma (artigos, capítulos, seções);
  - a regra de data de corte da legislação (costuma estar no início do conteúdo programático).

### 3. `concurso.config.json`
Preencha todos os campos. É ele que define o que o site mostra:

| Campo | O que é |
|---|---|
| `nome_site`, `orgao`, `cargo`, `banca`, `edital` | Textos exibidos e usados no campo "origem" dos erros |
| `prova.data` (AAAA-MM-DD), `prova.descricao`, `prova.duracao_min` | Contagem regressiva e simulados |
| `disciplinas` | `[slug, nome]` de cada disciplina do edital. Slug sem acento, com hífen |
| `objetiva.total`, `meta`, `nota_max` | Total de questões, meta de acertos do usuário, nota máxima |
| `objetiva.blocos` | Blocos da prova: `id` (vira chave no simulado), `nome`, `total`, `minimo` (se houver), `disciplinas` |
| `objetiva.questoes_por_disciplina` | Quantas questões de cada disciplina |
| `redacao` | `existe` (`false` esconde a tela), `nota_max`, `minimo`, `criterios`, `avisos_linhas` |
| `estudo` | Minutos por dia (meta semanal do Painel) e duração dos blocos do Pomodoro |
| `cronograma.etiquetas` | Etiquetas das tarefas (`DIR`, `POR`…) e a disciplina ou tipo de sessão de cada uma |
| `cronograma.palavras_chave` | Regex para deduzir a disciplina de tarefas sem link de lei seca |

Depois, ajuste:
- `caderno/07-simulados/_modelo-simulado.md`: as chaves de `resultado` são os `id` dos blocos, e a tabela "Acertos por disciplina" segue `questoes_por_disciplina`;
- `caderno/06-redacao/_modelo-redacao.md`: em `nota_estimada`, uma chave por critério, mais `total`;
- o README de `caderno/` (convenções) e o de `caderno/08-provas/` (lista de provas).

Rode `npm run build` para conferir.

### 4. Análise de incidência e cronograma
- `caderno/01-analise/analise.md`: peso de cada disciplina nas últimas provas da mesma banca e cargo, assuntos mais cobrados e notas de corte, citando as fontes. Use pesquisa na web. Se os dados forem escassos, diga isso no texto.
- `caderno/02-cronograma/cronograma.md`: da data de início até a prova, seguindo **exatamente** o formato do exemplo:
  - front matter com `prova`, `inicio`, `semanas`, `carga_referencia`;
  - semanas em `## SNN · dd/mm – dd/mm/aaaa · Fase N`;
  - tarefas em `- [ ] \`ETIQUETA\` descrição → [lei seca](../03-lei-seca/arquivo.md#art-n)`, com etiquetas que existam em `cronograma.etiquetas`;
  - seção `## Prazos do edital` com as datas do concurso;
  - fases: base, aprofundamento, revisão e simulados, reta final. Distribua as disciplinas pelo peso da análise e encaixe a lei seca na ordem do edital;
  - a carga diária do usuário define a duração dos blocos e a tabela "Rotina de referência".
- Confira se todo link `#art-n` do cronograma existe no arquivo de lei seca correspondente.

### 5. Lei seca (`caderno/03-lei-seca/`)
Um arquivo por norma: `NN-disciplina-nome.md`, numerado na ordem do edital. Formato (veja `02-penal-cp.md`):

```markdown
---
titulo: "Direito Penal — Código Penal (recorte TJSP)"
norma: "Código Penal"
recorte_edital: "arts. 293 a 305; 307; ..."
item_edital: "Bloco II, item 1"
disciplina: "penal"            # slug de concurso.config.json (obrigatório)
artigos_extraidos: 53
fonte_oficial: "https://..."
texto_obtido_em: "AAAA-MM-DD"
origem_do_arquivo: "como foi obtido/convertido"
observacoes: "o que o usuário precisa saber (opcional)"
edital: "..."
status: "ok"                   # ou PENDENTE (mostra o selo no site)
---

# Título

> **Recorte do edital:** ...
> **Fonte oficial:** ...

#### TÍTULO X — ...
##### CAPÍTULO I — ...
###### Art. 312 {#art-312}
*Peculato*            ← rubrica, quando a lei tem
Texto do caput...
§ 1º ...
```

- A âncora usa o número sem ponto e o sufixo em minúsculas: `#art-1189`, `#art-311-a`, `#art-5`. Normas numeradas por item usam `###### Item N {#item-n}`.
- Linhas que começam com "1." ou "-" precisam de escape (`1\.`, `\-`) para não virarem lista.
- **Ferramentas** em `ferramentas/` (veja o README de lá). Elas foram feitas para as fontes do exemplo e quase sempre precisam de ajustes para outra fonte:
  - `alesp.py`: HTML de assembleia (remove `<s>`, recorte por intervalos);
  - `esaj.py`: atos do TJSP;
  - `regimento.py`: PDF com fluxo contínuo;
  - `nscgj.py`: PDF com notas de rodapé por página;
  - `montar.py`: gera o front matter e o cabeçalho;
  - `conferir.py`: conferência linha a linha.
- **Leis federais:** o repositório [LawCodex/br](https://github.com/LawCodex/br) tem o texto do Planalto em Markdown. O HTML compilado do Planalto também serve (remova o texto tachado).
- Norma que não conseguir baixar: crie o arquivo com `status: PENDENTE`, a fonte oficial e o recorte, e avise o usuário.

### 6. Provas anteriores (`caderno/08-provas/`)
- Procure as provas e gabaritos da mesma banca e cargo (site da banca, arquivos públicos de provas). Respeite os bloqueios (regra 5).
- Converta cada prova para `AAAA-questoes.md` no formato do exemplo:

```markdown
## Texto para as questões 01 a 05 {#texto-01-05}
...
### Q01 {#q01}
disciplina: portugues · assunto: interpretacao · gabarito: C · lei: 03-lei-seca/arquivo.md#art-n

Enunciado...

- (A) ...
- (B) ...
```

  - `lei:` é opcional e liga a questão ao artigo da lei seca;
  - questão anulada: `gabarito: X`;
  - figuras vão em `public/provas/AAAA-qNN.png`, recortadas do PDF;
  - tabelas viram tabela Markdown.
- Ferramentas: `prova_texto.py` (extração com colunas, negrito, lacunas, sobrescritos) e `conv_prova.py` (gera o .md a partir do texto, do gabarito e da distribuição de disciplinas). O layout varia de banca para banca: confira o resultado questão por questão e verifique o total e o gabarito.
- Informe no README da pasta o que foi e o que não foi convertido.

### 7. Verificação
- `npx tsc --noEmit` e `npm run build` sem erros.
- Rode o site com `npx netlify-cli serve` (com `.env` local: `AUTH_SECRET=...` e `SENHA_TESTE=...`) e confira login, Painel, Cronograma (semana atual), Lei seca (busca e grifo), Questões (responder errado → caderno de erros), Simulados (blocos e mínimos do novo concurso) e Exportar.
- Atualize o README da raiz se algo mudou no uso.

### 8. Publicação
Siga o `DEPLOY.md`. Se houver conector do Netlify disponível, ofereça criar o projeto. As senhas são cadastradas pelo próprio usuário: não peça para ele digitar senhas na conversa.

## Para entender o código
- Conteúdo: `src/lib/conteudo.ts` lê `caderno/` no build. `src/lib/questoes.ts` lê as provas.
- Configuração: `src/lib/config.ts` (lê `concurso.config.json`).
- Dados do usuário: `src/lib/dados.ts` grava no IndexedDB e sincroniza com `netlify/functions/dados.ts` (Netlify Blobs, separado por usuário).
- Login: `netlify/functions/login.ts`, `netlify/lib/auth.ts` e `netlify/edge-functions/portao.ts`.
- Telas interativas: `src/islands/*.tsx`. Páginas: `src/pages/`.
