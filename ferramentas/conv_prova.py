"""Converte o texto extraído de um caderno VUNESP (prova_texto.py) + gabarito para AAAA-questoes.md.

Uso: python3 -I conv_prova.py prova-p.txt gabarito.txt distribuicao.json extras.json > AAAA-questoes.md
- distribuicao.json: [[1,16,"portugues"], ...]
- extras.json: {"53": {"figura": "...", "remover": ["4 cm", ...]}, "58": {"antes_de": "Após preencher", "tabela": "| … |"}, "assuntos": {"01": "interpretacao"}, "lei": {"17": "03-lei-seca/…#art-…"}, "cabecalho": {...}}
"""
import json
import re
import sys

linhas = open(sys.argv[1], encoding='utf-8').read().split('\n')
gab_txt = open(sys.argv[2], encoding='utf-8').read()
dist = json.load(open(sys.argv[3], encoding='utf-8'))
extras = json.load(open(sys.argv[4], encoding='utf-8'))

gab = {int(n): l for n, l in re.findall(r'(\d{1,2})\s*-\s*([A-E]|\*|X|ANULADA)', gab_txt)}

CLITICOS = r'(?:lhe|lhes|o|a|os|as|se|me|te|nos|vos|la|las|lo|los|na|nas|no|ão|á|ás|ei|emos|eis|ia|íamos|iam)(?![\wÀ-ú])'


def juntar(ls, paragrafos=False):
    """Junta linhas quebradas, desfazendo a hifenização de fim de linha."""
    out = ''
    for i, l in enumerate(ls):
        l = l.strip()
        if not l:
            continue
        titulo = l.startswith('⊤ ')
        novo_par = l.startswith('¶ ')
        l = re.sub(r'^(⊤|¶) ', '', l)
        if titulo and paragrafos:
            l = f'**{l}**'
        if not out:
            out = l
            continue
        if paragrafos and (titulo or novo_par or ls[i - 1].strip().startswith('⊤ ')):
            out += '\n\n' + l
            continue
        # negrito cortado na hifenização: "**excep-**" + "**cionais**"
        if out.endswith('-**') and l.startswith('**') and re.match(r'\*\*[a-zà-ú]', l):
            out = out[:-3]
            l = l[2:]
            out += l
            continue
        # Convenção VUNESP: palavra composta quebrada no hífen repete o hífen na linha seguinte
        if out.endswith('-') and l.startswith('-'):
            out += l[1:]
            continue
        if re.search(r'[A-Za-zÀ-ú]-$', out) and re.match(r'[a-zà-úA-ZÀ-Ú]', l):
            out = out[:-1] + l  # separação de sílaba
            continue
        anterior = re.sub(r'^(⊤|¶) ', '', ls[i - 1].strip())
        if paragrafos and (l.startswith('•') or l.startswith('(http') or anterior.startswith('(http') or (len(anterior) < 25 and not anterior.endswith('-'))):
            out += '\n\n' + l
        elif paragrafos and re.search(r'[.!?:”"]\s*$', out) and len(anterior) < 42:
            out += '\n\n' + l
        else:
            out += ' ' + l
    out = re.sub(r'\*\*\s*\*\*', '', out)
    return out.strip()


def disciplina(n):
    for a, b, d in dist:
        if a <= n <= b:
            return d
    return ''


# Limpeza: cabeçalhos de seção, rascunho, rodapés, páginas
# Títulos de seção do caderno (fonte em versalete sai com maiúsculas trocadas). Ajuste para a sua prova.
SECAO = re.compile(extras.get('secoes_regex', r'^(______ )?(LÍNgUA PORTUgUESA|cONHEcImENTOS .*|DIREItO .*|atUalIDaDEs|matEmÁtICa|InfORmÁtICa|RaCIOCÍnIO .*|.*R A ScU N H O.*|\d{1,2} ______ Confidencial.*)$'))
limpas = []
for l in linhas:
    if l.startswith('@@PAGINA'):
        continue
    if re.search(r'REDAÇÃO Em LÍNgUA', l):
        break
    if SECAO.match(l.strip()):
        continue
    limpas.append(l)

# Blocos: textos de apoio e questões
textos = []  # (ini, fim, linhas)
questoes = {}  # n -> linhas
atual = None
texto_atual = None
for l in limpas:
    m = re.match(r'^Leia o texto para responder às questões de \*\*(\d+)\*\* a \*\*(\d+)\*\*\.?', l.replace('**.', '**.'))
    if m:
        texto_atual = [int(m.group(1)), int(m.group(2)), []]
        textos.append(texto_atual)
        atual = None
        continue
    q = re.match(r'^\*\*(\d{2,3})\.\*\*\s*(.*)$', l) or re.match(r'^\*\*(\d{2,3})\.\s+(.*)$', l)
    if q:
        atual = int(q.group(1))
        resto = q.group(2) if l.startswith(f'**{q.group(1)}.**') else '**' + q.group(2)
        questoes[atual] = [resto]
        texto_atual = None
        continue
    if texto_atual is not None:
        texto_atual[2].append(l)
    elif atual is not None:
        questoes[atual].append(l)

TOTAL = int(extras['cabecalho'].get('questoes', max(questoes)))
assert sorted(questoes) == list(range(1, TOTAL + 1)), sorted(set(range(1, TOTAL + 1)) - set(questoes))

cab = extras['cabecalho']
out = ['---']
for k, v in cab.items():
    out.append(f'{k}: {json.dumps(v, ensure_ascii=False) if isinstance(v, str) else v}')
out += ['---', '', f"# {cab['titulo']}", '',
        f"> Prova: {cab['fonte_prova']}  ",
        f"> Gabarito: {cab['fonte_gabarito']} ({cab['gabarito']})", '']

textos_por_ini = {t[0]: t for t in textos}
for n in range(1, TOTAL + 1):
    if n in textos_por_ini:
        a, b, ls = textos_por_ini[n]
        ls = [re.sub(r'^______ ', '', x) for x in ls]
        out += [f'## Texto para as questões {a:02d} a {b:02d} {{#texto-{a:02d}-{b:02d}}}', '', juntar(ls, paragrafos=True), '']
    ls = questoes[n]
    ex = extras.get(str(n), {})
    for r in ex.get('remover', []):
        ls = [x for x in ls if x.strip().replace('______ ', '') != r]
    # separa enunciado e alternativas
    alts, enun, cur = {}, [], None
    for l in ls:
        m = re.match(r'^\(([A-E])\)\s*(.*)$', l)
        if m:
            cur = m.group(1)
            alts[cur] = [m.group(2)]
        elif cur:
            alts[cur].append(l)
        else:
            enun.append(l)
    assert sorted(alts) == list('ABCDE'), (n, sorted(alts))
    lacuna = any('lacuna' in x for x in enun)
    enun = [x if lacuna else re.sub(r'^______ ', '', x) for x in enun]
    enun = [re.sub(r'^______ (?=\()', '', x) for x in enun]
    corpo = juntar(enun, paragrafos=True)
    if 'tabela' in ex:
        i = corpo.find(ex['antes_de'])
        corpo = corpo[:i].rstrip() + '\n\n' + ex['tabela'] + '\n\n' + corpo[i:]
    if 'figura' in ex:
        i = corpo.find(ex['antes_de'])
        corpo = corpo[:i].rstrip() + '\n\n' + ex['figura'] + '\n\n' + corpo[i:]
    for a_, b_ in ex.get('substituir', []):
        corpo = corpo.replace(a_, b_)
    meta = f"disciplina: {disciplina(n)} · assunto: {extras.get('assuntos', {}).get(f'{n:02d}', 'geral')} · gabarito: {gab.get(n, '?')}"
    lei = extras.get('lei', {}).get(f'{n:02d}')
    if lei:
        meta += f' · lei: {lei}'
    out += [f'### Q{n:02d} {{#q{n:02d}}}', meta, '', corpo, '']
    for k in 'ABCDE':
        out.append(f'- ({k}) {juntar([re.sub(r"^______ ", "", x) for x in alts[k]])}')
    out.append('')

print('\n'.join(out).rstrip() + '\n')
