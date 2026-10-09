import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
const ID="com.metalpig.land-of-eem/roll-card";
const p=new URLSearchParams(location.search);
const text=p.get("text")||"Roll received";
const name=p.get("name")||"Adventurer";
const rows=text.split(/\r?\n/).filter(Boolean);
const attack=rows.some(x=>/^Attack:/i.test(x));
const result=rows[rows.length-1]||"";
const isCritical=/critical|complete success/i.test(result);
const isFailure=/failure|miss/i.test(result);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const storageKey="eem-roll-card-history";
let history=[];
try{history=JSON.parse(localStorage.getItem(storageKey)||"[]");if(!Array.isArray(history))history=[];}catch{}
if(!history.some(h=>h.id===p.get("id"))){history.unshift({id:p.get("id"),name,text,at:Date.now()});history=history.slice(0,30);try{localStorage.setItem(storageKey,JSON.stringify(history))}catch{}}
const details=rows.slice(1,-1);
const html=details.map(line=>{const m=line.match(/^([^:]+):\s*([^\[]+)(\[.*\])?$/);return m?`<div class="rollline"><span>${escape(m[1])}</span><b>${escape(m[2].trim())}</b></div>${m[3]?`<div class="math">${escape(m[3])}</div>`:""}`:`<div class="math">${escape(line)}</div>`}).join("");
const SETTINGS_KEY = "eem-roll-card-settings-v1";
const validDurations = [3,5,7,10,15,0];
const settings = (() => {
  try { const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { position: ["top","left","right"].includes(v.position) ? v.position : "top", duration: validDurations.includes(Number(v.duration)) ? Number(v.duration) : 5 };
  } catch { return { position: "top", duration: 5 }; }
})();
const durationText = n => n === 0 ? "Stays until closed" : `Dismisses after ${n} seconds`;
const positionOptions = [["top","Top center"],["left","Middle left"],["right","Middle right"]];
document.querySelector("#rollCard").innerHTML=`<div class="top"><span class="emblem">E</span><div class="brand"><strong>LAND OF EEM</strong><div class="sub">${escape(rows[0]||name)} · ${attack?"Attack":"Check"}</div></div><div class="actions"><button id="settingsToggle" title="Roll card settings" aria-label="Roll card settings" aria-expanded="false">⚙</button><button id="pin" title="Keep card open" aria-label="Pin roll card">♧</button><button id="close" title="Close" aria-label="Close roll card">×</button></div></div><div class="divider"></div><section class="settings-panel hidden" id="settingsPanel" aria-label="Roll card settings"><label>Card position<select id="positionSetting">${positionOptions.map(([v,label])=>`<option value="${v}" ${settings.position===v?"selected":""}>${label}</option>`).join("")}</select></label><label>Display time<select id="durationSetting">${validDurations.map(v=>`<option value="${v}" ${settings.duration===v?"selected":""}>${v===0?"Until closed":v+" seconds"}</option>`).join("")}</select></label><div class="settings-note">Saved for this browser. Position applies on the next roll.</div></section>${html}<div class="result ${isCritical?"critical":isFailure?"failure":""}">${escape(result)}</div><details class="history"><summary>Roll history (${history.length})</summary>${history.map(h=>`<div class="history-item"><b>${escape(h.name)}</b><br>${escape(h.text)}</div>`).join("")}</details><div class="muted" id="hint">${durationText(settings.duration)} · Pin to keep open</div>`;
let pinned=false;
let dismissTimer;
const close=async()=>{try{await OBR.popover.close(ID)}catch{}};
const scheduleDismiss = () => {
  clearTimeout(dismissTimer);
  if (settings.duration === 0 || pinned) return;
  dismissTimer = setTimeout(() => {
    if (!pinned && !document.querySelector(".history")?.open && document.querySelector("#settingsPanel")?.classList.contains("hidden")) close();
  }, settings.duration * 1000);
};
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} };
document.querySelector("#close").addEventListener("click",close);
document.querySelector("#pin").addEventListener("click",()=>{pinned=!pinned;document.querySelector("#pin").textContent=pinned?"◆":"♧";document.querySelector("#hint").textContent=pinned?"Pinned · close with ×":`${durationText(settings.duration)} · Pin to keep open`;scheduleDismiss();});
document.querySelector("#settingsToggle").addEventListener("click",()=>{
  const panel=document.querySelector("#settingsPanel");panel.classList.toggle("hidden");
  document.querySelector("#settingsToggle").setAttribute("aria-expanded",String(!panel.classList.contains("hidden")));
  scheduleDismiss();
});
document.querySelector("#positionSetting").addEventListener("change",e=>{settings.position=e.target.value;saveSettings();});
document.querySelector("#durationSetting").addEventListener("change",e=>{settings.duration=Number(e.target.value);saveSettings();document.querySelector("#hint").textContent=durationText(settings.duration)+" · Pin to keep open";scheduleDismiss();});
document.querySelector(".history").addEventListener("toggle",scheduleDismiss);
scheduleDismiss();
