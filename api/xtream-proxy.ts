import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy CORS per Xtream Codes API
 * Consente alle richieste HTTPS da SandTV di raggiungere server Xtream HTTP
 * 
 * Utilizzo: /api/xtream-proxy?url=<encoded_url>
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Solo GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }

  try {
    // Valida che sia un URL Xtream
    const urlObj = new URL(url);
    if (!urlObj.pathname.includes('player_api.php')) {
      return res.status(400).json({ error: 'Invalid Xtream API URL' });
    }

    console.log('🔄 Proxying Xtream request:', urlObj.hostname);

    // Fai la richiesta al server Xtream
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'SandTV/1.0',
      },
    });

    const contentType = response.headers.get('content-type');
    const body = await response.text();

    // Imposta CORS headers per permettere al client di leggere la risposta
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', contentType || 'application/json');

    res.status(response.status).send(body);
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(502).json({
      error: 'Server Xtream non raggiungibile',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
