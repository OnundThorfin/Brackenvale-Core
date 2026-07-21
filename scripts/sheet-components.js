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

    default:
      console.warn(
        `${moduleId} | Unknown sheet component: ${component.component}`,
        component
      );
      return {...component, unsupported: true};
  }
}

function prepareTextField(component, actor, flags, editable) {
  const value = component.source === "actorName"
    ? actor.name
    : flags[component.flag] ?? "";

  return {
    ...component,
    isTextField: true,
    value,
    disabled: !editable,
    style: createPositionStyle(component)
  };
}

function prepareNativeField(component, actor, editable) {
  return {
    ...component,
    isTextField: true,
    value: getProperty(actor, component.path) ?? "",
    disabled: !editable || component.readonly === true,
    readonly: component.readonly === true,
    style: createPositionStyle(component)
  };
}

function prepareDerivedField(component, actor) {
  let value = "";

  switch (component.derive) {
    case "nextLevel":
      value = getProperty(actor, "system.details.xp.max") ?? "";
      break;

    case "initiative":
      value = formatSignedNumber(
        getProperty(actor, "system.attributes.init.total")
        ?? getProperty(actor, "system.attributes.init.mod")
        ?? 0
      );
      break;

    case "speed":
      value = formatSpeed(actor);
      break;

    case "proficiency":
      value = formatSignedNumber(
        getProperty(actor, "system.attributes.prof") ?? 0
      );
      break;

    default:
      value = getProperty(actor, component.path) ?? "";
  }

  return {
    ...component,
    isTextField: true,
    value,
    disabled: true,
    readonly: true,
    style: createPositionStyle(component)
  };
}

function prepareItemSummary(component, actor, editable) {
  const items = actor.items?.filter((item) =>
    (component.itemTypes ?? []).includes(item.type)
  ) ?? [];

  let value = component.emptyLabel ?? "";
  let itemId = "";

  if (items.length) {
    itemId = items[0].id;

    if (component.includeLevel) {
      value = items.map((item) => {
        const levels = getProperty(item, "system.levels")
          ?? getProperty(item, "system.level")
          ?? "";
        return levels ? `${item.name} ${levels}` : item.name;
      }).join(" / ");
    } else {
      value = items.map((item) => item.name).join(" / ");
    }
  }

  return {
    ...component,
    isItemSummary: true,
    value,
    itemId,
    editable,
    style: createPositionStyle(component)
  };
}

function prepareCheckboxField(component, flags, editable) {
  return {
    ...component,
    isCheckboxField: true,
    checked: Boolean(flags[component.flag]),
    disabled: !editable,
    style: createPositionStyle(component)
  };
}

function prepareNativeCheckbox(component, actor, editable) {
  return {
    ...component,
    isCheckboxField: true,
    checked: Boolean(getProperty(actor, component.path)),
    disabled: !editable,
    style: createPositionStyle(component)
  };
}

function prepareAbilityScore(component, actor, editable) {
  const ability = getProperty(actor, `system.abilities.${component.ability}`) ?? {};
  const modifier = Number(ability.mod ?? 0);

  return {
    ...component,
    isAbilityScore: true,
    scoreValue: ability.value ?? "",
    modifierValue: formatSignedNumber(modifier),
    scoreName: `system.abilities.${component.ability}.value`,
    scoreStyle: createPositionStyle(component.score),
    modifierStyle: createPositionStyle(component.modifier),
    scoreDisabled: !editable
  };
}

function formatSpeed(actor) {
  const movement = getProperty(actor, "system.attributes.movement") ?? {};
  const walk = movement.walk ?? 0;
  const units = movement.units ?? "ft";
  return `${walk} ${units}`.trim();
}

function formatSignedNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value ?? "";
  return number >= 0 ? `+${number}` : `${number}`;
}

function createPositionStyle(component) {
  return [
    `left:${component.left}%`,
    `top:${component.top}%`,
    `width:${component.width}%`,
    `height:${component.height}%`
  ].join(";");
}
