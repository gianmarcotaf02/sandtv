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

  // Valida parametri
  if (!server || !username || !password || !action) {
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
      serverUrl = new URL(decodeURIComponent(server));
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid server URL' }),
      };
    }

    // Costruisci URL API
    const apiUrl = new URL(
      `${serverUrl.protocol}//${serverUrl.host}${serverUrl.pathname || ''}/player_api.php`
    );
    apiUrl.searchParams.append('username', decodeURIComponent(username));
    apiUrl.searchParams.append('password', decodeURIComponent(password));
    apiUrl.searchParams.append('action', decodeURIComponent(action));

    console.log('🔄 Proxying to:', apiUrl.toString());

    // Set timeout con AbortController
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 secondi timeout

    let response;
    try {
      response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'SandTV/1.0',
        },
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeout);
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

    const body = await response.text();

    console.log('✅ Response status:', response.status);

    return {
      statusCode: response.status,
      headers: {
        ...headers,
        'Cache-Control': 'public, max-age=3600',
      },
      body,
    };
  } catch (error) {
    console.error('❌ Proxy error:', error);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        error: 'Server error',
        message: error.message,
      }),
    };
  }
};
