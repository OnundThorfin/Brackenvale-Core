/**
 * Brackenvale Character Sheet
 * Component-driven artwork renderer
 * Foundry VTT 14 / D&D 5e 5.3.3
 */

import { prepareSheetComponent } from "./sheet-components.js";

const MODULE_ID = "brackenvale-core";
const TEMPLATE_PATH =
  "modules/brackenvale-core/templates/character-sheet.hbs";
const LAYOUT_ROOT =
  "modules/brackenvale-core/layouts";

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

    static #layoutCache = null;

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      const layouts = await this._loadLayouts();

      context.actor = this.actor;
      context.system = this.actor.system ?? {};
      context.cssClass = "brackenvale-character-sheet";
      context.pages = layouts.map((layout, index) => ({
        ...layout,
        active: index === 0,
        components: layout.components.map((component) =>
          prepareSheetComponent(
            component,
            this.actor,
            MODULE_ID
          )
        )
      }));

      return context;
    }

    async _loadLayouts() {
      if (BrackenvaleCharacterSheet.#layoutCache) {
        return BrackenvaleCharacterSheet.#layoutCache;
      }

      const pageNumbers = [1, 2, 3, 4];

      const layouts = await Promise.all(
        pageNumbers.map(async (pageNumber) => {
          const response = await fetch(
            `${LAYOUT_ROOT}/page${pageNumber}.json`
          );

          if (!response.ok) {
            throw new Error(
              `${MODULE_ID} | Could not load page ${pageNumber} layout.`
            );
          }

          return response.json();
        })
      );

      BrackenvaleCharacterSheet.#layoutCache = layouts;
      return layouts;
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
