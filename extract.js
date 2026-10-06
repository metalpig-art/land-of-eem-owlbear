const SKILLS = [
  "charm", "inspire", "mettle", "perception",
  "athletics", "intimidate", "might", "vitality",
  "nimbleness", "search", "sneak", "trickery",
  "lore", "realms", "tinker", "wilderness"
];

function norm(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scalar(value) {
  return ["string", "number", "boolean"].includes(typeof value);
}

function walk(obj, path = [], out = []) {
  if (obj === null || obj === undefined) return out;
  if (scalar(obj)) {
    out.push({ path, key: path[path.length - 1] ?? "", value: obj });
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => walk(v, [...path, String(i)], out));
    return out;
  }
  if (typeof obj === "object") {
    Object.entries(obj).forEach(([k, v]) => walk(v, [...path, k], out));
  }
  return out;
}

function findValue(entries, aliases, options = {}) {
  const names = aliases.map(norm);
  const matches = entries.filter((e) => names.includes(norm(e.key)));
  if (!matches.length) return options.fallback ?? "";
  const preferred = matches.find((e) => {
    const p = e.path.map(norm).join("/");
    return !/example|preview|default|option|description/.test(p);
  }) ?? matches[0];
  return preferred.value;
}

function findNumber(entries, aliases, fallback = 0) {
  const raw = findValue(entries, aliases, { fallback });
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number(String(raw).replace(/[^0-9+.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function findArray(obj, aliases) {
  if (!obj || typeof obj !== "object") return [];
  const names = aliases.map(norm);
  const queue = [obj];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    for (const [k, v] of Object.entries(current)) {
      if (names.includes(norm(k)) && Array.isArray(v)) return v;
      if (v && typeof v === "object") queue.push(v);
    }
  }
  return [];
}

function cleanList(items) {
  return (items ?? []).map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      const name = item.name ?? item.label ?? item.title ?? item.item ?? item.ability ?? item.perk;
      const desc = item.description ?? item.desc ?? item.text ?? item.effect ?? "";
      if (name && desc) return `${name}: ${desc}`;
      if (name) return String(name);
      return JSON.stringify(item);
    }
    return String(item ?? "");
  }).filter(Boolean);
}

export function extractCharacter(raw) {
  const root = raw?.character ?? raw?.data ?? raw?.state ?? raw;
  const entries = walk(root);
  const skills = {};

  for (const skill of SKILLS) {
    const value = findValue(entries, [skill, `${skill}skill`, `${skill}value`], { fallback: "" });
    if (value !== "") skills[skill] = Number.isNaN(Number(value)) ? value : Number(value);
  }

  const courageMax = findNumber(entries, ["couragemax", "maxcourage", "courageMaximum", "courage"], 0);
  const courageCurrentCandidate = findValue(entries, ["couragecurrent", "currentcourage", "current"], { fallback: "" });
  const courageCurrent = courageCurrentCandidate === ""
    ? courageMax
    : findNumber(entries, ["couragecurrent", "currentcourage", "current"], courageMax);

  return {
    name: String(root?.name ?? "Unnamed adventurer"),
    pronouns: String(root?.pronouns ?? ""),
    className: String(root?.class ?? ""),
    folk: String(root?.folk ?? ""),
    homeland: String(root?.homeland ?? ""),
    level: findNumber(entries, ["level", "lv"], 1) || 1,
    courageCurrent,
    courageMax,
    dread: String(findValue(entries, ["dreaddie", "dread", "dreadDie"], { fallback: "" })),
    attack: findNumber(entries, ["attack", "attackbonus"], 0),
    defense: findNumber(entries, ["defense", "defence", "defensebonus"], 0),
    questPoints: findNumber(entries, ["questpoints", "questpts", "qp"], 0),
    xp: findNumber(entries, ["xp", "experience"], 0),
    skills,
    proficiencies: cleanList(findArray(root, ["proficiencies", "proficiency"])),
    deficiencies: cleanList(findArray(root, ["deficiencies", "deficiency"])),
    inventory: cleanList(findArray(root, ["inventory", "equipment", "items", "gear"])),
    abilities: cleanList(findArray(root, ["abilities", "classabilities"])),
    perks: cleanList(findArray(root, ["perks", "folkperks", "classperks", "traits"])),
    ideals: String(root?.ideal ?? ""),
    flaws: String(root?.flaw ?? ""),
    backstory: String(root?.backstory ?? ""),
    personalQuest: String(root?.quest ?? ""),
    relationships: String(root?.relationships ?? ""),
    notes: String(root?.notes ?? "")
  };
}

export { SKILLS };
