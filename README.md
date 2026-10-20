# Caderno de estudos para concurso (modelo)

Modelo de um site pessoal de estudos para concurso público, feito para ser adaptado pelo **Claude Code** ao seu concurso e cargo. Funciona no celular e no computador, é publicado de graça no Netlify e sincroniza entre os aparelhos.

O exemplo que vem preenchido é o do **TJ-SP, Escrevente Técnico Judiciário (VUNESP, Edital 02/2026)**. Você troca tudo isso pelo seu concurso.

## O que o site faz

- **Painel:** contagem regressiva, semana atual do cronograma, horas estudadas, progresso e acertos por disciplina, revisões do dia.
- **Cronograma:** semanas com checklist e botão "Iniciar sessão".
- **Lei seca:** só os artigos do recorte do edital, com índice, busca (`art 312` ou palavra), grifos, anotações, estado do artigo (lido, revisar, dominado) e contador de quedas em prova. O texto da lei nunca é alterado.
- **Sessão de estudo:** Pomodoro e registro com revisões automáticas em +1, +7 e +30 dias.
- **Questões:** provas anteriores para resolver. Cada erro vai sozinho para o caderno de erros.
- **Caderno de erros** (com modo revisão), **Redação** (com gráfico de evolução) e **Simulados** (com alertas de nota mínima e meta).
- **Exportar:** baixa todos os registros como arquivos `.md` num zip, para backup.
- **Login** para uma ou mais pessoas, com dados separados por pessoa. Funciona offline e sincroniza quando a conexão volta.

## Modo de uso

### 1. Crie a sua cópia
Clique em **Use this template → Create a new repository** (ou faça um fork) e deixe o repositório **privado**.

### 2. Abra no Claude Code
Pode ser em [claude.ai/code](https://claude.ai/code), escolhendo o repositório, ou no terminal (`claude` dentro da pasta clonada).

### 3. Peça a adaptação
Copie o pedido abaixo, preencha as partes entre colchetes e envie. Se tiver o PDF do edital, coloque-o antes em `caderno/00-edital/edital.pdf`.

```
Leia o ADAPTAR.md e adapte este caderno para o meu concurso:

- Concurso e cargo: [ex.: TRT-2, Analista Judiciário – Área Administrativa]
- Banca: [ex.: FCC]
- Edital: [link do PDF oficial, ou "está em caderno/00-edital/edital.pdf"]
- Data da prova: [dd/mm/aaaa, ou "ainda não saiu"]
- Quanto tempo posso estudar: [ex.: 3h por dia de segunda a sexta, 4h no sábado]
- Data de início dos estudos: [dd/mm/aaaa]
- Quem vai usar o site: [ex.: só eu (usuário "pedro")]

Antes de escrever código ou baixar leis, me mostre o plano e espere meu ok.
```

O Claude segue o roteiro do `ADAPTAR.md`:

1. Lê o edital e extrai o conteúdo programático, os blocos da prova, as notas mínimas e a redação.
2. Preenche o `concurso.config.json`.
3. Monta a análise de incidência e o cronograma conforme o seu tempo de estudo.
4. Baixa a lei seca das fontes oficiais, só com o recorte do edital, e confere linha a linha contra a fonte.
5. Converte provas anteriores da sua banca para a tela de Questões.
6. Publica no Netlify e mostra o que você precisa cadastrar.

Ele faz um commit a cada etapa e avisa o que não conseguiu baixar.

### 4. Publique
Siga o [DEPLOY.md](DEPLOY.md):

1. Ligue o repositório ao Netlify.
2. Cadastre `AUTH_SECRET` e uma `SENHA_<NOME>` por pessoa.
3. Faça o deploy.

No celular, abra o site e use "Adicionar à Tela de Início".

### 5. Use e mantenha
- **Para mudar o cronograma, a carga de estudo ou a meta:** peça ao Claude ("mudei para 2h por dia, ajuste os blocos sem mudar a sequência").
- **Quando sair uma prova nova:** coloque os PDFs em `caderno/08-provas/` e peça a conversão.
- **Backup:** use o botão **Exportar** de vez em quando.

## Estrutura

```
concurso.config.json   tudo que muda de um concurso para outro (datas, disciplinas, blocos, mínimos, redação, carga horária)
ADAPTAR.md             roteiro que o Claude Code segue para adaptar o modelo
caderno/               conteúdo em Markdown (edital, análise, cronograma, lei seca, modelos, provas)
ferramentas/           conversores usados na adaptação (ALESP, e-SAJ, PDF de regimento ou normas, prova de banca)
src/                   site (Astro + Preact)
netlify/               login, dados (Netlify Blobs) e bloqueio das páginas sem login
```

## Custos
O plano gratuito do Netlify basta para uso pessoal. O Claude Code precisa de uma assinatura do Claude.
