"""Extrai o texto de um caderno de prova VUNESP com pdfplumber.

Uso: python3 -I prova_texto.py prova.pdf [regex-do-rodapé] > prova.txt
- Páginas em 2 colunas: lê a esquerda e depois a direita. Páginas de coluna única são detectadas.
- Palavras em negrito (Arial-Bold) viram **…** (os "termos destacados" das questões).
- Espaço horizontal grande entre palavras (ou no início da linha) vira lacuna "______".
- Sobrescritos: 2 o → 2º, 1 a → 1ª, cm 2 → cm².
- Remove cabeçalhos e rodapés.
"""
import re
import statistics
import sys

import pdfplumber

SOBRE = {'2': '²', '3': '³'}

pdf = pdfplumber.open(sys.argv[1])
out = []
for num, pg in enumerate(pdf.pages):
    if num == 0:
        continue  # capa
    out.append(f'@@PAGINA {num + 1}')
    meio = pg.width / 2
    ws = pg.extract_words(extra_attrs=['fontname', 'size'], x_tolerance=1.5)
    if not ws:
        continue
    tam = statistics.median(w['size'] for w in ws)
    cruzam = sum(1 for w in ws if w['x0'] < meio - 2 and w['x1'] > meio + 2)
    colunas = [ws] if cruzam > 5 else [[w for w in ws if w['x0'] < meio - 5], [w for w in ws if w['x0'] >= meio - 5]]
    for cw in colunas:
        if not cw:
            continue
        esquerda = min(w['x0'] for w in cw)
        cw.sort(key=lambda w: (round(w['top'] / 3), w['x0']))
        linhas = []
        for w in cw:
            # sobrescrito: fica um pouco acima da linha; agrupa com tolerância maior
            if linhas and abs(linhas[-1][0]['top'] - w['top']) < (5 if w['size'] < tam * 0.85 else 3):
                linhas[-1].append(w)
            else:
                linhas.append([w])
        direita = max(w['x1'] for w in cw)
        inicios = [round(min(w['x0'] for w in ln)) for ln in linhas]
        moda = statistics.mode(inicios) if inicios else esquerda
        for ln in linhas:
            ln.sort(key=lambda w: w['x0'])
            partes = []
            prev = None
            neg = False
            recuo = ln[0]['x0'] - max(moda, esquerda)
            sobra = direita - max(w['x1'] for w in ln)
            if not re.match(r'^(\d{2,3}\.|\([A-E]\))', ln[0]['text']):
                if recuo > 8 and abs(recuo - sobra) < 8:
                    partes.append('⊤ ')  # linha centralizada (título)
                elif recuo > 24:
                    partes.append('______ ')
                elif recuo > 8:
                    partes.append('¶ ')  # recuo de primeira linha: novo parágrafo
            for w in ln:
                txt = w['text']
                bold = 'Bold' in w['fontname'] and 'Tahoma' not in w['fontname']
                pequeno = w['size'] < tam * 0.85
                if prev is not None and pequeno and txt in ('o', 'a', 'os', 'as') and re.search(r'\d$', prev['text']):
                    partes.append({'o': 'º', 'a': 'ª', 'os': 'os', 'as': 'as'}[txt])
                    prev = w
                    continue
                if prev is not None and pequeno and txt in SOBRE:
                    partes.append(SOBRE[txt])
                    prev = w
                    continue
                if prev is not None:
                    gap = w['x0'] - prev['x1']
                    sep = ' ______ ' if gap > 18 else ('' if gap < 0.8 else ' ')
                    if neg and not bold:
                        partes.append('**')
                        neg = False
                    partes.append(sep)
                if bold and not neg:
                    partes.append('**')
                    neg = True
                partes.append(txt)
                prev = w
            if neg:
                partes.append('**')
            linha = ''.join(partes).strip()
            rodape = sys.argv[2] if len(sys.argv) > 2 else r'TJSP\d+/'
            if re.match(r'^(Confidencial até o momento|\d{1,2}$)', linha) or re.search(rodape, linha):
                continue
            out.append(linha)
print('\n'.join(out))
