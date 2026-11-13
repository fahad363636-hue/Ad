// MJ Repo: serve canonical APT indexes and up-to-date Sileo depictions.
export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const url = new URL(incoming);
    url.search = '';
    if (url.pathname === '/health') {
      return new Response('MJ Repo OK', {status:200, headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
    }
    const response = await env.ASSETS.fetch(new Request(url.toString(), request));
    const headers = new Headers(response.headers);
    if (url.pathname === '/Packages' || url.pathname === '/Release') {
      headers.set('Content-Type', 'text/plain; charset=utf-8');
    }
    if (/^\/(Packages(?:\.(?:gz|bz2|xz|zst))?|Release)$/.test(url.pathname) ||
        url.pathname.startsWith('/depictions/')) {
      headers.set('Cache-Control', 'no-cache, must-revalidate');
    }
    return new Response(response.body, {status:response.status, headers});
  }
};
