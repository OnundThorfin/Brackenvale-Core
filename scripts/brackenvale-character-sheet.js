/**
 * Brackenvale Character Sheet
 * Initial registration test for Foundry VTT 14 and D&D 5e 5.3.3.
 */

const MODULE_ID = "brackenvale-core";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Registering Brackenvale Character Sheet`);

  const CharacterActorSheet =
    game.dnd5e?.applications?.actor?.CharacterActorSheet;

  if (!CharacterActorSheet) {
    console.error(
      `${MODULE_ID} | D&D 5e CharacterActorSheet could not be found.`
    );
    return;
  }

  /**
   * For now, this inherits the standard D&D 5e character sheet unchanged.
   * Once registration is confirmed, we will begin replacing its layout.
   */
class BrackenvaleCharacterSheet extends CharacterActorSheet {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: [
      ...(super.DEFAULT_OPTIONS?.classes ?? []),
      "brackenvale-character-sheet"
    ],
    window: {
      ...super.DEFAULT_OPTIONS?.window,
      title: "Brackenvale Character Sheet"
    }
  };
}

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    Actor,
    MODULE_ID,
    BrackenvaleCharacterSheet,
    {
      types: ["character"],
      makeDefault: false,
      label: "Brackenvale Character Sheet"
    }
  );

  // Makes the class accessible from the browser console while developing.
  game.brackenvaleCore ??= {};
  game.brackenvaleCore.BrackenvaleCharacterSheet =
    BrackenvaleCharacterSheet;
});
