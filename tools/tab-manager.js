// ===== Browser Helper - Tab Manager Module =====
// Scoped to #panel-tab-manager

const TabManager = (function() {
  // State
  let allTabs = [];
  let activeTabId = null;
  let selectedTabIds = new Set();
  let searchQuery = "";
  let currentView = "group";
  let sortMode = "domain";
  let collapsedGroups = new Set();

  const DOMAIN_CFG = {
    "github.com":       ["#18191C","GH"],
    "google.com":       ["#4285F4","G"],
    "mail.google.com":  ["#4285F4","M"],
    "docs.google.com":  ["#4285F4","D"],
    "claude.ai":        ["#D97757","C"],
    "figma.com":        ["#D97706","F"],
    "youtube.com":      ["#FF0000","Y"],
    "stackoverflow.com":["#0F172A","S"],
    "twitter.com":      ["#1DA1F2","X"],
    "x.com":            ["#000000","X"],
    "reddit.com":       ["#FF4500","R"],
    "notion.so":        ["#000000","N"],
    "gmail.com":        ["#EA4335","M"],
  };

  // Helpers
  function h(s){ return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function d(url){ try{ var h=new URL(url).hostname; return h.replace("www.",""); }catch(e){return "其他";} }
  function dc(domain){
    if(DOMAIN_CFG[domain]) return DOMAIN_CFG[domain];
    var p=domain.split(".");
    for(var i=1;i<p.length;i++){ var s=p.slice(i).join("."); if(DOMAIN_CFG[s]) return DOMAIN_CFG[s]; }
    return ["#94A3B8", domain.charAt(0).toUpperCase()||"?"];
  }

  function groupTabs(tabs){
    var g={};
    for(var i=0;i<tabs.length;i++){ var k=d(tabs[i].url); if(!g[k])g[k]=[]; g[k].push(tabs[i]); }
    return g;
  }

  function sortG(groups){
    var e=Object.entries(groups);
    if(sortMode==="domain") e.sort(function(a,b){return a[0].localeCompare(b[0]);});
    else if(sortMode==="title") e.sort(function(a,b){return (a[1][0].title||"").localeCompare(b[1][0].title||"");});
    else if(sortMode==="time") e.sort(function(a,b){
      return Math.max.apply(null,b[1].map(function(t){return t.lastAccessed||0;})) -
             Math.max.apply(null,a[1].map(function(t){return t.lastAccessed||0;}));
    });
    return Object.fromEntries(e);
  }

  function filterTabs(){
    if(!searchQuery) return allTabs;
    var q=searchQuery.toLowerCase();
    return allTabs.filter(function(t){return(t.title||"").toLowerCase().indexOf(q)>=0||(t.url||"").toLowerCase().indexOf(q)>=0;});
  }

  // Render
  function render(){
    var c=document.getElementById("tab-count"); if(c)c.textContent=allTabs.length+" 个标签页";
    renderList();
    renderBottom();
  }

  function renderList(){
    var c=document.getElementById("tab-list");
    if(!c) return;
    var tabs=filterTabs();

    if(tabs.length===0){
      c.innerHTML='<div class="tm-loading">'+(searchQuery?"未找到匹配的标签页":"暂无标签页")+'</div>';
      return;
    }

    c.className = "tm-list";
    if(currentView==="group"){
      renderGroups(c, tabs);
    } else {
      renderFlat(c, tabs);
      c.classList.add("list-view");
    }
  }

  function renderGroups(container, tabs){
    var groups=sortG(groupTabs(tabs));
    var keys=Object.entries(groups);
    var html="";
    for(var i=0;i<keys.length;i++){
      var domain=keys[i][0];
      var dtabs=keys[i][1];
      dtabs.sort(function(a,b){ return b.id===activeTabId?1:a.id===activeTabId?-1:0; });
      var cfg=dc(domain);
      var collapsed=collapsedGroups.has(domain);
      html+='<div class="tm-group'+(collapsed?' collapsed':'')+'" data-domain="'+h(domain)+'">';
      html+='<div class="tm-group-hdr" data-domain="'+h(domain)+'">';
      html+='<div class="tm-group-left">';
      html+='<span class="tm-chevron">▼</span>';
      html+='<span class="tm-favicon" style="background:'+cfg[0]+'">'+cfg[1]+'</span>';
      html+='<span class="tm-group-name">'+h(domain)+' · '+dtabs.length+'</span>';
      html+='</div>';
      html+='<button class="tm-group-close" data-domain="'+h(domain)+'">✕</button>';
      html+='</div>';
      html+='<div class="tm-group-items">';
      for(var j=0;j<dtabs.length;j++){ html+=renderTabItem(dtabs[j], cfg); }
      html+='</div></div>';
    }
    container.innerHTML=html;
    bindGroupEvents(container);
    bindTabItemEvents(container);
  }

  function renderFlat(container, tabs){
    var sorted=[].concat(tabs);
    sorted.sort(function(a,b){ return b.id===activeTabId?1:a.id===activeTabId?-1:0; });
    if(sortMode==="title") sorted.sort(function(a,b){ return (a.title||"").localeCompare(b.title||""); });
    else if(sortMode==="time") sorted.sort(function(a,b){ return (b.lastAccessed||0)-(a.lastAccessed||0); });
    var html='<div class="tm-group"><div class="tm-group-items">';
    for(var i=0;i<sorted.length;i++){ html+=renderTabItem(sorted[i], dc(d(sorted[i].url))); }
    html+='</div></div>';
    container.innerHTML=html;
    bindTabItemEvents(container);
  }

  function isSelected(id){ return selectedTabIds.has(id); }

  function renderTabItem(tab, cfg){
    var id=tab.id;
    var title=tab.title||tab.url||"无标题";
    var url=tab.url||"";
    var sel=isSelected(id)?" sel":"";
    var act=id===activeTabId?" act":"";
    var cb=isSelected(id)?" on":"";
    var ac=id===activeTabId?'<span class="tm-act-chip"><span class="tm-dot"></span><span class="tm-lbl">活跃</span></span>':"";
    return '<div class="tm-tab'+sel+act+'" data-tab-id="'+id+'">'+
      '<span class="tm-cb'+cb+'" data-tab-id="'+id+'"></span>'+
      '<span class="tm-favicon" style="background:'+cfg[0]+'">'+cfg[1]+'</span>'+
      '<div class="tm-tab-info"><div class="tm-tab-title">'+h(title)+'</div><div class="tm-tab-url">'+h(url)+'</div></div>'+
      ac+
      '<button class="tm-tab-close" data-tab-id="'+id+'">✕</button>'+
      '</div>';
  }

  function bindGroupEvents(container){
    var hdrs=container.querySelectorAll(".tm-group-hdr");
    for(var i=0;i<hdrs.length;i++){
      hdrs[i].addEventListener("click", function(e){
        if(e.target.closest(".tm-group-close")) return;
        var domain=e.currentTarget.dataset.domain;
        var grp=e.currentTarget.closest(".tm-group");
        if(collapsedGroups.has(domain)){
          collapsedGroups.delete(domain); grp.classList.remove("collapsed");
        } else { collapsedGroups.add(domain); grp.classList.add("collapsed"); }
      });
    }
    var cbs=container.querySelectorAll(".tm-group-close");
    for(var i=0;i<cbs.length;i++){
      cbs[i].addEventListener("click", function(e){
        e.stopPropagation();
        var domain=e.currentTarget.dataset.domain;
        var tabs=allTabs.filter(function(t){return d(t.url)===domain;});
        closeGroup(domain, tabs);
      });
    }
  }

  function bindTabItemEvents(container){
    var items=container.querySelectorAll(".tm-tab");
    for(var i=0;i<items.length;i++){
      items[i].addEventListener("click", function(e){
        if(e.target.closest(".tm-cb")||e.target.closest(".tm-tab-close")) return;
        var tid=parseInt(e.currentTarget.dataset.tabId);
        if(chrome&&chrome.tabs) chrome.tabs.update(tid,{active:true});
      });
    }
    var cbs=container.querySelectorAll(".tm-cb");
    for(var i=0;i<cbs.length;i++){
      cbs[i].addEventListener("click", function(e){
        e.stopPropagation();
        var tid=parseInt(e.currentTarget.dataset.tabId);
        var item=e.currentTarget.closest(".tm-tab");
        if(isSelected(tid)){
          selectedTabIds.delete(tid); e.currentTarget.classList.remove("on"); item.classList.remove("sel");
        } else {
          selectedTabIds.add(tid); e.currentTarget.classList.add("on"); item.classList.add("sel");
        }
        renderBottom();
      });
    }
    var tcb=container.querySelectorAll(".tm-tab-close");
    for(var i=0;i<tcb.length;i++){
      tcb[i].addEventListener("click", function(e){
        e.stopPropagation();
        closeTab(parseInt(e.currentTarget.dataset.tabId));
      });
    }
  }

  function renderBottom(){
    var bar=document.getElementById("bottom-bar");
    var cnt=document.getElementById("sel-count");
    if(!bar) return;
    if(selectedTabIds.size>0){
      bar.style.display="flex"; cnt.textContent="已选 "+selectedTabIds.size+" 个";
    } else { bar.style.display="none"; }
  }

  function expandAll(){
    collapsedGroups.clear();
    var groups=document.querySelectorAll(".tm-group");
    for(var i=0;i<groups.length;i++) groups[i].classList.remove("collapsed");
  }

  function collapseAll(){
    var groups=document.querySelectorAll(".tm-group");
    for(var i=0;i<groups.length;i++){ collapsedGroups.add(groups[i].dataset.domain); groups[i].classList.add("collapsed"); }
  }

  // ----- Safe remove: switch away from active tab before closing -----
  // This prevents Chrome from auto-closing the popup when the active tab is removed
  async function safeRemove(ids){
    var idList = Array.isArray(ids) ? ids : [ids];
    if(!chrome||!chrome.tabs) return;
    var remaining = allTabs.filter(function(t){ return idList.indexOf(t.id) < 0; });
    if(remaining.length === 0){
      // All tabs are being closed — spawn a blank one first to keep popup alive
      await chrome.tabs.create({ url: 'about:blank' });
    } else if(idList.indexOf(activeTabId) >= 0){
      // Active tab is being removed — switch to another tab first
      await chrome.tabs.update(remaining[0].id, { active: true });
    }
    await chrome.tabs.remove(idList);
  }

  // Actions
  async function closeTab(tabId){
    try{
      await safeRemove(tabId);
      selectedTabIds.delete(tabId);
      allTabs=await chrome.tabs.query({currentWindow:true});
      render(); showToast("已关闭标签页");
    }catch(e){showToast("关闭失败: "+e.message,"error");}
  }

  async function closeGroup(domain, tabs){
    var ids=tabs.map(function(t){return t.id;});
    if(ids.length>1 && !confirm("确定要关闭 "+domain+" 下的 "+ids.length+" 个标签页吗？")) return;
    try{
      await safeRemove(ids);
      ids.forEach(function(id){selectedTabIds.delete(id);});
      allTabs=await chrome.tabs.query({currentWindow:true});
      render(); showToast("已关闭 "+domain+" 的 "+ids.length+" 个标签页");
    }catch(e){showToast("关闭失败: "+e.message,"error");}
  }

  async function closeAll(){
    if(allTabs.length===0){showToast("没有可关闭的标签页");return;}
    if(!confirm("确定要关闭全部 "+allTabs.length+" 个标签页吗？")) return;
    try{
      var ids=allTabs.map(function(t){return t.id;});
      await safeRemove(ids);
      allTabs=await chrome.tabs.query({currentWindow:true});
      render(); showToast("已关闭全部标签页");
    }catch(e){showToast("关闭失败: "+e.message,"error");}
  }

  async function closeOthers(){
    if(!activeTabId){showToast("无法确定当前标签页");return;}
    var others=allTabs.filter(function(t){return t.id!==activeTabId;});
    if(others.length===0){showToast("没有其他标签页可关闭");return;}
    if(!confirm("确定要关闭其他 "+others.length+" 个标签页吗？")) return;
    try{
      await safeRemove(others.map(function(t){return t.id;}));
      allTabs=await chrome.tabs.query({currentWindow:true});
      render(); showToast("已关闭其他标签页");
    }catch(e){showToast("关闭失败: "+e.message,"error");}
  }

  async function closeDup(){
    var map={}, dup=[];
    for(var i=0;i<allTabs.length;i++){
      var t=allTabs[i];
      if(!t.url) continue;
      if(map[t.url]!==undefined){
        if(t.id!==activeTabId) dup.push(t.id);
        else{dup.push(map[t.url]);map[t.url]=t.id;}
      }else{map[t.url]=t.id;}
    }
    if(dup.length===0){showToast("没有发现重复标签页");return;}
    if(!confirm("发现 "+dup.length+" 个重复标签页，确定要关闭吗？")) return;
    try{
      await safeRemove(dup);
      allTabs=await chrome.tabs.query({currentWindow:true});
      render(); showToast("已关闭重复标签页");
    }catch(e){showToast("关闭失败: "+e.message,"error");}
  }

  async function closeSelected(){
    if(selectedTabIds.size===0){showToast("请先选择标签页");return;}
    var ids=Array.from(selectedTabIds);
    try{
      await safeRemove(ids);
      selectedTabIds.clear();
      allTabs=await chrome.tabs.query({currentWindow:true});
      render(); showToast("已关闭选中的标签页");
    }catch(e){showToast("关闭失败: "+e.message,"error");}
  }

  async function bookmarkAll(){
    try{
      var f=await chrome.bookmarks.create({parentId:"1",title:"Tab管家 "+new Date().toLocaleString("zh-CN")});
      var saved=0;
      for(var i=0;i<allTabs.length;i++){
        var t=allTabs[i];
        if(!t.url||t.url.indexOf("chrome://")===0) continue;
        await chrome.bookmarks.create({parentId:f.id,title:t.title||t.url,url:t.url});
        saved++;
      }
      showToast("已收藏 "+saved+" 个标签页");
    }catch(e){showToast("收藏失败: "+e.message,"error");}
  }

  async function bookmarkSelected(){
    if(selectedTabIds.size===0){showToast("请先选择标签页");return;}
    try{
      var f=await chrome.bookmarks.create({parentId:"1",title:"Tab管家 "+new Date().toLocaleString("zh-CN")});
      var cnt=0;
      for(var i=0;i<allTabs.length;i++){
        var t=allTabs[i];
        if(!selectedTabIds.has(t.id)) continue;
        if(!t.url||t.url.indexOf("chrome://")===0) continue;
        await chrome.bookmarks.create({parentId:f.id,title:t.title||t.url,url:t.url});
        cnt++;
      }
      showToast("已收藏 "+cnt+" 个标签页");
      selectedTabIds.clear();
      render();
    }catch(e){showToast("收藏失败: "+e.message,"error");}
  }

  // Toast
  var toastTimer=null;
  function showToast(msg, type){
    var t=document.getElementById("toast");
    if(!t){ t=document.createElement("div"); t.id="toast"; t.className="toast"; document.body.appendChild(t); }
    t.textContent=msg; t.className="toast show";
    if(type) t.classList.add(type);
    if(toastTimer) clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){t.className="toast";}, 2000);
  }

  // Init
  function bindUI(){
    var si=document.getElementById("search-input");
    if(si) si.addEventListener("input", function(){ searchQuery=si.value; renderList(); });

    var qas=document.querySelectorAll("#quick-actions .qa-btn");
    for(var i=0;i<qas.length;i++){
      qas[i].addEventListener("click", function(){
        var a=this.dataset.a;
        if(a==="dup") closeDup(); else if(a==="oth") closeOthers();
        else if(a==="sel") closeSelected(); else if(a==="bmk") bookmarkAll();
        else if(a==="all") closeAll();
      });
    }

    var vbs=document.querySelectorAll("#view-toggle .view-btn");
    for(var i=0;i<vbs.length;i++){
      vbs[i].addEventListener("click", function(){
        for(var j=0;j<vbs.length;j++) vbs[j].classList.remove("active");
        this.classList.add("active"); currentView=this.dataset.v; renderList();
      });
    }

    var sortBtns=document.querySelectorAll("#sort-actions .sort-btn");
    for(var i=0;i<sortBtns.length;i++){
      sortBtns[i].addEventListener("click", function(){
        for(var j=0;j<sortBtns.length;j++) sortBtns[j].classList.remove("active");
        this.classList.add("active"); sortMode=this.dataset.s; renderList();
      });
    }

    var ea=document.getElementById("expand-all");
    var ca=document.getElementById("collapse-all");
    if(ea) ea.addEventListener("click", expandAll);
    if(ca) ca.addEventListener("click", collapseAll);

    var cs=document.getElementById("close-sel");
    var bs=document.getElementById("bmk-sel");
    if(cs) cs.addEventListener("click", closeSelected);
    if(bs) bs.addEventListener("click", bookmarkSelected);

    if(chrome&&chrome.tabs){
      chrome.tabs.onRemoved.addListener(function(){
        chrome.tabs.query({currentWindow:true}).then(function(t){allTabs=t;render();});
      });
      chrome.tabs.onCreated.addListener(function(){
        chrome.tabs.query({currentWindow:true}).then(function(t){allTabs=t;render();});
      });
      chrome.tabs.onActivated.addListener(async function(info){
        activeTabId=info.tabId;
        allTabs=await chrome.tabs.query({currentWindow:true});
        render();
      });
    }
  }

  function loadData(callback){
    if(!chrome||!chrome.tabs){
      throw new Error("Chrome API 不可用");
    }
    chrome.tabs.query({currentWindow:true}, function(tabs){
      allTabs = tabs;
      chrome.tabs.query({active:true,currentWindow:true}, function(at){
        activeTabId = at[0] ? at[0].id : null;
        try { render(); } catch(e) {}
        if(callback) callback();
      });
    });
  }

  function init(){
    bindUI();
    loadData(function(){
      // data loaded
    });
  }

  return { init: init };
})();
