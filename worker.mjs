// Random 192-bit passwords are issued by the admin; users cannot choose guessable passwords.
// SHA-256 stores these random credentials like API tokens, without a slow password KDF.
const encoder = new TextEncoder();
const SESSION_SECONDS = 7 * 86400;
const APPS = new Set(['joblens', 'xiaoyuan']);
export function randomSecret(bytes = 24) {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function hash(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))].map(b => b.toString(16).padStart(2,'0')).join('');
}
function equal(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
function fail(status, message) { throw Object.assign(new Error(message), {status}); }
function json(body, status = 200, headers = {}) {
  return Response.json(body, {status, headers: {'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...headers}});
}
async function bytes(request, max) {
  if (Number(request.headers.get('Content-Length') || 0) > max) fail(413, '内容过大，请先导出并整理历史记录');
  const reader = request.body?.getReader();
  if (!reader) fail(400, '缺少请求内容');
  const chunks=[]; let size=0;
  while(true){ const {done,value}=await reader.read(); if(done)break; size+=value.length; if(size>max){await reader.cancel();fail(413,'内容过大，请先导出并整理历史记录');} chunks.push(value); }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return bytes;
}
async function body(request, max = 530000) {
  const text = new TextDecoder().decode(await bytes(request,max));
  try { return JSON.parse(text); } catch { fail(400, '无效 JSON'); }
}
function cookie(value, age = SESSION_SECONDS) {
  return `__Host-wenfeng=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
}
async function session(request, db) {
  const token = /(?:^|;\s*)__Host-wenfeng=([\w-]{43})(?:;|$)/.exec(request.headers.get('Cookie') || '')?.[1];
  if (!token) return null;
  return db.prepare('SELECT u.id,u.username,u.role,s.token_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.disabled=0')
    .bind(await hash(token), Date.now()).first();
}
async function count(db, key, limit, expires) {
  const result = await db.prepare('INSERT INTO counters(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END, expires_at=excluded.expires_at RETURNING count')
    .bind(key, expires, Date.now()).first();
  if (result.count > limit) fail(429, '请求次数已达上限，请稍后再试');
}
function username(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{2,31}$/.test(value)) fail(400, '账号为 3–32 位小写字母、数字、下划线或短横线，字母开头');
  return value;
}
function clean(app, data) {
  const allowed = app === 'joblens' ? ['resumes','portfolio','settings','matchHistory','interviewHistory','currentResume','theme'] : ['config','history'];
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, '无效的空间数据');
  for (const key of Object.keys(data)) if (!allowed.includes(key)) fail(400, '未知的数据字段');
  if (data.settings?.llm) data.settings.llm.apiKey = '';
  if (data.config) data.config.apiKey = '';
  if (JSON.stringify(data).includes('sk-proj-')) fail(400, '请勿把模型密钥保存在个人空间');
  return data;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    try {
      const api = path.startsWith('/api/');
      if (!api) {
        if (path.startsWith('/joblens/') || path.startsWith('/ai-voice-pet/')) {
          if (!env.DB) return new Response('个人空间数据库尚未连接', {status:503});
          if (!await session(request, env.DB)) return Response.redirect(`${url.origin}/login.html?next=${encodeURIComponent(path + url.search)}`, 303);
        }
        return env.ASSETS.fetch(request);
      }
      if (!env.DB) fail(503, '个人空间数据库尚未连接');
      if (!['GET','POST','PATCH','DELETE'].includes(request.method)) fail(405, '不支持的请求方式');
      if (request.method !== 'GET') {
        if (request.headers.get('Origin') !== url.origin) fail(403, '请从本站操作');
        if (!(path==='/api/images' && request.method==='POST') && !request.headers.get('Content-Type')?.startsWith('application/json')) fail(415, '需要 JSON 请求');
      }
      const db = env.DB;
      if (path === '/api/login' && request.method === 'POST') {
        const input = await body(request, 2048);
        const name = username(input.username);
        if (typeof input.password !== 'string' || input.password.length > 128) fail(400, '请输入密码');
        const now = Date.now(), bucket = Math.floor(now / 900000);
        const ip = await hash(request.headers.get('CF-Connecting-IP') || 'local');
        await count(db, `login-ip:${ip}:${bucket}`, 30, (bucket+1)*900000);
        await count(db, `login-user:${name}:${bucket}`, 10, (bucket+1)*900000);
        const user = await db.prepare('SELECT * FROM users WHERE username=?').bind(name).first();
        const digest = await hash(input.password);
        if (!equal(digest, user?.password_hash || '0'.repeat(64)) || !user || user.disabled) fail(401, '账号或密码不正确');
        const token = randomSecret(32);
        await db.batch([
          db.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now),
          db.prepare('DELETE FROM counters WHERE expires_at<=?').bind(now),
          db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hash(token), user.id, now+SESSION_SECONDS*1000)
        ]);
        return json({ok:true}, 200, {'Set-Cookie':cookie(token)});
      }
      const user = await session(request, db);
      if (!user) fail(401, '请先登录');
      if (path === '/api/me' && request.method === 'GET') return json({id:user.id,username:user.username,role:user.role,ai:!!(env.OPENAI_API_KEY && env.OPENAI_MODEL),model:env.OPENAI_MODEL || ''});
      if (path === '/api/images' || path.startsWith('/api/images/')) {
        if (!env.MEDIA || !env.IMAGES) fail(503, '图片服务尚未连接');
        if (path === '/api/images' && request.method === 'GET') {
          return json((await db.prepare('SELECT id,name,mime,bytes,width,height,ready,created_at FROM images WHERE user_id=? ORDER BY created_at DESC').bind(user.id).all()).results);
        }
        if (path === '/api/images' && request.method === 'POST') {
          const mime = request.headers.get('Content-Type')?.split(';')[0];
          if (!['image/jpeg','image/png','image/webp'].includes(mime)) fail(415, '仅支持 JPEG、PNG 和 WebP 图片');
          const content = await bytes(request, 5*1024*1024);
          if (!content.length) fail(400, '图片内容为空');
          const hex = [...content.slice(0,12)].map(b=>b.toString(16).padStart(2,'0')).join('');
          const valid = mime==='image/jpeg' ? hex.startsWith('ffd8ff') : mime==='image/png' ? hex.startsWith('89504e470d0a1a0a') : hex.startsWith('52494646') && hex.slice(16,24)==='57454250';
          if (!valid) fail(415, '图片内容与文件类型不一致');
          let info;
          try { info = await env.IMAGES.info(new Blob([content]).stream()); } catch { fail(422, '无法识别图片，请换一张有效图片'); }
          if (!Number.isInteger(info.width) || !Number.isInteger(info.height) || info.width<=0 || info.height<=0 || info.width*info.height>20000000) fail(422, '图片最多支持 2000 万像素');
          const now=Date.now(), day=new Date().toISOString().slice(0,10), expires=Date.parse(day)+86400000;
          await count(db,`upload:all:${day}`,100,expires);
          await count(db,`upload:${user.id}:${day}`,20,expires);
          let name;
          try { name=decodeURIComponent(request.headers.get('X-File-Name') || 'image'); } catch { fail(400, '文件名无效'); }
          name=name.replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,100) || 'image';
          const id=crypto.randomUUID(), key=`${user.id}/${id}`;
          try { await db.prepare('INSERT INTO images(id,user_id,object_key,name,mime,bytes,width,height,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,user.id,key,name,mime,content.length,info.width,info.height,now).run(); }
          catch(error){ if(String(error.message).includes('image_quota')) fail(413, '图片空间已满：每账号最多 100 张、100 MB；全站最多 512 MB'); throw error; }
          try {
            await env.MEDIA.put(key,content,{httpMetadata:{contentType:mime},customMetadata:{owner:user.id}});
            await db.prepare('UPDATE images SET ready=1 WHERE id=? AND user_id=?').bind(id,user.id).run();
          } catch(error) {
            // Keep a recoverable pending row if cleanup fails; the owner can delete it from the gallery.
            try { await env.MEDIA.delete(key); await db.prepare('DELETE FROM images WHERE id=? AND user_id=?').bind(id,user.id).run(); } catch {}
            throw error;
          }
          return json({id,name,mime,bytes:content.length,width:info.width,height:info.height},201);
        }
        const match=/^\/api\/images\/([a-f0-9-]{36})(\/file)?$/.exec(path);
        if (!match) fail(404,'图片不存在');
        const image=await db.prepare('SELECT * FROM images WHERE id=? AND user_id=?').bind(match[1],user.id).first();
        if (!image) fail(404,'图片不存在');
        if (request.method==='DELETE' && !match[2]) {
          await env.MEDIA.delete(image.object_key);
          await db.prepare('DELETE FROM images WHERE id=? AND user_id=?').bind(image.id,user.id).run();
          return json({ok:true});
        }
        if (request.method==='GET' && match[2]) {
          if (!image.ready) fail(409,'图片尚未保存完成，可删除后重新上传');
          const original=url.searchParams.get('original')==='1';
          const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'};
          if (original) {
            const object=await env.MEDIA.get(image.object_key);
            if (!object) fail(404,'图片源文件不存在');
            return new Response(object.body,{headers:{...headers,'Content-Type':image.mime}});
          }
          const size=Number(url.searchParams.get('size') || 800), format=url.searchParams.get('format') || 'webp', fit=url.searchParams.get('fit') || 'contain';
          if (![320,800,1600].includes(size) || !['webp','jpeg','png'].includes(format) || !['contain','cover'].includes(fit)) fail(400,'请选择 320、800 或 1600 像素，WebP、JPEG 或 PNG，等比缩放或方形裁剪');
          // Explicit cache lookup follows authentication and ownership checks; private files never bypass login.
          const cacheKey=new Request(`${url.origin}/_image-cache/${image.id}/${size}/${format}/${fit}`);
          const cache=typeof caches==='undefined' ? null : caches.default;
          const cached=cache ? await cache.match(cacheKey) : null;
          if (cached) return new Response(cached.body,{headers:{...headers,'Content-Type':cached.headers.get('Content-Type')}});
          const month=new Date().toISOString().slice(0,7), next=Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1);
          await count(db,`transform:all:${month}`,1000,next);
          await count(db,`transform:${user.id}:${month}`,300,next);
          const object=await env.MEDIA.get(image.object_key);
          if (!object) fail(404,'图片源文件不存在');
          let output;
          try { output=await env.IMAGES.input(object.body).transform(fit==='cover' ? {width:size,height:size,fit:'cover'} : {width:size,height:size,fit:'scale-down'}).output({format:`image/${format}`,quality:80,anim:false}); }
          catch(error) { console.warn('Images conversion failed:',error.message); fail(502,'图片转换暂时不可用，仍可下载原图；请站长检查 Images 权限或额度'); }
          const result=output.response();
          if (cache) {
            // ponytail: one-hour edge cache; deletion is enforced by the D1 ownership lookup above.
            const copy=new Response(result.clone().body,{headers:{'Content-Type':`image/${format}`,'Cache-Control':'public, max-age=3600'}});
            await cache.put(cacheKey,copy);
          }
          return new Response(result.body,{headers:{...headers,'Content-Type':`image/${format}`}});
        }
        fail(405,'不支持的图片操作');
      }
      if (path === '/api/logout' && request.method === 'POST') {
        await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.token_hash).run();
        return json({ok:true}, 200, {'Set-Cookie':cookie('', 0)});
      }
      if (path === '/api/users') {
        if (user.role !== 'admin') fail(403, '需要管理账号');
        if (request.method === 'GET') return json((await db.prepare('SELECT id,username,role,disabled FROM users ORDER BY created_at').all()).results);
        if (request.method === 'POST') {
          const name = username((await body(request, 1024)).username);
          const password = randomSecret();
          if (await db.prepare('SELECT id FROM users WHERE username=?').bind(name).first()) fail(409, '账号已存在');
          await db.prepare('INSERT INTO users(id,username,password_hash,role,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), name, await hash(password), 'member', Date.now()).run();
          return json({username:name,password}, 201);
        }
      }
      if (path.startsWith('/api/users/') && request.method === 'PATCH') {
        if (user.role !== 'admin') fail(403, '需要管理账号');
        const id = path.slice('/api/users/'.length), input = await body(request, 1024);
        if (id === user.id) fail(400, '不能停用当前管理账号');
        const target = await db.prepare('SELECT id FROM users WHERE id=?').bind(id).first();
        if (!target) fail(404, '账号不存在');
        const password = input.reset === true ? randomSecret() : null;
        if (!password && typeof input.disabled !== 'boolean') fail(400, '请选择停用、启用或重置密码');
        await db.batch([
          password ? db.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await hash(password),id) : db.prepare('UPDATE users SET disabled=? WHERE id=?').bind(Number(input.disabled),id),
          db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id)
        ]);
        return json({ok:true,...(password ? {password} : {})});
      }
      if (path.startsWith('/api/space/')) {
        const app = path.slice('/api/space/'.length);
        if (!APPS.has(app)) fail(404, '空间不存在');
        if (request.method === 'GET') {
          const row = await db.prepare('SELECT data,version FROM spaces WHERE user_id=? AND app=?').bind(user.id,app).first();
          return json({data:row ? JSON.parse(row.data) : {},version:row?.version || 0});
        }
        if (request.method === 'PATCH') {
          const input = await body(request);
          if (!Number.isSafeInteger(input.version) || input.version < 0) fail(400, '版本无效');
          const previous = await db.prepare('SELECT version FROM spaces WHERE user_id=? AND app=?').bind(user.id,app).first();
          if ((previous?.version || 0) !== input.version) fail(409, '其他窗口已更新，请导出本页备份后重新加载');
          const data = clean(app, input.data);
          if (encoder.encode(JSON.stringify(data)).length > 512000) fail(413, '个人空间已超过 500 KB，请导出并整理历史记录');
          const result = await db.prepare('INSERT INTO spaces(user_id,app,data,version) VALUES (?,?,?,1) ON CONFLICT(user_id,app) DO UPDATE SET data=excluded.data, version=spaces.version+1 WHERE spaces.version=? RETURNING version')
            .bind(user.id,app,JSON.stringify(data),input.version).first();
          // Require version 0 for a new row too; do not silently restore stale deleted data.
          if (!result) fail(409, '其他窗口已更新，请导出本页备份后重新加载');
          return json({version:result.version});
        }
      }
      if (path === '/api/ai/chat/completions' && request.method === 'POST') {
        if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL) fail(503, '站长尚未接通模型；你可以继续使用本地分析和离线小元');
        const input = await body(request, 65000);
        if (!Array.isArray(input.messages) || !input.messages.length || input.messages.length > 32 || input.messages.some(m=>!m || !['system','user','assistant'].includes(m.role) || typeof m.content !== 'string')) fail(400, '无效对话');
        const day = new Date().toISOString().slice(0,10), expires = Date.parse(day)+86400000;
        await count(db, `ai:all:${day}`, Number(env.AI_TOTAL_DAILY_LIMIT || 100), expires);
        await count(db, `ai:${user.id}:${day}`, Number(env.AI_USER_DAILY_LIMIT || 20), expires);
        let upstream;
        try {
          upstream = await fetch('https://api.openai.com/v1/responses', {
            method:'POST', signal:AbortSignal.timeout(45000),
            headers:{'Content-Type':'application/json','Authorization':`Bearer ${env.OPENAI_API_KEY}`},
            body:JSON.stringify({model:env.OPENAI_MODEL,input:input.messages,store:false,max_output_tokens:1200})
          });
        } catch { fail(502, '模型服务暂时无法连接，请稍后再试'); }
        if (!upstream.ok) fail(502, '模型服务未完成请求，请站长检查余额、模型权限或限流');
        const answer = await upstream.json();
        const text = answer.output?.flatMap(item=>item.content || []).filter(item=>item.type==='output_text').map(item=>item.text).join('');
        if (!text) fail(502, '没有收到模型回复');
        return json({choices:[{message:{role:'assistant',content:text}}]});
      }
      fail(404, '接口不存在');
    } catch (error) {
      return json({error:{message:error.status ? error.message : '服务暂时不可用，请稍后重试'}}, error.status || 500);
    }
  }
};
