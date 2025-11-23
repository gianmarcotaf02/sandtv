exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Solo GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const { server, username, password, action } = event.queryStringParameters || {};

  console.log('📥 Proxy request:', { server: server?.substring(0, 50), action });

  // Valida parametri
  if (!server || !username || !password || !action) {
    console.log('❌ Missing params');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: 'Missing required parameters: server, username, password, action',
      }),
    };
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
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid server URL: ' + e.message }),
      };
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
    const timeout = setTimeout(() => controller.abort(), 15000); // 15 secondi timeout

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
          return {
            statusCode: 504,
            headers,
            body: JSON.stringify({ 
              error: 'Timeout: il server Xtream non risponde. Verifica che il server sia online e le credenziali corrette.' 
            }),
          };
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

    return {
      statusCode: response.status,
      headers: {
        ...headers,
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
      body,
    };
  } catch (error) {
    console.error('❌ Proxy error:', error.message);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        error: 'Proxy error',
        message: error.message,
      }),
    };
  }
};
