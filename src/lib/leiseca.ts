// Leitor de uma norma: busca, filtro, estados, grifos, anotações e contador de quedas em prova.
import { assinar } from './dados';
import { normalizar } from './busca-doc';
import { marcacoesDaNorma, ROTULO_ESTADO, salvarMarcacao, vazia, type EstadoArtigo, type Grifo, type Marcacao } from './marcacoes';
import { toast } from './app';

let marcas = new Map<string, Marcacao>();
let norma = '';
let textoNormalizado = new Map<string, string>();

const $ = <T extends Element = HTMLElement>(s: string, raiz: ParentNode = document) => raiz.querySelector(s) as T | null;
const artigos = () => Array.from(document.querySelectorAll<HTMLElement>('section.art'));
const corpoDe = (art: HTMLElement) => art.querySelector('.art-corpo') as HTMLElement;
const marcacaoDe = (id: string) => marcas.get(id) ?? vazia(norma, id);

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

// ---------- Grifos ----------

function removerGrifos(corpo: HTMLElement) {
  corpo.querySelectorAll('mark.grifo').forEach((m) => m.replaceWith(...Array.from(m.childNodes)));
  corpo.normalize();
}

function aplicarGrifos(art: HTMLElement, m: Marcacao) {
  const corpo = corpoDe(art);
  removerGrifos(corpo);
  if (!m.grifos.length) return;
  const texto = corpo.textContent ?? '';
  // Confere cada grifo contra o texto atual; se a posição mudou, procura o trecho.
  const intervalos = m.grifos
    .map((g, idx) => {
      if (texto.slice(g.i, g.f) === g.txt) return { ...g, idx };
      const j = texto.indexOf(g.txt);
      return j >= 0 ? { i: j, f: j + g.txt.length, txt: g.txt, idx } : null;
    })
    .filter(Boolean) as (Grifo & { idx: number })[];
  intervalos.sort((a, b) => a.i - b.i);

  const walker = document.createTreeWalker(corpo, NodeFilter.SHOW_TEXT);
  const nos: { no: Text; ini: number }[] = [];
  let pos = 0;
  while (walker.nextNode()) {
    const no = walker.currentNode as Text;
    nos.push({ no, ini: pos });
    pos += no.data.length;
  }
  for (const { no, ini } of nos) {
    const fim = ini + no.data.length;
    const cortes = intervalos.filter((g) => g.i < fim && g.f > ini);
    if (!cortes.length) continue;
    let resto: Text = no;
    let base = ini;
    for (const g of cortes) {
      const a = Math.max(g.i, base) - base;
      const b = Math.min(g.f, fim) - base;
      if (b <= a) continue;
      const meio = resto.splitText(a);
      const depois = meio.splitText(b - a);
      const mark = document.createElement('mark');
      mark.className = 'grifo';
      mark.dataset.g = String(g.idx);
      meio.replaceWith(mark);
      mark.appendChild(meio);
      resto = depois;
      base = base + b;
    }
  }
}

function deslocamento(corpo: HTMLElement, no: Node, off: number): number {
  const r = document.createRange();
  r.selectNodeContents(corpo);
  r.setEnd(no, off);
  return r.toString().length;
}

let selecaoPendente: { art: HTMLElement; i: number; f: number; txt: string } | null = null;
let grifoSelecionado: { art: HTMLElement; idx: number } | null = null;

function mostrarBarra(modo: 'grifar' | 'remover' | null) {
  const barra = $('#barra-grifo')!;
  barra.hidden = modo === null;
  ($('[data-g="grifar"]', barra) as HTMLElement).hidden = modo !== 'grifar';
  ($('[data-g="remover"]', barra) as HTMLElement).hidden = modo !== 'remover';
}

function lerSelecao() {
  const sel = getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
    selecaoPendente = null;
    if (!grifoSelecionado) mostrarBarra(null);
    return;
  }
  const r = sel.getRangeAt(0);
  const el = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement) as HTMLElement;
  const corpo = el?.closest('.art-corpo') as HTMLElement | null;
  if (!corpo) { selecaoPendente = null; mostrarBarra(null); return; }
  const art = corpo.closest('section.art') as HTMLElement;
  const i = deslocamento(corpo, r.startContainer, r.startOffset);
  let f: number;
  if (corpo.contains(r.endContainer)) f = deslocamento(corpo, r.endContainer, r.endOffset);
  else f = (corpo.textContent ?? '').length;
  const txt = (corpo.textContent ?? '').slice(i, f);
  if (!txt.trim()) { selecaoPendente = null; mostrarBarra(null); return; }
  selecaoPendente = { art, i, f, txt };
  grifoSelecionado = null;
  mostrarBarra('grifar');
}

async function grifar() {
  if (!selecaoPendente) return;
  const { art, i, f, txt } = selecaoPendente;
  const m = { ...marcacaoDe(art.dataset.art!) };
  // Junta com grifos que se sobrepõem
  let ini = i, fim = f;
  const texto = corpoDe(art).textContent ?? '';
  const restantes = m.grifos.filter((g) => {
    if (g.f < ini || g.i > fim) return true;
    ini = Math.min(ini, g.i);
    fim = Math.max(fim, g.f);
    return false;
  });
  m.grifos = [...restantes, { i: ini, f: fim, txt: texto.slice(ini, fim) || txt }].sort((a, b) => a.i - b.i);
  if (!m.estado) m.estado = 'lido';
  marcas.set(m.artigo, m);
  getSelection()?.removeAllRanges();
  selecaoPendente = null;
  mostrarBarra(null);
  atualizarArtigo(art);
  await salvarMarcacao(m);
}

async function removerGrifo() {
  if (!grifoSelecionado) return;
  const { art, idx } = grifoSelecionado;
  const m = { ...marcacaoDe(art.dataset.art!) };
  m.grifos = m.grifos.filter((_, k) => k !== idx);
  marcas.set(m.artigo, m);
  grifoSelecionado = null;
  mostrarBarra(null);
  atualizarArtigo(art);
  await salvarMarcacao(m);
}

// ---------- Selos, painel e nota ----------

function atualizarArtigo(art: HTMLElement) {
  const id = art.dataset.art!;
  const m = marcacaoDe(id);
  art.classList.remove('estado-lido', 'estado-revisar', 'estado-dominado');
  if (m.estado) art.classList.add(`estado-${m.estado}`);
  const selos = $('.art-selos', art)!;
  const partes: string[] = [];
  if (m.estado === 'revisar') partes.push('<span class="selo pendente">Revisar</span>');
  if (m.estado === 'dominado') partes.push('<span class="selo ok">Dominado</span>');
  if (m.vezes_em_prova > 0) partes.push(`<span class="selo perigo" title="Vezes em que caiu em prova">caiu ${m.vezes_em_prova}×</span>`);
  if (m.nota) partes.push('<span class="selo info">nota</span>');
  selos.innerHTML = partes.join('');

  let nota = $('.art-nota', art);
  if (m.nota) {
    if (!nota) {
      nota = document.createElement('div');
      nota.className = 'art-nota';
      corpoDe(art).after(nota);
    }
    nota.textContent = m.nota;
  } else nota?.remove();

  aplicarGrifos(art, m);
  if ($('.art-painel', art)) abrirPainel(art, true);
}

function abrirPainel(art: HTMLElement, redesenhar = false) {
  const existente = $('.art-painel', art);
  if (existente && !redesenhar) { existente.remove(); return; }
  document.querySelectorAll('.art-painel').forEach((p) => { if (p.closest('section.art') !== art) p.remove(); });
  const id = art.dataset.art!;
  const m = marcacaoDe(id);
  const painel = existente ?? document.createElement('div');
  painel.className = 'art-painel';
  const estados: EstadoArtigo[] = ['lido', 'revisar', 'dominado'];
  const disc = document.querySelector<HTMLElement>('.leiseca')?.dataset.disciplina ?? '';
  const rotulo = $('.art-rotulo', art)?.textContent ?? id;
  painel.innerHTML = `
    <div class="estados" role="group" aria-label="Estado do artigo">
      ${estados.map((e) => `<button type="button" class="btn pequeno" data-estado="${e}" aria-pressed="${m.estado === e}">${ROTULO_ESTADO[e]}</button>`).join('')}
    </div>
    <div class="linha" style="margin-bottom:8px">
      <span>Caiu em prova:</span>
      <button type="button" class="btn pequeno" data-quedas="-1" aria-label="Diminuir">−</button>
      <strong data-quedas-n>${m.vezes_em_prova}</strong>
      <button type="button" class="btn pequeno" data-quedas="1" aria-label="Aumentar">+</button>
    </div>
    <label>Anotação</label>
    <textarea data-nota rows="3" placeholder="Sua anotação sobre este artigo">${esc(m.nota)}</textarea>
    <div class="linha" style="margin-top:8px">
      <button type="button" class="btn pequeno primario" data-salvar-nota>Salvar anotação</button>
      <a class="btn pequeno" href="/sessao?disciplina=${encodeURIComponent(disc)}&tipo=lei-seca&topico=${encodeURIComponent(rotulo + ' · ' + document.title.split(' · ')[0])}&lei=${encodeURIComponent(`03-lei-seca/${norma}.md#${id}`)}">Iniciar sessão</a>
      <button type="button" class="btn pequeno" data-fechar>Fechar</button>
    </div>
    <p class="sutil pequeno" style="margin:6px 0 0">Para grifar, selecione um trecho do texto. Toque num grifo para removê-lo.</p>`;
  if (!existente) $('.art-cab', art)!.after(painel);

  painel.querySelectorAll<HTMLButtonElement>('[data-estado]').forEach((b) =>
    b.addEventListener('click', async () => {
      const novo = { ...marcacaoDe(id) };
      novo.estado = novo.estado === b.dataset.estado ? '' : (b.dataset.estado as EstadoArtigo);
      marcas.set(id, novo);
      atualizarArtigo(art);
      atualizarContagens();
      await salvarMarcacao(novo);
    }),
  );
  painel.querySelectorAll<HTMLButtonElement>('[data-quedas]').forEach((b) =>
    b.addEventListener('click', async () => {
      const novo = { ...marcacaoDe(id) };
      novo.vezes_em_prova = Math.max(0, (novo.vezes_em_prova || 0) + Number(b.dataset.quedas));
      marcas.set(id, novo);
      atualizarArtigo(art);
      await salvarMarcacao(novo);
    }),
  );
  $('[data-salvar-nota]', painel)!.addEventListener('click', async () => {
    const novo = { ...marcacaoDe(id) };
    novo.nota = ($('[data-nota]', painel) as HTMLTextAreaElement).value.trim();
    marcas.set(id, novo);
    atualizarArtigo(art);
    await salvarMarcacao(novo);
    toast('Anotação salva');
  });
  $('[data-fechar]', painel)!.addEventListener('click', () => painel.remove());
}

// ---------- Busca e filtro ----------

function idDeBusca(q: string): string | null {
  const m = q.trim().match(/^(?:art(?:igo)?\.?|item)\s*(\d{1,2}\.\d{3}|\d+)\s*[º°o]?\s*(?:-?\s*([a-z]))?\b/i);
  if (!m) return null;
  const pref = /^item/i.test(q.trim()) ? 'item' : 'art';
  return `${pref}-${m[1].replace('.', '')}${m[2] ? '-' + m[2].toLowerCase() : ''}`;
}

function textoDe(art: HTMLElement): string {
  const id = art.dataset.art!;
  let t = textoNormalizado.get(id);
  if (t === undefined) {
    t = normalizar(($('.art-rotulo', art)?.textContent ?? '') + ' ' + (corpoDe(art).textContent ?? ''));
    textoNormalizado.set(id, t);
  }
  return t;
}

function aplicarFiltro() {
  const q = ($('#ls-busca') as HTMLInputElement).value;
  const filtro = ($('#ls-filtro') as HTMLSelectElement).value;
  const id = idDeBusca(q);
  const palavras = id ? [] : normalizar(q).split(/\s+/).filter((p) => p.length >= 2);
  let visiveis = 0;
  for (const art of artigos()) {
    const m = marcacaoDe(art.dataset.art!);
    let ok = true;
    if (palavras.length) ok = palavras.every((p) => textoDe(art).includes(p));
    if (ok && filtro) {
      ok =
        (filtro === 'nao-lido' && !m.estado) ||
        (filtro === m.estado) ||
        (filtro === 'grifo' && m.grifos.length > 0) ||
        (filtro === 'nota' && !!m.nota) ||
        (filtro === 'caiu' && m.vezes_em_prova > 0);
    }
    art.classList.toggle('oculto', !ok);
    if (ok) visiveis++;
  }
  const filtrando = palavras.length > 0 || !!filtro;
  document.querySelectorAll<HTMLElement>('.ls-titulo').forEach((t) => (t.style.display = filtrando ? 'none' : ''));
  $('#ls-contagem')!.textContent = filtrando ? `${visiveis} dispositivo(s) encontrados` : '';
  if (id) {
    const alvo = document.getElementById(id) ?? document.getElementById(id.replace(/-[a-z]$/, ''));
    if (alvo) alvo.scrollIntoView({ block: 'start' });
    $('#ls-contagem')!.textContent = alvo ? '' : 'Artigo não está no recorte';
  }
}

function atualizarContagens() {
  const lista = artigos();
  const dom = lista.filter((a) => marcacaoDe(a.dataset.art!).estado === 'dominado').length;
  const lidos = lista.filter((a) => marcacaoDe(a.dataset.art!).estado).length;
  $('#ls-progresso')!.textContent = `${lidos}/${lista.length} marcados · ${dom} dominados`;
}

// ---------- Índice no celular ----------

function abrirIndiceCelular() {
  const indice = $('.ls-indice');
  if (!indice) return;
  const gaveta = document.createElement('div');
  gaveta.className = 'ls-gaveta';
  const int = document.createElement('div');
  int.innerHTML = '<p><strong>Índice</strong></p>';
  int.appendChild(indice.cloneNode(true));
  gaveta.appendChild(int);
  gaveta.addEventListener('click', (e) => {
    if (e.target === gaveta || (e.target as HTMLElement).closest('a')) gaveta.remove();
  });
  document.body.appendChild(gaveta);
}

// ---------- Início ----------

async function carregar() {
  marcas = await marcacoesDaNorma(norma);
  for (const art of artigos()) atualizarArtigo(art);
  atualizarContagens();
  aplicarFiltro();
}

export function iniciarLeiSeca() {
  norma = document.querySelector<HTMLElement>('.leiseca')!.dataset.norma!;
  void carregar();
  assinar((col) => { if (!col || col === 'marcacoes') void carregar(); });

  let t: ReturnType<typeof setTimeout>;
  $('#ls-busca')!.addEventListener('input', () => { clearTimeout(t); t = setTimeout(aplicarFiltro, 250); });
  $('#ls-busca')!.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') aplicarFiltro(); });
  $('#ls-filtro')!.addEventListener('change', aplicarFiltro);
  $('#ls-abrir-indice')?.addEventListener('click', abrirIndiceCelular);

  document.addEventListener('click', (e) => {
    const alvo = e.target as HTMLElement;
    const mais = alvo.closest('.art-mais');
    if (mais) { abrirPainel(mais.closest('section.art') as HTMLElement); return; }
    const g = alvo.closest('mark.grifo') as HTMLElement | null;
    if (g && getSelection()?.isCollapsed) {
      grifoSelecionado = { art: g.closest('section.art') as HTMLElement, idx: Number(g.dataset.g) };
      selecaoPendente = null;
      mostrarBarra('remover');
    }
  });

  let ts: ReturnType<typeof setTimeout>;
  document.addEventListener('selectionchange', () => { clearTimeout(ts); ts = setTimeout(lerSelecao, 200); });

  const barra = $('#barra-grifo')!;
  // Evita que o toque no botão apague a seleção antes do clique
  barra.addEventListener('mousedown', (e) => e.preventDefault());
  $('[data-g="grifar"]', barra)!.addEventListener('click', () => void grifar());
  $('[data-g="remover"]', barra)!.addEventListener('click', () => void removerGrifo());
  $('[data-g="cancelar"]', barra)!.addEventListener('click', () => {
    getSelection()?.removeAllRanges();
    selecaoPendente = null;
    grifoSelecionado = null;
    mostrarBarra(null);
  });

  if (location.hash) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView(), 50);
}
