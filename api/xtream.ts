import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy API per Xtream Codes
 * Questo endpoint agisce da intermediario tra il browser e il server Xtream
 * Consente di aggirare i controlli CORS e Mixed Content del browser
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Solo GET
  if (req.method !== 'GET') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { server, username, password, action, ...params } = req.query;

  // Valida parametri richiesti
  if (!server || !username || !password || !action) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(400).json({ 
      error: 'Missing required parameters: server, username, password, action' 
    });
  }

  try {
    // Valida che server sia un URL valido
    const serverStr = Array.isArray(server) ? server[0] : server;
    const serverUrl = new URL(serverStr);
    
    // Costruisci URL API
    const apiUrl = new URL(`${serverUrl.protocol}//${serverUrl.host}${serverUrl.pathname || ''}/player_api.php`);
    apiUrl.searchParams.append('username', Array.isArray(username) ? username[0] : username);
    apiUrl.searchParams.append('password', Array.isArray(password) ? password[0] : password);
    apiUrl.searchParams.append('action', Array.isArray(action) ? action[0] : action);

    // Aggiungi parametri opzionali
    Object.entries(params).forEach(([key, value]) => {
      const val = Array.isArray(value) ? value[0] : value;
      if (val && typeof val === 'string') {
        apiUrl.searchParams.append(key, val);
      }
    });

    console.log('🔄 Proxying Xtream request:', apiUrl.toString());

    // Fai richiesta al server Xtream con timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondi timeout

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'SandTV/1.0 (Mozilla/5.0)',
        'Accept': 'application/json, text/plain, */*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || 'application/json';
    const body = await response.text();

    console.log('✅ Xtream response:', response.status);

    // Imposta CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    res.status(response.status).send(body);
  } catch (error) {
    console.error('❌ Proxy error:', error);

    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Timeout: il server Xtream non ha risposto in tempo',
      });
    }

    res.status(502).json({
      error: 'Errore server Xtream',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
