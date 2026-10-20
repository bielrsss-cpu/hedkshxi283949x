// Lista de normas: progresso por norma e busca em toda a lei seca.
import { assinar, listar } from './dados';
import { normalizar } from './busca-doc';
import type { Marcacao } from './marcacoes';

interface ItemIndice { n: string; id: string; r: string; x: string }
let indice: ItemIndice[] | null = null;
let indiceNorm: string[] = [];

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

async function progresso() {
  const marcas = await listar<Marcacao>('marcacoes');
  const porNorma = new Map<string, { marcados: number; dominados: number; revisar: number }>();
  for (const { fm } of marcas) {
    const p = porNorma.get(fm.norma) ?? { marcados: 0, dominados: 0, revisar: 0 };
    if (fm.estado) p.marcados++;
    if (fm.estado === 'dominado') p.dominados++;
    if (fm.estado === 'revisar') p.revisar++;
    porNorma.set(fm.norma, p);
  }
  document.querySelectorAll<HTMLElement>('.norma-item').forEach((el) => {
    const p = porNorma.get(el.dataset.slug!);
    const caixa = el.querySelector<HTMLElement>('.progresso-norma');
    if (!caixa) return;
    const total = Number(el.dataset.total) || 1;
    caixa.hidden = !p;
    if (!p) return;
    (caixa.querySelector('.barra > span') as HTMLElement).style.width = `${Math.round((p.marcados / total) * 100)}%`;
    caixa.querySelector('.resumo')!.textContent = `${p.marcados}/${total} marcados · ${p.dominados} dominados · ${p.revisar} para revisar`;
  });
}

async function buscar(q: string) {
  const out = document.getElementById('resultados-global')!;
  const termo = q.trim();
  if (termo.length < 2) { out.innerHTML = ''; return; }
  if (!indice) {
    out.innerHTML = '<p class="sutil pequeno">Carregando índice…</p>';
    indice = (await (await fetch('/lei-seca/indice.json')).json()) as ItemIndice[];
    indiceNorm = indice.map((i) => normalizar(i.r + ' ' + i.x));
  }
  const nomes = JSON.parse(document.getElementById('nomes-normas')!.textContent!);
  const art = termo.match(/^art(?:igo)?\.?\s*(\d{1,2}\.\d{3}|\d+)\s*[º°o]?\s*(?:-?\s*([a-z]))?\s*$/i);
  let achados: ItemIndice[];
  if (art) {
    const id = `art-${art[1].replace('.', '')}${art[2] ? '-' + art[2].toLowerCase() : ''}`;
    achados = indice.filter((i) => i.id === id);
  } else {
    const palavras = normalizar(termo).split(/\s+/).filter((p) => p.length >= 2);
    achados = indice.filter((_, k) => palavras.every((p) => indiceNorm[k].includes(p)));
  }
  if (!achados.length) { out.innerHTML = '<p class="sutil pequeno">Nada encontrado.</p>'; return; }
  const primeira = normalizar(termo).split(/\s+/)[0];
  out.innerHTML =
    `<p class="sutil pequeno">${achados.length} resultado(s)${achados.length > 60 ? ', mostrando 60' : ''}</p>` +
    achados
      .slice(0, 60)
      .map((i) => {
        const pos = art ? 0 : Math.max(0, normalizar(i.x).indexOf(primeira) - 60);
        const trecho = (pos > 0 ? '…' : '') + i.x.slice(pos, pos + 180) + (i.x.length > pos + 180 ? '…' : '');
        return `<a class="cartao" style="display:block;text-decoration:none;color:inherit;margin:0" href="/lei-seca/${i.n}#${i.id}">
          <strong>${esc(i.r)}</strong> <span class="sutil pequeno">· ${esc(nomes[i.n] ?? i.n)}</span>
          <div class="pequeno">${esc(trecho)}</div></a>`;
      })
      .join('');
}

export function iniciarIndiceLeiSeca() {
  void progresso();
  assinar((c) => { if (!c || c === 'marcacoes') void progresso(); });
  const input = document.getElementById('busca-global') as HTMLInputElement;
  let t: ReturnType<typeof setTimeout>;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => void buscar(input.value), 300); });
}
