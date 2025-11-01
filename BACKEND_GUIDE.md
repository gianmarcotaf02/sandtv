# 🌐 Backend Implementation Guide

## 📋 Indice
1. [Backend Node.js/Express](#backend-nodejsexpress)
2. [Backend Cloudflare Workers](#backend-cloudflare-workers)
3. [Backend Vercel Serverless](#backend-vercel-serverless)
4. [Configurazione Frontend](#configurazione-frontend)

---

## 1. Backend Node.js/Express

### Setup Completo

#### Passo 1: Crea la struttura
```bash
mkdir backend
cd backend
npm init -y
npm install express cors node-fetch@2 compression dotenv helmet express-rate-limit
```

#### Passo 2: Crea `backend/server.js`

```javascript
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // max 100 richieste per IP
});
app.use(limiter);

// JSON parser
app.use(express.json());

// Cache in memoria per EPG
const epgCache = new Map();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 giorni

/**
 * Endpoint proxy per EPG
 * GET /api/epg?url=<epg_url>
 */
app.get('/api/epg', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ 
      error: 'URL parameter is required',
      usage: '/api/epg?url=<epg_url>'
    });
  }

  try {
    // Verifica cache
    const cached = epgCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[CACHE HIT] Serving EPG from cache for: ${url}`);
      res.set('X-Cache', 'HIT');
      res.set('Content-Type', 'application/xml');
      res.set('Cache-Control', 'public, max-age=604800'); // 7 giorni
      return res.send(cached.data);
    }

    console.log(`[FETCH] Downloading EPG from: ${url}`);
    
    // Fetch EPG con timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/xml, text/xml, */*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.text();
    
    // Salva in cache
    epgCache.set(url, {
      data,
      timestamp: Date.now(),
    });

    console.log(`[SUCCESS] EPG downloaded and cached (${(data.length / 1024).toFixed(2)} KB)`);

    res.set('X-Cache', 'MISS');
    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=604800');
    res.send(data);

  } catch (error) {
    console.error('[ERROR] EPG fetch failed:', error.message);
    
    if (error.name === 'AbortError') {
      return res.status(408).json({ error: 'Request timeout (60s exceeded)' });
    }

    res.status(500).json({ 
      error: 'Failed to fetch EPG',
      message: error.message 
    });
  }
});

/**
 * Endpoint proxy per M3U Playlist
 * GET /api/playlist?url=<playlist_url>
 */
app.get('/api/playlist', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ 
      error: 'URL parameter is required',
      usage: '/api/playlist?url=<playlist_url>'
    });
  }

  try {
    console.log(`[FETCH] Downloading playlist from: ${url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, */*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.text();
    
    console.log(`[SUCCESS] Playlist downloaded (${(data.length / 1024).toFixed(2)} KB)`);

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Cache-Control', 'public, max-age=3600'); // 1 ora
    res.send(data);

  } catch (error) {
    console.error('[ERROR] Playlist fetch failed:', error.message);
    
    if (error.name === 'AbortError') {
      return res.status(408).json({ error: 'Request timeout (30s exceeded)' });
    }

    res.status(500).json({ 
      error: 'Failed to fetch playlist',
      message: error.message 
    });
  }
});

/**
 * Health check endpoint
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    cache: {
      epgEntries: epgCache.size,
      memoryUsage: process.memoryUsage(),
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * Clear cache endpoint (per debug)
 * POST /api/cache/clear
 */
app.post('/api/cache/clear', (req, res) => {
  const size = epgCache.size;
  epgCache.clear();
  console.log(`[CACHE] Cleared ${size} entries`);
  res.json({ 
    message: 'Cache cleared successfully',
    entriesCleared: size 
  });
});

/**
 * Stats endpoint
 * GET /api/stats
 */
app.get('/api/stats', (req, res) => {
  const stats = {
    cache: {
      totalEntries: epgCache.size,
      entries: Array.from(epgCache.keys()).map(url => ({
        url: url.substring(0, 50) + '...',
        age: Math.floor((Date.now() - epgCache.get(url).timestamp) / 1000),
        size: (epgCache.get(url).data.length / 1024).toFixed(2) + ' KB',
      })),
    },
    server: {
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
    },
  };

  res.json(stats);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    available_endpoints: [
      'GET /api/epg?url=<url>',
      'GET /api/playlist?url=<url>',
      'GET /health',
      'GET /api/stats',
      'POST /api/cache/clear',
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 SandTV Backend Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`📊 Stats:  http://localhost:${PORT}/api/stats`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});
```

#### Passo 3: Crea `.env`

```env
PORT=3001
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

#### Passo 4: Aggiungi script in `package.json`

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

#### Passo 5: Avvia

```bash
# Dev mode (con nodemon)
npm install -D nodemon
npm run dev

# Production
npm start
```

---

## 2. Backend Cloudflare Workers

### Setup Completo

#### Passo 1: Installa Wrangler

```bash
npm install -g wrangler
wrangler login
```

#### Passo 2: Crea `backend/wrangler.toml`

```toml
name = "sandtv-backend"
main = "worker.js"
compatibility_date = "2024-01-01"

[env.production]
name = "sandtv-backend-prod"
route = "https://sandtv-api.yourdomain.com/*"
```

#### Passo 3: Crea `backend/worker.js`

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // EPG Proxy
    if (url.pathname === '/api/epg') {
      const epgUrl = url.searchParams.get('url');
      
      if (!epgUrl) {
        return new Response(
          JSON.stringify({ error: 'Missing URL parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const response = await fetch(epgUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
          cf: {
            cacheTtl: 604800, // Cache 7 giorni
            cacheEverything: true,
          },
        });

        const data = await response.text();
        
        return new Response(data, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=604800',
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Playlist Proxy
    if (url.pathname === '/api/playlist') {
      const playlistUrl = url.searchParams.get('url');
      
      if (!playlistUrl) {
        return new Response(
          JSON.stringify({ error: 'Missing URL parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const response = await fetch(playlistUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
          cf: {
            cacheTtl: 3600, // Cache 1 ora
            cacheEverything: true,
          },
        });

        const data = await response.text();
        
        return new Response(data, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
```

#### Passo 4: Deploy

```bash
cd backend
wrangler deploy
```

URL: `https://sandtv-backend.<your-subdomain>.workers.dev`

---

## 3. Backend Vercel Serverless

### Setup Completo

#### Passo 1: Crea `api/epg.ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.text();
    
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}
```

#### Passo 2: Crea `api/playlist.ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.text();
    
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}
```

#### Passo 3: Deploy

```bash
npm install -g vercel
vercel
```

---

## 4. Configurazione Frontend

### Aggiorna `App.tsx`

Trova la riga ~46 e modifica:

```typescript
// Prima (CORS proxy pubblico):
const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(epgUrl)}`;

// Dopo (tuo backend):

// Opzione 1: Node.js locale
const proxyUrl = `http://localhost:3001/api/epg?url=${encodeURIComponent(epgUrl)}`;

// Opzione 2: Cloudflare Workers
const proxyUrl = `https://sandtv-backend.<your-subdomain>.workers.dev/api/epg?url=${encodeURIComponent(epgUrl)}`;

// Opzione 3: Vercel
const proxyUrl = `https://your-app.vercel.app/api/epg?url=${encodeURIComponent(epgUrl)}`;
```

---

## 📊 Confronto Backend

| Feature | Node.js | Cloudflare | Vercel |
|---------|---------|------------|--------|
| Costo | Gratis (self-host) | Gratis (100k req/giorno) | Gratis (100GB bandwidth) |
| Setup | Medio | Facile | Facilissimo |
| Performance | Alta | Altissima (edge) | Alta |
| Cache | Manuale | Automatica | Automatica |
| Scalabilità | Limitata | Illimitata | Alta |

---

## ✅ Test Backend

```bash
# Test EPG
curl "http://localhost:3001/api/epg?url=http://example.com/epg.xml"

# Test Playlist
curl "http://localhost:3001/api/playlist?url=http://example.com/playlist.m3u8"

# Health check
curl http://localhost:3001/health

# Stats
curl http://localhost:3001/api/stats
```

---

**Scegli la soluzione che preferisci e segui i passi sopra!** 🚀
