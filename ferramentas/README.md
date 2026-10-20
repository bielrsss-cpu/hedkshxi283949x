# Ferramentas de conversão

Scripts em Python usados para montar o exemplo (TJ-SP). Servem de ponto de partida: cada fonte tem suas particularidades, então **ajuste e confira sempre**. Rode com `python3 -I` e mantenha os arquivos baixados numa pasta separada.

Dependências: `pdftotext` (poppler-utils) e, para provas, `pip install pdfplumber`.

| Script | Para quê | Uso |
|---|---|---|
| `alesp.py` | HTML de norma estadual (ALESP e similares). Remove o texto riscado `<s>`, mantém notas e extrai o recorte por intervalo de artigos | `python3 -I alesp.py norma.html "1-86,171-175" [--sem-anexos] > corpo.md` |
| `anexos1111.py` | Exemplo de anexos (tabelas, imagens, lista de cargos) de uma lei da ALESP | adaptar |
| `esaj.py` | JSON da Legislação do e-SAJ/TJSP (`gcn-services/api/publico/legislacao/find/<id>`) | `python3 -I esaj.py norma.json [--so-compilado] > corpo.md` |
| `regimento.py` | PDF com artigos em fluxo contínuo (use `pdftotext -raw`, que mantém a ordem certa) | `python3 -I regimento.py texto.txt > corpo.md` |
| `nscgj.py` | PDF com notas de rodapé numeradas por página e recorte por Capítulo/Seção/Subseção | adaptar a função `no_recorte` |
| `montar.py` | Junta front matter, cabeçalho e corpo no formato da lei seca | `python3 -I montar.py corpo.md destino.md '{"titulo": ..., "disciplina": ...}'` |
| `conferir.py` | Confere se cada linha gerada existe literalmente na fonte | `python3 -I conferir.py fonte.html corpo.md` |
| `conferir_nscgj.py` | Conferência para PDFs com notas de rodapé incorporadas | ver o script |
| `prova_texto.py` | Extrai o caderno de prova (2 colunas) com negrito, lacunas `______`, sobrescritos (2º, cm²), parágrafos e títulos | `python3 -I prova_texto.py prova.pdf ['regex-rodapé'] > prova.txt` |
| `conv_prova.py` | Gera `AAAA-questoes.md` a partir do texto da prova, do gabarito (`pdftotext -layout`), da distribuição de disciplinas e de um JSON de extras (cabeçalho, assuntos, lei, figuras, tabelas) | `python3 -I conv_prova.py prova.txt gab.txt dist.json extras.json > AAAA-questoes.md` |

Exemplo de `dist.json`: `[[1,16,"portugues"],[17,20,"penal"]]`. Para o `extras.json`, veja o início de `conv_prova.py`.

Convenção útil da VUNESP: quando uma palavra composta quebra no hífen, o hífen se repete no início da linha seguinte ("salários-" / "-mínimos"). Já o hífen simples no fim da linha é separação de sílaba. Outras bancas podem fazer diferente: confira.
