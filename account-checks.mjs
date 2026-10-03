import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker, {randomSecret, hash} from './worker.mjs';
const sqlite = new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
const db={prepare(sql){return {bind(...args){const stmt=sqlite.prepare(sql);return {first:async()=>stmt.get(...args)||null,all:async()=>({results:stmt.all(...args)}),run:async()=>stmt.run(...args)};}}},async batch(items){sqlite.exec('BEGIN');try{const out=await Promise.all(items.map(item=>item.run()));sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const env={DB:db,ASSETS:{fetch:async()=>new Response('public')},OPENAI_MODEL:'test-model',OPENAI_API_KEY:'test-secret',AI_USER_DAILY_LIMIT:'2',AI_TOTAL_DAILY_LIMIT:'20'};
const password=randomSecret();
sqlite.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run('admin','wenfeng_admin',await hash(password),'admin',0,Date.now());
async function req(path,method='GET',body,cookie='',origin='https://example.test'){
 return worker.fetch(new Request('https://example.test'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'CF-Connecting-IP':'127.0.0.1'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
}
async function login(username,password){const r=await req('/api/login','POST',{username,password});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie');assert.match(cookie,/Secure; HttpOnly; SameSite=Strict/);return cookie.split(';')[0];}
assert.equal((await req('/')).status,200);assert.equal((await req('/joblens/')).status,303);assert.equal((await req('/api/space/joblens')).status,401);
assert.equal((await req('/api/login','POST',{username:'wenfeng_admin',password:'wrong'})).status,401);
const admin=await login('wenfeng_admin',password);
assert.equal((await req('/api/users','POST',{username:'friend_001'},admin,'https://evil.test')).status,403);
const create=await req('/api/users','POST',{username:'friend_001'},admin);assert.equal(create.status,201);const friend=await create.json();assert.equal(friend.password.length,32);
const member=await login(friend.username,friend.password);
assert.equal((await req('/api/users','GET',undefined,member)).status,403);
assert.equal((await req('/joblens/','GET',undefined,member)).status,200);
const save=await req('/api/space/joblens','PATCH',{version:0,data:{resumes:[{name:'private resume'}],settings:{llm:{apiKey:'do-not-store'}}}},member);assert.equal(save.status,200);
const memberData=await(await req('/api/space/joblens','GET',undefined,member)).json();assert.equal(memberData.data.settings.llm.apiKey,'');assert.equal(memberData.version,1);
const adminData=await(await req('/api/space/joblens','GET',undefined,admin)).json();assert.deepEqual(adminData.data,{});
assert.equal((await req('/api/space/joblens','PATCH',{version:0,data:{resumes:[]}},member)).status,409);
assert.equal((await req('/api/space/xiaoyuan','PATCH',{version:5,data:{}},member)).status,409);
assert.equal((await req('/api/space/xiaoyuan','PATCH',{version:0,data:{history:[{role:'user',content:'hello'}]}},member)).status,200);
assert.equal((await req('/api/space/xiaoyuan','PATCH',{version:1,data:{unexpected:true}},member)).status,400);
const originalFetch=globalThis.fetch;let calls=0;
globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');const payload=JSON.parse(options.body);assert.equal(payload.model,'test-model');assert.equal(payload.store,false);assert.equal(payload.max_output_tokens,1200);assert.equal(options.headers.Authorization,'Bearer test-secret');return Response.json({output:[{content:[{type:'output_text',text:'model reply'}]}]});};
const aiBody={model:'expensive-client-model',messages:[{role:'user',content:'hello'}]};
for(let i=0;i<2;i++){const r=await req('/api/ai/chat/completions','POST',aiBody,member);assert.equal(r.status,200);assert.equal((await r.json()).choices[0].message.content,'model reply');}
assert.equal((await req('/api/ai/chat/completions','POST',aiBody,member)).status,429);assert.equal(calls,2);globalThis.fetch=originalFetch;
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAAZElEQVR4nO3PUQkAIBTAwBfSFtYwuCH8OITBAtxmnf11wwUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY8dgF+TiTiNTH85AAAAABJRU5ErkJggg==','base64'));
const objects=new Map();let transforms=0;
env.MEDIA={put:async(key,value)=>{objects.set(key,new Uint8Array(value));},get:async(key)=>objects.has(key)?{body:new Blob([objects.get(key)]).stream()}:null,delete:async(key)=>objects.delete(key)};
env.IMAGES={info:async()=>({width:1,height:1}),input(){return {transform(options){assert(options.width<=1600);return this;},async output(options){transforms++;return {response:()=>new Response(png,{headers:{'Content-Type':options.format}})};}}}};
async function upload(content=png,mime='image/png',origin='https://example.test') {return worker.fetch(new Request('https://example.test/api/images',{method:'POST',headers:{Origin:origin,Cookie:member,'Content-Type':mime,'X-File-Name':encodeURIComponent('测试图片.png')},body:content}),env);}
assert.equal((await upload(png,'image/png','https://evil.test')).status,403);
assert.equal((await upload(png,'image/svg+xml')).status,415);
assert.equal((await upload(new TextEncoder().encode('not an image'))).status,415);
assert.equal((await upload(new Uint8Array(5*1024*1024+1))).status,413);
const uploaded=await upload();assert.equal(uploaded.status,201);const image=await uploaded.json();
assert.equal((await(await req('/api/images','GET',undefined,member)).json()).length,1);
assert.equal((await(await req('/api/images','GET',undefined,admin)).json()).length,0);
assert.equal((await req('/api/images/'+image.id+'/file','GET',undefined,admin)).status,404);
const original=await req('/api/images/'+image.id+'/file?original=1','GET',undefined,member);assert.equal(original.status,200);assert.deepEqual(new Uint8Array(await original.arrayBuffer()),png);assert.equal(original.headers.get('Cache-Control'),'private, no-store');
const converted=await req('/api/images/'+image.id+'/file?size=320&format=webp&fit=cover','GET',undefined,member);assert.equal(converted.status,200);assert.equal(converted.headers.get('Content-Type'),'image/webp');assert.equal(transforms,1);
assert.equal((await req('/api/images/'+image.id+'/file?size=99999','GET',undefined,member)).status,400);
const owner=sqlite.prepare('SELECT id FROM users WHERE username=?').get(friend.username).id;
assert.throws(()=>sqlite.prepare('INSERT INTO images(id,user_id,object_key,name,mime,bytes,width,height,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run('over-quota',owner,'quota-key','large.png','image/png',104857601,1,1,Date.now()),/image_quota/);
assert.equal((await req('/api/images/'+image.id,'DELETE',{},admin)).status,404);
assert.equal((await req('/api/images/'+image.id,'DELETE',{},member)).status,200);
assert.equal(objects.size,0);assert.equal((await req('/api/images/'+image.id+'/file','GET',undefined,member)).status,404);
console.log('PASS: upload type/size validation, same-origin protection, account-isolated listing/download/delete, conversion options, original bytes and atomic storage quota');

const id=sqlite.prepare('SELECT id FROM users WHERE username=?').get(friend.username).id;
const reset=await req('/api/users/'+id,'PATCH',{reset:true},admin);assert.equal(reset.status,200);assert.equal((await req('/api/me','GET',undefined,member)).status,401);
const newPassword=(await reset.json()).password;const renewed=await login(friend.username,newPassword);
assert.equal((await req('/api/users/'+id,'PATCH',{disabled:true},admin)).status,200);assert.equal((await req('/api/me','GET',undefined,renewed)).status,401);
assert.equal((await req('/api/logout','POST',{},admin)).status,200);assert.equal((await req('/api/me','GET',undefined,admin)).status,401);
assert(!JSON.stringify(sqlite.prepare('SELECT * FROM users').all()).includes(password));
console.log('PASS: login, cookie, CSRF, administrator access, per-user storage, concurrent-write rejection, secret stripping, shared AI quota, password reset, disable and logout');
