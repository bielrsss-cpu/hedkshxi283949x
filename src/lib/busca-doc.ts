// Busca simples dentro de um documento longo (edital): destaca e navega pelas ocorrências.
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function ligarBuscaNoDocumento() {
  const input = document.getElementById('busca-doc') as HTMLInputElement | null;
  const res = document.getElementById('busca-res');
  const doc = document.querySelector('article.doc');
  if (!input || !doc || !res) return;
  let marcas: HTMLElement[] = [];
  let atual = -1;

  const limpar = () => {
    for (const m of marcas) m.replaceWith(document.createTextNode(m.textContent ?? ''));
    doc.normalize();
    marcas = [];
    atual = -1;
  };

  const buscar = () => {
    limpar();
    const termo = normalizar(input.value.trim());
    if (termo.length < 3) { res.textContent = ''; return; }
    const walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
    const nos: Text[] = [];
    while (walker.nextNode()) nos.push(walker.currentNode as Text);
    for (const no of nos) {
      const txt = normalizar(no.data);
      let i = txt.indexOf(termo);
      let alvo: Text = no;
      let desloc = 0;
      while (i >= 0) {
        const antes = alvo.splitText(i - desloc);
        const depois = antes.splitText(termo.length);
        const m = document.createElement('mark');
        m.className = 'achado';
        m.textContent = antes.data;
        antes.replaceWith(m);
        marcas.push(m);
        alvo = depois;
        desloc = i + termo.length;
        i = txt.indexOf(termo, desloc);
      }
    }
    res.textContent = marcas.length ? `${marcas.length} ocorrência(s) · Enter para a próxima` : 'nada encontrado';
    if (marcas.length) proxima();
  };

  const proxima = () => {
    if (!marcas.length) return;
    marcas[atual]?.classList.remove('foco');
    atual = (atual + 1) % marcas.length;
    const m = marcas[atual];
    m.classList.add('foco');
    m.closest('details')?.setAttribute('open', '');
    m.scrollIntoView({ block: 'center' });
    res.textContent = `${atual + 1} de ${marcas.length} · Enter para a próxima`;
  };

  let t: ReturnType<typeof setTimeout>;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(buscar, 300); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); proxima(); } });
}
