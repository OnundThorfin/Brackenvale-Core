/**
 * Brackenvale equipment state manager.
 * Keeps native D&D equipped state and Brackenvale inventory locations synchronized.
 */

export const EQUIPMENT_LOCATION_FLAG = "location";
const PREVIOUS_AC_FLAG = "previousArmorClass";
const DISABLED_AC_EFFECTS_FLAG = "disabledArmorClassEffects";

const INVENTORY_TYPES = new Set([
  "weapon",
  "equipment",
  "consumable",
  "tool",
  "loot",
  "container"
]);

export function isInventoryItem(item) {
  return Boolean(item && INVENTORY_TYPES.has(item.type));
}

export function isShieldItem(item) {
  if (item?.type !== "equipment") return false;
  return getEquipmentIdentityValues(item).some((value) => value.includes("shield"));
}

export function isArmorItem(item) {
  if (item?.type !== "equipment" || isShieldItem(item)) return false;

  return getEquipmentIdentityValues(item).some((value) =>
    value.includes("armor")
    || ["light", "medium", "heavy"].includes(value)
  );
}

export function isArmorOrShieldItem(item) {
  return isArmorItem(item) || isShieldItem(item);
}

export function isNativeEquipped(item) {
  const direct = foundry.utils.getProperty(item, "system.equipped");
  if (typeof direct === "boolean") return direct;
  if (direct && typeof direct === "object" && "value" in direct) {
    return Boolean(direct.value);
  }
  return false;
}

export function getItemLocation(item, moduleId = "brackenvale-core") {
  return foundry.utils.getProperty(item, `flags.${moduleId}.${EQUIPMENT_LOCATION_FLAG}`)
    ?? (isNativeEquipped(item) ? "equipped" : "packed");
}

export function getEquipmentState(actor, moduleId = "brackenvale-core") {
  const items = (actor?.items ?? [])
    .filter(isInventoryItem)
    .map((item) => ({
      item,
      id: item.id,
      name: item.name,
      type: item.type,
      location: getItemLocation(item, moduleId),
      nativeEquipped: isNativeEquipped(item),
      isWeapon: item.type === "weapon",
      isArmor: isArmorItem(item),
      isShield: isShieldItem(item)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const equipped = items.filter((entry) => entry.location === "equipped");

  return {
    items,
    armor: equipped.find((entry) => entry.isArmor)?.item ?? null,
    shield: equipped.find((entry) => entry.isShield)?.item ?? null,
    weapons: equipped.filter((entry) => entry.isWeapon).map((entry) => entry.item),
    worn: items.filter((entry) => entry.location === "worn").map((entry) => entry.item),
    packedLeft: items
      .filter((entry) => entry.location === "packed" || entry.location === "packed-left")
      .map((entry) => entry.item),
    packedRight: items
      .filter((entry) => entry.location === "packed-right")
      .map((entry) => entry.item)
  };
}

export async function placeEquipmentItem(
  actor,
  sourceItem,
  zoneType,
  moduleId = "brackenvale-core"
) {
  if (!actor || !sourceItem) throw new Error("Actor and source item are required.");

  if (zoneType === "weapons" && sourceItem.type !== "weapon") {
    throw new Error("Only weapons can be placed in the Weapons section.");
  }

  if (zoneType === "armor" && !isArmorOrShieldItem(sourceItem)) {
    throw new Error("Only armor or shields can be placed in the Armor & Shield section.");
  }

  const location = ["armor", "weapons"].includes(zoneType)
    ? "equipped"
    : zoneType;
  const equipped = location === "equipped";
  const sourceIsArmor = isArmorItem(sourceItem);
  const sourceIsShield = isShieldItem(sourceItem);

  if (equipped && (sourceIsArmor || sourceIsShield)) {
    const state = getEquipmentState(actor, moduleId);
    const previous = sourceIsShield ? state.shield : state.armor;

    if (previous && previous.id !== sourceItem.id) {
      await previous.update({
        [`flags.${moduleId}.${EQUIPMENT_LOCATION_FLAG}`]: "packed-left",
        "system.equipped": false
      });
    }
  }

  let ownedItem = sourceItem.parent === actor ? sourceItem : null;

  if (ownedItem) {
    await ownedItem.update({
      [`flags.${moduleId}.${EQUIPMENT_LOCATION_FLAG}`]: location,
      "system.equipped": equipped
    });
  } else {
    const itemData = sourceItem.toObject();
    foundry.utils.setProperty(
      itemData,
      `flags.${moduleId}.${EQUIPMENT_LOCATION_FLAG}`,
      location
    );
    foundry.utils.setProperty(itemData, "system.equipped", equipped);
    delete itemData._id;

    [ownedItem] = await actor.createEmbeddedDocuments("Item", [itemData]);
  }

  if (sourceIsArmor) {
    if (equipped) {
      await applyArmorClass(actor, ownedItem, moduleId);
    } else {
      await restoreArmorClassIfUnarmored(actor, moduleId);
    }
  }

  return ownedItem;
}

export async function deleteEquipmentItem(
  actor,
  item,
  moduleId = "brackenvale-core"
) {
  const wasArmor = isArmorItem(item) && getItemLocation(item, moduleId) === "equipped";
  await item.delete();
  if (wasArmor) await restoreArmorClassIfUnarmored(actor, moduleId);
}

async function applyArmorClass(actor, armor, moduleId) {
  const saved = foundry.utils.getProperty(
    actor,
    `flags.${moduleId}.${PREVIOUS_AC_FLAG}`
  );

  if (!saved) {
    const ac = foundry.utils.getProperty(
      actor,
      "system.attributes.ac"
    ) ?? {};

    await actor.setFlag(moduleId, PREVIOUS_AC_FLAG, {
      calc: ac.calc ?? "default",
      flat: ac.flat ?? null,
      formula: ac.formula ?? ""
    });
  }

  // Class features such as Barbarian or Monk Unarmored Defense can override
  // system.attributes.ac.calc through an Active Effect. Temporarily disable
  // only effects that change the AC calculation while armor is equipped.
  const disabledEffectIds = [];

  for (const effect of actor.effects ?? []) {
    if (effect.disabled) continue;

    const changes = Array.from(effect.changes ?? []);
    const overridesArmorCalculation = changes.some((change) =>
      change?.key === "system.attributes.ac.calc"
    );

    if (!overridesArmorCalculation) continue;

    disabledEffectIds.push(effect.id);
    await effect.update({disabled: true});
  }

  if (disabledEffectIds.length) {
    await actor.setFlag(
      moduleId,
      DISABLED_AC_EFFECTS_FLAG,
      disabledEffectIds
    );
  }

  // Use D&D5e's equipped armor base and capped Dexterity modifier.
  // Shield, bonuses, and cover are added by the system after this base.
  await actor.update({
    "system.attributes.ac.calc": "custom",
    "system.attributes.ac.flat": null,
    "system.attributes.ac.formula":
      "@attributes.ac.armor + @attributes.ac.dex"
  });
}

async function restoreArmorClassIfUnarmored(
  actor,
  moduleId = "brackenvale-core"
) {
  const state = getEquipmentState(actor, moduleId);
  if (state.armor) return;

  const saved = actor.getFlag(moduleId, PREVIOUS_AC_FLAG);
  const disabledEffectIds =
    actor.getFlag(moduleId, DISABLED_AC_EFFECTS_FLAG) ?? [];

  if (saved) {
    await actor.update({
      "system.attributes.ac.calc": saved.calc ?? "default",
      "system.attributes.ac.flat": saved.flat ?? null,
      "system.attributes.ac.formula": saved.formula ?? ""
    });

    await actor.unsetFlag(moduleId, PREVIOUS_AC_FLAG);
  }

  for (const effectId of disabledEffectIds) {
    const effect = actor.effects?.get?.(effectId);
    if (effect) await effect.update({disabled: false});
  }

  if (disabledEffectIds.length) {
    await actor.unsetFlag(moduleId, DISABLED_AC_EFFECTS_FLAG);
  }
}

function getEquipmentIdentityValues(item) {
  return [
    foundry.utils.getProperty(item, "system.type.value"),
    foundry.utils.getProperty(item, "system.type.baseItem"),
    foundry.utils.getProperty(item, "system.armor.type"),
    foundry.utils.getProperty(item, "system.identifier"),
    item.name
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
}
