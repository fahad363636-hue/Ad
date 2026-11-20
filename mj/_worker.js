// MJ Repo: preserve APT, legacy depictions and package files; count successful DEB fetches.
// Counters represent successful download requests, not unique installations.

const PRIVATE_STATS_SHA256='414dba779f2aec4f6c492877dd931f181228e5380eddb2a2b757333bd0af1967';
const PRIVATE_STATS_COOKIE='mj_stats_access';
const PRIVATE_LOGIN_HTML="<!doctype html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><meta name=\"referrer\" content=\"no-referrer\"><title>إحصائياتي الخاصة | MJ Repo</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(155deg,#1b356f,#090f21);color:#edf3ff;font:16px/1.7 -apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif}.box{width:min(440px,calc(100% - 32px));padding:30px;border:1px solid #ffffff35;border-radius:22px;background:#ffffff12}h1{margin:0 0 10px;font-size:25px}p{color:#cbd8f0}input{font:inherit;width:100%;padding:13px;margin:10px 0;border:1px solid #ffffff60;border-radius:12px;background:#101b37;color:white;direction:ltr}button{cursor:pointer;font:inherit;background:#eff4ff;color:#1c2e68;font-weight:750;border:0;border-radius:12px;padding:11px 20px;width:100%}.error{color:#ffb9b9}a{color:#b9d8ff}</style></head><body><main class=\"box\"><h1>🔒 إحصائيات المطوّر الخاصة</h1><p>هذه الصفحة محمية ولا تعرض عدد التحميلات للزوار. أدخل مفتاح الدخول الخاص، أو استخدم رابطك الشخصي.</p><form id=\"f\"><input type=\"password\" id=\"token\" autocomplete=\"off\" placeholder=\"Private access key\" required><button id=\"btn\" type=\"submit\">عرض الإحصائيات</button></form><p id=\"status\" role=\"status\"></p><a href=\"/\">العودة إلى السورس</a></main><script>const f=document.getElementById('f'),s=document.getElementById('status'),input=document.getElementById('token');async function enter(token){try{s.textContent='جارٍ التحقق...';const res=await fetch('/__mj/stats-login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({token})});if(res.ok){location.replace('/downloads/')}else{s.className='error';s.textContent='المفتاح غير صحيح.'}}catch(e){s.className='error';s.textContent='تعذّر تسجيل الدخول. حاول مجددًا.'}}f.addEventListener('submit',e=>{e.preventDefault();enter(input.value)});const key=new URLSearchParams(location.hash.slice(1)).get('access');if(key){history.replaceState(null,'',location.pathname);enter(key)}</script></body></html>";
const PRIVATE_HEADERS={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
function constantTimeEqual(a,b){
  if(typeof a!=='string'||a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
async function sha256hex(input){
  const bytes=new TextEncoder().encode(input);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function validStatsToken(token){
  return typeof token==='string'&&token.length>=24&&token.length<=128&&constantTimeEqual(await sha256hex(token),PRIVATE_STATS_SHA256);
}
async function hasStatsAccess(request){
  const raw=request.headers.get('Cookie')||'';
  const entry=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(PRIVATE_STATS_COOKIE+'='));
  if(!entry)return false;
  return validStatsToken(entry.slice(PRIVATE_STATS_COOKIE.length+1));
}
function privateLoginPage(){
  return new Response(PRIVATE_LOGIN_HTML,{status:401,headers:{...PRIVATE_HEADERS,'Content-Type':'text/html; charset=utf-8','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'"}});
}
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
async function getPackages(env,origin){
  const r=await env.ASSETS.fetch(new Request(origin+'/Packages'));
  if(!r.ok) throw new Error('Package index unavailable');
  return (await r.text()).split(/\n\s*\n/).map(block=>{
    const lines=block.split('\n'),field=(key)=>{const l=lines.find(v=>v.startsWith(key+': '));return l?l.slice(key.length+2).trim():'';};
    return {id:field('Package'),name:field('Name')||field('Package'),file:field('Filename').replace(/^\.\//,'/'),version:field('Version')};
  }).filter(pkg=>pkg.id&&pkg.file&&pkg.file.startsWith('/debs/'));
}
export default {
  async fetch(request,env,ctx){
    const original=new URL(request.url);
    const url=new URL(original);
    url.search='';

    if(url.pathname==='/__mj/stats-login'){
      if(request.method!=='POST')return json({error:'Method not allowed'},405);
      if(request.headers.get('Origin')!==url.origin)return json({error:'Forbidden'},403);
      if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))return json({error:'Expected JSON'},415);
      const raw=await request.text();
      if(raw.length>256)return json({error:'Invalid request'},400);
      let token='';try{token=JSON.parse(raw).token||''}catch{return json({error:'Invalid request'},400)}
      if(!await validStatsToken(token))return json({error:'Invalid access key'},401);
      return new Response(null,{status:204,headers:{...PRIVATE_HEADERS,'Set-Cookie':PRIVATE_STATS_COOKIE+'='+token+'; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict'}});
    }
    if(url.pathname==='/__mj/stats-logout'){
      if(request.method!=='POST'||request.headers.get('Origin')!==url.origin)return json({error:'Forbidden'},403);
      return new Response(null,{status:204,headers:{...PRIVATE_HEADERS,'Set-Cookie':PRIVATE_STATS_COOKIE+'=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'}});
    }
    const isStatsPage=/^\/downloads(?:\/|$)/.test(url.pathname);
    const isStatsApi=url.pathname==='/api/downloads';
    if(isStatsPage||isStatsApi){
      if(!await hasStatsAccess(request))return isStatsPage?privateLoginPage():json({error:'Private statistics. Sign in required.'},401);
    }
    if(url.pathname==='/health')return new Response('MJ Repo OK',{status:200,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
    if(url.pathname==='/api/downloads'){
      if(request.method!=='GET')return json({error:'Method not allowed'},405);
      if(!env.DOWNLOAD_DB)return json({enabled:false,message:'Download database not connected yet'},503);
      try{
        const [packages,counts]=await Promise.all([
          getPackages(env,url.origin),
          env.DOWNLOAD_DB.prepare('SELECT package, count, last_download FROM downloads').all()
        ]);
        const byId=new Map((counts.results||[]).map(c=>[c.package,c]));
        const items=packages.map(p=>({...p,count:Number(byId.get(p.id)?.count||0),lastDownload:byId.get(p.id)?.last_download||null}));
        return json({enabled:true,type:'successful_deb_requests',since:'database activation',total:items.reduce((sum,p)=>sum+p.count,0),packages:items});
      }catch(e){console.error('download stats read failed',e);return json({enabled:false,error:'Download statistics temporarily unavailable'},503);}
    }
    const response=await env.ASSETS.fetch(new Request(url.toString(),request));
    if(request.method==='GET' && /^\/debs\/[^/]+\.deb$/i.test(url.pathname) && (response.status===200 || response.status===206) && env.DOWNLOAD_DB){
      const range=request.headers.get('Range');
      // A resumed multi-part transfer is not another download; count only the initial request.
      if(!range || /^bytes=0-(?:\d*)$/i.test(range.trim())){
        const filename=url.pathname;
        const work=(async()=>{
          const packages=await getPackages(env,url.origin);
          const pkg=packages.find(p=>p.file===filename);
          if(!pkg)return;
          await env.DOWNLOAD_DB.prepare(
            "INSERT INTO downloads (package,count,last_download) VALUES (?,1,datetime('now')) ON CONFLICT(package) DO UPDATE SET count=count+1,last_download=datetime('now')"
          ).bind(pkg.id).run();
        })().catch(e=>console.error('download counter write failed',e));
        if(ctx&&typeof ctx.waitUntil==='function')ctx.waitUntil(work);else await work;
      }
    }
    const headers=new Headers(response.headers);
    if(isStatsPage)for(const [key,value] of Object.entries(PRIVATE_HEADERS))headers.set(key,value);
    if(url.pathname==='/Packages'||url.pathname==='/Release')headers.set('Content-Type','text/plain; charset=utf-8');
    if(/^\/(Packages(?:\.(?:gz|bz2|xz|zst))?|Release)$/.test(url.pathname)||url.pathname.startsWith('/depictions/'))headers.set('Cache-Control','no-cache, must-revalidate');
    return new Response(response.body,{status:response.status,headers});
  }
};
