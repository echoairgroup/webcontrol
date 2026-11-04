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
  function consentGranted() { try { return localStorage.getItem(consentKey)==='granted'; } catch { return false; } }
  function send(eventName, extra={}) {
    if(!granted) return;
    if(!visitorId)visitorId=getVisitor();
    const payload={site_key:siteKey,event_name:eventName,path:location.pathname||'/',referrer:(()=>{try{return document.referrer?new URL(document.referrer).origin:''}catch{return ''}})(),session_id:getSession(),visitor_id:visitorId,...extra};
    const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
    if(navigator.sendBeacon){navigator.sendBeacon(endpoint,blob);}else fetch(endpoint,{method:'POST',mode:'cors',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(()=>{});
  }
  function grantConsent(){try{localStorage.setItem(consentKey,'granted')}catch{};if(!granted){granted=true;send('page_view');schedulePerformance();}}
  function revokeConsent(){try{localStorage.removeItem(consentKey);localStorage.removeItem(visitorKey);sessionStorage.removeItem(sessionKey)}catch{};visitorId=null;granted=false;}
  function schedulePerformance(){if(sentPerformance)return;sentPerformance=true;const emit=()=>{const nav=performance.getEntriesByType('navigation')[0];const duration=nav?.duration||Math.max(0,performance.now()-started);send('performance',{duration_ms:Math.round(duration),lcp_ms:lcp,cls:Number(cls.toFixed(4)),inp_ms:inp});};if(document.readyState==='complete')setTimeout(emit,1500);else window.addEventListener('load',()=>setTimeout(emit,1500),{once:true});}
  try{new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)cls+=e.value;}).observe({type:'layout-shift',buffered:true});}catch{}
  try{new PerformanceObserver(list=>{const entries=list.getEntries();if(entries.length)lcp=entries[entries.length-1].startTime;}).observe({type:'largest-contentful-paint',buffered:true});}catch{}
  try{new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.interactionId)inp=Math.max(inp||0,e.duration);}).observe({type:'event',buffered:true,durationThreshold:40});}catch{}
  window.webcontrol=function(command,name,properties){
    if(command==='consent'&&name==='grant')return grantConsent();
    if(command==='consent'&&name==='revoke')return revokeConsent();
    if(command==='event'&&name){const clean={};if(properties&&typeof properties==='object')for(const [k,v] of Object.entries(properties).slice(0,12)){if(/email|name|phone|address|password|token|user.?id/i.test(k))continue;if(['string','number','boolean'].includes(typeof v))clean[safe(k,40)]=typeof v==='string'?safe(v,100):v;}return send('custom',{properties:clean,custom_name:safe(name,80)});}
  };
  window.addEventListener('error',e=>{send('error',{error_type:'javascript',error_message:safe(e.message||'Script error',500)});});
  window.addEventListener('unhandledrejection',e=>{const msg=e.reason?.message||e.reason||'Unhandled promise rejection';send('error',{error_type:'unhandledrejection',error_message:safe(msg,500)});});
  window.addEventListener('pagehide',()=>{if(granted)send('session_end',{duration_ms:Math.round(performance.now()-started)});});
  if(consentGranted())grantConsent();
  window.addEventListener('popstate',()=>{if(granted)send('page_view')});
  const originalPush=history.pushState;history.pushState=function(...args){const result=originalPush.apply(this,args);if(granted)send('page_view');return result;};
})();
