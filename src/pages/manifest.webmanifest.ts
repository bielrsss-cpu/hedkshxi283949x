import { CONFIG } from '../lib/config';

export function GET() {
  return new Response(
    JSON.stringify({
      name: CONFIG.nome_site,
      short_name: CONFIG.nome_site,
      description: `Caderno de estudos · ${CONFIG.cargo} · ${CONFIG.orgao}`,
      lang: 'pt-BR',
      start_url: '/',
      display: 'standalone',
      background_color: '#f7f7f5',
      theme_color: '#1f5fa8',
      icons: [
        { src: '/icone-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        { src: '/icone.svg', sizes: 'any', type: 'image/svg+xml' },
      ],
    }),
    { headers: { 'content-type': 'application/manifest+json' } },
  );
}
