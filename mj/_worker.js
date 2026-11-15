// MJ Repo: preserve APT, legacy depictions and package files; count successful DEB fetches.
// Counters represent successful download requests, not unique installations.
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'};
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
    if(url.pathname==='/Packages'||url.pathname==='/Release')headers.set('Content-Type','text/plain; charset=utf-8');
    if(/^\/(Packages(?:\.(?:gz|bz2|xz|zst))?|Release)$/.test(url.pathname)||url.pathname.startsWith('/depictions/'))headers.set('Cache-Control','no-cache, must-revalidate');
    return new Response(response.body,{status:response.status,headers});
  }
};
