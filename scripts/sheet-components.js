/**
 * Reusable Brackenvale sheet components.
 *
 * Each layout entry declares a component type. This module converts that
 * declaration into template-ready data without coupling the main sheet class
 * to individual fields or page layouts.
 */

export function prepareSheetComponent(component, actor, moduleId) {
  const flags = actor.flags?.[moduleId] ?? {};

  switch (component.component) {
    case "textField":
      return prepareTextField(component, actor, flags);

    case "checkboxField":
      return prepareCheckboxField(component, flags);

    default:
      console.warn(
        `${moduleId} | Unknown sheet component: ${component.component}`,
        component
      );

      return {
        ...component,
        unsupported: true
      };
  }
}

function prepareTextField(component, actor, flags) {
  const value =
    component.source === "actorName"
      ? actor.name
      : flags[component.flag] ?? "";

  return {
    ...component,
    isTextField: true,
    value,
    style: createPositionStyle(component)
  };
}

function prepareCheckboxField(component, flags) {
  const value = Boolean(flags[component.flag]);

  return {
    ...component,
    isCheckboxField: true,
    checked: value,
    style: createPositionStyle(component)
  };
}

function createPositionStyle(component) {
  return [
    `left:${component.left}%`,
    `top:${component.top}%`,
    `width:${component.width}%`,
    `height:${component.height}%`
  ].join(";");
}
