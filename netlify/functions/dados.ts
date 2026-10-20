// Dados de cada usuário no Netlify Blobs.
// Chave no Blobs: <usuario>/<colecao>/<id>. Valor: { col, id, fm, secoes?, t, apagado? }
//   GET  /api/dados          -> lista { chave, etag } de todos os registros do usuário
//   POST /api/dados          -> { registros: [...] } grava (vence o maior "t")
//   POST /api/dados/buscar   -> { chaves: [...] } devolve os registros
import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { json, naoAutorizado, usuarioDaRequisicao } from '../lib/auth';

export const COLECOES = ['sessoes', 'erros', 'redacoes', 'simulados', 'tarefas', 'marcacoes', 'revisoes', 'respostas', 'config'];
const ID_VALIDO = /^[A-Za-z0-9._@-]{1,160}$/;
const MAX_BYTES = 256 * 1024;

interface Registro {
  col: string;
  id: string;
  fm: Record<string, unknown>;
  secoes?: Record<string, string>;
  t: number;
  apagado?: boolean;
}

function valido(r: any): r is Registro {
  return (
    r && typeof r === 'object' &&
    COLECOES.includes(r.col) &&
    typeof r.id === 'string' && ID_VALIDO.test(r.id) &&
    typeof r.t === 'number' && Number.isFinite(r.t) &&
    r.fm && typeof r.fm === 'object' &&
    JSON.stringify(r).length <= MAX_BYTES
  );
}

async function emLotes<T, R>(itens: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < itens.length; i += n) out.push(...(await Promise.all(itens.slice(i, i + n).map(f))));
  return out;
}

export default async (req: Request) => {
  const usuario = usuarioDaRequisicao(req);
  if (!usuario) return naoAutorizado();

  const store = getStore({ name: 'caderno', consistency: 'strong' });
  const prefixo = `${usuario}/`;
  const rota = new URL(req.url).pathname;

  if (req.method === 'GET' && rota === '/api/dados') {
    const itens: { chave: string; etag: string }[] = [];
    for await (const pagina of store.list({ prefix: prefixo, paginate: true })) {
      for (const b of pagina.blobs) itens.push({ chave: b.key.slice(prefixo.length), etag: b.etag });
    }
    return json({ itens });
  }

  if (req.method !== 'POST') return json({ erro: 'método não permitido' }, 405);

  let corpo: any;
  try { corpo = await req.json(); } catch { return json({ erro: 'requisição inválida' }, 400); }

  if (rota === '/api/dados/buscar') {
    const chaves: string[] = Array.isArray(corpo?.chaves) ? corpo.chaves.slice(0, 200) : [];
    const registros = await emLotes(chaves, 20, async (chave) => {
      if (typeof chave !== 'string' || chave.includes('..')) return null;
      const r = await store.getWithMetadata(prefixo + chave, { type: 'json' });
      return r ? { chave, etag: r.etag, registro: r.data } : null;
    });
    return json({ registros: registros.filter(Boolean) });
  }

  if (rota === '/api/dados') {
    const lista: unknown[] = Array.isArray(corpo?.registros) ? corpo.registros.slice(0, 100) : [];
    const resultados = await emLotes(lista, 10, async (r) => {
      if (!valido(r)) return { chave: null, ok: false, erro: 'registro inválido' };
      const chave = `${r.col}/${r.id}`;
      const atual = (await store.get(prefixo + chave, { type: 'json' })) as Registro | null;
      if (atual && atual.t > r.t) return { chave, ok: true, ignorado: true }; // o servidor tem versão mais nova
      const limpo: Registro = { col: r.col, id: r.id, fm: r.fm, t: r.t };
      if (r.secoes) limpo.secoes = r.secoes;
      if (r.apagado) limpo.apagado = true;
      await store.setJSON(prefixo + chave, limpo);
      return { chave, ok: true };
    });
    return json({ resultados });
  }

  return json({ erro: 'rota desconhecida' }, 404);
};

export const config: Config = { path: ['/api/dados', '/api/dados/buscar'] };
