// Autenticação compartilhada pelas Netlify Functions.
//
// Usuários: cada variável de ambiente SENHA_<NOME> cria um login <nome> (minúsculo).
//   SENHA_MARIA=...  -> usuário "maria"
//   SENHA_JULIA=...    -> usuário "julia"
// Token: base64url({u, exp}) + "." + HMAC-SHA256(AUTH_SECRET), guardado num cookie HttpOnly.
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'caderno_sessao';
export const VALIDADE_S = 90 * 24 * 3600;

export function usuarios(): Map<string, string> {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(process.env)) {
    const r = k.match(/^SENHA_([A-Z0-9_]+)$/);
    if (r && v) m.set(r[1].toLowerCase(), v);
  }
  return m;
}

function segredo(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error('AUTH_SECRET ausente ou curto demais (mínimo 16 caracteres).');
  return s;
}

const b64url = (b: Buffer) => b.toString('base64url');

export function criarToken(usuario: string): string {
  const payload = b64url(Buffer.from(JSON.stringify({ u: usuario, exp: Math.floor(Date.now() / 1000) + VALIDADE_S })));
  const sig = b64url(createHmac('sha256', segredo()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verificarToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const esperado = createHmac('sha256', segredo()).update(payload).digest();
  const recebido = Buffer.from(sig, 'base64url');
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof u !== 'string' || typeof exp !== 'number' || exp < Date.now() / 1000) return null;
    // Se a senha do usuário foi removida do ambiente, o token deixa de valer.
    if (!usuarios().has(u)) return null;
    return u;
  } catch {
    return null;
  }
}

export function senhaConfere(usuario: string, senha: string): boolean {
  const certa = usuarios().get(usuario);
  const a = createHash('sha256').update(senha).digest();
  const b = createHash('sha256').update(certa ?? '\u0000sem-usuario').digest();
  return timingSafeEqual(a, b) && certa !== undefined;
}

export function lerCookie(req: Request, nome: string): string | null {
  const c = req.headers.get('cookie') ?? '';
  for (const parte of c.split(/;\s*/)) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i) === nome) return decodeURIComponent(parte.slice(i + 1));
  }
  return null;
}

/** Devolve o usuário do token (cookie ou Authorization: Bearer) ou null. */
export function usuarioDaRequisicao(req: Request): string | null {
  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  return verificarToken(bearer ?? lerCookie(req, COOKIE));
}

export function cookieSessao(token: string): string {
  return `${COOKIE}=${token}; Path=/; Max-Age=${VALIDADE_S}; HttpOnly; Secure; SameSite=Lax`;
}

export function cookieApagado(): string {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function json(dados: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

export const naoAutorizado = () => json({ erro: 'não autorizado' }, 401);
