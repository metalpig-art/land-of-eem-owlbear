import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
import { extractCharacter, ATTRIBUTE_GROUPS } from "./extract.js";

const EXT_ID = "com.metalpig.land-of-eem";
const META_KEY = `${EXT_ID}/character`;
const OPEN_TOKEN_KEY = `${EXT_ID}/open-token`;
const app = document.querySelector("#app");
let sceneItems = [];
let selectedTokenId = "";
let currentRaw = null;
let activeTab = "attributes";
let model = emptyModel();

function emptyModel() {
  return {
    name: "Unnamed adventurer", pronouns: "", className: "", folk: "", homeland: "", level: 1,
    attributes: { Vim: 0, Vigor: 0, Knack: 0, Knowhow: 0 },
    courageCurrent: 0, courageMax: 0, dread: "", attack: 0, defense: 0, questPoints: 0,
    block: 0, inventorySlots: 20, xp: 0,
    skills: {}, proficiencies: [], deficiencies: [], inventory: [], magnificentItems: [], racialTraits: [], classPerks: [], abilities: [],
    ideals: "", flaws: "", backstory: "", personalQuest: "", relationships: "", ally: "", rival: "", secondRival: "", notes: ""
  };
}

function esc(v) { return String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function listText(v) { return Array.isArray(v) ? v.join("\n") : String(v ?? ""); }
function parseList(v) { return String(v ?? "").split(/\r?\n/).map(s => s.trim()).filter(Boolean); }
function tokenName(item) { return item?.text?.plainText || item?.name || item?.id || "Character token"; }
function characterTokens(items) { return items.filter(item => item.layer === "CHARACTER"); }
function skillLabel(skill) { return skill[0].toUpperCase() + skill.slice(1); }
function signed(v) { const n = Number(v)||0; return n > 0 ? `+${n}` : String(n); }

function normalizeModelSheet(sheet = {}) {
  const base = emptyModel();
  const next = { ...base, ...sheet };
  next.attributes = { ...base.attributes, ...(sheet.attributes ?? {}) };
  next.skills = { ...(sheet.skills ?? {}) };
  next.inventory = Array.isArray(sheet.inventory) ? [...sheet.inventory] : [];
  next.magnificentItems = Array.isArray(sheet.magnificentItems) ? [...sheet.magnificentItems] : [];
  const keep = [];
  for (const raw of next.inventory) {
    const item = typeof raw === "string" ? { name: raw, slots: 0, worn: false, source: "" } : { ...raw };
    if ((item.traits?.length ?? 0) > 0 || /^Magnificent\b/i.test(String(item.name ?? ""))) next.magnificentItems.push({ ...item, magnificent: true, traits: Array.isArray(item.traits) ? item.traits : [], classGranted: Boolean(item.classGranted) });
    else keep.push(item);
  }
  next.inventory = keep;
  next.magnificentItems = next.magnificentItems.map(item => ({ ...item, magnificent: true, traits: Array.isArray(item.traits) ? item.traits : [], classGranted: Boolean(item.classGranted) }));
  return next;
}

function magnificentPerkText(item) {
  const details = (item?.traits ?? []).map(trait => `  - ${trait?.name || "[trait]"}${trait?.text ? ` ${trait.text}` : ""}`);
  return [item?.name || "Magnificent Item", ...details].join("\n");
}

function displayedClassPerks() {
  const base = [...(model.classPerks ?? [])].filter(text => !/^Magnificent\b/i.test(String(text).trim()));
  const granted = (model.magnificentItems ?? []).filter(item => item.classGranted).map(magnificentPerkText);
  return [...granted, ...base];
}

function attributeCards() {
  return ATTRIBUTE_GROUPS.map(group => {
    const skills = group.skills.map(skill => `
      <label class="skill-row"><span>${esc(skillLabel(skill))}</span><input data-skill="${esc(skill)}" type="number" min="-3" max="3" value="${esc(model.skills?.[skill] ?? 0)}"></label>`).join("");
    return `<section class="attribute-card"><div class="attribute-head"><strong>${esc(group.key.toUpperCase())}</strong><input data-attr="${esc(group.key)}" type="number" min="-3" max="3" value="${esc(model.attributes?.[group.key] ?? 0)}"></div><div class="attribute-skills">${skills}</div></section>`;
  }).join("");
}

function featureList(title, items, field, emptyText) {
  const rows = (items ?? []).map(item => `<li>${esc(item)}</li>`).join("");
  return `<section class="feature-panel"><h3>${esc(title)}</h3><ul class="feature-list" data-feature="${esc(field)}">${rows || `<li class="empty">${esc(emptyText)}</li>`}</ul></section>`;
}

function trashIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-1 11H8L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/></svg>`;
}

function inventoryRows() {
  const normalRows = (model.inventory ?? []).map((item, i) => {
    const obj = typeof item === "string" ? { name:item, slots:0, worn:false, source:"" } : item;
    return `<tr><td><input class="wear-check" data-inventory-worn="${i}" type="checkbox" ${obj.worn ? "checked" : ""}></td><td><div class="item-name-row"><input class="inventory-name" data-inventory-name="${i}" value="${esc(obj.name)}"><button class="trashBtn" data-delete-inventory="${i}" type="button" title="Delete item" aria-label="Delete ${esc(obj.name || "item")}">${trashIcon()}</button></div></td><td><input class="inventory-slots" data-inventory-slots="${i}" type="number" min="0" value="${esc(obj.slots ?? 0)}"></td><td class="source">${esc(obj.source ?? "")}</td></tr>`;
  }).join("");
  const magnificentRows = (model.magnificentItems ?? []).map((item, i) => {
    const traits = (item.traits ?? []).map((trait, j) => `<div class="trait-edit"><input data-mag-trait-name="${i}:${j}" value="${esc(trait.name ?? "")}" placeholder="[trait]"><input data-mag-trait-text="${i}:${j}" value="${esc(trait.text ?? "")}" placeholder="Trait description"><button class="trashBtn traitTrashBtn" data-delete-trait="${i}:${j}" type="button" title="Remove trait" aria-label="Remove trait ${esc(trait.name || "trait")}">${trashIcon()}</button></div>`).join("");
    return `<tr class="magnificent-row"><td><input class="wear-check" data-mag-worn="${i}" type="checkbox" ${item.worn ? "checked" : ""}></td><td><div class="item-name-row"><input class="inventory-name" data-mag-name="${i}" value="${esc(item.name ?? "Magnificent Item")}"><button class="trashBtn" data-delete-magnificent="${i}" type="button" title="Delete item" aria-label="Delete ${esc(item.name || "Magnificent item")}">${trashIcon()}</button></div></td><td><input class="inventory-slots" data-mag-slots="${i}" type="number" min="0" value="${esc(item.slots ?? 0)}"></td><td class="source">${esc(item.source ?? "Acquired")}${item.classGranted ? " · Class perk" : ""}</td></tr><tr class="magnificent-detail"><td></td><td colspan="3"><div class="mag-meta"><input data-mag-type="${i}" value="${esc(item.type ?? "")}" placeholder="Type"><input data-mag-cost="${i}" value="${esc(item.cost ?? "")}" placeholder="Cost"></div>${traits}<button class="tinyBtn addTraitBtn" data-add-trait="${i}" type="button">+ Trait</button></td></tr>`;
  }).join("");
  return normalRows + magnificentRows;
}

function renderTab() {
  if (activeTab === "inventory") {
    return `<section class="tab-page inventory-page">
      <div class="inventory-summary"><strong>INVENTORY</strong><span>Capacity ${esc(model.inventorySlots)} slots</span><span>Worn items are checked; unchecked items are carried.</span></div>
      <table class="inventory-table"><thead><tr><th>Worn</th><th>Item</th><th>Slots</th><th>Source</th></tr></thead><tbody>${inventoryRows()}</tbody></table>
      <div class="inventory-buttons"><button id="addInventoryBtn" class="smallBtn">+ Add item</button><button id="addMagnificentBtn" class="smallBtn secondary">+ Add Magnificent item</button></div>
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
          ${featureList("Proficiencies", model.proficiencies, "proficiencies", "No proficiencies")}
          ${featureList("Deficiencies", model.deficiencies, "deficiencies", "No deficiencies")}
        </div>
        ${featureList("Racial Traits", model.racialTraits, "racialTraits", "No racial traits")}
        ${featureList("Class Perks", displayedClassPerks(), "classPerks", "No class perks")}
        ${featureList("Abilities", model.abilities, "abilities", "No abilities")}
      </section>
    </div>
  </section>`;
}

function render(message = "") {
  const tokens = characterTokens(sceneItems);
  const tokenOptions = tokens.map(t => `<option value="${esc(t.id)}" ${t.id === selectedTokenId ? "selected" : ""}>${esc(tokenName(t))}</option>`).join("");
  app.innerHTML = `<header>
    <div class="brand"><div class="mark">E</div><div><strong>LAND OF EEM</strong><span>OWLBEAR CHARACTER SHEET</span></div></div>
    <div id="status" class="status">${esc(message)}</div>
  </header><main>
    <section class="utility-row">
      <div class="token-tools"><select id="tokenSelect"><option value="">Choose a Character token…</option>${tokenOptions}</select><button id="refreshBtn" class="secondary">Refresh</button></div>
      <label class="fileBtn">Import .eem.json<input id="fileInput" type="file" accept=".json,.eem.json,application/json"></label>
    </section>
    <section class="identity hero-card">
      <div class="name-block"><label>Name & Pronouns<input data-field="name" value="${esc(model.name)}"></label><input class="pronouns" data-field="pronouns" value="${esc(model.pronouns)}" placeholder="Pronouns"></div>
      <div class="identity-pair"><label>Class<input data-field="className" value="${esc(model.className)}"></label><label>Folk<input data-field="folk" value="${esc(model.folk)}"></label><label>Homeland<input data-field="homeland" value="${esc(model.homeland)}"></label></div>
      <div class="level-chip"><span>LV</span><b>${esc(model.level)}</b><span>XP</span><input data-field="xp" type="number" value="${esc(model.xp)}"></div>
    </section>
    <nav class="tabs"><button data-tab="attributes" class="${activeTab === "attributes" ? "active" : ""}">Attributes</button><button data-tab="inventory" class="${activeTab === "inventory" ? "active" : ""}">Inventory</button><button data-tab="background" class="${activeTab === "background" ? "active" : ""}">Background</button></nav>
    ${renderTab()}
    <div class="actions"><button id="saveBtn">Save to token</button><button id="popOutBtn" class="secondary">Pop Out ↗</button><button id="exportBtn" class="secondary">Export .eem.json</button></div>
  </main>`;
  bind();
}

function readForm() {
  document.querySelectorAll("[data-field]").forEach(el => { const key = el.dataset.field; model[key] = el.type === "number" ? (Number(el.value) || 0) : el.value; });
  document.querySelectorAll("[data-attr]").forEach(el => model.attributes[el.dataset.attr] = Number(el.value) || 0);
  document.querySelectorAll("[data-skill]").forEach(el => model.skills[el.dataset.skill] = Number(el.value) || 0);
  document.querySelectorAll("[data-list]").forEach(el => model[el.dataset.list] = parseList(el.value));
  (model.inventory ?? []).forEach((item, i) => {
    if (typeof item === "string") model.inventory[i] = { name:item, slots:0, worn:false, source:"" };
    const name = document.querySelector(`[data-inventory-name="${i}"]`), slots = document.querySelector(`[data-inventory-slots="${i}"]`), worn = document.querySelector(`[data-inventory-worn="${i}"]`);
    if (name) model.inventory[i].name = name.value;
    if (slots) model.inventory[i].slots = Number(slots.value) || 0;
    if (worn) model.inventory[i].worn = worn.checked;
  });
  (model.magnificentItems ?? []).forEach((item, i) => {
    const name = document.querySelector(`[data-mag-name="${i}"]`), slots = document.querySelector(`[data-mag-slots="${i}"]`), worn = document.querySelector(`[data-mag-worn="${i}"]`), type = document.querySelector(`[data-mag-type="${i}"]`), cost = document.querySelector(`[data-mag-cost="${i}"]`);
    if (name) item.name = name.value;
    if (slots) item.slots = Number(slots.value) || 0;
    if (worn) item.worn = worn.checked;
    if (type) item.type = type.value;
    if (cost) item.cost = cost.value;
    const traitInputs = [...document.querySelectorAll(`[data-mag-trait-name^="${i}:"]`)];
    if (traitInputs.length) item.traits = traitInputs.map(input => { const key = input.dataset.magTraitName; const text = document.querySelector(`[data-mag-trait-text="${key}"]`); return { name: input.value.trim(), text: text?.value.trim() ?? "" }; }).filter(trait => trait.name || trait.text);
  });
}

async function refreshItems(preserveSelection = true) {
  const ready = await OBR.scene.isReady();
  if (!ready) { sceneItems = []; selectedTokenId = ""; render("Open a scene to use token sheets."); return; }
  const old = selectedTokenId;
  sceneItems = await OBR.scene.items.getItems();
  if (!preserveSelection || !sceneItems.some(i => i.id === old)) selectedTokenId = "";
  render();
}

async function loadFromToken(id) {
  readForm();
  selectedTokenId = id;
  const item = sceneItems.find(i => i.id === id);
  const stored = item?.metadata?.[META_KEY];
  if (stored && typeof stored === "object") {
    currentRaw = stored.source ?? null;
    model = normalizeModelSheet(stored.sheet ?? {});
    render("Loaded from token.");
  } else { currentRaw = null; model = emptyModel(); render(id ? "No Land of Eem sheet on this token yet." : ""); }
}

async function saveToToken() {
  readForm();
  if (!selectedTokenId) { render("Choose a Character-layer token first."); return; }
  const payload = { version: 6, updatedAt: new Date().toISOString(), sheet: model, source: currentRaw };
  await OBR.scene.items.updateItems([selectedTokenId], items => { for (const item of items) item.metadata[META_KEY] = payload; });
  await OBR.notification.show(`Saved ${model.name || "character"} to token`);
  render("Saved to Owlbear token.");
}

function downloadJson() {
  readForm();
  const output = currentRaw && typeof currentRaw === "object" ? structuredClone(currentRaw) : { character: {} };
  output.owlbear = { version: 6, sheet: model };
  const blob = new Blob([JSON.stringify(output, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${(model.name || "Land-of-Eem-character").replace(/[^a-z0-9_-]+/gi, "-")}.eem.json`; a.click(); URL.revokeObjectURL(a.href);
}

window.addEventListener("message", async event => {
  if (event.origin !== location.origin) return;
  const msg = event.data ?? {};
  if (msg.source !== EXT_ID || !msg.requestId) return;
  try {
    if (msg.type === "popout-load") {
      const item = sceneItems.find(i => i.id === msg.tokenId);
      const payload = item?.metadata?.[META_KEY] ?? null;
      event.source?.postMessage({ source: EXT_ID, requestId: msg.requestId, type: "popout-load-result", ok: !!payload?.sheet, payload }, event.origin);
    } else if (msg.type === "popout-save") {
      await OBR.scene.items.updateItems([msg.tokenId], items => {
        for (const item of items) item.metadata[META_KEY] = msg.payload;
      });
      event.source?.postMessage({ source: EXT_ID, requestId: msg.requestId, type: "popout-save-result", ok: true }, event.origin);
    }
  } catch (error) {
    event.source?.postMessage({ source: EXT_ID, requestId: msg.requestId, type: `${msg.type}-result`, ok: false, error: String(error?.message ?? error) }, event.origin);
  }
});

function popOutCharacter() {
  readForm();
  if (!selectedTokenId) { render("Choose a Character token first, then save it before popping out."); return; }
  const item = sceneItems.find(i => i.id === selectedTokenId);
  const stored = item?.metadata?.[META_KEY];
  if (!stored?.sheet) { render("Save this character to the token before popping it out."); return; }
  const url = new URL("./popout.html", window.location.href);
  url.searchParams.set("token", selectedTokenId);
  const popupName = `land-of-eem-${selectedTokenId}`;
  const win = window.open(url.href, popupName, "popup=yes,width=760,height=900,resizable=yes,scrollbars=yes");
  if (!win) render("Your browser blocked the pop-out window. Allow pop-ups for this site and try again.");
}

function bind() {
  document.querySelector("#refreshBtn")?.addEventListener("click", () => refreshItems());
  document.querySelector("#tokenSelect")?.addEventListener("change", e => loadFromToken(e.target.value));
  document.querySelector("#saveBtn")?.addEventListener("click", saveToToken);
  document.querySelector("#popOutBtn")?.addEventListener("click", popOutCharacter);
  document.querySelector("#exportBtn")?.addEventListener("click", downloadJson);
  document.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", () => { readForm(); activeTab = btn.dataset.tab; render(); }));
  document.querySelector("#addInventoryBtn")?.addEventListener("click", () => { readForm(); model.inventory.push({name:"New item",slots:0,worn:false,type:"",cost:"",source:"Manual"}); render(); });
  document.querySelector("#addMagnificentBtn")?.addEventListener("click", () => { readForm(); model.magnificentItems.push({name:"Magnificent Item",slots:0,worn:false,type:"",cost:"",source:"Acquired",magnificent:true,classGranted:false,traits:[{name:"[trait]",text:"Trait description"}]}); render(); });
  document.querySelectorAll("[data-add-trait]").forEach(btn => btn.addEventListener("click", () => { readForm(); const i = Number(btn.dataset.addTrait); model.magnificentItems[i]?.traits.push({name:"[trait]",text:"Trait description"}); render(); }));
  document.querySelectorAll("[data-delete-inventory]").forEach(btn => btn.addEventListener("click", () => { readForm(); const i = Number(btn.dataset.deleteInventory); const item = model.inventory[i]; const name = typeof item === "string" ? item : item?.name || "this item"; if (window.confirm(`Delete ${name}?`)) { model.inventory.splice(i, 1); render(); } }));
  document.querySelectorAll("[data-delete-magnificent]").forEach(btn => btn.addEventListener("click", () => { readForm(); const i = Number(btn.dataset.deleteMagnificent); const name = model.magnificentItems[i]?.name || "this Magnificent item"; if (window.confirm(`Delete ${name}?`)) { model.magnificentItems.splice(i, 1); render(); } }));
  document.querySelectorAll("[data-delete-trait]").forEach(btn => btn.addEventListener("click", () => { readForm(); const [i, j] = btn.dataset.deleteTrait.split(":").map(Number); model.magnificentItems[i]?.traits?.splice(j, 1); render(); }));
  document.querySelector("#fileInput")?.addEventListener("change", async e => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      currentRaw = JSON.parse(await file.text());
      model = normalizeModelSheet(extractCharacter(currentRaw));
      if (currentRaw?.owlbear?.sheet) {
        model = normalizeModelSheet({ ...model, ...currentRaw.owlbear.sheet });
      }
      activeTab = "attributes";
      render(`Imported ${file.name}. Choose a token and save.`);
    } catch { render("That file is not valid JSON."); }
  });
}

function start() {
  render("Connecting to Owlbear Rodeo…");
  OBR.onReady(async () => {
    await OBR.action.setWidth(640);
    await OBR.action.setHeight(780);
    await refreshItems(false);

    // If the sheet was opened from the token context menu, load that token immediately.
    const playerMetadata = await OBR.player.getMetadata();
    const requestedTokenId = playerMetadata?.[OPEN_TOKEN_KEY];
    if (requestedTokenId && sceneItems.some(i => i.id === requestedTokenId)) {
      await loadFromToken(requestedTokenId);
    }

    // Keep an already-open sheet in sync with future context-menu opens.
    OBR.player.onChange(async player => {
      const nextTokenId = player?.metadata?.[OPEN_TOKEN_KEY];
      if (nextTokenId && nextTokenId !== selectedTokenId && sceneItems.some(i => i.id === nextTokenId)) {
        await loadFromToken(nextTokenId);
      }
    });

    OBR.scene.items.onChange(items => {
      sceneItems = items;
      const selected = sceneItems.find(i => i.id === selectedTokenId);
      const stored = selected?.metadata?.[META_KEY];
      if (stored?.sheet) { model = normalizeModelSheet(stored.sheet); }
      render();
    });
    OBR.scene.onReadyChange(() => refreshItems(false));
  });
}

if (!OBR.isAvailable) render("This page is meant to run inside Owlbear Rodeo."); else start();
