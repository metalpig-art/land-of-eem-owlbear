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

const CLASS_ABILITIES = {
  "Bard": [
    "Narrator: Inspire Check. Once every session, narrate a desired outcome of a single action or situation beginning with ‘And then…’ to make it happen (with +1 for rhyming).",
    "Little Ditty: Inspire Check. Once every session, out of Conflict, Invigorate all allies for Courage equal to the Inspire Check."
  ],
  "Dungeoneer": [
    "Dungeon Crew: Inspire or Intimidate Check. Once every session, make the crew do something useful; they excel at distractions, menial labor, and triggering traps.",
    "Reconnoiter: Realms Check. Once every session, make up a fact or rumor about a place or a group located there. Instant Action."
  ],
  "Gnome": [
    "Chronicler: Lore Check. Once every session, create a historical fact, bit of ancient knowledge, or trivia. Instant Action.",
    "Magic Feet: Nimbleness Check. Once every session, perform a spectacular acrobatic feat beyond normal capabilities, or reroll a Nimbleness Check."
  ],
  "Knight-Errant": [
    "Wayfarer: Realms Check. Once every session, invent something about a place, landmark, or point of interest. Instant Action.",
    "Inspiring Orders: Inspire Check. Twice every session, on a 6+, grant +1 to allies during one phase of a Conflict, grant +2 to an ally’s Check before rolling, or heal an ally for 1d6 Courage."
  ],
  "Loyal Chum": [
    "Old Chums: Charm Check. Once every session, invent an old friend who can help or give advice.",
    "Lend a Hand: Once every session, if an ally fails a Check, make the Check instead and replace the ally’s result. Gain Advantage when catching someone’s fall, pulling them from danger, or similar."
  ],
  "Rascal": [
    "Disappearing Act: Sneak Check. Once every session, hide in plain sight—even in seemingly impossible circumstances.",
    "Sticky Fingers: Nimbleness Check. Once every session, pickpocket an NPC and invent a stolen Mundane Item."
  ]
};

const HOMELAND_EQUIPMENT = {
  "The Drippy Downs": [
    ["Bear Trap",1],["Bedroll",1],["Canteen",1],["Knife",1],["Normal Rations",1],["Umbrella",1],["Walking Stick",2],["Cookware",2]
  ],
  "Drippy Downs": [
    ["Bear Trap",1],["Bedroll",1],["Canteen",1],["Knife",1],["Normal Rations",1],["Umbrella",1],["Walking Stick",2],["Cookware",2]
  ],
  "Fleabag County": [
    ["Comic Book [valuable]",0],["Pen and Paper",0],["Pouch of Copper Coins",0],["Can Opener",1],["Canteen",1],["Change of Fine Clothing",1],["Mirror",1],["Quality Rations",1]
  ],
  "The Quagmash": [
    ["Bug Repellent",0],["Canteen",1],["Chum Bucket",1],["Normal Rations",1],["Torch",1],["Fishing Pole",2],["Net",2],["Alchemy Set",2]
  ],
  "Quagmash": [
    ["Bug Repellent",0],["Canteen",1],["Chum Bucket",1],["Normal Rations",1],["Torch",1],["Fishing Pole",2],["Net",2],["Alchemy Set",2]
  ],
  "River Country": [
    ["Deck of Cards",0],["Bait and Tackle",1],["Bullhorn",1],["Normal Rations",1],["Overcoat with Hidden Pockets",1],["Waterskin",1],["50’ Rope",2],["Fishing Pole",2]
  ],
  "Scalawag Strand": [
    ["Compass",0],["Grappling Hook",1],["Knife",1],["Normal Rations",1],["Old Map [valuable]",0],["Waterskin",1],["50’ Rope",2],["Fishing Pole",2]
  ],
  "The Used T’Be Forest": [
    ["Tinderbox",0],["Bedroll",1],["Canteen",1],["Lantern",1],["Normal Rations",1],["Saw",1],["Stick of Dynamite",1],["Crafting Tools",2]
  ],
  "Used T’Be Forest": [
    ["Tinderbox",0],["Bedroll",1],["Canteen",1],["Lantern",1],["Normal Rations",1],["Saw",1],["Stick of Dynamite",1],["Crafting Tools",2]
  ],
  "The Dingledell": [
    ["Whistle",0],["Animal Feed",1],["Bedroll",1],["Gourmet Rations",1],["Pen and Journal",1],["Waterskin",1],["Cookware",2],["Walking Stick",2]
  ],
  "Dingledell": [
    ["Whistle",0],["Animal Feed",1],["Bedroll",1],["Gourmet Rations",1],["Pen and Journal",1],["Waterskin",1],["Cookware",2],["Walking Stick",2]
  ],
  "The Underlands": [
    ["Canteen",1],["Crowbar",1],["Hard Hat",1],["Lantern",1],["Normal Rations",1],["Rappelling Harness",1],["50’ Rope",2],["Pickaxe",2]
  ],
  "Underlands": [
    ["Canteen",1],["Crowbar",1],["Hard Hat",1],["Lantern",1],["Normal Rations",1],["Rappelling Harness",1],["50’ Rope",2],["Pickaxe",2]
  ]
};

function clampSkill(value) { return Math.max(-3, Math.min(3, Number(value) || 0)); }

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

function equipmentItem(item, source = "Extra") {
  if (typeof item === "string") return { name: item, slots: 0, worn: false, source };
  return {
    id: item?.id ?? null,
    name: String(item?.name ?? item?.label ?? item?.title ?? "Unnamed item"),
    slots: Number(item?.slots) || 0,
    worn: Boolean(item?.worn),
    type: item?.type ?? "",
    source
  };
}

function inventoryFromBuilder(root) {
  const items = [];
  for (const [name, slots] of HOMELAND_EQUIPMENT[root?.homeland] ?? []) {
    items.push({ name, slots, worn: false, source: "Homeland" });
  }
  for (const item of root?.randomItems ?? []) items.push(equipmentItem(item, "Random item"));
  for (const item of root?.extraItems ?? []) items.push(equipmentItem(item, "Extra item"));
  if (root?.specialItem) items.push(equipmentItem(root.specialItem, "Special item"));
  if (root?.gadget) items.push(equipmentItem(root.gadget, "Gadget"));
  if (root?.weapon) items.push(equipmentItem(root.weapon, "Weapon"));
  return items;
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
    racialTraits: cleanList(root?.perks ?? []),
    classPerks: classChoiceList(root),
    abilities: CLASS_ABILITIES[className] ?? [],
    ideals: String(root?.ideal ?? ""),
    flaws: String(root?.flaw ?? ""),
    backstory: String(root?.backstory ?? ""),
    personalQuest: String(root?.quest ?? ""),
    relationships: String(root?.relationships ?? ""),
    ally: String(root?.ally ?? ""),
    rival: String(root?.rival ?? ""),
    secondRival: String(root?.secondRival ?? ""),
    notes: String(root?.notes ?? "")
  };
}

export { ATTRIBUTE_GROUPS, SKILLS };
