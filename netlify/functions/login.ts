import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { cookieApagado, cookieSessao, criarToken, json, senhaConfere, usuarioDaRequisicao, usuarios } from '../lib/auth';

const MAX_FALHAS = 8;
const JANELA_MS = 15 * 60 * 1000;

export default async (req: Request, context: Context) => {
  const rota = new URL(req.url).pathname;

  if (rota === '/api/eu') {
    const u = usuarioDaRequisicao(req);
    return json({ usuario: u });
  }

  if (req.method !== 'POST') return json({ erro: 'método não permitido' }, 405);

  if (rota === '/api/sair') return json({ ok: true }, 200, { 'set-cookie': cookieApagado() });

  if (!process.env.AUTH_SECRET || usuarios().size === 0) {
    return json({ erro: 'Servidor sem configuração: cadastre AUTH_SECRET e ao menos uma SENHA_<NOME> no Netlify.' }, 500);
  }

  // Limite simples de tentativas por IP
  const tentativas = getStore({ name: 'login-tentativas', consistency: 'strong' });
  const ip = (context.ip || 'desconhecido').replace(/[^\w.:-]/g, '_');
  const reg = ((await tentativas.get(ip, { type: 'json' })) as { n: number; desde: number } | null) ?? { n: 0, desde: Date.now() };
  if (Date.now() - reg.desde > JANELA_MS) { reg.n = 0; reg.desde = Date.now(); }
  if (reg.n >= MAX_FALHAS) return json({ erro: 'Muitas tentativas. Espere 15 minutos.' }, 429);

  let corpo: { usuario?: string; senha?: string };
  try { corpo = await req.json(); } catch { return json({ erro: 'requisição inválida' }, 400); }
  const usuario = String(corpo.usuario ?? '').trim().toLowerCase();
  const senha = String(corpo.senha ?? '');

  if (!usuario || !senha || !senhaConfere(usuario, senha)) {
    reg.n += 1;
    await tentativas.setJSON(ip, reg);
    await new Promise((r) => setTimeout(r, 600));
    return json({ erro: 'Usuário ou senha incorretos.' }, 401);
  }

  if (reg.n > 0) await tentativas.delete(ip);
  return json({ usuario }, 200, { 'set-cookie': cookieSessao(criarToken(usuario)) });
};

export const config: Config = { path: ['/api/login', '/api/sair', '/api/eu'] };
