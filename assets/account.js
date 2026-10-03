(async function () {
  const app = location.pathname.startsWith('/joblens/') ? 'joblens' : location.pathname.startsWith('/ai-voice-pet/') ? 'xiaoyuan' : null;
  const wf = window.Wenfeng = {data:{},version:0,user:null};
  wf.api = async function(path, options = {}) {
    const response = await fetch(path, {credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}});
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error?.message || '请求失败'),{status:response.status});
    return result;
  };
  let pending = false, saving = false, blocked = false, timer;
  function status(text) { document.getElementById('sync-status').textContent = text; }
  wf.get = (key, fallback) => key in wf.data ? structuredClone(wf.data[key]) : fallback;
  wf.set = function(key, value) {
    if (value === undefined) delete wf.data[key]; else wf.data[key] = structuredClone(value);
    pending = true; status('等待保存'); clearTimeout(timer); timer = setTimeout(wf.flush, 500); return true;
  };
  wf.flush = async function () {
    if (!app || saving || !pending || blocked) return;
    saving = true; pending = false; status('正在保存');
    try {
      const result = await wf.api('/api/space/'+app,{method:'PATCH',body:JSON.stringify({version:wf.version,data:wf.data})});
      wf.version = result.version; status(pending ? '等待保存' : '已保存到个人空间');
    } catch(error) {
      pending = true; blocked = error.status === 409 || error.status === 401;
      status(error.message + ' · 请保留本页并导出备份');
    } finally { saving = false; if(pending && !blocked) timer = setTimeout(wf.flush,3000); }
  };
  window.addEventListener('beforeunload',event=>{if(pending || saving){event.preventDefault();event.returnValue='';}});
  wf.ready = (async function(){
    try {
      wf.user = await wf.api('/api/me');
      if(app) Object.assign(wf, await wf.api('/api/space/'+app));
      const bar = document.createElement('aside'); bar.id='account-status';
      const name=document.createElement('span');name.textContent=wf.user.username+' · ';
      const sync=document.createElement('span');sync.id='sync-status';sync.setAttribute('role','status');sync.textContent='个人空间';
      const link=document.createElement('a');link.href='/space.html';link.textContent='我的空间';
      const backup=document.createElement('button');backup.textContent='备份';backup.onclick=()=>{
        const url=URL.createObjectURL(new Blob([JSON.stringify({app,data:wf.data},null,2)],{type:'application/json'}));
        const a=document.createElement('a');a.href=url;a.download=app+'-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      };
      const out=document.createElement('button');out.textContent='退出';out.onclick=async()=>{
        if(pending || saving){await wf.flush();if(pending || saving)return status('请等保存完成；保存失败时先导出备份');}
        await wf.api('/api/logout',{method:'POST',body:'{}'});wf.data={};location.href='/login.html';
      };
      bar.append(name,sync,link);if(app)bar.append(backup);bar.append(out);document.body.append(bar);
      wf.loaded=true; return wf;
    } catch(error) {
      if(error.status===401){location.replace('/login.html?next='+encodeURIComponent(location.pathname+location.hash));}
      else {document.body.replaceChildren(Object.assign(document.createElement('p'),{textContent:'个人空间暂时无法打开：'+error.message+'。请稍后重试。'}));}
      throw error;
    }
  })();
  wf.ready.catch(()=>{});
})();
