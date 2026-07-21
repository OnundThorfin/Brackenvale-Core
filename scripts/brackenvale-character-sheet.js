/**
 * Brackenvale Character Sheet
 * Artwork-backed overlay architecture
 * Foundry VTT 14 / D&D 5e 5.3.3
 */

const MODULE_ID = "brackenvale-core";
const TEMPLATE_PATH =
  "modules/brackenvale-core/templates/character-sheet.hbs";

const PAGE_ONE_FIELDS = [
  {
    key: "characterName",
    type: "text",
    name: "name",
    source: "actorName",
    className: "line-field",
    left: 17.10,
    top: 8.55,
    width: 33.20,
    height: 2.10,
    label: "Character Name"
  },
  {
    key: "classLevel",
    type: "text",
    name: "flags.brackenvale-core.classLevel",
    flag: "classLevel",
    className: "line-field",
    left: 17.10,
    top: 10.75,
    width: 33.20,
    height: 2.10,
    label: "Class and Level"
  },
  {
    key: "background",
    type: "text",
    name: "flags.brackenvale-core.background",
    flag: "background",
    className: "line-field",
    left: 17.10,
    top: 12.93,
    width: 33.20,
    height: 2.10,
    label: "Background"
  },
  {
    key: "species",
    type: "text",
    name: "flags.brackenvale-core.species",
    flag: "species",
    className: "line-field",
    left: 17.10,
    top: 15.12,
    width: 33.20,
    height: 2.10,
    label: "Species"
  },
  {
    key: "culturalFeature",
    type: "text",
    name: "flags.brackenvale-core.culturalFeature",
    flag: "culturalFeature",
    className: "line-field",
    left: 17.10,
    top: 17.29,
    width: 33.20,
    height: 2.10,
    label: "Cultural Feature"
  },
  {
    key: "faith",
    type: "text",
    name: "flags.brackenvale-core.faith",
    flag: "faith",
    className: "line-field",
    left: 17.10,
    top: 19.48,
    width: 33.20,
    height: 2.10,
    label: "Faith"
  },
  {
    key: "homeland",
    type: "text",
    name: "flags.brackenvale-core.homeland",
    flag: "homeland",
    className: "line-field",
    left: 17.10,
    top: 21.66,
    width: 33.20,
    height: 2.10,
    label: "Homeland"
  },
  {
    key: "experiencePoints",
    type: "text",
    name: "flags.brackenvale-core.experiencePoints",
    flag: "experiencePoints",
    className: "line-field",
    left: 17.10,
    top: 23.84,
    width: 33.20,
    height: 2.10,
    label: "Experience Points"
  },
  {
    key: "nextLevel",
    type: "text",
    name: "flags.brackenvale-core.nextLevel",
    flag: "nextLevel",
    className: "line-field",
    left: 17.10,
    top: 26.03,
    width: 33.20,
    height: 2.10,
    label: "Next Level"
  },
  {
    key: "armorClass",
    type: "text",
    name: "flags.brackenvale-core.previewArmorClass",
    flag: "previewArmorClass",
    className: "box-field",
    left: 59.12,
    top: 11.95,
    width: 8.10,
    height: 5.25,
    label: "Armor Class"
  },
  {
    key: "initiative",
    type: "text",
    name: "flags.brackenvale-core.previewInitiative",
    flag: "previewInitiative",
    className: "box-field",
    left: 71.20,
    top: 11.95,
    width: 8.10,
    height: 5.25,
    label: "Initiative"
  },
  {
    key: "speed",
    type: "text",
    name: "flags.brackenvale-core.previewSpeed",
    flag: "previewSpeed",
    className: "box-field",
    left: 83.52,
    top: 11.95,
    width: 8.10,
    height: 5.25,
    label: "Speed"
  },
  {
    key: "proficiency",
    type: "text",
    name: "flags.brackenvale-core.previewProficiency",
    flag: "previewProficiency",
    className: "box-field",
    left: 60.55,
    top: 20.80,
    width: 8.10,
    height: 5.25,
    label: "Proficiency Bonus"
  },
  {
    key: "inspiration",
    type: "checkbox",
    name: "flags.brackenvale-core.previewInspiration",
    flag: "previewInspiration",
    className: "circle-field",
    left: 82.15,
    top: 21.02,
    width: 5.15,
    height: 5.15,
    label: "Inspiration"
  }
];

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
        width: 1080,
        height: 900
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
      const flags = this.actor.flags?.[MODULE_ID] ?? {};

      context.actor = this.actor;
      context.system = this.actor.system ?? {};
      context.cssClass = "brackenvale-character-sheet";
      context.pageOneFields = PAGE_ONE_FIELDS.map((field) => {
        const value =
          field.source === "actorName"
            ? this.actor.name
            : flags[field.flag] ?? "";

        return {
          ...field,
          value,
          checked: Boolean(value),
          style:
            `left:${field.left}%;` +
            `top:${field.top}%;` +
            `width:${field.width}%;` +
            `height:${field.height}%;`
        };
      });

      return context;
    }

    _onRender(context, options) {
      super._onRender(context, options);

      const root = this.element;
      if (!root) return;

      this._activateArtworkPageTabs(root);
    }

    _activateArtworkPageTabs(root) {
      const buttons = root.querySelectorAll(
        ".brackenvale-page-tabs [data-page]"
      );

      const pages = root.querySelectorAll(
        ".brackenvale-art-page[data-page]"
      );

      for (const button of buttons) {
        button.addEventListener("click", (event) => {
          event.preventDefault();

          const selectedPage = button.dataset.page;

          for (const tabButton of buttons) {
            tabButton.classList.toggle(
              "active",
              tabButton === button
            );
          }

          for (const page of pages) {
            page.classList.toggle(
              "active",
              page.dataset.page === selectedPage
            );
          }
        });
      }
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
