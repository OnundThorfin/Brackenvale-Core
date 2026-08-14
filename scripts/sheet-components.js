import {
  getEquipmentState,
  getItemLocation,
  getItemSlotValue,
  getEquipmentDamage,
  getEquipmentDamageCapacity,
  isEquipmentBroken,
  isArmorItem,
  isInventoryItem,
  isNativeEquipped,
  isShieldItem
} from "./equipment-manager.js";

/**
 * Brackenvale sheet component preparation.
 * Native D&D data is read from the Actor; Brackenvale-only data uses module flags.
 */

export function prepareSheetComponent(component, actor, moduleId, editable = true) {
  const flags = actor.flags?.[moduleId] ?? {};

  switch (component.component) {
    case "textField":
      return prepareTextField(component, actor, flags, editable);
    case "nativeField":
      return prepareNativeField(component, actor, editable);
    case "derivedField":
      return prepareDerivedField(component, actor);
    case "cantripList":
      return prepareCantripList(component, actor);
    case "itemSummary":
      return prepareItemSummary(component, actor, editable);
    case "checkboxField":
      return prepareCheckboxField(component, flags, editable);
    case "nativeCheckbox":
      return prepareNativeCheckbox(component, actor, editable);
    case "abilityScore":
      return prepareAbilityScore(component, actor, editable);
    case "savingThrow":
      return prepareSavingThrow(component, actor, editable);
    case "skill":
      return prepareSkill(component, actor, editable);
    case "hitDiceSummary":
      return prepareHitDiceSummary(component, actor, editable);
    case "deathSaveBubble":
      return prepareDeathSaveBubble(component, actor, editable);
    case "weaponTable":
      return prepareWeaponTable(component, actor);
    case "equipmentRegion":
      return prepareEquipmentRegion(component, actor, moduleId, editable);
    case "supplyWidget":
      return prepareSupplyWidget(component, actor, moduleId, editable);
    case "flagTextArea":
      return prepareFlagTextArea(component, actor, moduleId, editable);
    case "featureList":
      return prepareFeatureList(component, actor, editable);
    case "languageList":
      return prepareLanguageList(component, actor);
    case "proficiencyList":
      return prepareProficiencyList(component, actor);
    case "equippedDefenseName":
      return prepareEquippedDefenseName(component, actor);
    case "defenseConditionBubble":
      return prepareDefenseConditionBubble(component, actor, editable);
     case "cantripList":
  return prepareCantripList(component, actor); 
    default:
      console.warn(`${moduleId} | Unknown sheet component: ${component.component}`, component);
      return {...component, unsupported: true};
  }
}


function prepareFeatureList(component, actor, editable) {
  const items = Array.from(actor.items ?? [])
    .filter((item) => item.type === "feat")
    .sort((a, b) => {
      const aType = String(foundry.utils.getProperty(a, "system.type.value") ?? "");
      const bType = String(foundry.utils.getProperty(b, "system.type.value") ?? "");
      return aType.localeCompare(bType) || a.name.localeCompare(b.name);
    });

  const rows = items.map((item) => ({
    id: item.id,
    name: item.name,
    img: item.img ?? "",
    typeLabel:
      foundry.utils.getProperty(item, "system.type.label")
      ?? foundry.utils.getProperty(item, "system.type.value")
      ?? ""
  }));

  const classItems = Array.from(actor.items ?? [])
    .filter((item) => item.type === "class");

  return {
    ...component,
    isFeatureList: true,
    rows,
    classItems: classItems.map((item) => ({
      id: item.id,
      name: item.name,
      levels:
        foundry.utils.getProperty(item, "system.levels")
        ?? foundry.utils.getProperty(item, "system.level")
        ?? ""
    })),
    hasClass: classItems.length > 0,
    editable,
    style: createPositionStyle(component)
  };
}

function normalizeTraitValues(value) {
  if (value == null) return [];

  if (value instanceof Set) return Array.from(value);

  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeTraitValues(entry));
  }

  if (typeof value === "string") {
    return value
      .split(/[;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === "object") {
    if (value.value != null) {
      const values = normalizeTraitValues(value.value);
      const custom = normalizeTraitValues(value.custom);
      return [...values, ...custom];
    }

    return Object.entries(value)
      .filter(([, enabled]) => enabled === true || typeof enabled === "string")
      .map(([key, enabled]) => typeof enabled === "string" ? enabled : key);
  }

  return [];
}

function findConfiguredValue(config, key) {
  if (!config || typeof config !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(config, key)) return config[key];

  for (const entry of Object.values(config)) {
    if (!entry || typeof entry !== "object" || !entry.children) continue;
    const found = findConfiguredValue(entry.children, key);
    if (found !== undefined) return found;
  }

  return undefined;
}

function localizeConfiguredValues(values, config = {}) {
  return values.map((value) => {
    const key = String(value ?? "").trim();
    if (!key) return "";

    const configured = findConfiguredValue(config, key);
    if (configured == null) return key;

    if (typeof configured === "string") {
      return game.i18n?.localize(configured) ?? configured;
    }

    const label = configured.label ?? configured.name ?? key;
    return game.i18n?.localize(label) ?? label;
  }).filter(Boolean);
}

function prepareLanguageList(component, actor) {
  const trait = foundry.utils.getProperty(actor, "system.traits.languages");
  const values = normalizeTraitValues(trait);
  const config = CONFIG.DND5E?.languages ?? {};

  const rows = Array.from(new Set(localizeConfiguredValues(values, config)))
    .sort((a, b) => a.localeCompare(b));

  return {
    ...component,
    isLanguageList: true,
    rows,
    style: createPositionStyle(component)
  };
}

function prepareProficiencyList(component, actor) {
  const sources = [
    ["Armor", foundry.utils.getProperty(actor, "system.traits.armorProf"), CONFIG.DND5E?.armorProficiencies],
    ["Weapons", foundry.utils.getProperty(actor, "system.traits.weaponProf"), CONFIG.DND5E?.weaponProficiencies],
    ["Tools", foundry.utils.getProperty(actor, "system.traits.toolProf"), CONFIG.DND5E?.toolProficiencies]
  ];

  const groups = sources.map(([label, raw, config]) => {
    const values = normalizeTraitValues(raw);
    const rows = Array.from(new Set(localizeConfiguredValues(values, config ?? {})))
      .sort((a, b) => a.localeCompare(b));

    return {label, rows};
  }).filter((group) => group.rows.length);

  return {
    ...component,
    isProficiencyList: true,
    groups,
    style: createPositionStyle(component)
  };
}


function prepareSupplyWidget(component, actor, moduleId, editable) {
  const stored = foundry.utils.getProperty(
    actor,
    `flags.${moduleId}.supplyDice`
  );

  const rows = Array.from({length: component.rows ?? 5}, (_, index) => {
    const row = Array.isArray(stored) ? stored[index] ?? {} : {};
    const die = ["d12", "d10", "d8", "d6", "d4", "empty"].includes(row.die)
      ? row.die
      : "empty";
    const linkedItem = row.itemId ? actor.items?.get(row.itemId) ?? null : null;
    const name = linkedItem?.name ?? String(row.name ?? "");

    return {
      index,
      name,
      itemId: linkedItem?.id ?? "",
      linked: Boolean(linkedItem),
      die,
      isEmpty: die === "empty",
      options: [
        {value: "empty", label: "Empty", selected: die === "empty"},
        {value: "d4", label: "d4", selected: die === "d4"},
        {value: "d6", label: "d6", selected: die === "d6"},
        {value: "d8", label: "d8", selected: die === "d8"},
        {value: "d10", label: "d10", selected: die === "d10"},
        {value: "d12", label: "d12", selected: die === "d12"}
      ]
    };
  });

  return {
    ...component,
    isSupplyWidget: true,
    rows,
    editable,
    style: createPositionStyle(component)
  };
}

function prepareFlagTextArea(component, actor, moduleId, editable) {
  return {
    ...component,
    isFlagTextArea: true,
    value: String(
      foundry.utils.getProperty(actor, `flags.${moduleId}.${component.flag}`)
        ?? ""
    ),
    editable,
    style: createPositionStyle(component)
  };
}

function prepareTextField(component, actor, flags, editable) {
  return {
    ...component,
    isTextField: true,
    value: component.source === "actorName" ? actor.name : flags[component.flag] ?? "",
    disabled: !editable,
    style: createPositionStyle(component)
  };
}

function prepareNativeField(component, actor, editable) {
  return {
    ...component,
    isTextField: true,
    inputType: component.inputType ?? "text",
    value: foundry.utils.getProperty(actor, component.path) ?? "",
    disabled: !editable || component.readonly === true,
    readonly: component.readonly === true,
    style: createPositionStyle(component)
  };
}

function prepareDerivedField(component, actor) {
  let value = "";
  switch (component.derive) {
    case "nextLevel":
      value = foundry.utils.getProperty(actor, "system.details.xp.max") ?? "";
      break;
    case "initiative":
      value = formatSignedNumber(
        foundry.utils.getProperty(actor, "system.attributes.init.total")
        ?? foundry.utils.getProperty(actor, "system.attributes.init.mod")
        ?? 0
      );
      break;
    case "speed":
      value = formatSpeed(actor);
      break;
    case "proficiency":
      value = formatSignedNumber(foundry.utils.getProperty(actor, "system.attributes.prof") ?? 0);
      break;
    case "gearSlotSummary": {
      const state = getEquipmentState(actor);
      value = `${state.slotsUsed} / ${state.slotCapacity}`;
      break;
    }
  case "spellcastingAbility": {
  const casterClass = Array.from(actor.items ?? [])
    .filter((item) => item.type === "class")
    .map((item) => ({
      item,
      data: item.toObject()
    }))
    .find(({ data }) =>
      data.system?.spellcasting?.ability
    );

  const abilityKey =
    casterClass?.data?.system?.spellcasting?.ability
    ?? "";

  const abilityConfig = CONFIG.DND5E?.abilities?.[abilityKey];

  value = abilityKey
    ? game.i18n?.localize(
        abilityConfig?.label ?? abilityConfig ?? abilityKey
      )
    : "";

  break;
}

case "spellSaveDC": {
  const casterClass = Array.from(actor.items ?? [])
    .filter((item) => item.type === "class")
    .map((item) => ({
      item,
      data: item.toObject()
    }))
    .find(({ data }) =>
      data.system?.spellcasting?.ability
    );

  const abilityKey =
    casterClass?.data?.system?.spellcasting?.ability
    ?? "";

  const abilityMod = Number(
    foundry.utils.getProperty(
      actor,
      `system.abilities.${abilityKey}.mod`
    ) ?? 0
  );

  const proficiency = Number(
    foundry.utils.getProperty(
      actor,
      "system.attributes.prof"
    ) ?? 0
  );

  value = abilityKey
    ? 8 + abilityMod + proficiency
    : "";

  break;
}

case "spellAttackBonus": {
  const casterClass = Array.from(actor.items ?? [])
    .filter((item) => item.type === "class")
    .map((item) => ({
      item,
      data: item.toObject()
    }))
    .find(({ data }) =>
      data.system?.spellcasting?.ability
    );

  const abilityKey =
    casterClass?.data?.system?.spellcasting?.ability
    ?? "";

  const abilityMod = Number(
    foundry.utils.getProperty(
      actor,
      `system.abilities.${abilityKey}.mod`
    ) ?? 0
  );

  const proficiency = Number(
    foundry.utils.getProperty(
      actor,
      "system.attributes.prof"
    ) ?? 0
  );

  value = abilityKey
    ? formatSignedNumber(abilityMod + proficiency)
    : "";

  break;
}
case "cantripsKnown": {
  value = Array.from(actor.items ?? [])
    .filter(item =>
      item.type === "spell"
      && Number(foundry.utils.getProperty(item, "system.level") ?? -1) === 0
    )
    .length;
  break;
}

    default:
      value = foundry.utils.getProperty(actor, component.path) ?? "";
  }
  return {...component, isTextField: true, value, disabled: true, readonly: true, style: createPositionStyle(component)};
}

function prepareItemSummary(component, actor, editable) {
  const items = actor.items?.filter((item) => (component.itemTypes ?? []).includes(item.type)) ?? [];
  let value = component.emptyLabel ?? "";
  let itemId = "";

  if (items.length) {
    itemId = items[0].id;
    value = component.includeLevel
      ? items.map((item) => {
          const levels = foundry.utils.getProperty(item, "system.levels")
            ?? foundry.utils.getProperty(item, "system.level")
            ?? "";
          return levels ? `${item.name} ${levels}` : item.name;
        }).join(" / ")
      : items.map((item) => item.name).join(" / ");
  }

  const isClass =
    component.key === "classLevel"
    || (component.itemTypes ?? []).includes("class");

  const isBackground =
    component.key === "background"
    || (component.itemTypes ?? []).includes("background");

  const isSpecies =
    component.key === "species"
    || (component.itemTypes ?? []).some((type) => ["race", "species"].includes(type));

  const summaryKind = isClass
    ? "class"
    : isBackground
      ? "background"
      : isSpecies
        ? "species"
        : component.key;

  return {
    ...component,
    isItemSummary: false,
    isClassSummary: false,
    isSummaryControl: true,
    summaryKind,
    summaryAction: isClass ? "class-level-overlay" : "origin-summary",
    removeAction: isClass ? "remove-class" : "remove-origin",
    value,
    itemId,
    editable,
    style: createPositionStyle(component)
  };
}

function prepareCheckboxField(component, flags, editable) {
  return {...component, isCheckboxField: true, checked: Boolean(flags[component.flag]), disabled: !editable, style: createPositionStyle(component)};
}

function prepareNativeCheckbox(component, actor, editable) {
  return {...component, isCheckboxField: true, checked: Boolean(foundry.utils.getProperty(actor, component.path)), disabled: !editable, style: createPositionStyle(component)};
}

function prepareAbilityScore(component, actor, editable) {
  const ability = foundry.utils.getProperty(actor, `system.abilities.${component.ability}`) ?? {};
  return {
    ...component,
    isAbilityScore: true,
    scoreValue: ability.value ?? "",
    modifierValue: formatSignedNumber(ability.mod ?? 0),
    scoreName: `system.abilities.${component.ability}.value`,
    scoreStyle: createPositionStyle(component.score),
    modifierStyle: createPositionStyle(component.modifier),
    scoreDisabled: !editable
  };
}

function prepareSavingThrow(component, actor, editable) {
  const ability = foundry.utils.getProperty(actor, `system.abilities.${component.rollKey}`) ?? {};
  const rank = Number(ability.proficient ?? ability.proficiency ?? 0);
  const total = firstFinite(
    ability.save,
    ability.save?.value,
    ability.savingThrow,
    Number(ability.mod ?? 0)
      + (rank ? Number(foundry.utils.getProperty(actor, "system.attributes.prof") ?? 0) : 0)
  );

  return {
    ...component,
    isRollRow: true,
    rollType: "savingThrow",
    modifierValue: formatSignedNumber(total),
    proficiencyRank: rank > 0 ? 1 : 0,
    proficiencyEditable: editable,
    proficiencyPath: `system.abilities.${component.rollKey}.proficient`,
    maximumRank: 1,
    style: createPositionStyle(component)
  };
}

function prepareSkill(component, actor, editable) {
  const skill = foundry.utils.getProperty(actor, `system.skills.${component.rollKey}`) ?? {};
  const rank = Number(skill.value ?? skill.proficient ?? skill.proficiency ?? 0);
  const abilityKey = skill.ability ?? CONFIG.DND5E?.skills?.[component.rollKey]?.ability;
  const abilityMod = foundry.utils.getProperty(actor, `system.abilities.${abilityKey}.mod`) ?? 0;
  const proficiency = foundry.utils.getProperty(actor, "system.attributes.prof") ?? 0;
  const fallback = Number(abilityMod) + (Number.isFinite(rank) ? Number(proficiency) * rank : 0);

  return {
    ...component,
    isRollRow: true,
    rollType: "skill",
    modifierValue: formatSignedNumber(firstFinite(skill.total, skill.mod, skill.bonus, fallback)),
    proficiencyRank: Math.max(0, Math.min(2, rank)),
    proficiencyEditable: editable,
    proficiencyPath: `system.skills.${component.rollKey}.value`,
    maximumRank: 2,
    style: createPositionStyle(component)
  };
}

function prepareHitDiceSummary(component, actor, editable) {
  const classes = actor.items?.filter((item) => item.type === "class") ?? [];
  const firstClass = classes[0] ?? null;

  if (!firstClass) {
    return {
      ...component,
      isHitDiceSummary: true,
      itemId: "",
      denomination: "",
      total: "",
      used: "",
      usedPath: "",
      editable: false,
      style: createPositionStyle(component)
    };
  }

  const denomination =
    foundry.utils.getProperty(firstClass, "system.hitDice")
    ?? foundry.utils.getProperty(firstClass, "system.hd.denomination")
    ?? "";

  const total =
    foundry.utils.getProperty(firstClass, "system.levels")
    ?? foundry.utils.getProperty(firstClass, "system.level")
    ?? 0;

  const modernUsed = foundry.utils.getProperty(firstClass, "system.hd.spent");
  const legacyUsed = foundry.utils.getProperty(firstClass, "system.hitDiceUsed");
  const usedPath = modernUsed !== undefined ? "system.hd.spent" : "system.hitDiceUsed";
  const used = modernUsed ?? legacyUsed ?? 0;

  return {
    ...component,
    isHitDiceSummary: true,
    itemId: firstClass.id,
    denomination,
    total,
    used,
    usedPath,
    editable,
    style: createPositionStyle(component)
  };
}

function prepareDeathSaveBubble(component, actor, editable) {
  const current = Number(foundry.utils.getProperty(actor, component.path) ?? 0);

  return {
    ...component,
    isDeathSaveBubble: true,
    filled: Number(component.value) <= current,
    editable,
    style: createPositionStyle(component)
  };
}

function prepareWeaponTable(component, actor) {

  const weapons = actor.items
    ?.filter((item) => item.type === "weapon")
    .sort((a, b) => {
      const equippedA = isWeaponEquipped(a) ? 1 : 0;
      const equippedB = isWeaponEquipped(b) ? 1 : 0;
      if (equippedA !== equippedB) return equippedB - equippedA;
      return a.name.localeCompare(b.name);
    })
    .slice(0, component.maxRows ?? 4)
    .map((item) => {
      const penalty = getEquipmentDamage(item);
      const capacity = getEquipmentDamageCapacity(item);
      const broken = isEquipmentBroken(item);
      const mastery = getMasteryDetails(item);
      return {
        id: item.id,
        name: item.name,
        attack: applyNumericPenalty(getWeaponAttackLabel(item), penalty),
        damage: applyFormulaPenalty(getWeaponDamageLabel(item), penalty),
        mastery: mastery.label,
        masteryReference: mastery.reference,
        equipped: isWeaponEquipped(item),
        broken
      };
    }) ?? [];

  while (weapons.length < (component.maxRows ?? 4)) {
    weapons.push({
      id: "", name: "", attack: "", damage: "", mastery: "",
      masteryReference: "", equipped: false, broken: false
    });
  }

  return {...component, isWeaponTable: true, weapons, style: createPositionStyle(component)};
}


function prepareEquipmentRegion(component, actor, moduleId, editable) {
  const state = getEquipmentState(actor, moduleId);
  const region = component.sourceRegion ?? component.region;
  const slotOnly = component.displayMode === "slots";
  const damageOnly = component.displayMode === "damage";

  const summarize = (item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    slots: getItemSlotValue(item, moduleId),
    damage: getEquipmentDamage(item, moduleId),
    damageCapacity: getEquipmentDamageCapacity(item),
    damageDots: Array.from(
      {length: getEquipmentDamageCapacity(item)},
      (_, index) => {
        const value = index + 1;
        return {value, filled: value <= getEquipmentDamage(item, moduleId)};
      }
    ),
    broken: isEquipmentBroken(item, moduleId)
  });

  let items = [];
  let armorItem = null;
  let shieldItem = null;

  if (region === "armor") {
    armorItem = state.armor ? summarize(state.armor) : null;
    shieldItem = state.shield ? summarize(state.shield) : null;
  } else if (region === "weapons") {
    items = state.weapons.map(summarize);
  } else if (region === "worn") {
    items = state.worn.map(summarize);
  } else if (region === "packed-left") {
    items = state.packedLeft.map(summarize);
  } else if (region === "packed-right") {
    items = state.packedRight.map(summarize);
  }

  return {
    ...component,
    isEquipmentRegion: true,
    region,
    slotOnly,
    damageOnly,
    opaquePanel: Boolean(component.opaquePanel),
    itemRole: component.itemRole ?? "",
    items,
    slotRows: region === "armor"
      ? [armorItem, shieldItem].filter(Boolean)
      : items,
    damageRows: region === "armor"
      ? (
          component.itemRole === "armor"
            ? [armorItem].filter(Boolean)
            : component.itemRole === "shield"
              ? [shieldItem].filter(Boolean)
              : [armorItem, shieldItem].filter(Boolean)
        )
      : items,
    armorItem,
    shieldItem,
    editable,
    style: createPositionStyle(component)
  };
}

function applyNumericPenalty(value, penalty) {
  if (!penalty || value === "") return value;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return formatSignedNumber(numeric - penalty);
  const match = String(value).trim().match(/^([+-]?\d+)$/);
  if (match) return formatSignedNumber(Number(match[1]) - penalty);
  return `${value} − ${penalty}`;
}

function applyFormulaPenalty(value, penalty) {
  if (!penalty || !value) return value;
  return `${value} − ${penalty}`;
}

function getMasteryDetails(item) {
  const raw = foundry.utils.getProperty(item, "system.mastery")
    ?? foundry.utils.getProperty(item, "system.properties.mastery")
    ?? "";

  const rawKey = typeof raw === "string"
    ? raw
    : (raw?.value ?? raw?.identifier ?? raw?.name ?? "");

  const key = String(rawKey).trim().toLowerCase();
  if (!key) return {label: "", reference: ""};

  const collections = [
    CONFIG.DND5E?.weaponMasteries,
    CONFIG.DND5E?.weaponMastery,
    CONFIG.DND5E?.masteries
  ].filter(Boolean);

  let config = null;
  for (const collection of collections) {
    config =
      collection?.[key]
      ?? collection?.[rawKey]
      ?? Object.values(collection).find((entry) => {
        const label = String(entry?.label ?? entry?.name ?? "").toLowerCase();
        return label === key;
      })
      ?? null;

    if (config) break;
  }

  const labelValue = config?.label ?? config?.name ?? rawKey;
  const labelText = String(labelValue);

  return {
    label: game.i18n?.has?.(labelText)
      ? game.i18n.localize(labelText)
      : labelText,
    reference: String(config?.reference ?? "")
  };
}

function prepareEquippedDefenseName(component, actor) {
  const state = getEquipmentState(actor);
  const item = component.defenseType === "shield" ? state.shield : state.armor;

  return {
    ...component,
    isEquippedDefenseName: true,
    itemId: item?.id ?? "",
    value: item?.name ?? "",
    style: createPositionStyle(component)
  };
}

function prepareDefenseConditionBubble(component, actor, editable) {
  const item = findEquippedDefense(actor, component.defenseType);
  const current = item ? Number(foundry.utils.getProperty(actor, component.path) ?? 0) : 0;
  return {...component, isDefenseConditionBubble: true, itemId: item?.id ?? "", filled: Number(component.value) <= current, editable: Boolean(editable && item), style: createPositionStyle(component)};
}

function findEquippedDefense(actor, defenseType) {
  const state = getEquipmentState(actor);
  return defenseType === "shield" ? state.shield : state.armor;
}

function isWeaponEquipped(item) {
  return getItemLocation(item) === "equipped" || isNativeEquipped(item);
}

function getWeaponAttackLabel(item) {
  const labels = item.labels ?? {};
  const direct =
    labels.toHit
    ?? labels.attack
    ?? foundry.utils.getProperty(item, "system.attack.bonus");

  if (direct !== undefined && direct !== null && direct !== "") {
    const numeric = Number(direct);
    return Number.isFinite(numeric) ? formatSignedNumber(numeric) : String(direct);
  }

  const activity = getFirstActivity(item);
  const activityBonus =
    foundry.utils.getProperty(activity, "attack.bonus")
    ?? foundry.utils.getProperty(activity, "attack.flat");

  if (activityBonus !== undefined && activityBonus !== null && activityBonus !== "") {
    const numeric = Number(activityBonus);
    return Number.isFinite(numeric) ? formatSignedNumber(numeric) : String(activityBonus);
  }

  return "";
}

function getWeaponDamageLabel(item) {
  const labels = item.labels ?? {};
  let formula = labels.damage ? String(labels.damage) : "";

  if (!formula) {
    const activity = getFirstActivity(item);
    const parts =
      foundry.utils.getProperty(activity, "damage.parts")
      ?? foundry.utils.getProperty(activity, "damage.include")
      ?? [];

    if (Array.isArray(parts)) {
      formula = parts
        .map((part) => {
          if (typeof part === "string") return part;
          return part?.formula ?? part?.number ?? part?.custom?.formula ?? "";
        })
        .filter(Boolean)
        .join(" + ");
    }
  }

  if (!formula) return "";

  // Native labels in D&D 5.3 can expose only the base weapon dice.
  // Add the actor's relevant ability modifier when it is not already shown.
  if (!formula.includes("@mod") && !/[+-]\s*\d+\s*$/.test(formula.trim())) {
    const modifier = getWeaponAbilityModifier(item);
    if (modifier) formula = `${formula} ${modifier > 0 ? "+" : "−"} ${Math.abs(modifier)}`;
  }

  return formula;
}

function getWeaponAbilityModifier(item) {
  const actor = item.parent;
  if (!actor) return 0;

  const activity = getFirstActivity(item);
  const explicitAbility =
    foundry.utils.getProperty(activity, "attack.ability")
    ?? foundry.utils.getProperty(activity, "ability")
    ?? foundry.utils.getProperty(item, "system.ability");

  let ability = explicitAbility ? String(explicitAbility) : "";

  if (!ability) {
    const properties = foundry.utils.getProperty(item, "system.properties");
    const hasProperty = (key) => {
      if (properties instanceof Set) return properties.has(key);
      if (Array.isArray(properties)) return properties.includes(key);
      return Boolean(properties?.[key]);
    };

    const weaponType = String(
      foundry.utils.getProperty(item, "system.type.value") ?? ""
    ).toLowerCase();

    const attackType = String(
      foundry.utils.getProperty(activity, "attack.type.value")
      ?? foundry.utils.getProperty(activity, "attack.type")
      ?? ""
    ).toLowerCase();

    const isRangedWeapon =
      attackType.includes("ranged")
      || weaponType.includes("ranged")
      || weaponType.endsWith("r")
      || hasProperty("amm");

    ability = isRangedWeapon && !hasProperty("fin")
      ? "dex"
      : "str";

    if (hasProperty("fin")) {
      const strength = Number(foundry.utils.getProperty(actor, "system.abilities.str.mod") ?? 0);
      const dexterity = Number(foundry.utils.getProperty(actor, "system.abilities.dex.mod") ?? 0);
      ability = dexterity > strength ? "dex" : "str";
    }
  }

  return Number(foundry.utils.getProperty(actor, `system.abilities.${ability}.mod`) ?? 0);
}

function getFirstActivity(item) {
  const activities = foundry.utils.getProperty(item, "system.activities");
  if (!activities) return null;
  if (typeof activities.values === "function") return activities.values().next().value ?? null;
  if (Array.isArray(activities)) return activities[0] ?? null;
  if (typeof activities === "object") return Object.values(activities)[0] ?? null;
  return null;
}

function firstFinite(...values) {
  for (const value of values) {
    const candidate = typeof value === "object" ? value?.value : value;
    const number = Number(candidate);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function formatSpeed(actor) {
  const movement = foundry.utils.getProperty(actor, "system.attributes.movement") ?? {};
  return `${movement.walk ?? 0} ${movement.units ?? "ft"}`.trim();
}

function formatSignedNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value ?? "";
  return number >= 0 ? `+${number}` : `${number}`;
}

function createPositionStyle(component) {
  return [`left:${component.left}%`, `top:${component.top}%`, `width:${component.width}%`, `height:${component.height}%`].join(";");
}
function prepareCantripList(component, actor) {
  const rows = Array.from(actor.items ?? [])
    .filter(item =>
      item.type === "spell"
      && Number(foundry.utils.getProperty(item, "system.level") ?? -1) === 0
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(item => ({
      id: item.id,
      name: item.name
    }))
    .slice(0, component.rows ?? 15);

  return {
    ...component,
    isCantripList: true,
    rows,
    style: createPositionStyle(component)
  };
}
