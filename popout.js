import { ITEMS, TRAITS, traitGroup, specialRules, armorRuleTexts } from "./item-catalog.js";
import { ATTRIBUTE_GROUPS } from "./extract.js";
import { recalculateEquipmentStats, signedNumber, isWeaponItem, weaponRuleTexts, weaponUseDescription } from "./equipment.js";

const EXT_ID = "com.metalpig.land-of-eem";
const ROLL_CHANNEL = `${EXT_ID}/roll`;
const app = document.querySelector("#app");
const tokenId = new URL(location.href).searchParams.get("token") || "";
let model = emptyModel();
let source = null;
let activeTab = "attributes";
let itemPicker = null;
let rollPrompt = null;
let rollResult = null;
let connected = false;
let tokenImageUrl = "";
let statusText = "Connecting to Owlbear…";

function emptyModel() {
  return {
    name: "Unnamed adventurer", pronouns: "", portraitUrl: "", className: "", folk: "", homeland: "", level: 1,
    attributes: { Vim: 0, Vigor: 0, Knack: 0, Knowhow: 0 },
    courageCurrent: 0, courageMax: 0, dread: "", attack: 0, defense: 0, questPoints: 0, tempModifiers: { attributes:{}, skills:{}, courage:0, dread:0, attack:0, defense:0, block:0 },
    block: 0, inventorySlots: 20, xp: 0,
    skills: {}, addedAttributes: [], proficiencies: [], deficiencies: [], inventory: [], magnificentItems: [], racialTraits: [], classPerks: [], abilities: [],
    ideals: "", flaws: "", backstory: "", personalQuest: "", relationships: "", ally: "", rival: "", secondRival: "", notes: "", journal: "", mount: { name:"", size:"", type:"", inventorySlots:0, inventory:[], abilities:"", description:"" }
  };
}

function esc(v) { return String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function skillLabel(skill) { return skill[0].toUpperCase() + skill.slice(1); }

function normalizeModelSheet(sheet = {}) {
  const base = emptyModel();
  const next = { ...base, ...sheet };
  next.attributes = { ...base.attributes, ...(sheet.attributes ?? {}) };
  next.mount = { ...{ name:"", size:"", type:"", inventorySlots:0, inventory:[], abilities:"", description:"" }, ...(sheet.mount && typeof sheet.mount === "object" ? sheet.mount : {}) };
  next.mount.inventory = Array.isArray(next.mount.inventory) ? next.mount.inventory.map(item => typeof item === "string" ? {name:item,slots:0,description:""} : {...item}) : [];
  next.skills = { ...(sheet.skills ?? {}) };
  next.tempModifiers = { attributes: { ...(sheet.tempModifiers?.attributes || {}) }, skills: { ...(sheet.tempModifiers?.skills || {}) }, courage: Number(sheet.tempModifiers?.courage)||0, dread: Number(sheet.tempModifiers?.dread)||0, attack: Number(sheet.tempModifiers?.attack)||0, defense: Number(sheet.tempModifiers?.defense)||0, block: Number(sheet.tempModifiers?.block)||0 };
  next.addedAttributes = Array.isArray(sheet.addedAttributes) ? sheet.addedAttributes.map(a => ({type:String(a.type||"abilities"),description:String(a.description||""),source:String(a.source||"")})) : [];
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
  next.equipmentBase = sheet.equipmentBase ? { ...sheet.equipmentBase, skills: { ...(sheet.equipmentBase.skills ?? sheet.skills ?? {}) } } : null;
  next.equipmentRules = { ...(sheet.equipmentRules ?? {}) };
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

function tempMod(kind, key) {
  const value = key ? model.tempModifiers?.[kind]?.[key] : model.tempModifiers?.[kind];
  return Number(value) || 0;
}
function tempBox(kind, key = "") {
  const value = tempMod(kind, key);
  return `<label class="temp-mod-wrap ${value < 0 ? "temp-negative" : "temp-positive"}" title="Temporary modifier (cleared by Session Reset)"><span>temp</span><div class="temp-control"><b class="temp-sign" aria-hidden="true">${value < 0 ? "−" : "+"}</b><input class="temp-mod" type="number" step="1" data-temp-kind="${kind}" data-temp-key="${esc(key)}" value="${value}" aria-label="Temporary ${esc(key||kind)} modifier"></div></label>`;
}
function sessionReset() {
  readForm();
  if (!window.confirm("End session? Clear all temporary modifiers, used-ability marks, and restore Quest Points to Knowhow + 3?")) return;
  model.tempModifiers = {attributes:{},skills:{},courage:0,dread:0,attack:0,defense:0,block:0};
  model.questPoints = (Number(model.attributes?.Knowhow) || 0) + 3;
  model.abilityUsage = {};
  render("Session reset. Save character to persist the changes.");
}
function attributeCards() {
  return ATTRIBUTE_GROUPS.map(group => {
    const skills = group.skills.map(skill => `<label class="skill-row nested-skill"><button type="button" class="roll-link skill-roll" data-roll-skill="${esc(skill)}">${esc(skillLabel(skill))}</button><input data-skill="${esc(skill)}" data-number="true" type="text" inputmode="numeric" value="${esc(signedNumber(model.skills?.[skill] ?? 0))}">${tempBox("skills", skill)}</label>`).join("");
    return `<section class="attribute-card"><div class="attribute-head"><button type="button" class="roll-link attribute-roll" data-roll-attribute="${esc(group.key)}">${esc(group.key.toUpperCase())}</button><input data-attr="${esc(group.key)}" data-number="true" type="text" inputmode="numeric" value="${esc(signedNumber(model.attributes?.[group.key] ?? 0))}">${tempBox("attributes", group.key)}</div><div class="attribute-skills">${skills}</div></section>`;
  }).join("");
}

function abilityRows(items) {
  return (items ?? []).map((item, index) => {
    const key = `${index}:${String(item)}`;
    const checked = Boolean(model.abilityUsage?.[key]);
    return `<li class="ability-entry${checked ? " ability-spent" : ""}"><label class="ability-use-toggle" title="Mark ability used; spending a Quest Point to reuse is handled manually"><input type="checkbox" data-ability-used="${index}" ${checked ? "checked" : ""}><span class="ability-use-label">Used</span></label><span class="ability-entry-text">${esc(item)}</span></li>`;
  }).join("");
}

function addedRows(type) {
  return (model.addedAttributes || []).map((entry, i) => entry.type === type
    ? `<li class="added-attribute"><span class="added-plus">+</span> <span>${esc(entry.description)}</span> <small>(${esc(entry.source || "Unknown source")})</small><button type="button" class="trashBtn added-delete" data-delete-added="${i}" title="Remove added attribute" aria-label="Remove added attribute">${trashIcon()}</button></li>`
    : "").join("");
}
function addAttributeForm(type) {
  const titles = {proficiencies:"Proficiency", deficiencies:"Deficiency", racialTraits:"Racial Trait", classPerks:"Class Perk", abilities:"Ability"};
  return `<div class="feature-add"><details class="add-attribute-details"><summary class="add-attribute-toggle">+ Add ${titles[type] || "Attribute"}</summary><div class="add-attribute-fields">
    <label>Description<input class="addedAttributeDescription" placeholder="New ${esc((titles[type] || "attribute").toLowerCase())}" maxlength="600"></label>
    <label>Source<input class="addedAttributeSource" placeholder="Item, quest, GM, etc." maxlength="120"></label>
    <button type="button" class="smallBtn addAttributeBtn" data-add-type="${esc(type)}">+ Add</button>
  </div></details></div>`;
}

function featureList(title, items, emptyText) {
  const rows = title === "Abilities" ? abilityRows(items) : (items ?? []).map(item => `<li>${esc(item)}</li>`).join("");
  const field = ({ "Proficiencies":"proficiencies","Deficiencies":"deficiencies","Racial Traits":"racialTraits","Class Perks":"classPerks","Abilities":"abilities" })[title];
  const additions = addedRows(field);
  return `<section class="feature-panel"><h3>${esc(title)}</h3><ul class="feature-list">${rows || (!additions ? `<li class="empty">${esc(emptyText)}</li>` : "")}${additions}</ul>${addAttributeForm(field)}</section>`;
}

function trashIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-1 11H8L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/></svg>`;
}

function itemSpecialDetails(item) {
  if (!item || typeof item === "string") return "";
  const lines = [];
  const add = value => { if (typeof value === "string" && value.trim() && !lines.includes(value.trim())) lines.push(value.trim()); };
  for (const key of ["description", "effect", "effects", "properties", "property", "special", "ability", "notes"]) add(item[key]);
  for (const trait of item.traits ?? []) {
    if (typeof trait === "string") add(trait);
    else if (trait && typeof trait === "object") add([trait.name, trait.text || trait.description].filter(Boolean).join(" — "));
  }
  // Apply armor/shield rules even to characters imported before the item catalog existed.
  for (const rule of armorRuleTexts(item)) {
    if (!lines.some(line => line.toLowerCase().includes(rule.toLowerCase()))) add(rule);
  }
  return lines.length ? `<div class="inventory-item-details">${lines.map(line => `<div>${esc(line)}</div>`).join("")}</div>` : "";
}

function slotUsage(items) {
  let used = 0, zeroCount = 0;
  for (const item of items) {
    const slots = Math.max(0, Number(item?.slots ?? 0) || 0);
    if (slots === 0) zeroCount++;
    else used += slots;
  }
  return used + Math.floor(zeroCount / 5);
}
function inventoryCapacity() {
  const items = [...(model.inventory || []), ...(model.magnificentItems || [])];
  const used = slotUsage(items);
  const capacity = Math.max(0, Number(model.inventorySlots) || 0);
  return { used, capacity, overburdened: used > capacity };
}
function inventoryCapacityHeader() {
  const {used, capacity, overburdened} = inventoryCapacity();
  return `<div class="inventory-capacity" id="inventoryCapacity"><strong>${used}/${capacity} slots</strong></div>`;
}
function updateInventoryCapacityDisplay() {
  const el = document.querySelector("#inventoryCapacity");
  const warning = document.querySelector("#overburdenedWarning");
  if (!el || !warning) return;
  const inputs = [...document.querySelectorAll("[data-inventory-slots],[data-mag-slots]")];
  const used = slotUsage(inputs.map(input => ({slots: input.value})));
  const capacity = Math.max(0, Number(model.inventorySlots) || 0);
  el.innerHTML = `<strong>${used}/${capacity} slots</strong>`;
  warning.hidden = used <= capacity;
}
function itemPickerHTML() {
  if (!itemPicker) return "";
  return `<div class="item-picker-backdrop"><section class="item-picker" role="dialog" aria-modal="true" aria-label="Choose equipment">
    <div class="item-picker-head"><strong>${itemPicker.magnificent ? "Create Magnificent Item" : "Add Inventory Item"}</strong><button type="button" id="closeItemPicker" aria-label="Close">×</button></div>
    <label>Item type<select id="itemPickerCategory">
       <option value="all">All item types</option>
       <option value="weapons">Weapons (all)</option>
       <option value="Bladed">Bladed weapons</option>
       <option value="Blunt">Blunt weapons</option>
       <option value="Ranged">Ranged weapons</option>
       <option value="Polearm">Polearms</option>
       <option value="Flexible">Flexible weapons</option>
       <option value="armor">Armor and shields</option>
       <option value="Tool">Tools</option>
       <option value="Clothing">Clothing</option>
       <option value="Trinket">Trinkets</option>
       <option value="container">Containers</option>
     </select></label>
    <label>Search the 400-item equipment list<input id="itemPickerSearch" type="search" autocomplete="off" placeholder="Start typing, e.g. Buckler"></label>
    <div class="item-picker-results" id="itemPickerResults"></div>
    <div class="item-picker-choice" id="itemPickerChoice" hidden>
      <strong id="itemPickerChosenName"></strong><div id="itemPickerDetails"></div><div class="item-picker-weapon-rules" id="itemPickerWeaponRules" aria-live="polite"></div>
      <label>Slots<input id="itemPickerSlots" type="number" min="0" value="0"></label>
      <label>Special rules<input id="itemPickerRules" placeholder="Rules or special functions"></label>
      ${itemPicker.magnificent ? `<label>Magnificent trait<select id="itemPickerTrait"></select></label><p class="item-picker-trait-desc" id="itemPickerTraitDesc"></p>` : ""}
      <button type="button" id="confirmItemPicker">+ Add to Inventory</button>
    </div>
    <div class="picker-footer"><button type="button" id="customItemPicker">+ Create custom item instead</button><button type="button" id="cancelItemPicker" class="secondary">Cancel / Back</button></div>
  </section></div>`;
}
function bindItemPicker() {
  if (!itemPicker) return;
  const search = document.querySelector("#itemPickerSearch");
  const results = document.querySelector("#itemPickerResults");
  const category = document.querySelector("#itemPickerCategory");
  const choice = document.querySelector("#itemPickerChoice");
  let selected = null;
  const paintResults = () => {
    const q = search.value.toLocaleLowerCase().trim();
    const matchType = item => {
      const type = String(item.type || "").toLowerCase();
      const choice = category.value.toLowerCase();
      if (choice === "all") return true;
      if (choice === "weapons") return /bladed|blunt|ranged|polearm|flexible/.test(type);
      if (choice === "armor") return /armor|shield/.test(type);
      if (choice === "container") return /container/.test(type);
      return type.includes(choice);
    };
    const found = ITEMS.filter(x => matchType(x) && (!q || x.name.toLocaleLowerCase().includes(q))).slice(0,40);
    results.innerHTML = found.map(x => `<button type="button" class="item-picker-result" data-catalog-id="${x.id}"><span>${esc(x.name)}</span><small>${x.slots == null ? "Bulky" : x.slots+" slots"} · ${esc(x.type)}</small></button>`).join("") || '<p>No matching items. Use Custom Item below.</p>';
  };
  const showSelected = item => {
    selected = item;
    choice.hidden = false;
    document.querySelector("#itemPickerChosenName").textContent = item.name;
    document.querySelector("#itemPickerDetails").textContent = `${item.type} · ${item.cost || "Cost varies"}${item.slots == null ? " · Bulky: GM approval required" : ""}${weaponRuleTexts(item).length ? " · " + weaponRuleTexts(item).join(" / ") : ""}`;
    document.querySelector("#itemPickerWeaponRules").innerHTML = [...weaponUseDescription(item), ...armorRuleTexts(item)].map(rule => `<p>${esc(rule)}</p>`).join("");
    document.querySelector("#itemPickerSlots").value = item.slots ?? 0;
    document.querySelector("#itemPickerRules").value = specialRules(item).replace(/\n/g, " ");
    const traitSelect = document.querySelector("#itemPickerTrait");
    if (traitSelect) {
      const options = TRAITS[traitGroup(item.type)] || [];
      traitSelect.innerHTML = `<option value="">Choose trait...</option>`+options.map((t,i)=>`<option value="${i}">${esc(t.name)}</option>`).join("");
      document.querySelector("#itemPickerTraitDesc").textContent = "";
    }
  };
  paintResults();
  search.addEventListener("input", paintResults);
  category.addEventListener("change", paintResults);
  results.addEventListener("click", event => {
    const btn=event.target.closest("[data-catalog-id]");if(!btn)return;
    const found=ITEMS.find(x=>x.id===Number(btn.dataset.catalogId));if(found)showSelected(found);
  });
  document.querySelector("#itemPickerTrait")?.addEventListener("change",event=>{
    const t=(TRAITS[traitGroup(selected?.type)]||[])[Number(event.target.value)];
    document.querySelector("#itemPickerTraitDesc").textContent = event.target.value==="" ? "" : t?.text || "";
  });
  const cancelPicker = () => { itemPicker=null; render(); };
  document.querySelector("#closeItemPicker").addEventListener("click", cancelPicker);
  document.querySelector("#cancelItemPicker").addEventListener("click", cancelPicker);
  document.querySelector(".item-picker-backdrop")?.addEventListener("click", e => {
    if (e.target.classList.contains("item-picker-backdrop")) cancelPicker();
  });
  document.querySelector(".item-picker")?.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.preventDefault(); cancelPicker(); }
  });
  document.querySelector("#customItemPicker").addEventListener("click",()=>{
    readForm();
    if(itemPicker.magnificent)model.magnificentItems.push({name:"Magnificent Item",slots:0,worn:false,type:"",cost:"",source:"Custom",magnificent:true,traits:[]});
    else model.inventory.push({name:"New item",slots:0,worn:false,type:"",cost:"",source:"Custom"});
    itemPicker=null;render();
  });
  document.querySelector("#confirmItemPicker").addEventListener("click",()=>{
    if(!selected)return;
    readForm();
    const rules=document.querySelector("#itemPickerRules").value.trim();
    const slots=Math.max(0,Number(document.querySelector("#itemPickerSlots").value)||0);
    const base={name:selected.name,slots,worn:false,type:selected.type,cost:selected.cost,source:"Mundane Items",description:rules};
    if(itemPicker.magnificent){
      const value=document.querySelector("#itemPickerTrait").value;
      const t=value===""?null:(TRAITS[traitGroup(selected.type)]||[])[Number(value)];
      model.magnificentItems.push({...base,name:`Magnificent ${selected.name}`,source:"Magnificent Items",magnificent:true,classGranted:false,traits:t?[{name:t.name,text:t.text}]:[]});
    } else model.inventory.push(base);
    if(model.equipmentBase)recalculateEquipmentStats(model);
    itemPicker=null;render();
  });
}

function weaponMarker(item) {
  if (!isWeaponItem(item)) return "";
  const rules = weaponRuleTexts(item);
  const ruleText = rules.length ? rules.join(" · ") : "Weapon; no additional general modifier.";
  return `<span class="item-marker weapon-rule-marker" tabindex="0" title="${esc(ruleText)}" aria-label="${esc(ruleText)}">*<span class="weapon-rule-tooltip">${rules.map(r => `<span>${esc(r)}</span>`).join("") || "Weapon"}</span></span>`;
}

function inventoryRows() {
  const normalRows = (model.inventory ?? []).map((item, i) => {
    const obj = typeof item === "string" ? { name:item, slots:0, worn:false, source:"" } : item;
    return `<tr><td><input class="wear-check" data-inventory-worn="${i}" type="checkbox" ${obj.worn ? "checked" : ""}></td><td><div class="item-name-row"><input class="inventory-name" data-inventory-name="${i}" value="${esc(obj.name)}">${weaponMarker(obj)}<button class="trashBtn" data-delete-inventory="${i}" type="button" title="Delete item" aria-label="Delete ${esc(obj.name || "item")}">${trashIcon()}</button></div>${itemSpecialDetails(obj)}</td><td><input class="inventory-slots" data-inventory-slots="${i}" type="number" min="0" value="${esc(obj.slots ?? 0)}"></td><td class="source">${esc(obj.source ?? "")}</td></tr>`;
  }).join("");
  const magnificentRows = (model.magnificentItems ?? []).map((item, i) => {
    const traits = (item.traits ?? []).map((trait, j) => `<div class="trait-edit"><input data-mag-trait-name="${i}:${j}" value="${esc(trait.name ?? "")}" placeholder="[trait]"><input data-mag-trait-text="${i}:${j}" value="${esc(trait.text ?? "")}" placeholder="Trait description"><button class="trashBtn traitTrashBtn" data-delete-trait="${i}:${j}" type="button" title="Remove trait" aria-label="Remove trait ${esc(trait.name || "trait")}">${trashIcon()}</button></div>`).join("");
    return `<tr class="magnificent-row"><td><input class="wear-check" data-mag-worn="${i}" type="checkbox" ${item.worn ? "checked" : ""}></td><td><div class="item-name-row"><input class="inventory-name" data-mag-name="${i}" value="${esc(item.name ?? "Magnificent Item")}">${weaponMarker(item)}<button class="trashBtn" data-delete-magnificent="${i}" type="button" title="Delete item" aria-label="Delete ${esc(item.name || "Magnificent item")}">${trashIcon()}</button></div></td><td><input class="inventory-slots" data-mag-slots="${i}" type="number" min="0" value="${esc(item.slots ?? 0)}"></td><td class="source">${esc(item.source ?? "Acquired")}${item.classGranted ? " · Class perk" : ""}</td></tr><tr class="magnificent-detail"><td></td><td colspan="3"><div class="mag-meta"><input data-mag-type="${i}" value="${esc(item.type ?? "")}" placeholder="Type"><input data-mag-cost="${i}" value="${esc(item.cost ?? "")}" placeholder="Cost"></div>${traits}<button class="tinyBtn addTraitBtn" data-add-trait="${i}" type="button">+ Trait</button></td></tr>`;
  }).join("");
  return normalRows + magnificentRows;
}

function mountTab() {
  const mount = model.mount || {};
  const mountItems = Array.isArray(mount.inventory) ? mount.inventory : [];
  const used = mountItems.reduce((sum,item) => sum + Math.max(0,Number(item?.slots)||0),0);
  return `<section class="tab-page mount-page">
    <h3>Mount</h3>
    <div class="mount-fields">
      <label>Name<input data-mount-field="name" value="${esc(mount.name || "")}" placeholder="Mount name"></label>
      <label>Size<input data-mount-field="size" value="${esc(mount.size || "")}" placeholder="Small, Medium, Large..."></label>
      <label>Type<input data-mount-field="type" value="${esc(mount.type || "")}" placeholder="Horse, tortoise, other..."></label>
      <label>Inventory Slots<input data-mount-field="inventorySlots" type="number" min="0" step="1" value="${esc(mount.inventorySlots ?? 0)}"></label>
      <label class="mount-wide">Abilities<textarea data-mount-field="abilities" placeholder="Mount abilities and special rules">${esc(mount.abilities || "")}</textarea></label>
      <label class="mount-wide">Description<textarea data-mount-field="description" placeholder="Appearance, personality, equipment, and notes">${esc(mount.description || "")}</textarea></label>
    </div>
    <div class="mount-inventory-head"><h4>Mount Inventory</h4><span>${used}/${Math.max(0,Number(mount.inventorySlots)||0)} slots</span></div>
    <div class="mount-inventory-rows">${mountItems.map((item,i)=>`<div class="mount-item-row">
      <label>Item<input data-mount-item="${i}" data-mount-item-field="name" value="${esc(item.name||"")}" placeholder="Saddlebags, Barding, supplies..."></label>
      <label>Slots<input data-mount-item="${i}" data-mount-item-field="slots" type="number" min="0" step="1" value="${esc(item.slots??0)}"></label>
      <label>Details<input data-mount-item="${i}" data-mount-item-field="description" value="${esc(item.description||"")}" placeholder="Special rules or notes"></label>
      <button type="button" class="mount-remove-item" data-mount-remove="${i}" aria-label="Remove mount item" title="Remove item">×</button>
    </div>`).join("")}</div>
    <button type="button" class="mount-add-item" id="mountAddItem">+ Add Mount Item</button>
    <p class="mount-help">Mount inventory is tracked separately from your character's equipment. Mount equipment does not alter the rider's Block or other stats.</p>
  </section>`;
}

function renderTab() {
  if (activeTab === "mount") return mountTab();
  if (activeTab === "inventory") return `<section class="tab-page inventory-page"><div class="inventory-summary"><strong>INVENTORY</strong>${inventoryCapacityHeader()}<span>Checked items are equipped/worn; unchecked items are carried.</span></div><div class="inventory-explanation">Slots used / available. Every five 0-slot items count as one slot. Exceeding capacity causes Overburdened.</div><div class="overburdened-warning" id="overburdenedWarning" ${inventoryCapacity().overburdened ? "" : "hidden"}><strong>OVERBURDENED</strong><span>+1 Defense; Disadvantage on Movement and Travel Checks. After more than 1 Travel Turn, become Tired.</span></div><table class="inventory-table"><thead><tr><th>Equip</th><th>Item</th><th>Slots</th><th>Source</th></tr></thead><tbody>${inventoryRows()}</tbody></table><div class="inventory-buttons"><button id="addInventoryBtn" class="smallBtn">+ Add item</button><button id="addMagnificentBtn" class="smallBtn secondary">+ Add Magnificent item</button></div></section>`;
  if (activeTab === "background") return `<section class="tab-page background-page"><div class="background-grid"><label>Ideals<textarea data-field="ideals">${esc(model.ideals)}</textarea></label><label>Flaws<textarea data-field="flaws">${esc(model.flaws)}</textarea></label><label>Personal Quest<textarea data-field="personalQuest">${esc(model.personalQuest)}</textarea></label><label>Backstory<textarea data-field="backstory">${esc(model.backstory)}</textarea></label><label class="wide">Relationships<textarea data-field="relationships">${esc(model.relationships)}</textarea></label><label>Ally<input data-field="ally" value="${esc(model.ally)}"></label><label>Rival<input data-field="rival" value="${esc(model.rival)}"></label><label>Second Rival<input data-field="secondRival" value="${esc(model.secondRival)}"></label><label class="wide">Notes<textarea data-field="notes">${esc(model.notes)}</textarea></label></div></section>`;
  if (activeTab === "journal") return `<section class="tab-page journal-page"><label>Journal<textarea class="journal-textarea" data-field="journal" placeholder="Session notes, clues, NPCs, plans, treasure, promises…">${esc(model.journal)}</textarea></label></section>`;
  return `<section class="tab-page attributes-page"><div class="two-col-features">${featureList("Proficiencies", model.proficiencies, "No proficiencies")}${featureList("Deficiencies", model.deficiencies, "No deficiencies")}</div>${featureList("Racial Traits", model.racialTraits, "No racial traits")}${featureList("Class Perks", displayedClassPerks(), "No class perks")}${featureList("Abilities", model.abilities, "No abilities")}</section>`;
}

function renderWorkspace() {
  return `<section class="sheet-workspace"><aside class="attribute-column sticky-attributes">${attributeCards()}</aside><section class="workspace-right"><section class="vitals card compact-vitals sticky-vitals"><div class="stat courage"><span>COURAGE</span><div><input data-field="courageCurrent" type="number" value="${esc(model.courageCurrent)}"><em>/</em><span class="courage-max-area"><input data-field="courageMax" type="number" value="${esc(model.courageMax)}">${tempBox("courage")}</span></div></div><div class="stat"><span>DREAD</span><input data-field="dread" value="${esc(model.dread)}">${tempBox("dread")}</div><div class="stat"><button type="button" class="roll-link stat-roll" id="attackRollBtn">ATTACK</button><input data-field="attack" data-number="true" type="text" inputmode="numeric" value="${esc(signedNumber(model.attack))}">${tempBox("attack")}</div><div class="stat"><span>DEFENSE</span><input data-field="defense" data-number="true" type="text" inputmode="numeric" value="${esc(signedNumber(model.defense))}">${tempBox("defense")}</div><div class="stat"><span>QUEST PTS</span><input data-field="questPoints" type="number" value="${esc(model.questPoints)}"></div><div class="stat"><span>BLOCK †</span><input data-field="block" data-number="true" type="text" inputmode="numeric" value="${esc(signedNumber(model.block))}">${tempBox("block")}</div></section>${renderRollPanel()}<nav class="tabs workspace-tabs"><button data-tab="attributes" class="${activeTab === "attributes" ? "active" : ""}">Attributes</button><button data-tab="inventory" class="${activeTab === "inventory" ? "active" : ""}">Inventory</button><button data-tab="background" class="${activeTab === "background" ? "active" : ""}">Background</button><button data-tab="journal" class="${activeTab === "journal" ? "active" : ""}">Journal</button><button data-tab="mount" class="${activeTab === "mount" ? "active" : ""}">Mount</button></nav><div class="dynamic-panel">${renderTab()}</div></section></section>`;
}


function rollDie(sides) {
  const n = Math.max(2, Number(sides) || 12);
  return Math.floor(Math.random() * n) + 1;
}

function rollD12(mode = "normal") {
  const first = rollDie(12);
  if (mode === "normal") return { rolls: [first], chosen: first };
  const second = rollDie(12);
  return { rolls: [first, second], chosen: mode === "advantage" ? Math.max(first, second) : Math.min(first, second) };
}

function parseDread(value) {
  const text = String(value ?? "").replace(/\s+/g, "");
  const dice = text.match(/(?:(\d+))?d(\d+)/i);
  const count = dice ? Math.max(1, Number(dice[1] || 1)) : 1;
  const sides = dice ? Math.max(2, Number(dice[2] || 6)) : 6;
  const rest = dice ? text.replace(dice[0], "") : text;
  const bonus = [...rest.matchAll(/([+-]\d+)/g)].reduce((sum, m) => sum + (Number(m[1]) || 0), 0);
  return { count, sides, bonus };
}

function rollDreadValue() {
  const parsed = parseDread(model.dread);
  parsed.bonus += tempMod("dread");
  const rolls = Array.from({ length: parsed.count }, () => rollDie(parsed.sides));
  return { ...parsed, rolls, diceTotal: rolls.reduce((a, b) => a + b, 0) };
}

function checkOutcome(total) {
  if (total <= 2) return "Complete Failure";
  if (total <= 5) return "Failure with a Plus";
  if (total <= 8) return "Success with a Twist";
  if (total <= 11) return "Success";
  return "Complete Success";
}

function attackOutcome(total, attackType = "melee") {
  if (total <= 2) return "Critical Miss";
  if (total <= 5) return "Miss with a Plus";
  if (total <= 8) return attackType === "ranged" ? "Grazing Shot" : "Hit with a Counterattack";
  if (total <= 11) return "Hit";
  return "Critical Hit";
}

function inferAttackType() {
  const equipped = [...(model.inventory ?? []), ...(model.magnificentItems ?? [])].find(item => item?.worn && isWeaponItem(item));
  return /ranged/i.test(String(equipped?.type ?? "")) ? "ranged" : "melee";
}

function openSkillRoll(skill) {
  readForm();
  rollPrompt = { kind: "skill", skill, label: skillLabel(skill), modifier: (Number(model.skills?.[skill]) || 0) + tempMod("skills",skill) };
  rollResult = null;
  render();
}

function openAttributeRoll(attribute) {
  readForm();
  rollPrompt = { kind: "attribute", attribute, label: attribute, modifier: (Number(model.attributes?.[attribute]) || 0) + tempMod("attributes",attribute) };
  rollResult = null;
  render();
}

function openAttackRoll() {
  readForm();
  rollPrompt = { kind: "attack", label: "Attack", modifier: (Number(model.attack) || 0) + tempMod("attack"), attackType: inferAttackType(), targetDefense: 0 };
  rollResult = null;
  render();
}

function performRoll(mode) {
  if (!rollPrompt) return;
  readForm();
  const d12 = rollD12(mode);
  if (rollPrompt.kind === "skill" || rollPrompt.kind === "attribute") {
    const modifier = rollPrompt.kind === "skill" ? ((Number(model.skills?.[rollPrompt.skill]) || 0) + tempMod("skills",rollPrompt.skill)) : ((Number(model.attributes?.[rollPrompt.attribute]) || 0) + tempMod("attributes",rollPrompt.attribute));
    const total = d12.chosen + modifier;
    rollResult = { kind: rollPrompt.kind, label: rollPrompt.label, mode, d12, modifier, total, outcome: checkOutcome(total) };
  } else {
    const defense = Number(document.querySelector("#targetDefense")?.value) || 0;
    const attackType = document.querySelector("#attackType")?.value || rollPrompt.attackType || "melee";
    rollPrompt.targetDefense = defense;
    rollPrompt.attackType = attackType;
    const attack = (Number(model.attack) || 0) + tempMod("attack");
    const total = d12.chosen + attack + defense;
    const outcome = attackOutcome(total, attackType);
    const dread = rollDreadValue();
    let appliedDread = 0;
    let dreadNote = "Dread rolled, but no Dread is applied on this result.";
    if (outcome === "Grazing Shot") {
      appliedDread = 1;
      dreadNote = "Grazing Shot inflicts 1 Dread.";
    } else if (outcome === "Hit" || outcome === "Hit with a Counterattack") {
      appliedDread = dread.diceTotal + dread.bonus;
      dreadNote = "Hit inflicts the rolled Dread.";
    } else if (outcome === "Critical Hit") {
      appliedDread = dread.diceTotal * 2 + dread.bonus;
      dreadNote = "Critical Hit doubles the Dread dice before adding flat Dread bonuses.";
    }
    rollResult = { kind: "attack", label: "Attack", mode, d12, modifier: attack, defense, total, attackType, outcome, dread, appliedDread, dreadNote };
  }
  broadcastRollResult(rollResult);
  render();
}

function modeLabel(mode) {
  return mode === "advantage" ? "Advantage" : mode === "disadvantage" ? "Disadvantage" : "Normal";
}

function chosenRollMath(d12) {
  if (d12.rolls.length <= 1) return `(${d12.chosen})`;
  return `(${d12.rolls.join(", ")} → ${d12.chosen})`;
}

function modifierTerm(value, label = "") {
  const n = Number(value) || 0;
  const suffix = label ? ` ${label}` : "";
  return n < 0 ? `- ${Math.abs(n)}${suffix}` : `+ ${n}${suffix}`;
}

function rollDisplayLines(result, includeName = false) {
  const lines = [];
  if (includeName) lines.push(model.name || "A character");
  const rollMath = chosenRollMath(result.d12);
  if (result.kind === "attack") {
    lines.push(`Attack: ${result.total}  [${rollMath} ${modifierTerm(result.modifier)} ${modifierTerm(result.defense, "(Defense)")}]`);
    const dreadDice = result.dread.rolls.length > 1 ? result.dread.rolls.map(v => `(${v})`).join(" + ") : `(${result.dread.rolls[0] ?? 0})`;
    const dreadBonus = modifierTerm(result.dread.bonus);
    lines.push(`Dread: ${result.appliedDread} Dread  [${dreadDice} ${dreadBonus}]`);
    if (result.outcome === "Hit" || result.outcome === "Hit with a Counterattack" || result.outcome === "Critical Hit") {
      lines.push(`${result.outcome} for ${result.appliedDread} Dread!`);
    } else if (result.outcome === "Grazing Shot") {
      lines.push(`Grazing Shot for 1 Dread!`);
    } else {
      lines.push(result.outcome);
    }
  } else {
    lines.push(`${result.label}: ${result.total}  [${rollMath} ${modifierTerm(result.modifier)}]`);
    lines.push(result.outcome);
  }
  return lines;
}

function rollBroadcastText(result) {
  return rollDisplayLines(result, true).join("\n");
}

function broadcastRollResult(result) {
  const rollId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  request("popout-broadcast-roll", { text: rollBroadcastText(result), rollId }).then(reply => {
    if (!reply.ok) throw Error(reply.error || "Roll broadcast failed");
  }).catch(error => {
    console.warn("Roll broadcast failed", error);
    statusText = "Roll shown locally, but broadcast failed. Check Owlbear connection.";
    const status = app.querySelector(".status"); if (status) status.textContent = statusText;
  });
}
const ROLL_SETTINGS_KEY = "eem-roll-card-settings-v1";
let rollSettingsOpen = false;
let rollSettings = { position: "top", duration: 5 };
try { rollSettings = { ...rollSettings, ...JSON.parse(localStorage.getItem(ROLL_SETTINGS_KEY)||"{}") }; } catch {}
function renderBroadcastSettings() {
  return `<section class="broadcast-settings" ${rollSettingsOpen ? "" : "hidden"}>
    <label>Broadcast position<select id="rollPositionSetting">
      <option value="top" ${rollSettings.position === "top" ? "selected" : ""}>Top center</option>
      <option value="left" ${rollSettings.position === "left" ? "selected" : ""}>Middle left</option>
      <option value="right" ${rollSettings.position === "right" ? "selected" : ""}>Middle right</option>
    </select></label><label>Display duration<select id="rollDurationSetting">
      ${[3,5,7,10,15,0].map(n => `<option value="${n}" ${rollSettings.duration === n ? "selected" : ""}>${n === 0 ? "Until closed" : n + " seconds"}</option>`).join("")}
    </select></label><small>These settings control the roll cards on your Owlbear screen.</small>
  </section>`;
}
async function loadBroadcastSettings() {
  try { const reply = await request("popout-get-roll-settings"); if (reply.ok && reply.settings) { rollSettings = reply.settings; if (rollSettingsOpen) render(); } }
  catch (error) { console.warn("Broadcast settings unavailable", error); }
}

function renderRollPanel() {
  if (!rollPrompt && !rollResult) return "";
  const prompt = rollPrompt ?? rollResult;
  const attackControls = prompt.kind === "attack" ? `<div class="attack-options"><label>Target Defense<input id="targetDefense" type="number" step="1" value="${esc(prompt.targetDefense ?? rollResult?.defense ?? 0)}"></label><label>Attack Type<select id="attackType"><option value="melee" ${(prompt.attackType ?? rollResult?.attackType) === "melee" ? "selected" : ""}>Melee</option><option value="ranged" ${(prompt.attackType ?? rollResult?.attackType) === "ranged" ? "selected" : ""}>Ranged</option></select></label></div>` : "";
  let result = "";
  if (rollResult) {
    const lines = rollDisplayLines(rollResult, false);
    result = `<div class="roll-result ${rollResult.kind === "attack" ? "attack-result" : ""}">${lines.map((line, i) => i === lines.length - 1 ? `<strong>${esc(line)}</strong>` : `<span>${esc(line)}</span>`).join("")}</div>`;
  }
  return `<div class="roll-modal-backdrop" id="rollModalBackdrop"><section class="roll-panel roll-modal" role="dialog" aria-modal="true" aria-label="${esc(prompt.label)} roll"><div class="roll-panel-head"><strong>${esc(prompt.label)} Roll</strong><button class="roll-close" id="closeRollBtn" type="button" aria-label="Close roll panel">×</button></div>${attackControls}<div class="roll-modes"><button data-roll-mode="normal" type="button">Normal</button><button data-roll-mode="advantage" type="button">Advantage</button><button data-roll-mode="disadvantage" type="button">Disadvantage</button></div>${result}</section></div>`;
}

function render() {
  app.innerHTML = `<header><div class="brand"><div class="mark">E</div><div><strong>LAND OF EEM</strong><span>POPPED-OUT CHARACTER SHEET</span></div></div><div class="status">${esc(statusText)}</div><button id="broadcastSettingsBtn" type="button" class="broadcast-settings-button">⚙ Broadcast settings</button><button type="button" id="sessionResetBtn" class="session-reset-button" title="Clear temporary modifiers and used abilities, reset Quest Points">↻ Session Reset</button></header><main class="popout-main">${renderBroadcastSettings()}<section class="identity hero-card"><div class="name-block"><label>Name & Pronouns<input data-field="name" value="${esc(model.name)}"></label><input class="pronouns" data-field="pronouns" value="${esc(model.pronouns)}" placeholder="Pronouns"></div><div class="identity-pair"><label>Class<input data-field="className" value="${esc(model.className)}"></label><label>Folk<input data-field="folk" value="${esc(model.folk)}"></label><label>Homeland<input data-field="homeland" value="${esc(model.homeland)}"></label></div><div class="level-chip"><span>LV</span><b>${esc(model.level)}</b><span>XP</span><input data-field="xp" type="number" value="${esc(model.xp)}"></div><div class="portrait-slot"><div class="portrait-frame">${tokenImageUrl ? `<img src="${esc(tokenImageUrl)}" alt="Character portrait" onerror="this.style.display='none'">` : `<span class="portrait-placeholder">Portrait</span>`}</div></div></section>${renderWorkspace()}<div class="popout-actions"><button id="builderOpenBtn" type="button">Character Builder ↗</button><button id="saveBtn" ${connected ? "" : "disabled"}>Save Character</button><button id="reloadBtn" class="secondary">Reload from Owlbear</button></div><div class="extension-version">Land of Eem · v0.5.3</div></main>`;
  app.insertAdjacentHTML("beforeend", itemPickerHTML());
  bind();
  document.querySelector("#mountAddItem")?.addEventListener("click", () => {readForm(); model.mount.inventory ??= []; model.mount.inventory.push({name:"",slots:0,description:""});render();});
  document.querySelectorAll("[data-mount-remove]").forEach(btn => btn.addEventListener("click", () => {readForm();model.mount.inventory.splice(Number(btn.dataset.mountRemove),1);render();}));
}

function readForm() {
  model.mount ??= { name:"", size:"", type:"", inventorySlots:0, inventory:[], abilities:"", description:"" };
  document.querySelectorAll("[data-mount-field]").forEach(el => {
    const key = el.dataset.mountField;
    model.mount[key] = key === "inventorySlots" ? Math.max(0, Number(el.value) || 0) : el.value;
  });
  model.mount.inventory = Array.isArray(model.mount.inventory) ? model.mount.inventory : [];
  document.querySelectorAll("[data-mount-item]").forEach(el => {
    const idx = Number(el.dataset.mountItem), field = el.dataset.mountItemField;
    if (!model.mount.inventory[idx]) model.mount.inventory[idx] = {name:"",slots:0,description:""};
    model.mount.inventory[idx][field] = field === "slots" ? Math.max(0,Number(el.value)||0) : el.value;
  });
  model.tempModifiers ??= {attributes:{},skills:{}};
  model.tempModifiers.attributes ??= {};
  model.tempModifiers.skills ??= {};
  document.querySelectorAll("[data-temp-kind]").forEach(el => {
    const kind=el.dataset.tempKind, key=el.dataset.tempKey;
    if(key) model.tempModifiers[kind][key] = Number(el.value)||0;
    else model.tempModifiers[kind] = Number(el.value)||0;
  });
  document.querySelectorAll("[data-ability-used]").forEach(el => { const i = Number(el.dataset.abilityUsed); const key = `${i}:${String(model.abilities?.[i] ?? "")}`; model.abilityUsage ??= {}; model.abilityUsage[key] = el.checked; });
  document.querySelectorAll("[data-field]").forEach(el => { const key = el.dataset.field; model[key] = (el.type === "number" || el.dataset.number === "true") ? (Number(String(el.value).replace(/[^0-9+.-]/g, "")) || 0) : el.value; });
  document.querySelectorAll("[data-attr]").forEach(el => model.attributes[el.dataset.attr] = Number(String(el.value).replace(/[^0-9+.-]/g, "")) || 0);
  document.querySelectorAll("[data-skill]").forEach(el => model.skills[el.dataset.skill] = Number(String(el.value).replace(/[^0-9+.-]/g, "")) || 0);
  (model.inventory ?? []).forEach((item, i) => {
    if (typeof item === "string") model.inventory[i] = { name:item, slots:0,worn:false,source:"" };
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

function request(type, extra = {}, timeout = 6000) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    if (!window.opener || window.opener.closed) { reject(new Error("Owlbear link is not available. Reopen this sheet from the token menu.")); return; }
    const resultType = `${type}-result`;
    const timer = setTimeout(() => { window.removeEventListener("message", handler); reject(new Error("Owlbear connection timed out. Reopen this sheet from the token menu.")); }, timeout);
    const handler = event => {
      if (event.origin !== location.origin) return;
      const msg = event.data ?? {};
      if (msg.source !== EXT_ID || msg.requestId !== requestId || msg.type !== resultType) return;
      clearTimeout(timer); window.removeEventListener("message", handler); resolve(msg);
    };
    window.addEventListener("message", handler);
    window.opener.postMessage({ source: EXT_ID, type, requestId, tokenId, ...extra }, location.origin);
  });
}

async function loadCharacter() {
  if (!tokenId) { connected = false; statusText = "No character token was supplied."; render(); return; }
  statusText = "Loading character from Owlbear…"; render();
  try {
    const result = await request("popout-load");
    if (!result.ok || !result.payload?.sheet) throw new Error("No Land of Eem character is saved on that token.");
    source = result.payload.source ?? null;
    model = normalizeModelSheet(result.payload.sheet);
    tokenImageUrl = result.tokenImageUrl || "";
    connected = true;
    statusText = "Connected to Owlbear. Keep this window beside the dice roller.";
    render();
  } catch (error) { connected = false; statusText = String(error?.message ?? error); render(); }
}

async function saveCharacter() {
  readForm();
  if (!connected) return;
  statusText = "Saving to Owlbear…"; render();
  const payload = { version: 8, updatedAt: new Date().toISOString(), sheet: model, source };
  try {
    const result = await request("popout-save", { payload });
    if (!result.ok) throw new Error(result.error || "Could not save to Owlbear.");
    statusText = `Saved ${model.name || "character"} to the token.`; render();
  } catch (error) { connected = false; statusText = String(error?.message ?? error); render(); }
}

function updateEquipmentStats(message = "Equipment stats updated.") {
  readForm();
  if (model.equipmentBase) recalculateEquipmentStats(model);
  render(message);
}

function bindAddedAttributes() {
  document.querySelectorAll(".addAttributeBtn").forEach(btn => btn.addEventListener("click", () => {
    const section = btn.closest(".feature-add");
    const type = btn.dataset.addType;
    const description = section?.querySelector(".addedAttributeDescription")?.value.trim();
    const source = section?.querySelector(".addedAttributeSource")?.value.trim();
    if (!description) { section?.querySelector(".addedAttributeDescription")?.focus(); return; }
    readForm();
    model.addedAttributes ??= [];
    model.addedAttributes.push({type, description, source});
    render();
  }));
  document.querySelectorAll("[data-delete-added]").forEach(btn => btn.addEventListener("click", () => {
    readForm();
    model.addedAttributes.splice(Number(btn.dataset.deleteAdded),1);
    render();
  }));
}
function bindTempSigns() {
  document.querySelectorAll(".temp-mod").forEach(input => input.addEventListener("input", () => {
    const wrap = input.closest(".temp-mod-wrap");
    const negative = Number(input.value) < 0;
    wrap?.classList.toggle("temp-negative", negative);
    wrap?.classList.toggle("temp-positive", !negative);
    const sign = wrap?.querySelector(".temp-sign");
    if (sign) sign.textContent = negative ? "−" : "+";
  }));
}

function bind() {
  document.querySelector("#sessionResetBtn")?.addEventListener("click",sessionReset);
  document.querySelector("#broadcastSettingsBtn")?.addEventListener("click", () => { rollSettingsOpen = !rollSettingsOpen; loadBroadcastSettings(); render(); });
  for (const [id, field] of [["rollPositionSetting", "position"], ["rollDurationSetting", "duration"]]) {
    document.querySelector(`#${id}`)?.addEventListener("change", async event => {
      rollSettings[field] = field === "duration" ? Number(event.target.value) : event.target.value;
      try { localStorage.setItem(ROLL_SETTINGS_KEY,JSON.stringify(rollSettings)); } catch {}
      try { await request("popout-save-roll-settings", { settings: rollSettings }); }
      catch (error) { console.warn("Could not save broadcast setting", error); }
    });
  }
  bindItemPicker();
  document.querySelectorAll("[data-inventory-slots],[data-mag-slots]").forEach(input =>
    input.addEventListener("input", updateInventoryCapacityDisplay));

  bindAddedAttributes();
  bindTempSigns();
  document.querySelectorAll("[data-roll-skill]").forEach(btn => btn.addEventListener("click", () => openSkillRoll(btn.dataset.rollSkill)));
  document.querySelectorAll("[data-roll-attribute]").forEach(btn => btn.addEventListener("click", () => openAttributeRoll(btn.dataset.rollAttribute)));
  document.querySelector("#attackRollBtn")?.addEventListener("click", openAttackRoll);
  document.querySelectorAll("[data-roll-mode]").forEach(btn => btn.addEventListener("click", () => performRoll(btn.dataset.rollMode)));
  document.querySelector("#closeRollBtn")?.addEventListener("click", () => { rollPrompt = null; rollResult = null; render(); });
  document.querySelector("#rollModalBackdrop")?.addEventListener("click", e => { if (e.target.id === "rollModalBackdrop") { rollPrompt = null; rollResult = null; render(); } });
  document.querySelectorAll("[data-inventory-worn],[data-mag-worn]").forEach(el => el.addEventListener("change", () => updateEquipmentStats()));
  document.querySelectorAll("[data-mag-trait-name],[data-mag-trait-text],[data-mag-type],[data-mag-cost]").forEach(el => el.addEventListener("change", () => updateEquipmentStats()));
  document.querySelectorAll("[data-ability-used]").forEach(el => el.addEventListener("change", () => { readForm(); el.closest(".ability-entry")?.classList.toggle("ability-spent", el.checked); }));
  document.querySelector("#saveBtn")?.addEventListener("click", saveCharacter);
  document.querySelector("#builderOpenBtn")?.addEventListener("click", openCharacterBuilder);
  document.querySelector("#reloadBtn")?.addEventListener("click", loadCharacter);
  document.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", () => { readForm(); activeTab = btn.dataset.tab; render(); }));
  document.querySelector("#addInventoryBtn")?.addEventListener("click", () => { readForm(); itemPicker = {magnificent:false}; render(); });
  document.querySelector("#addMagnificentBtn")?.addEventListener("click", () => { readForm(); itemPicker = {magnificent:true}; render(); });
  document.querySelectorAll("[data-add-trait]").forEach(btn => btn.addEventListener("click", () => { readForm(); const i = Number(btn.dataset.addTrait); model.magnificentItems[i]?.traits.push({name:"[trait]",text:"Trait description"}); render(); }));
  document.querySelectorAll("[data-delete-inventory]").forEach(btn => btn.addEventListener("click", () => { readForm(); const i = Number(btn.dataset.deleteInventory); const item = model.inventory[i]; const name = typeof item === "string" ? item : item?.name || "this item"; if (window.confirm(`Delete ${name}?`)) { model.inventory.splice(i, 1); if (model.equipmentBase) recalculateEquipmentStats(model); render(); } }));
  document.querySelectorAll("[data-delete-magnificent]").forEach(btn => btn.addEventListener("click", () => { readForm(); const i = Number(btn.dataset.deleteMagnificent); const name = model.magnificentItems[i]?.name || "this Magnificent item"; if (window.confirm(`Delete ${name}?`)) { model.magnificentItems.splice(i, 1); if (model.equipmentBase) recalculateEquipmentStats(model); render(); } }));
  document.querySelectorAll("[data-delete-trait]").forEach(btn => btn.addEventListener("click", () => { readForm(); const [i, j] = btn.dataset.deleteTrait.split(":").map(Number); model.magnificentItems[i]?.traits?.splice(j, 1); if (model.equipmentBase) recalculateEquipmentStats(model); render(); }));
}


const BUILDER_CHANNEL = "eem-unified-builder-v1";
let builderWindow = null;
function openCharacterBuilder() {
  if (!connected || !tokenId) { statusText = "Connect a character token first."; render(); return; }
  readForm();
  const url = new URL("./builder.html", location.href);
  url.searchParams.set("owlbear", "1");
  builderWindow = window.open(url.href, `eem-builder-${tokenId}`, "popup=yes,width=1120,height=900,resizable=yes,scrollbars=yes");
  if (!builderWindow) { statusText = "Allow pop-ups to open the character builder."; render(); }
  else builderWindow.focus();
}
window.addEventListener("message", async event => {
  if (event.origin !== location.origin || event.source !== builderWindow || event.data?.channel !== BUILDER_CHANNEL) return;
  if (event.data.type === "ready") {
    const raw = source;
    const state = raw?.format === "eem-builder" ? (raw.character || raw.state || raw) : raw?.state || raw?.character || (raw?.attrs ? raw : null);
    event.source.postMessage({channel:BUILDER_CHANNEL,type:"init",state},event.origin);
  } else if (event.data.type === "save") {
    try {
      const state = event.data.state;
      if (!state || typeof state !== "object" || Array.isArray(state)) throw Error("Invalid builder data");
      const { extractCharacter } = await import("./extract.js");
      const updated = normalizeModelSheet(extractCharacter(state));
      updated.journal = model.journal || "";
      updated.addedAttributes = model.addedAttributes || [];
      updated.abilityUsage = model.abilityUsage || {};
      const newSource = {format:"eem-builder",character:state};
      const payload = {version:9,updatedAt:new Date().toISOString(),sheet:updated,source:newSource};
      const result = await request("popout-save",{payload});
      if (!result.ok) throw Error(result.error || "Could not save to token");
      source = newSource; model = updated; statusText = "Builder saved to Owlbear token."; render();
      event.source.postMessage({channel:BUILDER_CHANNEL,type:"saved",ok:true},event.origin);
    } catch(error) {
      event.source.postMessage({channel:BUILDER_CHANNEL,type:"saved",ok:false,error:String(error?.message || error)},event.origin);
    }
  }
});

render();
loadCharacter();

loadBroadcastSettings();

window.addEventListener("storage", event => { if (event.key === ROLL_SETTINGS_KEY) { try { rollSettings = JSON.parse(event.newValue||"{}"); if (rollSettingsOpen) render(); } catch {} } });
