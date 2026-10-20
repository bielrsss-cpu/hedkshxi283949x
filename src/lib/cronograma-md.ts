// Reescreve o cronograma.md marcando [x] nas tarefas feitas.
// Usa a mesma regra de IDs do build: SNN-índice (1, 2, 3… dentro da semana) e PRAZO-índice.
export function marcarCronograma(texto: string, feitas: Set<string>): string {
  let semana: string | null = null;
  let emPrazos = false;
  let n = 0;
  return texto
    .split('\n')
    .map((linha) => {
      const h = linha.match(/^##\s+(S\d\d)\s+·/);
      if (h) { semana = h[1]; emPrazos = false; n = 0; return linha; }
      if (/^##\s+Prazos/.test(linha)) { emPrazos = true; n = 0; return linha; }
      if (/^##\s+/.test(linha)) { emPrazos = false; return linha; }
      const t = linha.match(/^- \[( |x|X)\] `[A-Z/]+` /);
      if (t && (semana || emPrazos)) {
        n++;
        const id = semana ? `${semana}-${n}` : `PRAZO-${n}`;
        return linha.replace(/^- \[( |x|X)\]/, feitas.has(id) ? '- [x]' : '- [ ]');
      }
      return linha;
    })
    .join('\n');
}
