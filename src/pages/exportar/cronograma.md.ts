// Texto original do cronograma, usado pela exportação para gerar a versão com [x].
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from '../../lib/conteudo';

export function GET() {
  return new Response(fs.readFileSync(path.join(RAIZ, '02-cronograma/cronograma.md'), 'utf8'), {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
}
