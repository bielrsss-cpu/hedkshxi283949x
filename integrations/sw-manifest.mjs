// Gera dist/sw.js no fim do build, com a lista de páginas e arquivos para uso offline.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

function listar(dir, base = dir) {
  const out = [];
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (fs.statSync(p).isDirectory()) out.push(...listar(p, base));
    else out.push('/' + path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

export default function swManifest() {
  return {
    name: 'sw-manifest',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const raiz = fileURLToPath(dir);
        const arquivos = listar(raiz).filter((f) => f !== '/sw.js');
        const paginas = arquivos
          .filter((f) => f.endsWith('.html') && f !== '/login.html' && !f.startsWith('/404'))
          .map((f) => (f === '/index.html' ? '/' : f.replace(/\.html$/, '')));
        const estaticos = arquivos.filter((f) => !f.endsWith('.html'));
        const hash = crypto.createHash('sha256');
        for (const f of arquivos) hash.update(f).update(fs.readFileSync(path.join(raiz, f)));
        const versao = hash.digest('hex').slice(0, 12);
        const modelo = fs.readFileSync(new URL('./sw-modelo.js', import.meta.url), 'utf8');
        const sw = modelo
          .replace('__VERSAO__', versao)
          .replace('__PAGINAS__', JSON.stringify(paginas))
          .replace('__ESTATICOS__', JSON.stringify(estaticos));
        fs.writeFileSync(path.join(raiz, 'sw.js'), sw);
        console.log(`[sw] versão ${versao}: ${paginas.length} páginas, ${estaticos.length} arquivos`);
      },
    },
  };
}
