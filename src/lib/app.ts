// Comportamento comum a todas as páginas: menu, tema, sair, exportar, status da sincronização, service worker.
import { assinarSync, iniciarSync, pendentes, usuarioAtual } from './dados';

export function toast(msg: string, ms = 2500) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function alternarTema() {
  const raiz = document.documentElement;
  const escuroAgora =
    raiz.dataset.theme === 'dark' || (!raiz.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const novo = escuroAgora ? 'light' : 'dark';
  raiz.dataset.theme = novo;
  try { localStorage.setItem('caderno_tema', novo); } catch {}
}

async function sair() {
  const n = await pendentes();
  if (n > 0 && !confirm(`Há ${n} registro(s) ainda não sincronizado(s). Se sair agora, eles ficam guardados neste aparelho e sobem no próximo login. Sair mesmo assim?`)) return;
  try { await fetch('/api/sair', { method: 'POST' }); } catch {}
  try { localStorage.removeItem('caderno_usuario'); } catch {}
  location.href = '/login';
}

const TEXTO_SYNC: Record<string, string> = {
  ok: 'Sincronizado',
  sincronizando: 'Sincronizando…',
  offline: 'Offline: salvo no aparelho',
  erro: 'Erro ao sincronizar',
  pendente: 'Alterações pendentes',
};

export function iniciarApp() {
  const u = usuarioAtual();
  if (!u) return;
  const nome = u.charAt(0).toUpperCase() + u.slice(1);
  for (const id of ['nome-usuario', 'nome-usuario-m']) {
    const el = document.getElementById(id);
    if (el) el.textContent = `· ${nome}`;
  }

  const btnMais = document.getElementById('btn-mais');
  const menu = document.getElementById('mais-menu');
  btnMais?.addEventListener('click', () => {
    const aberto = menu?.classList.toggle('aberto');
    btnMais.setAttribute('aria-expanded', String(!!aberto));
  });
  document.addEventListener('click', (e) => {
    if (!menu?.classList.contains('aberto')) return;
    const alvo = e.target as Node;
    if (!menu.contains(alvo) && !btnMais?.contains(alvo)) menu.classList.remove('aberto');
  });

  document.querySelectorAll<HTMLElement>('[data-acao]').forEach((b) => {
    b.addEventListener('click', async () => {
      const acao = b.dataset.acao;
      menu?.classList.remove('aberto');
      if (acao === 'tema') alternarTema();
      if (acao === 'sair') await sair();
      if (acao === 'exportar') {
        toast('Gerando o arquivo…');
        const { exportarZip } = await import('./exportar');
        await exportarZip();
      }
    });
  });

  const statusEls = ['status-sync-d', 'status-sync-m'].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
  assinarSync((estado, pend) => {
    for (const el of statusEls) {
      el.classList.remove('ok', 'sincronizando', 'offline', 'erro', 'pendente');
      el.classList.add(estado);
      el.innerHTML = `<span class="ponto"></span>${TEXTO_SYNC[estado]}${pend ? ` (${pend})` : ''}`;
    }
  });

  iniciarSync();

  if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}
