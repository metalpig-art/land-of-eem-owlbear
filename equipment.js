const SKILL_NAMES = [
  "charm","inspire","mettle","perception",
  "athletics","intimidate","might","vitality",
  "nimbleness","search","sneak","trickery",
  "lore","realms","tinker","wilderness"
];

const DIE_STEPS = ["d4","d6","d8","d10","d12"];

export function signedNumber(value) {
  const n = Number(value) || 0;
  return n > 0 ? `+${n}` : String(n);
}

function cloneSkills(skills = {}) {
  const out = {};
  for (const skill of SKILL_NAMES) out[skill] = Number(skills?.[skill]) || 0;
  return out;
}

function itemText(item) {
  const parts = [item?.properties, item?.property, item?.effect, item?.effects, item?.description, item?.text];
  for (const trait of item?.traits ?? []) parts.push(trait?.text, trait?.description);
  return parts.filter(Boolean).map(String).join(" ");
}

function isArmor(item) {
  return /armor|breastplate|mail|bascinet|helm|greaves|gauntlet|pauldron/i.test(`${item?.type ?? ""} ${item?.name ?? ""}`);
}

function armorBlockFallback(item, text) {
  if (/[-+]\s*\d+\s*Block/i.test(text)) return 0;
  const type = String(item?.type ?? "");
  if (/Armor\s*\(Heavy\)|Chest Armor\s*\(Heavy\)|Heavy Armor/i.test(type)) return 2;
  if (/Armor\s*\(Medium\)|Chest Armor\s*\(Medium\)|Medium Armor/i.test(type)) return 1;
  return 0;
}

function dieStep(die, steps) {
  const match = String(die ?? "").match(/d(4|6|8|10|12)/i);
  if (!match) return String(die ?? "");
  const current = `d${match[1]}`.toLowerCase();
  const index = DIE_STEPS.indexOf(current);
  if (index < 0) return String(die ?? "");
  return DIE_STEPS[Math.max(0, Math.min(DIE_STEPS.length - 1, index + steps))];
}

function parseSigned(text, label) {
  const regex = new RegExp(`([+-]\\s*\\d+)\\s*${label}\\b`, "gi");
  let total = 0;
  let match;
  while ((match = regex.exec(text))) total += Number(match[1].replace(/\s/g, "")) || 0;
  return total;
}

function parseSkills(text, skills) {
  for (const skill of SKILL_NAMES) {
    const label = skill[0].toUpperCase() + skill.slice(1);
    const delta = parseSigned(text, label);
    if (delta) skills[skill] = (Number(skills[skill]) || 0) + delta;
  }
}

function parseMaximumCourage(text) {
  let total = 0;
  const maxRegex = /([+-]\s*\d+)\s*(?:maximum|max)\s*Courage\b/gi;
  let match;
  while ((match = maxRegex.exec(text))) total += Number(match[1].replace(/\s/g, "")) || 0;
  const grantsRegex = /Grants?(?:\s+the\s+wearer)?[^.]{0,90}?([+-]\s*\d+)\s*Courage\b/gi;
  while ((match = grantsRegex.exec(text))) total += Number(match[1].replace(/\s/g, "")) || 0;
  return total;
}

function applyItem(item, stats) {
  if (!item?.worn) return;
  const text = itemText(item);
  stats.attack += parseSigned(text, "Attack");
  stats.defense += parseSigned(text, "Defense");
  stats.block += parseSigned(text, "Block") + armorBlockFallback(item, text);
  stats.inventorySlots += parseSigned(text, "Inventory Slots?");
  stats.courageMax += parseMaximumCourage(text);
  parseSkills(text, stats.skills);

  const dreadBonus = parseSigned(text, "Dread");
  if (dreadBonus) stats.dreadBonus += dreadBonus;
  // Apply the SRD's basic two-handed melee weapon bonus only while equipped.
  // Do not double-count if an existing description already explicitly includes it.
  if (isTwoHandedMeleeWeapon(item) && !/two.hand(?:ed)?[^.]{0,80}\+1\s*Dread/i.test(text)) {
    stats.dreadBonus += 1;
  }
  const upMatches = text.match(/Increase\s+Dread\s+by\s+one\s+die/gi) ?? [];
  const downMatches = text.match(/Decrease\s+Dread\s+by\s+one\s+die/gi) ?? [];
  stats.dreadDieSteps += upMatches.length - downMatches.length;
}

export function recalculateEquipmentStats(model, options = {}) {
  if (!model || typeof model !== "object") return model;
  const base = model.equipmentBase ?? {
    courageMax: Number(model.courageMax) || 0,
    dread: String(model.dread ?? ""),
    attack: Number(model.attack) || 0,
    defense: Number(model.defense) || 0,
    block: Number(model.block) || 0,
    inventorySlots: Number(model.inventorySlots) || 20,
    skills: cloneSkills(model.skills)
  };
  model.equipmentBase = {
    courageMax: Number(base.courageMax) || 0,
    dread: String(base.dread ?? ""),
    attack: Number(base.attack) || 0,
    defense: Number(base.defense) || 0,
    block: Number(base.block) || 0,
    inventorySlots: Number(base.inventorySlots) || 20,
    skills: cloneSkills(base.skills)
  };

  const previousMax = Number(model.courageMax) || 0;
  const previousCurrent = Number(model.courageCurrent) || 0;
  const stats = {
    courageMax: model.equipmentBase.courageMax,
    dread: model.equipmentBase.dread,
    dreadBonus: 0,
    dreadDieSteps: 0,
    attack: model.equipmentBase.attack,
    defense: model.equipmentBase.defense,
    block: model.equipmentBase.block,
    inventorySlots: model.equipmentBase.inventorySlots,
    skills: cloneSkills(model.equipmentBase.skills)
  };

  const items = [...(model.inventory ?? []), ...(model.magnificentItems ?? [])];
  for (const item of items) applyItem(item, stats);

  if (model.equipmentRules?.secondSkin && items.some(item => item?.worn && isArmor(item))) {
    stats.defense -= 1;
    stats.block += 1;
  }

  const stepped = dieStep(stats.dread, stats.dreadDieSteps);
  model.dread = stats.dreadBonus ? `${stepped} ${stats.dreadBonus > 0 ? "+" : ""}${stats.dreadBonus}` : stepped;
  model.attack = stats.attack;
  model.defense = stats.defense;
  model.block = stats.block;
  model.inventorySlots = stats.inventorySlots;
  model.skills = stats.skills;
  model.courageMax = stats.courageMax;

  if (options.initial || previousMax === 0 || previousCurrent >= previousMax) model.courageCurrent = stats.courageMax;
  else model.courageCurrent = Math.min(previousCurrent, stats.courageMax);
  return model;
}


const WEAPON_TYPES = /Bladed|Blunt|Ranged|Polearm|Flexible|Weapon/i;

/** Common weapon rules from the Land of Eem Core Rulebook, combat chapter. */
export function weaponRuleTexts(item) {
  const type = String(item?.type ?? "");
  const name = String(item?.name ?? "").replace(/^Magnificent\s+/i, "").trim();
  if (!WEAPON_TYPES.test(type)) return [];
  const rules = [];
  if (isTwoHandedMeleeWeapon(item)) rules.push("Two-handed melee weapon: +1 Dread while wielded.");
  if (/Ranged/i.test(type)) rules.push("Ranged attacks have Disadvantage at Close and Distant range.");
  if (/Thrown/i.test(type) || /\b(?:throwing\s+(?:axe|knife)|javelin|dart|boomerang)\b/i.test(name))
    rules.push("Thrown attacks have Disadvantage at Faraway range and cannot be thrown at Distant range.");
  if (/Bladed|Blunt|Polearm|Flexible/i.test(type)) rules.push("A melee weapon may be used in Close combat.");
  return rules;
}
export function isTwoHandedMeleeWeapon(item) {
  const name = String(item?.name ?? "").replace(/^Magnificent\s+/i, "").trim();
  const type = String(item?.type ?? "");
  if (!/Bladed|Blunt|Polearm|Flexible|Weapon/i.test(type)) return false;
  // Explicit two-handed entries; do not infer solely from item size or slot count.
  return item?.twoHanded === false ? false : (item?.twoHanded === true || /^(?:two[\s-]handed\s+sword|greatsword|greatclub)$/i.test(name) || (/Bladed|Blunt|Polearm|Flexible/i.test(type) && Number(item?.slots) >= 3));
}

export function isWeaponItem(item) {
  return /Bladed|Blunt|Ranged|Polearm|Flexible|Weapon/i.test(`${item?.type ?? ""} ${item?.source ?? ""}`);
}

export function weaponUseDescription(item) {
  const type=String(item?.type ?? "");
  const slots=Number(item?.slots);
  const name=String(item?.name ?? "").replace(/^Magnificent\s+/i, "").trim();
  if (!/Bladed|Blunt|Ranged|Polearm|Flexible|Weapon/i.test(type)) return [];
  const rules=[];
  if (/Ranged/i.test(type)) rules.push("Ranged weapon — ranged attacks have Disadvantage at Close and Distant range.");
  else rules.push("Melee weapon — may be used in Close combat.");
  if (/Thrown/i.test(type) || /\b(?:throwing\s+(?:axe|knife)|javelin|dart|boomerang)\b/i.test(name)) rules.push("Thrown attacks have Disadvantage at Faraway range and cannot be thrown at Distant range.");
  if (isTwoHandedMeleeWeapon(item)) rules.push("Two-handed — +1 Dread while equipped.");
  else if (!/Ranged/i.test(type)) rules.push(slots===1 ? "Light — generally one-handed (1 slot)." : slots===2 ? "Medium — generally one-handed (2 slots)." : "Weapon — check its handling with the GM.");
  return rules;
}
