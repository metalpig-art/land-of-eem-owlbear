// GM-only encounter tracker. Data is saved to the GM player's metadata, not to scene items.
export function createGMPanel(OBR, channel, namespace) {
  const key = `${namespace}/gm-encounter-v1`;
  let adversaries = [];
  let lastRoll = null;
  let draft = null;
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = (v, fallback=0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const sign = v => n(v)<0 ? `- ${Math.abs(n(v))}` : `+ ${n(v)}`;
  const id = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  async function load() {
    const meta = await OBR.player.getMetadata();
    adversaries = Array.isArray(meta?.[key]) ? meta[key].map(x=>({...x})) : [];
  }
  async function persist() { await OBR.player.setMetadata({[key]:adversaries}); }
  function render() {
    return `<section class="gm-page"><div class="gm-toolbar"><div><h2>GM Encounter Tracker</h2><small>Private to the GM · saved to your Owlbear player profile</small></div><button id="gmAdd" type="button">+ Add adversary</button></div>
    ${adversaries.length ? adversaries.map(a=>`<article class="gm-adversary" data-gm-id="${esc(a.id)}"><div class="gm-adversary-title"><input aria-label="Adversary name" data-gm-field="name" value="${esc(a.name)}"><button type="button" class="gm-trash" data-gm-delete="${esc(a.id)}" title="Delete adversary" aria-label="Delete ${esc(a.name)}">🗑</button></div><div class="gm-fields"><label>Courage current<input data-gm-field="current" type="number" min="0" value="${n(a.current)}"></label><label>Maximum<input data-gm-field="max" type="number" min="0" value="${n(a.max)}"></label><label>Attack bonus<input data-gm-field="attack" type="number" value="${n(a.attack)}"></label><label>Dread die<select data-gm-field="dread">${[4,6,8,10,12,20].map(d=>`<option value="d${d}" ${a.dread===`d${d}`?'selected':''}>d${d}</option>`).join('')}</select></label><label>Flat Dread<input data-gm-field="bonus" type="number" value="${n(a.bonus)}"></label><label>Defense<input data-gm-field="defense" type="number" value="${n(a.defense)}"></label></div><div class="gm-actions"><button type="button" data-gm-attack="${esc(a.id)}">⚔ Attack</button><button type="button" class="secondary" data-gm-counter="${esc(a.id)}">↩ Counterattack</button><button type="button" class="secondary" data-gm-damage="${esc(a.id)}">− Courage</button><button type="button" class="secondary" data-gm-heal="${esc(a.id)}">+ Courage</button></div></article>`).join('') : '<p class="gm-empty">No adversaries yet. Use + Add adversary to start an encounter.</p>'}
    ${draft ? `<div class="gm-dialog-backdrop"><section class="gm-dialog" role="dialog" aria-modal="true"><div class="gm-dialog-title"><strong>${esc(draft.counter?'Counterattack':'Attack')} — ${esc(draft.name)}</strong><button id="gmCancel" type="button" aria-label="Close">×</button></div><label>Target Defense<input id="gmTargetDefense" type="number" value="${n(draft.defense)}"></label><label>Attack type<select id="gmAttackType"><option value="melee">Melee</option><option value="ranged">Ranged</option></select></label><div class="gm-roll-modes"><button type="button" data-gm-mode="normal">Normal</button><button type="button" data-gm-mode="advantage">Advantage</button><button type="button" data-gm-mode="disadvantage">Disadvantage</button></div></section></div>` : ''}
    ${lastRoll ? `<div class="gm-last-roll" role="status"><button id="gmClearResult" type="button" aria-label="Dismiss result">×</button>${esc(lastRoll).replace(/\n/g,'<br>')}</div>` : ''}</section>`;
  }
  const rollDie = sides => 1 + Math.floor(Math.random()*sides);
  async function roll(mode) {
    const a = adversaries.find(x=>x.id===draft?.id); if(!a) return;
    const target = n(document.querySelector('#gmTargetDefense')?.value);
    const type = document.querySelector('#gmAttackType')?.value || 'melee';
    const dice = [rollDie(12)]; if(mode!=='normal') dice.push(rollDie(12));
    const chosen = mode==='advantage'?Math.max(...dice):mode==='disadvantage'?Math.min(...dice):dice[0];
    const total = chosen+n(a.attack)+target;
    const outcome = total<=2?'Critical Miss':total<=5?'Miss with a Plus':total<=8?(type==='ranged'?'Grazing Shot':'Hit with a Counterattack'):total<=11?'Hit':'Critical Hit';
    const sides = n(String(a.dread).replace('d',''),6);
    const die = rollDie(sides);
    const dread = outcome==='Grazing Shot'?1:outcome==='Critical Hit'?die*2+n(a.bonus):['Hit','Hit with a Counterattack'].includes(outcome)?die+n(a.bonus):0;
    const diceMath = dice.length>1?`(${dice.join(', ')} → ${chosen})`:`(${chosen})`;
    const text = `${a.name} — GM ${draft.counter?'Counterattack':'Attack'}\nAttack: ${total}  [${diceMath} ${sign(a.attack)} ${sign(target)} (Defense)]\nDread: ${dread} Dread  [${outcome==='Critical Hit'?'2 × ':''}(${die}) ${sign(a.bonus)}]\n${outcome}${dread>0?` for ${dread} Dread!`:''}`;
    lastRoll=text; draft=null;
    try { await OBR.broadcast.sendMessage(channel,{type:'roll-result',text,id:id()},{destination:'REMOTE'}); } catch(e){ console.warn('GM broadcast failed',e); }
    refresh();
  }
  let refresh = ()=>{};
  function mount(root,rerender) {
    refresh=rerender;
    root.querySelector('#gmAdd')?.addEventListener('click',async()=>{adversaries.push({id:id(),name:'New adversary',current:10,max:10,attack:0,defense:0,dread:'d6',bonus:0});await persist();refresh();});
    root.querySelectorAll('[data-gm-field]').forEach(el=>el.addEventListener('change',async()=>{const a=adversaries.find(x=>x.id===el.closest('[data-gm-id]')?.dataset.gmId);if(!a)return;const field=el.dataset.gmField;a[field]=['name','dread'].includes(field)?el.value:n(el.value);if(field==='max'&&a.current>a.max)a.current=a.max;await persist();refresh();}));
    root.querySelectorAll('[data-gm-delete]').forEach(el=>el.addEventListener('click',async()=>{const a=adversaries.find(x=>x.id===el.dataset.gmDelete);if(!a||!confirm(`Delete ${a.name}?`))return;adversaries=adversaries.filter(x=>x!==a);await persist();refresh();}));
    for(const [attr,counter] of [['data-gm-attack',false],['data-gm-counter',true]])root.querySelectorAll(`[${attr}]`).forEach(el=>el.addEventListener('click',()=>{const a=adversaries.find(x=>x.id===el.getAttribute(attr));if(!a)return;draft={id:a.id,name:a.name,defense:0,counter};refresh();}));
    for(const [attr,dir] of [['data-gm-damage',-1],['data-gm-heal',1]])root.querySelectorAll(`[${attr}]`).forEach(el=>el.addEventListener('click',async()=>{const a=adversaries.find(x=>x.id===el.getAttribute(attr));if(!a)return;const input=prompt(dir<0?`Dread suffered by ${a.name}:`:`Courage restored to ${a.name}:`,'1');if(input===null)return;const amount=n(input,NaN);if(!Number.isFinite(amount)||amount<0)return;a.current=Math.max(0,Math.min(n(a.max),n(a.current)+dir*amount));await persist();refresh();}));
    root.querySelector('#gmCancel')?.addEventListener('click',()=>{draft=null;refresh();});
    root.querySelectorAll('[data-gm-mode]').forEach(el=>el.addEventListener('click',()=>roll(el.dataset.gmMode)));
    root.querySelector('#gmClearResult')?.addEventListener('click',()=>{lastRoll=null;refresh();});
  }
  return {load,render,mount};
}
