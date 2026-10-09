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
document.querySelector("#rollCard").innerHTML=`<div class="top"><span class="emblem">E</span><div class="brand"><strong>LAND OF EEM</strong><div class="sub">${escape(rows[0]||name)} · ${attack?"Attack":"Check"}</div></div><div class="actions"><button id="pin" title="Keep card open" aria-label="Pin roll card">♧</button><button id="close" title="Close" aria-label="Close roll card">×</button></div></div><div class="divider"></div>${html}<div class="result ${isCritical?"critical":isFailure?"failure":""}">${escape(result)}</div><details class="history"><summary>Roll history (${history.length})</summary>${history.map(h=>`<div class="history-item"><b>${escape(h.name)}</b><br>${escape(h.text)}</div>`).join("")}</details><div class="muted" id="hint">Dismisses after 10 seconds · Pin to keep open</div>`;
let pinned=false;
const close=async()=>{try{await OBR.popover.close(ID)}catch{}};
document.querySelector("#close").addEventListener("click",close);
document.querySelector("#pin").addEventListener("click",()=>{pinned=!pinned;document.querySelector("#pin").textContent=pinned?"◆":"♧";document.querySelector("#hint").textContent=pinned?"Pinned · close with ×":"Dismisses after 10 seconds · Pin to keep open";});
setTimeout(()=>{if(!pinned&&!document.querySelector(".history")?.open)close()},10000);
