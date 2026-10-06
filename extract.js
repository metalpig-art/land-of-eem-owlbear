const ATTRIBUTE_GROUPS = [
  { key: "Vim", skills: ["charm", "inspire", "mettle", "perception"] },
  { key: "Vigor", skills: ["athletics", "intimidate", "might", "vitality"] },
  { key: "Knack", skills: ["nimbleness", "search", "sneak", "trickery"] },
  { key: "Knowhow", skills: ["lore", "realms", "tinker", "wilderness"] }
];

const SKILLS = ATTRIBUTE_GROUPS.flatMap(group => group.skills);

const CLASS_STATS = {
  "Bard": { courage: 12, dread: "d4" },
  "Dungeoneer": { courage: 13, dread: "d8" },
  "Gnome": { courage: 14, dread: "d8" },
  "Knight-Errant": { courage: 15, dread: "d10" },
  "Loyal Chum": { courage: 13, dread: "d6" },
  "Rascal": { courage: 12, dread: "d6" }
};

function clampSkill(value) {
  return Math.max(-3, Math.min(3, Number(value) || 0));
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

function inventoryFromBuilder(root) {
  const items = [];
  for (const item of root?.randomItems ?? []) items.push(item);
  for (const item of root?.extraItems ?? []) items.push(item);
  if (root?.specialItem) items.push(root.specialItem);
  if (root?.gadget) items.push(root.gadget);
  if (root?.weapon) items.push(root.weapon);
  return cleanList(items);
}

function classChoiceList(root) {
  if (!root?.classChoices || typeof root.classChoices !== "object") return [];
  return Object.entries(root.classChoices)
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`);
}

function calculateSkills(root, attributes) {
  const skills = {};
  const parentBySkill = {};

  for (const group of ATTRIBUTE_GROUPS) {
    for (const skill of group.skills) {
      parentBySkill[skill] = group.key;
      skills[skill] = Number(attributes[group.key]) || 0;
    }
  }

  // Character creation step 4: tweak one skill in each attribute band.
  // +2/+1 skills lose 1; +0/-1 skills gain 1.
  for (const skillName of Object.values(root?.tweaks ?? {})) {
    const skill = String(skillName ?? "").toLowerCase();
    const parent = parentBySkill[skill];
    if (!parent) continue;
    const base = Number(attributes[parent]) || 0;
    skills[skill] = clampSkill(skills[skill] + (base >= 1 ? -1 : 1));
  }

  const bonus = String(root?.bonus ?? "").toLowerCase();
  if (bonus in skills) skills[bonus] = clampSkill(skills[bonus] + 1);

  const penalty = String(root?.penalty ?? "").toLowerCase();
  if (penalty in skills) skills[penalty] = clampSkill(skills[penalty] - 1);

  return skills;
}

function deriveBlock(root) {
  const text = cleanList(root?.perks ?? []).join(" ");
  const match = text.match(/\+\s*(\d+)\s*Block/i);
  return match ? Number(match[1]) : 0;
}

export function extractCharacter(raw) {
  const root = raw?.character ?? raw?.data ?? raw?.state ?? raw ?? {};

  const attributes = {
    Vim: Number(root?.attrs?.Vim) || 0,
    Vigor: Number(root?.attrs?.Vigor) || 0,
    Knack: Number(root?.attrs?.Knack) || 0,
    Knowhow: Number(root?.attrs?.Knowhow) || 0
  };

  const skills = calculateSkills(root, attributes);
  const className = String(root?.class ?? "");
  const classStats = CLASS_STATS[className] ?? { courage: 0, dread: "" };
  const courageMax = classStats.courage ? classStats.courage + attributes.Vim : 0;
  const attack = attributes.Vigor;
  const defense = -attributes.Knack;
  const questPoints = 3 + attributes.Knowhow;
  const inventorySlots = 20 + (Number(skills.might) || 0) + (Number(skills.vitality) || 0);

  return {
    name: String(root?.name ?? "Unnamed adventurer"),
    pronouns: String(root?.pronouns ?? ""),
    className,
    folk: String(root?.folk ?? ""),
    homeland: String(root?.homeland ?? ""),
    level: 1,
    attributes,
    courageCurrent: courageMax,
    courageMax,
    dread: classStats.dread,
    attack,
    defense,
    questPoints,
    block: deriveBlock(root),
    inventorySlots,
    xp: 0,
    skills,
    proficiencies: cleanList(root?.profs ?? []),
    deficiencies: [],
    inventory: inventoryFromBuilder(root),
    abilities: [],
    perks: [...cleanList(root?.perks ?? []), ...classChoiceList(root)],
    ideals: String(root?.ideal ?? ""),
    flaws: String(root?.flaw ?? ""),
    backstory: String(root?.backstory ?? ""),
    personalQuest: String(root?.quest ?? ""),
    relationships: String(root?.relationships ?? ""),
    notes: String(root?.notes ?? "")
  };
}

export { ATTRIBUTE_GROUPS, SKILLS };
