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
      return prepareSavingThrow(component, actor);
    case "skill":
      return prepareSkill(component, actor);
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

function prepareSavingThrow(component, actor) {
  const ability = foundry.utils.getProperty(actor, `system.abilities.${component.rollKey}`) ?? {};
  const rank = Number(ability.proficient ?? ability.proficiency ?? 0);
  const total = firstFinite(
    ability.save,
    ability.save?.value,
    ability.savingThrow,
    Number(ability.mod ?? 0) + (rank ? Number(foundry.utils.getProperty(actor, "system.attributes.prof") ?? 0) : 0)
  );

  return {
    ...component,
    isRollRow: true,
    rollType: "savingThrow",
    modifierValue: formatSignedNumber(total),
    proficiencyRank: Math.max(0, Math.min(2, rank)),
    style: createPositionStyle(component)
  };
}

function prepareSkill(component, actor) {
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
    style: createPositionStyle(component)
  };
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
