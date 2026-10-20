"""Converte o texto atualizado de uma norma da ALESP (HTML) para o formato da lei seca.

Uso: python3 -I alesp.py entrada.html "1-86,171-175,239-323" > corpo.md
     (recorte vazio = íntegra)
- Remove o texto riscado (<s>…</s>), que é a redação revogada.
- Mantém as notas de alteração da ALESP como parágrafo entre parênteses.
- Títulos estruturais: TÍTULO → ####, CAPÍTULO/SEÇÃO → #####.
"""
import html
import re
import sys

entrada, recorte = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else '')
s = open(entrada, encoding='utf-8').read()
s = s[s.find('<body'):]
s = re.sub(r'<s>.*?</s>', '', s, flags=re.S)
s = re.sub(r'<script.*?</script>', '', s, flags=re.S)
# Corta os anexos (tratados à parte): tudo a partir da primeira imagem/tabela
if len(sys.argv) > 3 and sys.argv[3] == '--sem-anexos':
    corte = min([i for i in (s.find('<img'), s.find('<figure'), s.find('<table')) if i >= 0] or [len(s)])
    s = s[:corte]


def intervalos(r):
    out = []
    for parte in filter(None, r.split(',')):
        a, _, b = parte.partition('-')
        out.append((int(a), int(b or a)))
    return out


FAIXAS = intervalos(recorte)


def no_recorte(num):
    if not FAIXAS:
        return True
    n = int(re.match(r'\d+', num).group())
    return any(a <= n <= b for a, b in FAIXAS)


def texto(frag):
    frag = re.sub(r'<br\s*/?>', '\n', frag)
    frag = re.sub(r'<[^>]+>', '', frag)
    frag = html.unescape(frag).replace('\xa0', ' ')
    return frag


# Sequência de blocos: ('h', texto) ou ('p', texto)
blocos = []
for m in re.finditer(r'<(h[1-6]|p)[^>]*>(.*?)</\1>', s, flags=re.S):
    tag, conteudo = m.group(1), m.group(2)
    if tag in ('h1', 'h2', 'h3'):
        continue
    if tag == 'h4':
        t = ' '.join(texto(conteudo).split())
        if t:
            blocos.append(('h', t))
        continue
    nota = conteudo.strip().startswith('<em>')
    for linha in texto(conteudo).split('\n'):
        linha = ' '.join(linha.split())
        if not linha:
            continue
        if nota or linha.startswith('- '):
            linha = '(' + linha.lstrip('- ').rstrip('.') + ')'
        blocos.append(('p', linha))

# Junta "TÍTULO I" + "Disposições Preliminares"
estrut = re.compile(r'^(T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|SUBSE[ÇC][ÃA]O|LIVRO|PARTE)\b', re.I)
titulos = []
i = 0
saida_blocos = []
while i < len(blocos):
    tipo, t = blocos[i]
    if tipo == 'h':
        if estrut.match(t) and i + 1 < len(blocos) and blocos[i + 1][0] == 'h' and not estrut.match(blocos[i + 1][1]):
            t = f'{t} — {blocos[i + 1][1]}'
            i += 1
        nivel = 4 if re.match(r'^(T[ÍI]TULO|LIVRO|PARTE)', t, re.I) else 5
        saida_blocos.append(('h', nivel, t))
    else:
        saida_blocos.append(('p', 0, t))
    i += 1

ART = re.compile(r'^Artigo\s+(\d+)\s*(?:[°ºo])?\s*(?:-\s*([A-Z]))?\s*[-—–]\s*(.*)$')
out = []
pilha = {}  # nível -> (texto, já emitido)
atual = None  # número do artigo em curso (str) ou None
incluir = False
vistos = set()
prefixo_dt = False

for tipo, nivel, t in saida_blocos:
    if tipo == 'h':
        if re.search(r'Disposi[çc][õo]es Transit[óo]rias', t, re.I):
            prefixo_dt = True
        pilha[nivel] = [t, False]
        for n in list(pilha):
            if n > nivel:
                del pilha[n]
        atual = None
        incluir = False
        continue
    if re.match(r'^Pal[áa]cio dos Bandeirantes', t):
        break  # assinaturas
    m = ART.match(t)
    if m:
        num, letra, resto = m.group(1), m.group(2), m.group(3)
        incluir = no_recorte(num)
        atual = num
        if not incluir:
            continue
        for n in sorted(pilha):
            if not pilha[n][1]:
                out.append(f"\n{'#' * n} {pilha[n][0]}\n")
                pilha[n][1] = True
        rot = f'{num}º' if int(num) < 10 and not letra else num
        if letra:
            rot = f'{num}-{letra}'
        ancora = ('dt-' if prefixo_dt else '') + f'art-{num}' + (f'-{letra.lower()}' if letra else '')
        if prefixo_dt:
            rot += ' (Disposições Transitórias)'
        while ancora in vistos:
            ancora += '-b'
        vistos.add(ancora)
        out.append(f'\n###### Art. {rot} {{#{ancora}}}\n')
        if resto:
            out.append(resto + '\n')
        continue
    if atual is not None and incluir:
        # Evita que o Markdown transforme "1. …" ou "- …" em lista
        t = re.sub(r'^(\d+)\.', r'\1\\.', t)
        t = re.sub(r'^([-+*>])', r'\\\1', t)
        out.append(t + '\n')

print('\n'.join(out).replace('\n\n\n', '\n\n').strip())
print(f'ARTIGOS={len(vistos)}', file=sys.stderr)
