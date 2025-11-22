/**
 * Proxy API per Xtream Codes
 * Questo endpoint agisce da intermediario tra il browser e il server Xtream
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { server, username, password, action } = req.query;

  // Valida parametri richiesti
  if (!server || !username || !password || !action) {
    return res.status(400).json({ 
      error: 'Missing required parameters: server, username, password, action' 
    });
  }

  try {
    // Estrai i valori dalle query (potrebbero essere array)
    const serverStr = Array.isArray(server) ? server[0] : server;
    const usernameStr = Array.isArray(username) ? username[0] : username;
    const passwordStr = Array.isArray(password) ? password[0] : password;
    const actionStr = Array.isArray(action) ? action[0] : action;

    // Valida che server sia un URL valido
    let serverUrl;
    try {
      serverUrl = new URL(serverStr);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid server URL' });
    }
    
    // Costruisci URL API
    const apiUrl = new URL(`${serverUrl.protocol}//${serverUrl.host}${serverUrl.pathname || ''}/player_api.php`);
    apiUrl.searchParams.append('username', usernameStr);
    apiUrl.searchParams.append('password', passwordStr);
    apiUrl.searchParams.append('action', actionStr);

    // Aggiungi parametri opzionali
    Object.entries(req.query).forEach(([key, value]) => {
      if (!['server', 'username', 'password', 'action'].includes(key) && value) {
        const val = Array.isArray(value) ? value[0] : value;
        if (typeof val === 'string') {
          apiUrl.searchParams.append(key, val);
        }
      }
    });

    console.log('🔄 Proxying Xtream request to:', apiUrl.toString());

    // Fai richiesta al server Xtream
    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'SandTV/1.0',
        'Accept': 'application/json',
      },
    });

    console.log('✅ Xtream response status:', response.status);

    const contentType = response.headers.get('content-type') || 'application/json';
    const body = await response.text();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(response.status).send(body);

  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(502).json({
      error: 'Errore server Xtream',
      details: error.message,
    });
  }
}
