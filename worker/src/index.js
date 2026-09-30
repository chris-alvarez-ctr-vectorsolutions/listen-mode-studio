// Thin proxy: the browser app never sees the API keys.
//   /anthropic/*   -> https://api.anthropic.com/*   (adds x-api-key)
//   /elevenlabs/*  -> https://api.elevenlabs.io/*   (adds xi-api-key)
const UPSTREAMS = {
  anthropic: { base: 'https://api.anthropic.com', keyHeader: 'x-api-key', secret: 'ANTHROPIC_API_KEY' },
  elevenlabs: { base: 'https://api.elevenlabs.io', keyHeader: 'xi-api-key', secret: 'ELEVENLABS_API_KEY' },
};

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,anthropic-version,anthropic-beta,x-app-token',
    'Access-Control-Expose-Headers': 'request-id,x-request-id',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (env.APP_TOKEN && request.headers.get('x-app-token') !== env.APP_TOKEN) {
      return new Response(JSON.stringify({ error: 'Missing or wrong app token.' }), { status: 401, headers: { ...cors, 'content-type': 'application/json' } });
    }

    const url = new URL(request.url);
    const [, service, ...rest] = url.pathname.split('/');
    const up = UPSTREAMS[service];
    if (!up) return new Response('Not found', { status: 404, headers: cors });

    const target = `${up.base}/${rest.join('/')}${url.search}`;
    const headers = new Headers();
    for (const h of ['content-type', 'anthropic-version', 'anthropic-beta', 'accept']) {
      const v = request.headers.get(h);
      if (v) headers.set(h, v);
    }
    headers.set(up.keyHeader, env[up.secret]);

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' ? undefined : request.body,
    });

    const out = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors)) out.set(k, v);
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
