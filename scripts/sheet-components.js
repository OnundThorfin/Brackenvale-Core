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
    case "deathSaves":
      return prepareDeathSaves(component, actor, editable);
    case "weaponTable":
      return prepareWeaponTable(component, actor);
    default:
      console.warn(`${moduleId} | Unknown sheet component: ${component.component}`, component);
      return {...component, unsupported: true};
  }
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

  return {...component, isItemSummary: true, value, itemId, editable, style: createPositionStyle(component)};
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

function prepareDeathSaves(component, actor, editable) {
  const successes = Number(
    foundry.utils.getProperty(actor, "system.attributes.death.success") ?? 0
  );
  const failures = Number(
    foundry.utils.getProperty(actor, "system.attributes.death.failure") ?? 0
  );

  return {
    ...component,
    isDeathSaves: true,
    successes,
    failures,
    successDots: [1, 2, 3].map((value) => ({
      value,
      filled: value <= successes
    })),
    failureDots: [1, 2, 3].map((value) => ({
      value,
      filled: value <= failures
    })),
    editable,
    style: createPositionStyle(component)
  };
}

function prepareWeaponTable(component, actor) {
  const conditionMap =
    foundry.utils.getProperty(actor, "flags.brackenvale-core.weaponConditions") ?? {};

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
      const condition = Math.max(
        0,
        Math.min(5, Number(conditionMap[item.id] ?? 0))
      );

      return {
        id: item.id,
        name: item.name,
        attack: getWeaponAttackLabel(item),
        damage: getWeaponDamageLabel(item),
        mastery:
          foundry.utils.getProperty(item, "system.mastery")
          ?? foundry.utils.getProperty(item, "system.properties.mastery")
          ?? "",
        equipped: isWeaponEquipped(item),
        condition,
        conditionDots: [1, 2, 3, 4, 5].map((value) => ({
          value,
          filled: value <= condition
        }))
      };
    }) ?? [];

  while (weapons.length < (component.maxRows ?? 4)) {
    weapons.push({
      id: "",
      name: "",
      attack: "",
      damage: "",
      mastery: "",
      equipped: false,
      condition: 0,
      conditionDots: [1, 2, 3, 4, 5].map((value) => ({
        value,
        filled: false
      }))
    });
  }

  return {
    ...component,
    isWeaponTable: true,
    weapons,
    style: createPositionStyle(component)
  };
}

function isWeaponEquipped(item) {
  const direct = foundry.utils.getProperty(item, "system.equipped");
  if (typeof direct === "boolean") return direct;
  if (direct && typeof direct === "object" && "value" in direct) return Boolean(direct.value);

  const carried =
    foundry.utils.getProperty(item, "system.carried")
    ?? foundry.utils.getProperty(item, "system.container");

  return Boolean(carried === true);
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
  if (labels.damage) return String(labels.damage);

  const activity = getFirstActivity(item);
  const parts =
    foundry.utils.getProperty(activity, "damage.parts")
    ?? foundry.utils.getProperty(activity, "damage.include")
    ?? [];

  if (Array.isArray(parts)) {
    return parts
      .map((part) => {
        if (typeof part === "string") return part;
        return part?.formula ?? part?.number ?? part?.custom?.formula ?? "";
      })
      .filter(Boolean)
      .join(" + ");
  }

  return "";
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
