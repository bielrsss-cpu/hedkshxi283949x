"""Converte o HTML de uma norma do e-SAJ (gcn-services, campo deNormaHtml) para o formato da lei seca.

Uso: python3 -I esaj.py norma.json [--so-compilado] > corpo.md
- Considerandos ficam antes do primeiro título (aparecem como introdução).
- Linhas iniciadas por "*" (remissões do TJSP) viram notas entre parênteses.
- Para na fórmula final ("Registre-se…").
"""
import html
import json
import re
import sys

d = json.load(open(sys.argv[1], encoding='utf-8'))
h = d['deNormaHtml']
if '--so-compilado' in sys.argv:
    i = h.find('Original')
    if i > 0:
        h = h[:h.rfind('<div', 0, i)]

linhas = []
for m in re.finditer(r'<div[^>]*>(.*?)</div>', h, flags=re.S):
    t = re.sub(r'<br\s*/?>', ' ', m.group(1))
    t = html.unescape(re.sub(r'<[^>]+>', '', t)).replace('\xa0', ' ')
    t = ' '.join(t.split())
    if t:
        linhas.append(t)

# Pula cabeçalho de compilação e título
while linhas and not linhas[0].startswith(('RESOLUÇÃO', 'PROVIMENTO')):
    linhas.pop(0)
titulo = linhas.pop(0) if linhas else ''

ART = re.compile(r'^Art\.?\s*(\d+)\s*([º°o])?(?:-([A-Z])(?=[\s.\-–—:]))?\s*[.\-–—:]*\s*(.*)$')
CAB = re.compile(r'^(CAPÍTULO|SEÇÃO|SUBSEÇÃO|TÍTULO)\b', re.I)
out = []
vistos = set()
em_artigo = False
i = 0
while i < len(linhas):
    t = linhas[i]
    if re.match(r'^(Registre-se|REGISTRE-SE)', t):
        break
    if t.startswith('*'):
        out.append('(' + t.lstrip('* ').rstrip('.') + ')\n')
        i += 1
        continue
    m = ART.match(t)
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
        if resto:
            out.append(resto + '\n')
        em_artigo = True
        i += 1
        continue
    eh_cabecalho = CAB.match(t) or (t.isupper() and len(t) > 6 and not re.match(r'^[IVXLC]+\s*-', t) and t != 'RESOLVE:')
    if eh_cabecalho and not t.endswith(';'):
        nome = t
        if CAB.match(t) and i + 1 < len(linhas) and linhas[i + 1].isupper() and not CAB.match(linhas[i + 1]) and not ART.match(linhas[i + 1]):
            nome = f'{t} — {linhas[i + 1]}'
            i += 1
        nivel = 4 if re.match(r'^(TÍTULO|CAPÍTULO)', nome) else 5
        out.append(f"\n{'#' * nivel} {nome}\n")
        em_artigo = False
        i += 1
        continue
    t = re.sub(r'^(\d+)\.', r'\1\\.', t)
    t = re.sub(r'^([-+*>])', r'\\\1', t)
    out.append(t + '\n')
    i += 1

print('\n'.join(out).replace('\n\n\n', '\n\n').strip())
print(f'TITULO={titulo} ARTIGOS={len(vistos)}', file=sys.stderr)
