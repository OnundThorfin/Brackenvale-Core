/**
 * Brackenvale Character Sheet
 * Minimal rendering test for Foundry VTT 14 / D&D 5e 5.3.3
 */

const MODULE_ID = "brackenvale-core";
const TEMPLATE_PATH =
  "modules/brackenvale-core/templates/character-sheet.hbs";

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

  class BrackenvaleCharacterSheet extends CharacterActorSheet {
    static DEFAULT_OPTIONS = {
      ...super.DEFAULT_OPTIONS,

      classes: [
        ...(super.DEFAULT_OPTIONS?.classes ?? []),
        "brackenvale-character-sheet"
      ],

      position: {
        ...super.DEFAULT_OPTIONS?.position,
        width: 820,
        height: 680
      },

      window: {
        ...super.DEFAULT_OPTIONS?.window,
        title: "Brackenvale Character Sheet"
      }
    };

    static PARTS = {
      form: {
        template: TEMPLATE_PATH
      }
    };

    async _prepareContext(options) {
      const context = await super._prepareContext(options);

      context.actor = this.actor;
      context.system = this.actor.system ?? {};
      context.cssClass = "brackenvale-character-sheet";

      return context;
    }
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

  game.brackenvaleCore ??= {};
  game.brackenvaleCore.BrackenvaleCharacterSheet =
    BrackenvaleCharacterSheet;
});
