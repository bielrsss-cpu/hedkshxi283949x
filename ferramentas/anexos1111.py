"""Anexos da LC 1.111/2010 (ALESP): tabelas viram Markdown, o Anexo VII vira um dispositivo por cargo,
e os anexos publicados como imagem viram links para a imagem oficial."""
import html
import re
import sys
import unicodedata

s = open(sys.argv[1], encoding='utf-8').read()
s = s[s.find('<body'):]
s = re.sub(r'<s>.*?</s>', '', s, flags=re.S)
s = re.sub(r'<script.*?</script>', '', s, flags=re.S)
ini = min(i for i in (s.find('<img'), s.find('<figure'), s.find('<table')) if i >= 0)
s = s[ini:]
fim = s.find('</body>')
s = s[:fim if fim > 0 else len(s)]

BASE = 'https://www.al.sp.gov.br'


def limpo(frag):
    frag = re.sub(r'<br\s*/?>', '\n', frag)
    frag = re.sub(r'<[^>]+>', '', frag)
    return '\n'.join(' '.join(l.replace('\xa0', ' ').split()) for l in html.unescape(frag).split('\n')).strip()


def slug(t):
    t = unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')[:50]


# Sequência de elementos em ordem
elems = []
for m in re.finditer(r'<img[^>]*src=["\']([^"\']+)["\'][^>]*>|<table.*?</table>|<h4[^>]*>(.*?)</h4>|<p[^>]*>(.*?)</p>', s, flags=re.S):
    if m.group(1):
        elems.append(('img', BASE + m.group(1) if m.group(1).startswith('/') else m.group(1)))
    elif m.group(0).startswith('<table'):
        linhas = []
        for tr in re.findall(r'<tr.*?</tr>', m.group(0), flags=re.S):
            cels = [' '.join(limpo(td).split()) for td in re.findall(r'<td[^>]*>(.*?)</td>', tr, flags=re.S)]
            if any(cels):
                linhas.append(cels)
        elems.append(('table', linhas))
    elif m.group(2) is not None:
        t = ' '.join(limpo(m.group(2)).split())
        if t:
            elems.append(('h', t))
    else:
        t = limpo(m.group(3) or '')
        for l in t.split('\n'):
            if l:
                elems.append(('p', l))

out = ['## ANEXOS', '',
       '> Os Anexos I, III, IV, VI, VIII e IX são publicados pela ALESP como imagem. Eles aparecem aqui como link para a imagem oficial, com as notas de alteração. O Anexo II e o Anexo VII (atribuições dos cargos) estão em texto.', '']
n_img = 0
modo = None
vistos = set()
cargo = None


def titulo(t):
    return ' '.join(w.lower() if w.lower() in ('de', 'da', 'do', 'em', 'e') and k else w.capitalize() for k, w in enumerate(t.split()))


def nota(l):
    return '(' + l.lstrip('- ').rstrip('.').strip() + ')'


for i, (tipo, v) in enumerate(elems):
    if tipo == 'img':
        n_img += 1
        # Nome do anexo: pela nota logo depois da imagem, quando existe
        prox = ' '.join(x[1] for x in elems[i + 1:i + 3] if x[0] == 'p')
        m = re.search(r'Anexo ([IVX]+) com reda', prox)
        nome = f'ANEXO {m.group(1)}' if m else {5: 'ANEXO VI', 6: 'ANEXO VIII'}.get(n_img, f'Anexo (imagem {n_img})')
        if n_img == 4:
            nome = 'ANEXO V'
        out += [f'#### {nome} (imagem na fonte oficial)', '', f'[Abrir a imagem do {nome.replace("ANEXO", "Anexo")} na ALESP]({v})', '']
        modo = 'img'
        continue
    if tipo == 'table':
        out += ['#### ANEXO II — Anexo de Enquadramento de Classe - Cargos em Comissão', '',
                '> a que se refere o inciso II do artigo 2° da Lei Complementar n° 1.111, de 25 de maio de 2010', '']
        if v:
            larg = max(len(r) for r in v)
            cab = v[0] + [''] * (larg - len(v[0]))
            out.append('| ' + ' | '.join(cab) + ' |')
            out.append('|' + '---|' * larg)
            for r in v[1:]:
                r = r + [''] * (larg - len(r))
                out.append('| ' + ' | '.join(c.replace('|', '/') for c in r) + ' |')
            out.append('')
        modo = 'tabela'
        continue
    if tipo == 'h':
        if v.startswith('ANEXO VII'):
            modo = 'vii'
            out += ['#### ANEXO VII — Sumária de atribuições e pré-requisitos dos cargos', '']
        elif modo == 'vii' and v.startswith('a que se refere'):
            out += [f'> {v}', '']
        elif v.startswith('ANEXO VI'):
            pass  # título do anexo-imagem seguinte
        continue
    # parágrafos
    if v.startswith('- ') or v.startswith('-\xa0'):
        if modo == 'tabela':
            continue  # notas internas da tabela já estão nas células
        out += [nota(v), '']
        continue
    if modo == 'vii':
        if v.startswith('SUBANEXO'):
            out += [f'##### {v}', '']
            continue
        m = re.match(r'^([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{4,}?)(?:\s*\(NR\))?\s+(Sumária:.*)$', v)
        so_nome = re.match(r'^([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{4,}?)(\s*\(NR\))?$', v)
        if m or so_nome:
            nome_cargo = (m.group(1) if m else so_nome.group(1)).strip()
            a = 'anexo-vii-' + slug(nome_cargo)
            while a in vistos:
                a += '-b'
            vistos.add(a)
            out += [f'###### Anexo VII · {titulo(nome_cargo)} {{#{a}}}', '']
            if so_nome and so_nome.group(2):
                out += ['(NR)', '']
            if m:
                resto = m.group(2)
                if '(NR)' in v[:len(m.group(1)) + 6]:
                    resto = '(NR) ' + resto
                out += [re.sub(r'\s+(Pré-requisito:)', r'\n\n\1', resto), '']
            continue
        out += [re.sub(r'\s+(Pré-requisito:)', r'\n\n\1', v), '']
        continue
    # outros parágrafos fora do Anexo VII (raros): mantém
    if modo != 'tabela':
        out += [v, '']

print('\n'.join(out).strip())
