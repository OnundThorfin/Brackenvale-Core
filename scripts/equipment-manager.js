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


export function getItemSlotValue(item, moduleId = "brackenvale-core") {
  const override = Number(
    foundry.utils.getProperty(item, `flags.${moduleId}.slots`)
  );

  if (Number.isFinite(override) && override >= 0) {
    return override;
  }

  const quantity = Math.max(
    1,
    Number(foundry.utils.getProperty(item, "system.quantity") ?? 1)
  );
  const identity = getEquipmentIdentityValues(item);
  const name = String(item?.name ?? "").trim().toLowerCase();

  if (name.includes("belt pouch")) return 0;
  if (name.includes("backpack") || name === "sack" || name.endsWith(" sack")) {
    return quantity;
  }

  if (isShieldItem(item)) return quantity;
  if (isArmorItem(item)) {
    if (identity.some((value) => value.includes("heavy"))) return 3 * quantity;
    if (identity.some((value) => value.includes("medium"))) return 2 * quantity;
    return quantity;
  }

  if (item?.type === "weapon") {
    return (isTwoHandedWeapon(item) ? 2 : 1) * quantity;
  }

  if (isNegligibleItem(item)) return 0;
  if (isCoinOrGemItem(item)) return Math.ceil(quantity / 100);
  if (isProvisionItem(item)) return Math.ceil(quantity / 5);
  if (isWaterItem(item)) return quantity;
  if (isSupplyDieItem(item, moduleId)) return quantity;

  return quantity;
}

export function getActorSlotCapacity(actor, moduleId = "brackenvale-core") {
  const override = Number(
    foundry.utils.getProperty(actor, `flags.${moduleId}.totalSlots`)
  );

  if (Number.isFinite(override) && override >= 0) {
    return override;
  }

  const strength = Number(
    foundry.utils.getProperty(actor, "system.abilities.str.value") ?? 0
  );
  const bonus = Number(
    foundry.utils.getProperty(actor, `flags.${moduleId}.bonusSlots`) ?? 0
  );

  return Math.max(0, strength + (Number.isFinite(bonus) ? bonus : 0));
}

export function getEncumbranceState(slotsUsed, slotCapacity) {
  const excess = Math.max(0, Number(slotsUsed) - Number(slotCapacity));

  if (excess === 0) {
    return {key: "normal", label: "Unencumbered", effect: "No penalty"};
  }

  if (excess <= 5) {
    return {
      key: "encumbered",
      label: "Encumbered",
      effect: "Speed reduced by 10 feet"
    };
  }

  if (excess <= 10) {
    return {
      key: "heavily-encumbered",
      label: "Heavily Encumbered",
      effect: "Speed halved"
    };
  }

  return {
    key: "overloaded",
    label: "Overloaded",
    effect: "Cannot willingly travel"
  };
}

function isTwoHandedWeapon(item) {
  const properties = foundry.utils.getProperty(item, "system.properties");
  const values = [];

  if (properties instanceof Set) {
    values.push(...properties);
  } else if (Array.isArray(properties)) {
    values.push(...properties);
  } else if (properties && typeof properties === "object") {
    for (const [key, value] of Object.entries(properties)) {
      if (value === true || value === 1 || value === "true") values.push(key);
      else if (typeof value === "string") values.push(value);
    }
  }

  const normalized = values.map((value) =>
    String(value).trim().toLowerCase().replace(/[\s_-]+/g, "")
  );

  return normalized.some((value) =>
    ["two", "twohanded", "2h"].includes(value)
  );
}

function isNegligibleItem(item) {
  if (!item || isArmorOrShieldItem(item) || item.type === "weapon") return false;

  const name = String(item.name ?? "").trim().toLowerCase();
  const negligibleNames = [
    "ring",
    "whistle",
    "quill",
    "ink pen",
    "needle",
    "fishhook",
    "locket",
    "brooch",
    "button",
    "key",
    "seal",
    "signet",
    "belt pouch"
  ];

  return negligibleNames.some((entry) =>
    name === entry || name.startsWith(`${entry} `) || name.endsWith(` ${entry}`)
  );
}

function isCoinOrGemItem(item) {
  const name = String(item?.name ?? "").toLowerCase();
  return item?.type === "loot"
    && (name.includes("coin") || name.includes("gem"));
}

function isProvisionItem(item) {
  const name = String(item?.name ?? "").toLowerCase();
  return [
    "ration",
    "rations",
    "provision",
    "provisions",
    "hardtack",
    "jerky",
    "dried fruit",
    "salted meat",
    "smoked fish"
  ].some((term) => name.includes(term));
}

function isWaterItem(item) {
  const name = String(item?.name ?? "").toLowerCase();
  return name === "water"
    || name.includes("gallon of water")
    || name.includes("water ration");
}

function isSupplyDieItem(item, moduleId) {
  return Boolean(
    foundry.utils.getProperty(item, `flags.${moduleId}.supplyDie`)
    ?? foundry.utils.getProperty(item, `flags.${moduleId}.supplyDieSize`)
  );
}


export function getEquipmentDamage(item, moduleId = "brackenvale-core") {
  const value = Number(
    foundry.utils.getProperty(item, `flags.${moduleId}.equipmentDamage`) ?? 0
  );
  const capacity = getEquipmentDamageCapacity(item);
  return Math.max(0, Math.min(capacity, Number.isFinite(value) ? value : 0));
}

export function getEquipmentDamageCapacity(item) {
  if (!item) return 0;

  if (isShieldItem(item)) return 3;

  if (isArmorItem(item)) {
    const identity = getEquipmentIdentityValues(item);
    if (identity.some((value) => value.includes("heavy"))) return 4;
    if (identity.some((value) => value.includes("medium"))) return 3;
    return 2;
  }

  if (item.type === "weapon") {
    if (hasWeaponProperty(item, ["light", "lgt"])) return 2;
    if (isTwoHandedWeapon(item)) return 4;
    return 3;
  }

  return 0;
}

export function isEquipmentBroken(item, moduleId = "brackenvale-core") {
  const capacity = getEquipmentDamageCapacity(item);
  return capacity > 0 && getEquipmentDamage(item, moduleId) >= capacity;
}

export async function setEquipmentDamage(
  item,
  requestedDamage,
  moduleId = "brackenvale-core"
) {
  const capacity = getEquipmentDamageCapacity(item);
  if (!capacity) return;

  const current = getEquipmentDamage(item, moduleId);
  const requested = Number(requestedDamage);
  const next = requested === current
    ? Math.max(0, requested - 1)
    : Math.max(0, Math.min(capacity, requested));

  await item.update({
    [`flags.${moduleId}.equipmentDamage`]: next
  });

  if (isArmorOrShieldItem(item) && getItemLocation(item, moduleId) === "equipped") {
    await refreshEquippedArmorClass(item.actor, moduleId);
  }
}

function hasWeaponProperty(item, candidates) {
  const properties = foundry.utils.getProperty(item, "system.properties");
  const values = [];

  if (properties instanceof Set) values.push(...properties);
  else if (Array.isArray(properties)) values.push(...properties);
  else if (properties && typeof properties === "object") {
    for (const [key, value] of Object.entries(properties)) {
      if (value === true || value === 1 || value === "true") values.push(key);
      else if (typeof value === "string") values.push(value);
    }
  }

  const normalized = values.map((value) =>
    String(value).trim().toLowerCase().replace(/[\s_-]+/g, "")
  );

  return candidates.some((candidate) =>
    normalized.includes(String(candidate).toLowerCase().replace(/[\s_-]+/g, ""))
  );
}

async function refreshEquippedArmorClass(actor, moduleId = "brackenvale-core") {
  if (!actor) return;
  const state = getEquipmentState(actor, moduleId);
  if (state.armor) await applyArmorClass(actor, state.armor, moduleId);
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
      isShield: isShieldItem(item),
      slots: getItemSlotValue(item, moduleId),
      damage: getEquipmentDamage(item, moduleId),
      damageCapacity: getEquipmentDamageCapacity(item),
      broken: isEquipmentBroken(item, moduleId)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const equipped = items.filter((entry) => entry.location === "equipped");

  const slotCapacity = getActorSlotCapacity(actor, moduleId);
  const slotsUsed = items.reduce((total, entry) => total + entry.slots, 0);

  return {
    items,
    slotCapacity,
    slotsUsed,
    encumbrance: getEncumbranceState(slotsUsed, slotCapacity),
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
        value: (() => {
          const state = getEquipmentState(actor, moduleId);
          const armorDamage = state.armor
            ? getEquipmentDamage(state.armor, moduleId)
            : 0;
          const shieldDamage = state.shield
            ? getEquipmentDamage(state.shield, moduleId)
            : 0;
          const shieldBonus = state.shield
            ? Math.max(0, Number(foundry.utils.getProperty(state.shield, "system.armor.value") ?? 2) - shieldDamage)
            : 0;
          const armorBroken = state.armor
            ? isEquipmentBroken(state.armor, moduleId)
            : false;

          if (armorBroken) return `10 + @abilities.dex.mod + ${shieldBonus}`;
          return `@attributes.ac.armor + @attributes.ac.dex - ${armorDamage} + ${shieldBonus}`;
        })(),
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
