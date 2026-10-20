"""Converte as NSCGJ Tomo I (pdftotext -raw) para o formato da lei seca, só com o recorte do edital.

Uso: python3 -I nscgj.py nscgj.txt > corpo.md
- Notas de rodapé (numeradas por página) são incorporadas no ponto da chamada, entre parênteses.
- Recorte: Cap. II Seção I (subseções I e II); Cap. III Seções I, II, V, VI, VII, VIII (subseções I a III), IX a XIX;
  Cap. XI Seções I a VII.
"""
import re
import sys

ROMANOS = {r: i for i, r in enumerate(
    'I II III IV V VI VII VIII IX X XI XII XIII XIV XV XVI XVII XVIII XIX XX XXI XXII XXIII XXIV XXV'.split(), 1)}


def rom(s):
    base = s.split('-')[0]
    return ROMANOS.get(base, 0) + (0.5 if '-' in s else 0)


def no_recorte(cap, sec, sub):
    c = rom(cap) if cap else 0
    s = rom(sec) if sec else 0
    b = rom(sub) if sub else 0
    if c == 2:
        return s == 1 and (b in (0, 1, 2))
    if c == 3:
        if s in (1, 2, 5, 6, 7):
            return True
        if s == 8:
            return b in (0, 1, 2, 3)
        return 9 <= s <= 19
    if c == 11:
        return 1 <= s <= 7
    return False


paginas = open(sys.argv[1], encoding='utf-8').read().split('\f')

# ---------- 1) Notas de rodapé por página ----------
problemas = []


def tratar_pagina(pag):
    L = pag.split('\n')
    while L and not L[-1].strip():
        L.pop()
    melhor = None
    for j in range(len(L) - 1, -1, -1):
        if L[j].strip() != '1':
            continue
        notas, k, i, ok = {}, 1, j, True
        while i < len(L):
            if L[i].strip() != str(k):
                ok = False
                break
            i += 1
            txt = []
            while i < len(L) and L[i].strip() != str(k + 1):
                txt.append(L[i].strip())
                i += 1
            if not txt or len(txt) > 6:
                ok = False
                break
            notas[k] = ' '.join(txt)
            k += 1
        if ok and notas:
            melhor = (j, notas)
            break
    if not melhor:
        return '\n'.join(L)
    j, notas = melhor
    corpo = '\n' + '\n'.join(L[:j])  # \n inicial: chamada na 1ª linha da página
    pos = 0
    for k in sorted(notas):
        m = re.compile(r'(?<=[^\s\d/.,(\[-])' + str(k) + r'(?=[\s,;.:)]|$)|(?<=[.;:,)”"])' + str(k) + r'(?=[\s,;.:)]|$)'
                       r'|(?<=[.;:,)”"]) ' + str(k) + r'(?=\n|$)'
                       r'|(?<=[^\d\s] )' + str(k) + r'(?=\n|$)'
                       r'|(?<=\n)' + str(k) + r'(?=\n)').search(corpo, pos)
        if not m:
            problemas.append(f'chamada {k} não achada: {notas[k][:60]}')
            continue  # não insere no fim da página para não cortar frases
        insercao = f' ({notas[k].rstrip(".")})'
        print('NOTA\t' + insercao, file=sys.stderr)
        corpo = corpo[:m.start()] + insercao + corpo[m.end():]
        pos = m.start() + len(insercao)
    return corpo[1:]


texto = '\n'.join(tratar_pagina(p) for p in paginas)
linhas = texto.split('\n')

# ---------- 2) Início do corpo (depois do índice) ----------
ini = next(i for i, l in enumerate(linhas) if l.strip() == 'CAPÍTULO I')
linhas = linhas[ini:]

CAP = re.compile(r'^CAPÍTULO\s+([IVXLC]+(?:-[A-Z])?)\s*(\(.*\))?\s*$')
SEC = re.compile(r'^Seção\s+([IVXLC]+(?:-[A-Z])?)\s*(\(.*\))?\s*$')
SUB = re.compile(r'^Subseção\s+([IVXLC]+(?:-[A-Z])?)\s*(\(.*\))?\s*$')
ART_INI = re.compile(r'^Art\.\s*\d')

fluxo = []
cap = sec = sub = None
i = 0
while i < len(linhas):
    l = linhas[i].strip()
    if not l:
        i += 1
        continue
    m = CAP.match(l) or SEC.match(l) or SUB.match(l)
    if m:
        tipo = 'cap' if CAP.match(l) else 'sec' if SEC.match(l) else 'sub'
        partes, j = [], i + 1
        while j < len(linhas) and len(partes) < 4:
            p = linhas[j].strip()
            if not p:
                j += 1
                continue
            if ART_INI.match(p) or CAP.match(p) or SEC.match(p) or SUB.match(p):
                break
            partes.append(p)
            j += 1
        rotulo = l[:m.start(2)].strip() if m.group(2) else l
        nome = f"{rotulo} — {' '.join(partes)}" if partes else rotulo
        if m.group(2):
            nome += ' ' + m.group(2)
        if tipo == 'cap':
            cap, sec, sub = m.group(1), None, None
        elif tipo == 'sec':
            sec, sub = m.group(1), None
        else:
            sub = m.group(1)
        fluxo.append(('h', {'cap': 1, 'sec': 2, 'sub': 3}[tipo], nome, (cap, sec, sub)))
        i = j
        continue
    fluxo.append(('t', l, (cap, sec, sub)))
    i += 1

# ---------- 3) Texto em dispositivos, só no recorte ----------
DISP = re.compile(
    r'(?<=[.;:)”"])\s+(?='
    r'Art\.\s*\d'
    r'|§+\s*\d+'
    r'|Parágrafo único'
    r'|[IVXLC]+(?:-[A-Z])?\s*[-–—]\s'
    r'|[a-z]\)\s'
    r')'
)
ART = re.compile(r'^Art\.\s*(\d{1,2}(?:\.\d{3})|\d+)\s*([º°o])?(?:-([A-Z])(?=[\s.\-–—:]))?\s*[.:\-–—]?\s*(.*)$', re.S)
out = []
vistos = set()
emitidos = set()


def escapar(t):
    t = re.sub(r'^(\d+)\.(?!\d)', r'\1\\.', t)
    return re.sub(r'^([-+*>])', r'\\\1', t)


def emitir(txt):
    txt = re.sub(r'\s+', ' ', txt).strip()
    for parte in DISP.split(txt):
        parte = parte.strip()
        if not parte:
            continue
        m = ART.match(parte)
        if m:
            num, letra, resto = m.group(1), m.group(3), m.group(4)
            n = num.replace('.', '')
            rot = f'{num}º' if int(n) < 10 and not letra else num
            if letra:
                rot = f'{num}-{letra}'
            a = f'art-{n}' + (f'-{letra.lower()}' if letra else '')
            while a in vistos:
                a += '-b'
            vistos.add(a)
            out.append(f'\n###### Art. {rot} {{#{a}}}\n')
            if resto.strip():
                out.append(escapar(resto.strip()) + '\n')
        else:
            out.append(escapar(parte) + '\n')


buf, chave_buf = [], None
pendentes = []  # títulos ainda não emitidos
for item in fluxo:
    if item[0] == 'h':
        if buf and no_recorte(*chave_buf):
            emitir(' '.join(buf))
        buf = []
        _, rank, nome, chave = item
        # mantém só a hierarquia atual (capítulo > seção > subseção)
        pendentes = [p for p in pendentes if p[0] < rank]
        pendentes.append((rank, nome, chave))
        chave_buf = chave
        continue
    _, l, chave = item
    if no_recorte(*chave):
        for p in pendentes:
            if (p[1], p[2]) not in emitidos:
                out.append(f"\n{'#' * (4 if p[0] == 1 else 5)} {p[1]}\n")
                emitidos.add((p[1], p[2]))
    buf.append(l)
    chave_buf = chave
if buf and no_recorte(*chave_buf):
    emitir(' '.join(buf))

print('\n'.join(out).replace('\n\n\n', '\n\n').strip())
print(f'ARTIGOS={len(vistos)}', file=sys.stderr)
for p in problemas[:30]:
    print('AVISO', p, file=sys.stderr)
print(f'AVISOS={len(problemas)}', file=sys.stderr)
