"""Converte o texto do PDF do Regimento Interno do TJSP (pdftotext) para o formato da lei seca.

Uso: python3 -I regimento.py ritjsp.txt > corpo.md
"""
import re
import sys

linhas = open(sys.argv[1], encoding='utf-8').read().replace('\f', '\n').split('\n')

# O corpo começa na segunda ocorrência de "Disposição Inicial" (a primeira é o índice)
idx = [i for i, l in enumerate(linhas) if l.strip() == 'Disposição Inicial']
linhas = linhas[idx[1]:]
# O fim: aviso de publicação
for i, l in enumerate(linhas):
    if l.startswith('Este texto não substitui'):
        linhas = linhas[:i]
        break

CAB = re.compile(r'^(T[ÍI]TULO|T[íi]tulo|CAP[ÍI]TULO|Cap[íi]tulo|SE[ÇC][ÃA]O|Se[çc][ãa]o|SUBSE[ÇC][ÃA]O|Subse[çc][ãa]o)(?:\s+([IVXLC]+(?:-[A-Z])?|[ÚU]nic[ao]))?\s*$')
ART_INI = re.compile(r'^Art\.\s*\d')

# 1) Separa títulos estruturais (linha própria + linha do nome) do fluxo de texto
fluxo = []  # itens: ('h', nivel, texto) ou ('t', texto)
i = 0
while i < len(linhas):
    l = linhas[i].strip()
    if not l or re.fullmatch(r'\d{1,3}', l):
        i += 1
        continue
    m = CAB.match(l)
    if m or l in ('Disposição Inicial',) or re.fullmatch(r'Disposi[çc][õo]es (Finais|Gerais|Transit[óo]rias)( e (Finais|Transit[óo]rias))?', l, re.I):
        nome = l
        j = i + 1
        while j < len(linhas) and not linhas[j].strip():
            j += 1
        if m and j < len(linhas):
            # O nome pode ocupar até 3 linhas, até o próximo artigo ou título
            partes = []
            while j < len(linhas) and len(partes) < 3:
                prox = linhas[j].strip()
                if not prox:
                    j += 1
                    continue
                if ART_INI.match(prox) or CAB.match(prox):
                    break
                partes.append(prox)
                i = j
                j += 1
            if partes:
                nome = f"{l} — {' '.join(partes)}"
        tipo = (m.group(1).upper() if m else '')
        nivel = 4 if tipo.startswith('T') or not m else 5
        fluxo.append(('h', nivel, nome))
        i += 1
        continue
    fluxo.append(('t', l))
    i += 1

# 2) Junta o texto entre títulos e corta nos dispositivos
DISP = re.compile(
    r'(?<=[.;:)”"])\s+(?='
    r'Art\.\s*\d+'                       # artigo
    r'|§+\s*\d+'                          # parágrafo
    r'|Parágrafo único'                   # parágrafo único
    r'|[IVXLC]+(?:-[A-Z])?\s*[-–—]\s'    # inciso
    r'|[a-z]\)\s'                         # alínea
    r')'
)
ART = re.compile(r'^Art\.\s*(\d+)\s*([º°o])?(?:\s*-\s*([A-Z])(?=[\s.\-–—:]))?\s*[.:\-–—]?\s*(.*)$', re.S)

out = []
vistos = set()


def emitir_texto(txt):
    txt = re.sub(r'\s+', ' ', txt).strip()
    if not txt:
        return
    for parte in DISP.split(txt):
        parte = parte.strip()
        if not parte:
            continue
        m = ART.match(parte)
        if m:
            num, letra, resto = m.group(1), m.group(3), m.group(4)
            rot = f'{num}º' if int(num) < 10 and not letra else num
            if letra:
                rot = f'{num}-{letra}'
            a = f'art-{num}' + (f'-{letra.lower()}' if letra else '')
            while a in vistos:
                a += '-b'
            vistos.add(a)
            out.append(f'\n###### Art. {rot} {{#{a}}}\n')
            if resto.strip():
                out.append(escapar(resto.strip()) + '\n')
        else:
            out.append(escapar(parte) + '\n')


def escapar(t):
    t = re.sub(r'^(\d+)\.', r'\1\\.', t)
    return re.sub(r'^([-+*>])', r'\\\1', t)


buf = []
for item in fluxo:
    if item[0] == 'h':
        emitir_texto(' '.join(buf))
        buf = []
        out.append(f"\n{'#' * item[1]} {item[2]}\n")
    else:
        buf.append(item[1])
emitir_texto(' '.join(buf))

print('\n'.join(out).replace('\n\n\n', '\n\n').strip())
print(f'ARTIGOS={len(vistos)}', file=sys.stderr)
