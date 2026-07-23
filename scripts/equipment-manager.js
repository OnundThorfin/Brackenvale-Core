/**
 * Brackenvale equipment state manager.
 * Keeps native D&D equipped state and Brackenvale inventory locations synchronized.
 */

export const EQUIPMENT_LOCATION_FLAG = "location";
const PREVIOUS_AC_FLAG = "previousArmorClass";
const DISABLED_AC_EFFECTS_FLAG = "disabledArmorClassEffects";
const ARMOR_AC_EFFECT_FLAG = "equippedArmorClass";

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
    const sourceAc = foundry.utils.getProperty(
      actor,
      "_source.system.attributes.ac"
    ) ?? {};

    await actor.setFlag(moduleId, PREVIOUS_AC_FLAG, {
      calc: sourceAc.calc ?? "default",
      flat: sourceAc.flat ?? null,
      formula: sourceAc.formula ?? ""
    });
  }

  // D&D5e can reapply a class AC calculation (such as Barbarian
  // Unarmored Defense) during data preparation even when the actor source
  // is set to custom. A managed Active Effect applies after that class
  // calculation and reliably selects the equipped-armor formula.
  const existingEffect = (actor.effects ?? []).find((effect) =>
    effect.getFlag(moduleId, ARMOR_AC_EFFECT_FLAG)
  );

  const effectData = {
    name: "Brackenvale Equipped Armor",
    icon: armor?.img ?? "icons/svg/shield.svg",
    disabled: false,
    transfer: false,
    changes: [
      {
        key: "system.attributes.ac.calc",
        mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
        value: "custom",
        priority: 100
      },
      {
        key: "system.attributes.ac.formula",
        mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
        value: "@attributes.ac.armor + @attributes.ac.dex",
        priority: 100
      }
    ],
    flags: {
      [moduleId]: {
        [ARMOR_AC_EFFECT_FLAG]: true
      }
    }
  };

  if (existingEffect) {
    await existingEffect.update(effectData);
  } else {
    await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }
}

async function restoreArmorClassIfUnarmored(
  actor,
  moduleId = "brackenvale-core"
) {
  const state = getEquipmentState(actor, moduleId);
  if (state.armor) return;

  const armorEffects = (actor.effects ?? []).filter((effect) =>
    effect.getFlag(moduleId, ARMOR_AC_EFFECT_FLAG)
  );

  if (armorEffects.length) {
    await actor.deleteEmbeddedDocuments(
      "ActiveEffect",
      armorEffects.map((effect) => effect.id)
    );
  }

  const saved = actor.getFlag(moduleId, PREVIOUS_AC_FLAG);

  if (saved) {
    await actor.update({
      "system.attributes.ac.calc": saved.calc ?? "default",
      "system.attributes.ac.flat": saved.flat ?? null,
      "system.attributes.ac.formula": saved.formula ?? ""
    });

    await actor.unsetFlag(moduleId, PREVIOUS_AC_FLAG);
  }

  // Clean up flags from the earlier experimental implementation.
  if (actor.getFlag(moduleId, DISABLED_AC_EFFECTS_FLAG)) {
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
