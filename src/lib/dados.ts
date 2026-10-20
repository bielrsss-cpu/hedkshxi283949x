// Camada de dados do navegador.
// Tudo grava primeiro no IndexedDB (funciona offline) e entra numa fila.
// A fila é enviada a /api/dados quando há conexão; depois, baixa o que mudou em outros aparelhos.
// Em conflito vence a gravação mais recente (campo t).
import { openDB, type IDBPDatabase } from 'idb';

export type Colecao =
  | 'sessoes' | 'erros' | 'redacoes' | 'simulados' | 'tarefas' | 'marcacoes' | 'revisoes' | 'respostas' | 'config';

export interface Registro<F = Record<string, any>> {
  col: Colecao;
  id: string;
  fm: F;
  secoes?: Record<string, string>;
  t: number;
  apagado?: boolean;
}

type EstadoSync = 'ok' | 'sincronizando' | 'offline' | 'erro' | 'pendente';

let dbPromessa: Promise<IDBPDatabase> | null = null;
const ouvintes = new Set<(col?: Colecao) => void>();
const ouvintesSync = new Set<(e: EstadoSync, pendentes: number) => void>();
let canal: BroadcastChannel | null = null;

export function usuarioAtual(): string | null {
  try { return localStorage.getItem('caderno_usuario'); } catch { return null; }
}

function db(): Promise<IDBPDatabase> {
  if (!dbPromessa) {
    const u = usuarioAtual() ?? 'anonimo';
    dbPromessa = openDB(`caderno-${u}`, 1, {
      upgrade(d) {
        const r = d.createObjectStore('registros', { keyPath: 'chave' });
        r.createIndex('col', 'col');
        d.createObjectStore('fila', { keyPath: 'chave' });
        d.createObjectStore('etags');
      },
    });
    if (typeof BroadcastChannel !== 'undefined') {
      canal = new BroadcastChannel(`caderno-${u}`);
      canal.onmessage = (ev) => avisar(ev.data?.col, false);
    }
  }
  return dbPromessa;
}

function avisar(col?: Colecao, propagar = true) {
  for (const f of ouvintes) f(col);
  if (propagar) canal?.postMessage({ col });
}

/** Chama f sempre que os dados mudarem (nesta aba, em outra aba ou pela sincronização). */
export function assinar(f: (col?: Colecao) => void): () => void {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

export function assinarSync(f: (e: EstadoSync, pendentes: number) => void): () => void {
  ouvintesSync.add(f);
  return () => ouvintesSync.delete(f);
}

const chaveDe = (col: string, id: string) => `${col}/${id}`;

export async function listar<F = Record<string, any>>(col: Colecao): Promise<Registro<F>[]> {
  const d = await db();
  const todos = await d.getAllFromIndex('registros', 'col', col);
  return todos.filter((r) => !r.apagado).map(semChave) as Registro<F>[];
}

export async function listarTudo(): Promise<Registro[]> {
  const d = await db();
  return (await d.getAll('registros')).filter((r) => !r.apagado).map(semChave);
}

export async function obter<F = Record<string, any>>(col: Colecao, id: string): Promise<Registro<F> | undefined> {
  const d = await db();
  const r = await d.get('registros', chaveDe(col, id));
  return r && !r.apagado ? (semChave(r) as Registro<F>) : undefined;
}

function semChave(r: any): Registro {
  const { chave, ...resto } = r;
  return resto;
}

export async function salvar<F = Record<string, any>>(col: Colecao, id: string, fm: F, secoes?: Record<string, string>): Promise<Registro<F>> {
  const reg: Registro<F> = { col, id, fm, t: Date.now() };
  if (secoes) reg.secoes = secoes;
  await gravarLocal(reg);
  return reg;
}

export async function apagar(col: Colecao, id: string): Promise<void> {
  await gravarLocal({ col, id, fm: {}, t: Date.now(), apagado: true });
}

async function gravarLocal(reg: Registro<any>) {
  const d = await db();
  const chave = chaveDe(reg.col, reg.id);
  const tx = d.transaction(['registros', 'fila'], 'readwrite');
  await tx.objectStore('registros').put({ ...reg, chave });
  await tx.objectStore('fila').put({ ...reg, chave });
  await tx.done;
  avisar(reg.col);
  agendarSync(800);
}

// ---------------- Sincronização ----------------

let timer: ReturnType<typeof setTimeout> | null = null;
let rodando = false;
let deNovo = false;

export function agendarSync(ms = 0) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void sincronizar(), ms);
}

async function emitirEstado(e: EstadoSync) {
  const d = await db();
  const pend = await d.count('fila');
  const estado = e === 'ok' && pend > 0 ? 'pendente' : e;
  for (const f of ouvintesSync) f(estado, pend);
}

class NaoAutorizado extends Error {}

async function api(caminho: string, corpo?: unknown) {
  const r = await fetch(caminho, {
    method: corpo === undefined ? 'GET' : 'POST',
    headers: corpo === undefined ? {} : { 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (r.status === 401) throw new NaoAutorizado();
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function sincronizar(): Promise<void> {
  if (!usuarioAtual()) return;
  if (rodando) { deNovo = true; return; }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { await emitirEstado('offline'); return; }
  rodando = true;
  await emitirEstado('sincronizando');
  try {
    const d = await db();
    // 1) Envia a fila
    const fila = await d.getAll('fila');
    for (let i = 0; i < fila.length; i += 50) {
      const lote = fila.slice(i, i + 50);
      await api('/api/dados', { registros: lote.map(semChave) });
      const tx = d.transaction('fila', 'readwrite');
      for (const enviado of lote) {
        const atual = await tx.store.get(enviado.chave);
        if (atual && atual.t === enviado.t) await tx.store.delete(enviado.chave);
      }
      await tx.done;
    }
    // 2) Baixa o que mudou
    const { itens } = (await api('/api/dados')) as { itens: { chave: string; etag: string }[] };
    const mudadas: string[] = [];
    const etagDaLista = new Map(itens.map((it) => [it.chave, it.etag]));
    for (const it of itens) {
      const conhecida = await d.get('etags', it.chave);
      if (conhecida !== it.etag) mudadas.push(it.chave);
    }
    const colsMudadas = new Set<Colecao>();
    for (let i = 0; i < mudadas.length; i += 150) {
      const { registros } = (await api('/api/dados/buscar', { chaves: mudadas.slice(i, i + 150) })) as {
        registros: { chave: string; etag: string; registro: Registro }[];
      };
      const tx = d.transaction(['registros', 'fila', 'etags'], 'readwrite');
      for (const { chave, etag, registro } of registros) {
        const local = await tx.objectStore('registros').get(chave);
        const pendente = await tx.objectStore('fila').get(chave);
        if (!(pendente && pendente.t > registro.t) && !(local && local.t > registro.t)) {
          if (!local || local.t !== registro.t) colsMudadas.add(registro.col);
          await tx.objectStore('registros').put({ ...registro, chave });
        }
        await tx.objectStore('etags').put(etagDaLista.get(chave) ?? etag, chave);
      }
      await tx.done;
    }
    for (const c of colsMudadas) avisar(c);
    try { localStorage.setItem('caderno_ultima_sync', String(Date.now())); } catch {}
    await emitirEstado('ok');
  } catch (e) {
    if (e instanceof NaoAutorizado) {
      try { localStorage.removeItem('caderno_usuario'); } catch {}
      location.href = '/login?volta=' + encodeURIComponent(location.pathname + location.search);
      return;
    }
    await emitirEstado(navigator.onLine === false ? 'offline' : 'erro');
  } finally {
    rodando = false;
    if (deNovo) { deNovo = false; agendarSync(500); }
  }
}

let iniciado = false;
export function iniciarSync() {
  if (iniciado) return;
  iniciado = true;
  window.addEventListener('online', () => agendarSync(0));
  window.addEventListener('offline', () => void emitirEstado('offline'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') agendarSync(0);
  });
  setInterval(() => agendarSync(0), 90_000);
  agendarSync(0);
}

/** Quantos registros ainda não foram enviados ao servidor. */
export async function pendentes(): Promise<number> {
  return (await db()).count('fila');
}
