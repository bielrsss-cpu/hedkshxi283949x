// Bloqueia as páginas do site para quem não fez login.
// Confere o mesmo token assinado que as Functions usam (cookie caderno_sessao).
import type { Config, Context } from '@netlify/edge-functions';

const enc = new TextEncoder();

function b64urlParaBytes(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function tokenValido(token: string | undefined): Promise<boolean> {
  const segredo = Netlify.env.get('AUTH_SECRET');
  if (!token || !segredo) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const chave = await crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  let ok = false;
  try {
    ok = await crypto.subtle.verify('HMAC', chave, b64urlParaBytes(sig), enc.encode(payload));
  } catch {
    return false;
  }
  if (!ok) return false;
  try {
    const { u, exp } = JSON.parse(new TextDecoder().decode(b64urlParaBytes(payload)));
    if (typeof u !== 'string' || exp < Date.now() / 1000) return false;
    return !!Netlify.env.get(`SENHA_${u.toUpperCase()}`);
  } catch {
    return false;
  }
}

export default async (req: Request, context: Context) => {
  if (await tokenValido(context.cookies.get('caderno_sessao'))) return context.next();
  const url = new URL(req.url);
  const volta = url.pathname + url.search;
  const login = new URL('/login', url);
  if (volta !== '/') login.searchParams.set('volta', volta);
  return Response.redirect(login.toString(), 302);
};

export const config: Config = {
  path: '/*',
  excludedPath: [
    '/login',
    '/login.html',
    '/api/*',
    '/_astro/*',
    '/sw.js',
    '/manifest.webmanifest',
    '/icone.svg',
    '/icone-192.png',
    '/icone-512.png',
    '/favicon.ico',
  ],
};
