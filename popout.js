import { ATTRIBUTE_GROUPS } from "./extract.js";

const EXT_ID = "com.metalpig.land-of-eem";
const CHANNEL_NAME = `${EXT_ID}/popout`;
const app = document.querySelector("#app");
const tokenId = new URL(location.href).searchParams.get("token") || "";
const channel = new BroadcastChannel(CHANNEL_NAME);
let model = emptyModel();
let source = null;
let activeTab = "attributes";
let connected = false;
let statusText = "Connecting to Owlbear…";

function emptyModel() {
  return {
    name: "Unnamed adventurer", pronouns: "", className: "", folk: "", homeland: "", level: 1,
    attributes: { Vim: 0, Vigor: 0, Knack: 0, Knowhow: 0 },
    courageCurrent: 0, courageMax: 0, dread: "", attack: 0, defense: 0, questPoints: 0,
    block: 0, inventorySlots: 20, xp: 0,
    skills: {}, proficiencies: [], deficiencies: [], inventory: [], racialTraits: [], classPerks: [], abilities: [],
    ideals: "", flaws: "", backstory: "", personalQuest: "", relationships: "", ally: "", rival: "", secondRival: "", notes: ""
  };
}

function esc(v) { return String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function skillLabel(skill) { return skill[0].toUpperCase() + skill.slice(1); }

function attributeCards() {
  return ATTRIBUTE_GROUPS.map(group => {
    const skills = group.skills.map(skill => `
      <label class="skill-row"><span>${esc(skillLabel(skill))}</span><input data-skill="${esc(skill)}" type="number" min="-3" max="3" value="${esc(model.skills?.[skill] ?? 0)}"></label>`).join("");
    return `<section class="attribute-card"><div class="attribute-head"><strong>${esc(group.key.toUpperCase())}</strong><input data-attr="${esc(group.key)}" type="number" min="-3" max="3" value="${esc(model.attributes?.[group.key] ?? 0)}"></div><div class="attribute-skills">${skills}</div></section>`;
  }).join("");
}

function featureList(title, items, emptyText) {
  const rows = (items ?? []).map(item => `<li>${esc(item)}</li>`).join("");
  return `<section class="feature-panel"><h3>${esc(title)}</h3><ul class="feature-list">${rows || `<li class="empty">${esc(emptyText)}</li>`}</ul></section>`;
}

function inventoryRows() {
  return (model.inventory ?? []).map((item, i) => {
    const obj = typeof item === "string" ? { name:item, slots:0, worn:false, source:"" } : item;
    return `<tr>
      <td><input class="wear-check" data-inventory-worn="${i}" type="checkbox" ${obj.worn ? "checked" : ""}></td>
      <td><input class="inventory-name" data-inventory-name="${i}" value="${esc(obj.name)}"></td>
      <td><input class="inventory-slots" data-inventory-slots="${i}" type="number" min="0" value="${esc(obj.slots ?? 0)}"></td>
      <td class="source">${esc(obj.source ?? "")}</td>
    </tr>`;
  }).join("");
}

function renderTab() {
  if (activeTab === "inventory") {
    return `<section class="tab-page inventory-page">
      <div class="inventory-summary"><strong>INVENTORY</strong><span>Capacity ${esc(model.inventorySlots)} slots</span><span>Worn items are checked; unchecked items are carried.</span></div>
      <table class="inventory-table"><thead><tr><th>Worn</th><th>Item</th><th>Slots</th><th>Source</th></tr></thead><tbody>${inventoryRows()}</tbody></table>
      <button id="addInventoryBtn" class="smallBtn">+ Add item</button>
    </section>`;
  }
  if (activeTab === "background") {
    return `<section class="tab-page background-page">
      <div class="background-grid">
        <label>Ideals<textarea data-field="ideals">${esc(model.ideals)}</textarea></label>
        <label>Flaws<textarea data-field="flaws">${esc(model.flaws)}</textarea></label>
        <label>Personal Quest<textarea data-field="personalQuest">${esc(model.personalQuest)}</textarea></label>
        <label>Backstory<textarea data-field="backstory">${esc(model.backstory)}</textarea></label>
        <label class="wide">Relationships<textarea data-field="relationships">${esc(model.relationships)}</textarea></label>
        <label>Ally<input data-field="ally" value="${esc(model.ally)}"></label>
        <label>Rival<input data-field="rival" value="${esc(model.rival)}"></label>
        <label>Second Rival<input data-field="secondRival" value="${esc(model.secondRival)}"></label>
        <label class="wide">Notes<textarea data-field="notes">${esc(model.notes)}</textarea></label>
      </div>
    </section>`;
  }
  return `<section class="tab-page attributes-page">
    <div class="main-layout">
      <aside class="attribute-column">${attributeCards()}</aside>
      <section class="main-content">
        <section class="vitals card compact-vitals">
          <div class="stat courage"><span>COURAGE</span><div><input data-field="courageCurrent" type="number" value="${esc(model.courageCurrent)}"><em>/</em><input data-field="courageMax" type="number" value="${esc(model.courageMax)}"></div></div>
          <div class="stat"><span>DREAD</span><input data-field="dread" value="${esc(model.dread)}"></div>
          <div class="stat"><span>ATTACK</span><input data-field="attack" type="number" value="${esc(model.attack)}"></div>
          <div class="stat"><span>DEFENSE</span><input data-field="defense" type="number" value="${esc(model.defense)}"></div>
          <div class="stat"><span>QUEST PTS</span><input data-field="questPoints" type="number" value="${esc(model.questPoints)}"></div>
          <div class="stat"><span>BLOCK</span><input data-field="block" type="number" value="${esc(model.block)}"></div>
        </section>
        <div class="two-col-features">
          ${featureList("Proficiencies", model.proficiencies, "No proficiencies")}
          ${featureList("Deficiencies", model.deficiencies, "No deficiencies")}
        </div>
        ${featureList("Racial Traits", model.racialTraits, "No racial traits")}
        ${featureList("Class Perks", model.classPerks, "No class perks")}
        ${featureList("Abilities", model.abilities, "No abilities")}
      </section>
    </div>
  </section>`;
}

function render() {
  app.innerHTML = `<header>
    <div class="brand"><div class="mark">E</div><div><strong>LAND OF EEM</strong><span>POPPED-OUT CHARACTER SHEET</span></div></div>
    <div class="status">${esc(statusText)}</div>
  </header><main class="popout-main">
    <section class="identity hero-card">
      <div class="name-block"><label>Name & Pronouns<input data-field="name" value="${esc(model.name)}"></label><input class="pronouns" data-field="pronouns" value="${esc(model.pronouns)}" placeholder="Pronouns"></div>
      <div class="identity-pair"><label>Class<input data-field="className" value="${esc(model.className)}"></label><label>Folk<input data-field="folk" value="${esc(model.folk)}"></label><label>Homeland<input data-field="homeland" value="${esc(model.homeland)}"></label></div>
      <div class="level-chip"><span>LV</span><b>${esc(model.level)}</b><span>XP</span><input data-field="xp" type="number" value="${esc(model.xp)}"></div>
    </section>
    <nav class="tabs"><button data-tab="attributes" class="${activeTab === "attributes" ? "active" : ""}">Attributes</button><button data-tab="inventory" class="${activeTab === "inventory" ? "active" : ""}">Inventory</button><button data-tab="background" class="${activeTab === "background" ? "active" : ""}">Background</button></nav>
    ${renderTab()}
    <div class="popout-actions"><button id="saveBtn" ${connected ? "" : "disabled"}>Save Character</button><button id="reloadBtn" class="secondary">Reload from Owlbear</button></div>
  </main>`;
  bind();
}

function readForm() {
  document.querySelectorAll("[data-field]").forEach(el => { const key = el.dataset.field; model[key] = el.type === "number" ? (Number(el.value) || 0) : el.value; });
  document.querySelectorAll("[data-attr]").forEach(el => model.attributes[el.dataset.attr] = Number(el.value) || 0);
  document.querySelectorAll("[data-skill]").forEach(el => model.skills[el.dataset.skill] = Number(el.value) || 0);
  (model.inventory ?? []).forEach((item, i) => {
    if (typeof item === "string") model.inventory[i] = { name:item, slots:0, worn:false, source:"" };
    const name = document.querySelector(`[data-inventory-name="${i}"]`);
    const slots = document.querySelector(`[data-inventory-slots="${i}"]`);
    const worn = document.querySelector(`[data-inventory-worn="${i}"]`);
    if (name) model.inventory[i].name = name.value;
    if (slots) model.inventory[i].slots = Number(slots.value) || 0;
    if (worn) model.inventory[i].worn = worn.checked;
  });
}

function request(type, extra = {}, timeout = 5000) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { channel.removeEventListener("message", handler); reject(new Error("Owlbear connection timed out.")); }, timeout);
    const handler = event => {
      const msg = event.data ?? {};
      if (msg.requestId !== requestId || msg.type !== `${type}-result`) return;
      clearTimeout(timer); channel.removeEventListener("message", handler); resolve(msg);
    };
    channel.addEventListener("message", handler);
    channel.postMessage({ type, requestId, tokenId, ...extra });
  });
}

async function loadCharacter() {
  if (!tokenId) { connected = false; statusText = "No character token was supplied."; render(); return; }
  statusText = "Loading character from Owlbear…"; render();
  try {
    const result = await request("load");
    if (!result.ok || !result.payload?.sheet) throw new Error("No Land of Eem character is saved on that token.");
    source = result.payload.source ?? null;
    model = { ...emptyModel(), ...result.payload.sheet };
    model.attributes = { ...emptyModel().attributes, ...(result.payload.sheet.attributes ?? {}) };
    connected = true;
    statusText = "Connected to Owlbear. You can keep this window beside the dice roller.";
    render();
  } catch (error) {
    connected = false; statusText = String(error?.message ?? error); render();
  }
}

async function saveCharacter() {
  readForm();
  if (!connected) return;
  statusText = "Saving to Owlbear…"; render();
  const payload = { version: 4, updatedAt: new Date().toISOString(), sheet: model, source };
  try {
    const result = await request("save", { payload });
    if (!result.ok) throw new Error(result.error || "Could not save to Owlbear.");
    statusText = `Saved ${model.name || "character"} to the token.`; render();
  } catch (error) { statusText = String(error?.message ?? error); render(); }
}

function bind() {
  document.querySelector("#saveBtn")?.addEventListener("click", saveCharacter);
  document.querySelector("#reloadBtn")?.addEventListener("click", loadCharacter);
  document.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", () => { readForm(); activeTab = btn.dataset.tab; render(); }));
  document.querySelector("#addInventoryBtn")?.addEventListener("click", () => { readForm(); model.inventory.push({name:"New item",slots:0,worn:false,source:"Manual"}); render(); });
}

window.addEventListener("beforeunload", () => channel.close());
render();
loadCharacter();
