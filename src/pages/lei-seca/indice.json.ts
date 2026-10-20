// Índice de busca de toda a lei seca, gerado no build e baixado sob demanda.
import { carregarNorma, listarNormas } from '../../lib/conteudo';

export async function GET() {
  const itens: { n: string; id: string; r: string; x: string }[] = [];
  for (const meta of listarNormas()) {
    if (meta.pendente) continue;
    for (const b of carregarNorma(meta.slug).blocos) {
      if (b.tipo === 'artigo') itens.push({ n: meta.slug, id: b.id, r: b.rotulo, x: b.texto });
    }
  }
  return new Response(JSON.stringify(itens), { headers: { 'content-type': 'application/json' } });
}
