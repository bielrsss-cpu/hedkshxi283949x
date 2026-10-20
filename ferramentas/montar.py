"""Monta o arquivo final da lei seca: front matter + cabeçalho + corpo convertido.

Uso: python3 -I montar.py corpo.md destino.md 'json com os campos do front matter'
"""
import json
import re
import sys

corpo_path, destino, campos = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
corpo = open(corpo_path, encoding='utf-8').read().strip()
n = len(re.findall(r'^###### ', corpo, flags=re.M))

ordem = ['titulo', 'norma', 'recorte_edital', 'item_edital', 'artigos_extraidos', 'fonte_oficial',
         'texto_obtido_em', 'origem_do_arquivo', 'observacoes', 'edital', 'status']
campos['artigos_extraidos'] = n
campos.setdefault('status', 'ok')
linhas = ['---']
for k in ordem:
    if k in campos:
        v = campos[k]
        linhas.append(f'{k}: {v}' if isinstance(v, int) else f'{k}: {json.dumps(v, ensure_ascii=False)}')
linhas.append('---\n')
cab = [f"# {campos['titulo']}\n",
       f"> **Recorte do edital:** {campos['recorte_edital']}  ",
       f"> **Fonte oficial:** {campos['fonte_oficial']} (texto vigente em {campos['texto_obtido_em']}). Confira na fonte em caso de dúvida.  "]
if campos.get('observacoes'):
    cab.append(f"> **Observação:** {campos['observacoes']}")
open(destino, 'w', encoding='utf-8').write('\n'.join(linhas) + '\n'.join(cab) + '\n\n' + corpo + '\n')
print(f'{destino}: {n} dispositivos')
