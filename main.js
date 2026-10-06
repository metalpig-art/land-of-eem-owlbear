import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
import "./style.css";
import { extractCharacter, SKILLS } from "./extract.js";

const META_KEY = "com.pipeworks.land-of-eem/character";
const app = document.querySelector("#app");
let sceneItems = [];
let selectedTokenId = "";
let currentRaw = null;
let model = emptyModel();

function emptyModel() {
  return {
    name: "Unnamed adventurer", pronouns: "", className: "", folk: "", homeland: "", level: 1,
    courageCurrent: 0, courageMax: 0, dread: "", attack: 0, defense: 0, questPoints: 0, xp: 0,
    skills: {}, proficiencies: [], deficiencies: [], inventory: [], abilities: [], perks: [],
    ideals: "", flaws: "", backstory: "", personalQuest: "", relationships: "", notes: ""
  };
}

function esc(v) {
  return String(v ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

function listText(v) { return Array.isArray(v) ? v.join("\n") : String(v ?? ""); }
function parseList(v) { return String(v ?? "").split(/\r?\n/).map(s => s.trim()).filter(Boolean); }
function tokenName(item) { return item?.text?.plainText || item?.name || item?.id || "Character token"; }
function characterTokens(items) { return items.filter((item) => item.layer === "CHARACTER"); }

function render(message = "") {
  const tokens = characterTokens(sceneItems);
  const tokenOptions = tokens.map(t => `<option value="${esc(t.id)}" ${t.id === selectedTokenId ? "selected" : ""}>${esc(tokenName(t))}</option>`).join("");
  const skillInputs = SKILLS.map(s => `<label class="skill"><span>${esc(s[0].toUpperCase()+s.slice(1))}</span><input data-skill="${s}" type="number" value="${esc(model.skills?.[s] ?? 0)}"></label>`).join("");
  app.innerHTML = `
    <header>
      <div class="brand"><div class="mark">E</div><div><strong>LAND OF EEM</strong><span>OWLBEAR CHARACTER SHEET</span></div></div>
      <div id="status" class="status">${esc(message)}</div>
    </header>
    <main>
      <section class="card token-card">
        <label>Owlbear character token</label>
        <div class="row"><select id="tokenSelect"><option value="">Choose a token…</option>${tokenOptions}</select><button id="refreshBtn" class="secondary">Refresh</button></div>
        <p class="hint">The sheet is stored on the selected Character-layer token and syncs with the room.</p>
      </section>

      <section class="card import-card">
        <div class="row split"><div><b>Builder save</b><p class="hint">Use the .eem.json made by the existing character builder.</p></div><label class="fileBtn">Import .eem.json<input id="fileInput" type="file" accept=".json,.eem.json,application/json"></label></div>
      </section>

      <section class="identity card">
        <label>Name<input data-field="name" value="${esc(model.name)}"></label>
        <div class="grid3">
          <label>Class<input data-field="className" value="${esc(model.className)}"></label>
          <label>Folk<input data-field="folk" value="${esc(model.folk)}"></label>
          <label>Homeland<input data-field="homeland" value="${esc(model.homeland)}"></label>
        </div>
      </section>

      <section class="vitals card">
        <div class="stat"><span>COURAGE</span><div><input data-field="courageCurrent" type="number" value="${esc(model.courageCurrent)}"><em>/</em><input data-field="courageMax" type="number" value="${esc(model.courageMax)}"></div></div>
        <div class="stat"><span>DREAD</span><input data-field="dread" value="${esc(model.dread)}"></div>
        <div class="stat"><span>ATTACK</span><input data-field="attack" type="number" value="${esc(model.attack)}"></div>
        <div class="stat"><span>DEFENSE</span><input data-field="defense" type="number" value="${esc(model.defense)}"></div>
        <div class="stat"><span>QUEST PTS</span><input data-field="questPoints" type="number" value="${esc(model.questPoints)}"></div>
      </section>

      <details class="card" open><summary>Skills</summary><div class="skills">${skillInputs}</div></details>
      <details class="card"><summary>Abilities & perks</summary><label>Abilities<textarea data-list="abilities">${esc(listText(model.abilities))}</textarea></label><label>Perks / traits<textarea data-list="perks">${esc(listText(model.perks))}</textarea></label></details>
      <details class="card"><summary>Inventory</summary><textarea data-list="inventory">${esc(listText(model.inventory))}</textarea></details>
      <details class="card"><summary>Story & notes</summary><label>Ideals<textarea data-field="ideals">${esc(model.ideals)}</textarea></label><label>Flaws<textarea data-field="flaws">${esc(model.flaws)}</textarea></label><label>Backstory<textarea data-field="backstory">${esc(model.backstory)}</textarea></label><label>Personal quest<textarea data-field="personalQuest">${esc(model.personalQuest)}</textarea></label><label>Relationships<textarea data-field="relationships">${esc(model.relationships)}</textarea></label><label>Notes<textarea data-field="notes">${esc(model.notes)}</textarea></label></details>

      <div class="actions"><button id="saveBtn">Save to token</button><button id="exportBtn" class="secondary">Export .eem.json</button></div>
    </main>`;
  bind();
}

function readForm() {
  document.querySelectorAll("[data-field]").forEach(el => {
    const key = el.dataset.field;
    model[key] = el.type === "number" ? (Number(el.value) || 0) : el.value;
  });
  document.querySelectorAll("[data-skill]").forEach(el => model.skills[el.dataset.skill] = Number(el.value) || 0);
  document.querySelectorAll("[data-list]").forEach(el => model[el.dataset.list] = parseList(el.value));
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
  selectedTokenId = id;
  const item = sceneItems.find(i => i.id === id);
  const stored = item?.metadata?.[META_KEY];
  if (stored && typeof stored === "object") {
    currentRaw = stored.source ?? null;
    model = { ...emptyModel(), ...(stored.sheet ?? {}) };
    render("Loaded from token.");
  } else {
    currentRaw = null;
    model = emptyModel();
    render(id ? "No Land of Eem sheet on this token yet." : "");
  }
}

async function saveToToken() {
  readForm();
  if (!selectedTokenId) { render("Choose a Character-layer token first."); return; }
  const payload = { version: 1, updatedAt: new Date().toISOString(), sheet: model, source: currentRaw };
  await OBR.scene.items.updateItems([selectedTokenId], items => {
    for (const item of items) item.metadata[META_KEY] = payload;
  });
  await OBR.notification.show(`Saved ${model.name || "character"} to token`);
  render("Saved to Owlbear token.");
}

function downloadJson() {
  readForm();
  const output = currentRaw && typeof currentRaw === "object" ? structuredClone(currentRaw) : { character: {} };
  output.owlbear = { version: 1, sheet: model };
  const blob = new Blob([JSON.stringify(output, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(model.name || "Land-of-Eem-character").replace(/[^a-z0-9_-]+/gi, "-")}.eem.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function bind() {
  document.querySelector("#refreshBtn")?.addEventListener("click", () => refreshItems());
  document.querySelector("#tokenSelect")?.addEventListener("change", e => loadFromToken(e.target.value));
  document.querySelector("#saveBtn")?.addEventListener("click", saveToToken);
  document.querySelector("#exportBtn")?.addEventListener("click", downloadJson);
  document.querySelector("#fileInput")?.addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      currentRaw = JSON.parse(await file.text());
      model = { ...emptyModel(), ...extractCharacter(currentRaw) };
      if (currentRaw?.owlbear?.sheet) model = { ...model, ...currentRaw.owlbear.sheet };
      render(`Imported ${file.name}. Choose a token and save.`);
    } catch {
      render("That file is not valid JSON.");
    }
  });
}

function start() {
  render("Connecting to Owlbear Rodeo…");
  OBR.onReady(async () => {
    await OBR.action.setWidth(430);
    await OBR.action.setHeight(720);
    await refreshItems(false);
    OBR.scene.items.onChange(items => {
      sceneItems = items;
      const selected = sceneItems.find(i => i.id === selectedTokenId);
      const stored = selected?.metadata?.[META_KEY];
      if (stored?.sheet) model = { ...emptyModel(), ...stored.sheet };
      render();
    });
    OBR.scene.onReadyChange(() => refreshItems(false));
  });
}

if (!OBR.isAvailable) render("This page is meant to run inside Owlbear Rodeo.");
else start();
