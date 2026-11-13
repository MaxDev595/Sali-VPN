/**
 * salivpn.com: the website (static assets) plus a second way to reach the API.
 * Some networks cut api.salivpn.com now and then; the apps then call
 * https://salivpn.com/api/v1/... and Cloudflare forwards it to the API.
 */
const API_ORIGIN = 'https://api.salivpn.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, API_ORIGIN);
      const headers = new Headers(request.headers);
      headers.delete('host');
      // Keep the customer's IP for the API's rate limits (it trusts the proxy chain).
      const ip = request.headers.get('cf-connecting-ip');
      if (ip) headers.set('x-forwarded-for', ip);
      return fetch(target, {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        redirect: 'manual',
      });
    }
    return env.ASSETS.fetch(request);
  },
};
