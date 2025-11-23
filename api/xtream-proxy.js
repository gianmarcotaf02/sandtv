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

  console.log('📥 Proxy request:', { server: server?.substring(0, 50), action });

  // Valida parametri
  if (!server || !username || !password || !action) {
    console.log('❌ Missing params');
    return res.status(400).json({
      error: 'Missing required parameters: server, username, password, action',
    });
  }

  try {
    // Valida server URL
    let serverUrl;
    try {
      const decodedServer = decodeURIComponent(server);
      console.log('🔍 Decoded server:', decodedServer);
      serverUrl = new URL(decodedServer);
    } catch (e) {
      console.error('❌ Invalid URL:', e.message);
      return res.status(400).json({ error: 'Invalid server URL: ' + e.message });
    }

    // Costruisci URL API
    const apiUrl = new URL(
      `${serverUrl.protocol}//${serverUrl.host}${serverUrl.pathname || ''}/player_api.php`
    );
    apiUrl.searchParams.append('username', decodeURIComponent(username));
    apiUrl.searchParams.append('password', decodeURIComponent(password));
    apiUrl.searchParams.append('action', decodeURIComponent(action));

    console.log('🔄 Final URL:', apiUrl.toString());

    // Set timeout con AbortController (aumentato a 15 secondi)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response;
    let retries = 2;
    let lastError;

    // Retry logic con timeout
    while (retries > 0) {
      try {
        console.log(`🔄 Attempting fetch (${3 - retries}/3)...`);
        response = await fetch(apiUrl.toString(), {
          method: 'GET',
          headers: {
            'User-Agent': 'SandTV/1.0',
            'Accept': 'application/json',
          },
          redirect: 'follow',
          signal: controller.signal,
        });
        
        // Se arriviamo qui, la richiesta è andata a buon fine
        clearTimeout(timeout);
        console.log('✅ Fetch successful after', 3 - retries, 'attempts');
        break;
      } catch (fetchError) {
        lastError = fetchError;
        retries--;
        console.error(`❌ Fetch error (attempt ${3 - retries}/3):`, fetchError.message);
        
        if (fetchError.name === 'AbortError') {
          clearTimeout(timeout);
          console.error('❌ Timeout - server too slow or not responding');
          return res.status(504).json({ 
            error: 'Timeout: il server Xtream non risponde. Verifica che il server sia online e le credenziali corrette.' 
          });
        }
        
        // Se non ci sono più retry, fallisce
        if (retries === 0) {
          clearTimeout(timeout);
          throw fetchError;
        }
        
        // Aspetta 1 secondo prima di ritentare
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    clearTimeout(timeout);

    console.log('✅ Response status:', response.status);
    console.log('✅ Response content-type:', response.headers.get('content-type'));

    const body = await response.text();
    console.log('✅ Response body length:', body.length, 'bytes');

    // Prova a parsare come JSON per verificare validità
    try {
      const parsed = JSON.parse(body);
      console.log('✅ Response is valid JSON, type:', typeof parsed);
    } catch (e) {
      console.log('⚠️  Response is not JSON:', e.message);
    }

    return res.status(response.status).setHeader('Content-Type', response.headers.get('content-type') || 'application/json').setHeader('Cache-Control', 'public, max-age=3600').send(body);
  } catch (error) {
    console.error('❌ Proxy error:', error.message);
    return res.status(502).json({
      error: 'Proxy error',
      message: error.message,
    });
  }
}
