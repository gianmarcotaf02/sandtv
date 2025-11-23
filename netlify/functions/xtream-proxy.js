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

    // Set timeout con AbortController
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 secondi timeout

    let response;
    try {
      response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'SandTV/1.0',
        },
        redirect: 'follow', // Segui max 20 redirect (default)
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      console.error('❌ Fetch error:', fetchError.message);
      if (fetchError.name === 'AbortError') {
        return {
          statusCode: 504,
          headers,
          body: JSON.stringify({ error: 'Timeout connecting to Xtream server' }),
        };
      }
      throw fetchError;
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
