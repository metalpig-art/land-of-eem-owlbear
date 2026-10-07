import { recalculateEquipmentStats } from "./equipment.js";
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


const KNIGHT_ERRANT_ABILITIES = {
  "Wayfarer": "Wayfarer: Realms Check. Once every session, invent something about a place, landmark, or point of interest. Instant Action.",
  "Inspiring Orders": "Inspiring Orders: Inspire Check. Twice every session, on a 6+, grant +1 to all allies’ rolls during one phase of a Conflict, grant +2 to an ally’s Check before rolling, or heal an ally for 1d6 Courage.",
  "Tactical Combat": "Tactical Combat: Once every Combat, choose an Adversary. If the Knight-Errant and an ally are flanking that Adversary, both get +1 Attack and the target can’t Counterattack the ally.",
  "Feat of Strength": "Feat of Strength: Might Check. Once every session, perform an act of heroic strength beyond a normal adventurer’s capabilities.",
  "Discerning Eye": "Discerning Eye: Perception Check. Once every session, create a narrative weakness or vulnerability in someone or something within visual range. Instant Action.",
  "Sworn Protector": "Sworn Protector: Intimidate Check. Once every Combat, on a 6+, redirect a Close or Nearby Adversary’s attack against an ally to the Knight-Errant.",
  "Martial Prowess": "Martial Prowess: Increase Dread to 1d12. If mastered, this Ability grants +1d6 Courage.",
  "Faithful Steed": "Faithful Steed: Wilderness Check. The steed can follow complicated orders. Gain Advantage when performing stunts or tricky maneuvers, plus the chosen mount’s special benefit.",
  "Worldwise": "Worldwise: Realms Check. Once every session, invent a fact about a culture, faction, or group of people. Instant Action.",
  "Sweeping Strike": "Sweeping Strike: Once every Combat, attack 1d4+1 Close and Nearby targets with one Attack roll against multiple Defenses. On a 6–8, the targets can still Counterattack.",
  "Shrug It Off": "Shrug It Off: Once every session, Block 1d8 Dread from any source.",
  "War Stories": "War Stories: Lore Check. Once every session, tell a story about a past adventure or historical war to help the situation or convince an NPC.",
  "Oathbearer": "Oathbearer: Charm Check. Once every session, make a promise to an NPC which, under normal circumstances, they would not accept.",
  "Duel": "Duel: Once every Combat, initiate a duel with a Goon or Bruiser, or make a 6+ Intimidate Check to duel a Champion. For 1d4 rounds, both combatants can only attack each other; Attack results of 3–8 count as Hit with a Counterattack.",
  "Mighty Blow": "Mighty Blow: Once every Combat, declare a Mighty Blow before attacking. 1–2 Miss; 3–5 Hit with a Counterattack; 6–8 Hit +1d6 Dread; 9–11 Hit +2d6 Dread; 12+ Critical Hit +3d6 Dread.",
  "Commanding Presence": "Commanding Presence: Intimidate Check. Once every session, wordlessly impress or frighten an NPC out of Conflict or multiple Goons in or out of Conflict.",
  "Second Skin": "Second Skin: Any armor worn grants an additional -1 Defense and +1 Block, and inflicts no Disadvantage to Movement Checks.",
  "Hero of the People": "Hero of the People: Inspire Check. Once every session, rouse common folk to help your cause. Common folk also offer shelter, food, and basic supplies.",
  "Legendary Item": "Legendary Item: A legendary item from the Knight-Errant’s ancestors comes into their possession. Roll three times on the Relics Table and choose one to keep.",
  "Called Shot": "Called Shot: Attack. Once every Combat, target a specific location on an Adversary, object, or structure and describe the Called Shot’s narrative effect."
};

const KNIGHT_ERRANT_LEVEL_ABILITIES = {
  1: ["Wayfarer", "Inspiring Orders"],
  2: ["Tactical Combat", "Feat of Strength"],
  3: ["Discerning Eye", "Sworn Protector"],
  4: ["Martial Prowess", "Faithful Steed"],
  5: ["Worldwise", "Sweeping Strike"],
  6: ["Shrug It Off", "War Stories"],
  7: ["Oathbearer", "Duel"],
  8: ["Mighty Blow", "Commanding Presence"],
  9: ["Second Skin", "Hero of the People"],
  10: ["Legendary Item", "Called Shot"]
};

function masteredAbilityNames(root) {
  return Object.values(root?.mastery ?? {}).map(value => {
    const text = String(value ?? "");
    const colon = text.indexOf(":");
    return (colon >= 0 ? text.slice(colon + 1) : text).trim();
  }).filter(Boolean);
}

function progressionAbilities(root, className, level) {
  if (className !== "Knight-Errant" || level <= 1) return CLASS_ABILITIES[className] ?? [];
  const entries = [];
  for (const value of Object.values(root?.mastery ?? {})) {
    const text = String(value ?? "");
    const colon = text.indexOf(":");
    const levelPart = colon >= 0 ? text.slice(0, colon).trim() : "";
    const name = (colon >= 0 ? text.slice(colon + 1) : text).trim();
    if (name && !entries.some(entry => entry.name === name)) entries.push({ name, label: levelPart ? `LV ${levelPart} MASTERED` : "MASTERED" });
  }
  for (const name of KNIGHT_ERRANT_LEVEL_ABILITIES[Math.min(10, level)] ?? []) {
    if (!entries.some(entry => entry.name === name)) entries.push({ name, label: `LV ${level}` });
  }
  for (const extra of root?.extraAbilities ?? []) {
    const text = String(extra?.name ?? extra?.ability ?? extra ?? "").trim();
    const name = text.includes(":") && /^\d+:/.test(text) ? text.slice(text.indexOf(":") + 1).trim() : text;
    if (name && !entries.some(entry => entry.name === name)) entries.push({ name, label: "EXTRA ABILITY" });
  }
  return entries.map(({ name, label }) => {
    let text = KNIGHT_ERRANT_ABILITIES[name] ?? name;
    if (name === "Legendary Item" && root?.abilityChoices?.["Legendary Item"]) text += ` Chosen item: ${root.abilityChoices["Legendary Item"]}.`;
    return `${label} — ${text}`;
  });
}

function hasMastered(root, abilityName) {
  return masteredAbilityNames(root).some(name => name.toLowerCase() === String(abilityName).toLowerCase());
}

function hasWornArmor(itemCollections) {
  return [...(itemCollections.inventory ?? []), ...(itemCollections.magnificentItems ?? [])]
    .some(item => item?.worn && /armor|breastplate|mail|bascinet|helm/i.test(`${item?.type ?? ""} ${item?.name ?? ""}`));
}

function progressionDeficiencies(root) {
  const out = [];
  const texts = [root?.quirk, ...(root?.perks ?? [])].filter(Boolean);
  for (const text of texts) {
    const match = String(text).match(/Deficiency\s+in\s+([^.;]+)/i);
    if (match) out.push(match[1].trim());
  }
  return [...new Set(out)];
}

function appendStory(primary, secondary) {
  return [primary, secondary].map(v => String(v ?? "").trim()).filter(Boolean).join("\n");
}

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

function traitList(item) {
  return (item?.traits ?? []).map(trait => ({
    name: String(trait?.name ?? "").trim(),
    text: String(trait?.text ?? trait?.description ?? "").trim()
  })).filter(trait => trait.name || trait.text);
}

function equipmentItem(item, source = "Extra") {
  if (typeof item === "string") return { name: item, slots: 0, worn: false, type: "", cost: "", source };
  return {
    id: item?.id ?? null,
    name: String(item?.name ?? item?.label ?? item?.title ?? "Unnamed item"),
    slots: Number(item?.slots) || 0,
    worn: Boolean(item?.worn),
    type: String(item?.type ?? ""),
    cost: String(item?.cost ?? ""),
    properties: String(item?.properties ?? item?.property ?? item?.effect ?? item?.description ?? item?.text ?? ""),
    source
  };
}

function magnificentItem(item, source = "Acquired", classGranted = false) {
  const base = equipmentItem(item, source);
  return {
    ...base,
    traits: traitList(item),
    magnificent: true,
    classGranted: Boolean(classGranted)
  };
}

function isMagnificentItem(item) {
  return Boolean(item && typeof item === "object" && ((item.traits?.length ?? 0) > 0 || /^Magnificent\b/i.test(String(item.name ?? ""))));
}

function inventoryFromBuilder(root) {
  const inventory = [];
  const magnificentItems = [];
  for (const [name, slots] of HOMELAND_EQUIPMENT[root?.homeland] ?? []) {
    inventory.push({ name, slots, worn: false, type: "", cost: "", source: "Homeland" });
  }
  const add = (item, source, classGranted = false) => {
    if (!item) return;
    if (isMagnificentItem(item)) magnificentItems.push(magnificentItem(item, source, classGranted));
    else inventory.push(equipmentItem(item, source));
  };
  for (const item of root?.randomItems ?? []) add(item, "Random item");
  for (const item of root?.extraItems ?? []) add(item, "Extra item");
  add(root?.specialItem, root?.class === "Knight-Errant" ? "Knight-Errant starting perk" : "Special item", root?.class === "Knight-Errant");
  add(root?.gadget, "Gadget");
  add(root?.weapon, "Weapon");
  const legendary = String(root?.abilityChoices?.["Legendary Item"] ?? "").trim();
  if (legendary) inventory.push({ name: legendary, slots: 0, worn: false, type: "Relic", cost: "", source: "Level 10 Legendary Item" });
  return { inventory, magnificentItems };
}

function formatMagnificentPerk(item) {
  const details = (item?.traits ?? []).map(trait => `  - ${trait.name || "[trait]"}${trait.text ? ` ${trait.text}` : ""}`);
  return [item?.name || "Magnificent Item", ...details].join("\n");
}

function classChoiceList(root, magnificentItems = []) {
  if (!root?.classChoices || typeof root.classChoices !== "object") return [];
  const hasClassGrantedMagnificent = magnificentItems.some(item => item.classGranted);
  const choices = Object.entries(root.classChoices)
    .filter(([, value]) => value)
    .filter(([label, value]) => !(hasClassGrantedMagnificent && label === "Equipment" && /^Magnificent\b/i.test(String(value))))
    .map(([label, value]) => `${label}: ${value}`);
  for (const item of magnificentItems.filter(item => item.classGranted)) choices.unshift(formatMagnificentPerk(item));
  return choices;
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
  const level = Math.max(1, Math.min(10, Number(root?.level) || 1));
  const itemCollections = inventoryFromBuilder(root);
  let courageMax = classStats.courage ? classStats.courage + attributes.Vim : 0;
  let dread = classStats.dread;
  const attack = attributes.Vigor;
  const defense = -attributes.Knack;
  const questPoints = 3 + attributes.Knowhow;
  const block = deriveBlock(root);
  if (className === "Knight-Errant" && hasMastered(root, "Martial Prowess")) {
    dread = "d12";
    courageMax += Number(root?.martialCourage) || 0;
  }
  const inventorySlots = 20 + (Number(skills.might) || 0) + (Number(skills.vitality) || 0);

  const model = {
    name: String(root?.name ?? "Unnamed adventurer"),
    pronouns: String(root?.pronouns ?? ""),
    className,
    folk: String(root?.folk ?? ""),
    homeland: String(root?.homeland ?? ""),
    level,
    attributes,
    courageCurrent: courageMax,
    courageMax,
    dread,
    attack,
    defense,
    questPoints,
    block,
    inventorySlots,
    xp: Number(root?.xp) || 0,
    skills,
    proficiencies: cleanList(root?.profs ?? []),
    deficiencies: progressionDeficiencies(root),
    inventory: itemCollections.inventory,
    magnificentItems: itemCollections.magnificentItems,
    racialTraits: cleanList([...(root?.perks ?? []), ...(root?.quirk ? [root.quirk] : [])]),
    classPerks: classChoiceList(root, itemCollections.magnificentItems),
    abilities: progressionAbilities(root, className, level),
    ideals: appendStory(root?.ideal, root?.secondIdeal ? `Second Ideal: ${root.secondIdeal}` : ""),
    flaws: appendStory(root?.flaw, root?.secondFlaw ? `Second Flaw: ${root.secondFlaw}` : ""),
    backstory: String(root?.backstory ?? ""),
    personalQuest: String(root?.quest ?? ""),
    relationships: String(root?.relationships ?? ""),
    ally: String(root?.ally ?? ""),
    rival: String(root?.rival ?? ""),
    secondRival: String(root?.secondRival ?? ""),
    notes: String(root?.notes ?? ""),
    equipmentBase: { courageMax, dread, attack, defense, block, inventorySlots, skills: { ...skills } },
    equipmentRules: { secondSkin: className === "Knight-Errant" && hasMastered(root, "Second Skin") }
  };
  return recalculateEquipmentStats(model, { initial: true });
}

export { ATTRIBUTE_GROUPS, SKILLS };
