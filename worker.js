/**
 * Cloudflare Worker per proxy CORS di EPG e M3U
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Validate URL
    if (!targetUrl) {
      return new Response('Missing url parameter', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    try {
      // Validate URL format
      const target = new URL(targetUrl);
      
      // Cache key
      const cacheKey = new Request(targetUrl, request);
      const cache = caches.default;

      // Check cache first
      let response = await cache.match(cacheKey);
      
      if (!response) {
        // Fetch from origin
        response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        // Clone response for cache
        response = new Response(response.body, response);
        
        // Add cache headers (7 days for EPG)
        response.headers.set('Cache-Control', 'public, max-age=604800');
        
        // Store in cache
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }

      // Add CORS headers to response
      const newHeaders = new Headers(response.headers);
      Object.keys(corsHeaders).forEach(key => {
        newHeaders.set(key, corsHeaders[key]);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });

    } catch (error) {
      return new Response(`Error: ${error.message}`, { 
        status: 500,
        headers: corsHeaders 
      });
    }
  }
};
