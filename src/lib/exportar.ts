// Botão "Exportar": baixa todos os registros do usuário como .md num zip, no formato dos modelos.
import { strToU8, zipSync } from 'fflate';
import { listarTudo, sincronizar, usuarioAtual } from './dados';
import { PASTAS, paraMarkdown, type ColecaoMd } from './modelos';
import type { Marcacao } from './marcacoes';
import { marcarCronograma } from './cronograma-md';

export async function exportarZip() {
  try { await sincronizar(); } catch {}
  const registros = await listarTudo();
  const arquivos: Record<string, Uint8Array> = {};
  const raiz = 'caderno/';

  for (const r of registros) {
    if (r.col in PASTAS) {
      const col = r.col as ColecaoMd;
      arquivos[`${raiz}${PASTAS[col]}/${r.id}.md`] = strToU8(paraMarkdown(col, r.fm, r.secoes));
    }
  }

  // Marcações da lei seca: um JSON por norma, sem tocar no texto da lei
  const porNorma = new Map<string, Record<string, Omit<Marcacao, 'norma' | 'artigo'>>>();
  for (const r of registros) {
    if (r.col !== 'marcacoes') continue;
    const { norma, artigo, ...resto } = r.fm as Marcacao;
    if (!porNorma.has(norma)) porNorma.set(norma, {});
    porNorma.get(norma)![artigo] = resto;
  }
  for (const [norma, artigos] of porNorma) {
    arquivos[`${raiz}03-lei-seca/_marcacoes/${norma}.json`] = strToU8(JSON.stringify(artigos, null, 2));
  }

  // Cronograma com as tarefas marcadas como [x]
  const feitas = new Set(registros.filter((r) => r.col === 'tarefas' && r.fm.feita).map((r) => r.id));
  try {
    const original = await (await fetch('/exportar/cronograma.md', { cache: 'no-store' })).text();
    arquivos[`${raiz}02-cronograma/cronograma.md`] = strToU8(marcarCronograma(original, feitas));
  } catch {}

  // Revisões feitas e respostas de questões (dados auxiliares do site)
  const extras = registros.filter((r) => r.col === 'revisoes' || r.col === 'respostas');
  if (extras.length) {
    arquivos[`${raiz}_site/revisoes-e-respostas.json`] = strToU8(JSON.stringify(extras.map(({ col, id, fm }) => ({ col, id, ...fm })), null, 2));
  }

  const zip = zipSync(arquivos, { level: 6 });
  const hoje = new Date().toISOString().slice(0, 10);
  const blob = new Blob([zip], { type: 'application/zip' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `caderno-${usuarioAtual() ?? 'dados'}-${hoje}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
