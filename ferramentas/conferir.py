"""Confere se cada linha de texto do corpo gerado existe literalmente na fonte (HTML ou TXT)."""
import html, re, sys
fonte = open(sys.argv[1], encoding='utf-8', errors='replace').read()
if sys.argv[1].endswith('.html'):
    fonte = re.sub(r'<s>.*?</s>', '', fonte, flags=re.S)
    fonte = re.sub(r'</?(a|span|strong|em|i|u|b)\b[^>]*>', '', fonte)
    fonte = html.unescape(re.sub(r'<[^>]+>', ' ', re.sub(r'<br\s*/?>', '\n', fonte)))
norm = lambda x: ' '.join(x.replace('\xa0', ' ').split())
F = norm(fonte)
falhas = 0; total = 0
for linha in open(sys.argv[2], encoding='utf-8'):
    l = linha.strip()
    if not l or l.startswith('#') or l.startswith('>') or l.startswith('('): continue
    l = l.replace('\\.', '.').lstrip('\\')
    total += 1
    if norm(l) not in F:
        falhas += 1
        if falhas <= 8: print('NÃO ENCONTRADA:', l[:140])
print(f'{total - falhas}/{total} linhas encontradas literalmente na fonte')
