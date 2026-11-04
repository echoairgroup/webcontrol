/* WebControl first-party analytics tracker v1.0.0
 * Consent-gated by default. No raw IP address, query string, form value, or referrer path is sent.
 */
(() => {
  'use strict';
  const script = document.currentScript;
  if (!script) return;
  const siteId = script.dataset.siteId;
  const siteKey = script.dataset.siteKey;
  if (!siteId || !siteKey) { console.warn('[WebControl] Missing data-site-id or data-site-key.'); return; }
  const apiBase = new URL(script.src).origin;
  const endpoint = `${apiBase}/api/collect`;
  const consentKey = `webcontrol-consent:${siteId}`;
  const visitorKey = `webcontrol-visitor:${siteId}`;
  const sessionKey = `webcontrol-session:${siteId}`;
  const started = performance.now();
  let granted = false;
  let sentPerformance = false;
  let lcp = null, cls = 0, inp = null;
  const safe = (value, max=200) => String(value ?? '').slice(0,max);
  const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  function getStored(key, store) { try { return store.getItem(key); } catch { return null; } }
  function getVisitor() { let id=getStored(visitorKey,localStorage); if(!id){id=makeId();try{localStorage.setItem(visitorKey,id)}catch{}} return id; }
  function getSession() { let current; try{current=JSON.parse(sessionStorage.getItem(sessionKey)||'null')}catch{}; if(!current||Date.now()-current.lastSeen>30*60*1000){current={id:makeId(),lastSeen:Date.now()};}else current.lastSeen=Date.now();try{sessionStorage.setItem(sessionKey,JSON.stringify(current))}catch{} return current.id; }
  let visitorId=null;
  function getConsentChoice() { try { const value=localStorage.getItem(consentKey); return value==='granted'||value==='denied'?value:null; } catch { return null; } }
  function consentGranted() { return getConsentChoice()==='granted'; }
  function send(eventName, extra={}) {
    if(!granted) return;
    if(!visitorId)visitorId=getVisitor();
    const payload={site_key:siteKey,event_name:eventName,path:location.pathname||'/',referrer:(()=>{try{return document.referrer?new URL(document.referrer).origin:''}catch{return ''}})(),session_id:getSession(),visitor_id:visitorId,...extra};
    const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
    if(navigator.sendBeacon){navigator.sendBeacon(endpoint,blob);}else fetch(endpoint,{method:'POST',mode:'cors',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(()=>{});
  }
  function grantConsent(){try{localStorage.setItem(consentKey,'granted')}catch{};if(!granted){granted=true;send('page_view');schedulePerformance();}}
  function revokeConsent(){try{localStorage.setItem(consentKey,'denied');localStorage.removeItem(visitorKey);sessionStorage.removeItem(sessionKey)}catch{};visitorId=null;granted=false;}
  function schedulePerformance(){if(sentPerformance)return;sentPerformance=true;const emit=()=>{const nav=performance.getEntriesByType('navigation')[0];const duration=nav?.duration||Math.max(0,performance.now()-started);send('performance',{duration_ms:Math.round(duration),lcp_ms:lcp,cls:Number(cls.toFixed(4)),inp_ms:inp});};if(document.readyState==='complete')setTimeout(emit,1500);else window.addEventListener('load',()=>setTimeout(emit,1500),{once:true});}
  try{new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)cls+=e.value;}).observe({type:'layout-shift',buffered:true});}catch{}
  try{new PerformanceObserver(list=>{const entries=list.getEntries();if(entries.length)lcp=entries[entries.length-1].startTime;}).observe({type:'largest-contentful-paint',buffered:true});}catch{}
  try{new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.interactionId)inp=Math.max(inp||0,e.duration);}).observe({type:'event',buffered:true,durationThreshold:40});}catch{}
  window.webcontrol=function(command,name,properties){
    if(command==='consent'&&name==='grant')return grantConsent();
    if(command==='consent'&&name==='revoke')return revokeConsent();
    if(command==='event'&&name){const clean={};if(properties&&typeof properties==='object')for(const [k,v] of Object.entries(properties).slice(0,12)){if(/email|name|phone|address|password|token|user.?id/i.test(k))continue;if(['string','number','boolean'].includes(typeof v))clean[safe(k,40)]=typeof v==='string'?safe(v,100):v;}return send('custom',{properties:clean,custom_name:safe(name,80)});}
  };
  window.dispatchEvent(new Event('webcontrol:ready'));
  function installConsentUi(){
    if(script.dataset.consentManaged==='external'||!document.body)return;
    const host=document.createElement('div');
    host.setAttribute('data-webcontrol-consent-root','');
    const shadow=host.attachShadow({mode:'closed'});
    shadow.innerHTML=`
      <style>
        :host{all:initial}
        .panel{position:fixed;right:18px;bottom:18px;z-index:2147483647;box-sizing:border-box;width:min(440px,calc(100vw - 36px));padding:18px;border:1px solid rgba(148,163,184,.35);border-radius:16px;background:#101827;color:#f8fafc;box-shadow:0 18px 55px rgba(0,0,0,.32);font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .panel[hidden],.settings[hidden]{display:none!important}
        .title{margin:0 0 7px;font-size:16px;font-weight:700;letter-spacing:-.02em}
        .copy{margin:0 0 14px;color:#d2d9e5;font-size:13px}
        .actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap}
        button{font:600 13px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;border-radius:9px;padding:9px 12px;cursor:pointer}
        .reject{color:#f8fafc;background:transparent;border:1px solid #64748b}
        .accept{color:#07111d;background:#b9e5ff;border:1px solid #b9e5ff}
        .settings{position:fixed;right:16px;bottom:16px;z-index:2147483646;background:#101827;color:#f8fafc;border:1px solid rgba(148,163,184,.55);border-radius:999px;padding:8px 12px;box-shadow:0 5px 18px rgba(0,0,0,.22)}
        button:focus-visible{outline:3px solid #7dd3fc;outline-offset:3px}
        @media(max-width:480px){.panel{right:10px;bottom:10px;width:calc(100vw - 20px)}.settings{right:10px;bottom:10px}}
      </style>
      <section class="panel" id="panel" role="dialog" aria-label="Analytics privacy choices" aria-describedby="copy">
        <h2 class="title">Your privacy choices</h2>
        <p class="copy" id="copy">This website uses optional WebControl analytics to understand visits and improve the experience. Analytics stays off unless you allow it. You can change this choice later using Privacy settings.</p>
        <div class="actions"><button class="reject" id="reject" type="button">Reject optional</button><button class="accept" id="accept" type="button">Allow analytics</button></div>
      </section>
      <button class="settings" id="settings" type="button" hidden>Privacy settings</button>
    `;
    const panel=shadow.getElementById('panel');
    const settings=shadow.getElementById('settings');
    const refresh=()=>{const choice=getConsentChoice();panel.hidden=Boolean(choice);settings.hidden=!choice;};
    shadow.getElementById('accept').addEventListener('click',()=>{grantConsent();refresh();});
    shadow.getElementById('reject').addEventListener('click',()=>{revokeConsent();refresh();});
    settings.addEventListener('click',()=>{panel.hidden=false;settings.hidden=true;shadow.getElementById('accept').focus();});
    document.body.appendChild(host);
    refresh();
  }
  window.addEventListener('error',e=>{send('error',{error_type:'javascript',error_message:safe(e.message||'Script error',500)});});
  window.addEventListener('unhandledrejection',e=>{const msg=e.reason?.message||e.reason||'Unhandled promise rejection';send('error',{error_type:'unhandledrejection',error_message:safe(msg,500)});});
  window.addEventListener('pagehide',()=>{if(granted)send('session_end',{duration_ms:Math.round(performance.now()-started)});});
  if(consentGranted())grantConsent();
  installConsentUi();
  window.addEventListener('popstate',()=>{if(granted)send('page_view')});
  const originalPush=history.pushState;history.pushState=function(...args){const result=originalPush.apply(this,args);if(granted)send('page_view');return result;};
})();
