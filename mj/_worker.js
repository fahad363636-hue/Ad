// MJ Repo: canonical APT assets for Sileo.
export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const url = new URL(incoming);
    url.search = '';
    if (incoming.pathname === '/' && incoming.search) {
      return Response.redirect(url.toString(), 302);
    }
    if (url.pathname === '/Release') url.pathname = '/mj-release.txt';
    if (url.pathname === '/Packages') url.pathname = '/mj-packages.txt';
    if (url.pathname === '/health') {
      return new Response('MJ Repo OK', { status: 200, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
    }
    const response = await env.ASSETS.fetch(new Request(url.toString(), request));
    if (url.pathname === '/mj-release.txt' || url.pathname === '/mj-packages.txt') {
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'text/plain; charset=utf-8');
      headers.set('Cache-Control', 'public, max-age=60');
      return new Response(response.body, { status: response.status, headers });
    }
    if (/^\/Packages(?:\.(?:gz|bz2|xz|zst))?$/.test(incoming.pathname) && response.status === 404) {
      return new Response('APT index missing', {status:404, headers:{'Content-Type':'text/plain'}});
    }
    return response;
  }
};
