/**
 * Brackenvale Character Sheet
 * Foundry VTT 14 / D&D 5e 5.3.3
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
    /**
     * Add our sheet-specific CSS class and set its starting size.
     */
    static DEFAULT_OPTIONS = {
      ...super.DEFAULT_OPTIONS,

      classes: [
        ...(super.DEFAULT_OPTIONS?.classes ?? []),
        "brackenvale-character-sheet"
      ],

      position: {
        ...super.DEFAULT_OPTIONS?.position,
        width: 1120,
        height: 820
      },

      window: {
        ...super.DEFAULT_OPTIONS?.window,
        title: "Brackenvale Character Sheet"
      }
    };

    /**
     * Replace the standard D&D sheet parts with our single custom template.
     */
    static PARTS = {
      form: {
        template: TEMPLATE_PATH
      }
    };

    /**
     * Prepare all data required by the Brackenvale template.
     */
    async _prepareContext(options) {
      const context = await super._prepareContext(options);

      const actor = this.actor;
      const system = actor.system ?? {};

      context.actor = actor;
      context.system = system;
      context.cssClass = "brackenvale-character-sheet";

      context.abilities = this._prepareAbilities(system);
      context.skills = this._prepareSkills(system);

      const items = Array.from(actor.items ?? []);

      context.weapons = this._prepareWeapons(items);
      context.features = this._prepareFeatures(items);

      const spellData = this._prepareSpells(items);

      context.cantrips = spellData.cantrips;
      context.cantripBlanks = Array.from({
        length: Math.max(0, 6 - spellData.cantrips.length)
      });

      context.preparedSpellsLeft = spellData.preparedSpellsLeft;
      context.preparedSpellsRight = spellData.preparedSpellsRight;
      context.spellSlots = this._prepareSpellSlots(system);

      context.weaponSlots = this._makeBlankSlots(5);
      context.wornSlots = this._makeBlankSlots(10);
      context.packedGearLeft = this._makeBlankSlots(12);
      context.packedGearRight = this._makeBlankSlots(12);

      return context;
    }

    /**
     * Add tab switching and basic item interaction after rendering.
     */
    _onRender(context, options) {
      super._onRender(context, options);

      const root = this.element;

      if (!root) return;

      this._activatePageTabs(root);
      this._activateItemListeners(root);
      this._activateAbilityListeners(root);
      this._activateSkillListeners(root);
    }

    /**
     * Prepare the six ability score entries.
     */
    _prepareAbilities(system) {
      const abilities = system.abilities ?? {};
      const labels = CONFIG.DND5E?.abilities ?? {};

      return Object.entries(abilities).reduce(
        (prepared, [key, ability]) => {
          const value = Number(ability.value ?? 10);
          const mod =
            ability.mod ??
            Math.floor((value - 10) / 2);

          const save =
            ability.save ??
            ability.saveBonus ??
            mod;

          prepared[key] = {
            key,
            label:
              labels[key]?.label ??
              labels[key] ??
              key.toUpperCase(),
            value,
            mod,
            save,
            proficient: Number(ability.proficient ?? 0) > 0
          };

          return prepared;
        },
        {}
      );
    }

    /**
     * Prepare the actor's skill list.
     */
    _prepareSkills(system) {
      const skills = system.skills ?? {};
      const labels = CONFIG.DND5E?.skills ?? {};

      return Object.entries(skills).reduce(
        (prepared, [key, skill]) => {
          prepared[key] = {
            key,
            label:
              labels[key]?.label ??
              labels[key] ??
              key.toUpperCase(),

            total:
              skill.total ??
              skill.mod ??
              skill.value ??
              0,

            proficient:
              Number(skill.value ?? skill.proficient ?? 0) > 0
          };

          return prepared;
        },
        {}
      );
    }

    /**
     * Prepare equipped weapon items for Page One.
     */
    _prepareWeapons(items) {
      return items
        .filter((item) => item.type === "weapon")
        .slice(0, 5)
        .map((item) => {
          const itemSystem = item.system ?? {};

          return {
            id: item.id,
            name: item.name,

            attack:
              itemSystem.attack?.bonus ??
              itemSystem.bonus ??
              "—",

            damage:
              itemSystem.damage?.base?.formula ??
              itemSystem.damage?.parts?.[0]?.[0] ??
              itemSystem.damage?.formula ??
              "—"
          };
        });
    }

    /**
     * Prepare class, species, feat, and background features.
     */
    _prepareFeatures(items) {
      const featureTypes = new Set([
        "feat",
        "class",
        "subclass",
        "background",
        "race",
        "species"
      ]);

      return items
        .filter((item) => featureTypes.has(item.type))
        .map((item) => ({
          id: item.id,
          name: item.name,
          source:
            item.system?.source?.book ??
            item.system?.source?.custom ??
            item.type
        }));
    }

    /**
     * Prepare cantrips and prepared leveled spells.
     */
    _prepareSpells(items) {
      const spells = items
        .filter((item) => item.type === "spell")
        .map((item) => {
          const itemSystem = item.system ?? {};
          const level = Number(itemSystem.level ?? 0);

          const properties = new Set(
            itemSystem.properties instanceof Set
              ? Array.from(itemSystem.properties)
              : itemSystem.properties ?? []
          );

          const activationCondition =
            itemSystem.duration?.concentration ??
            properties.has("concentration") ??
            properties.has("con");

          const ritual =
            itemSystem.ritual ??
            properties.has("ritual") ??
            properties.has("rit");

          const materials =
            itemSystem.materials ??
            itemSystem.components?.material ??
            properties.has("material") ??
            properties.has("mat");

          return {
            id: item.id,
            name: item.name,
            level,

            concentration: Boolean(activationCondition),
            ritual: Boolean(ritual),
            material: Boolean(materials),

            prepared:
              level === 0 ||
              itemSystem.preparation?.prepared === true ||
              itemSystem.preparation?.mode === "always"
          };
        });

      const cantrips = spells
        .filter((spell) => spell.level === 0)
        .slice(0, 6);

      const prepared = spells
        .filter(
          (spell) =>
            spell.level > 0 &&
            spell.prepared
        )
        .sort(
          (a, b) =>
            a.level - b.level ||
            a.name.localeCompare(b.name)
        );

      const halfway = Math.ceil(prepared.length / 2);

      return {
        cantrips,
        preparedSpellsLeft: prepared.slice(0, halfway),
        preparedSpellsRight: prepared.slice(halfway)
      };
    }

    /**
     * Prepare spell slot values for levels 1–9.
     */
    _prepareSpellSlots(system) {
      const spells = system.spells ?? {};
      const slots = {};

      for (let level = 1; level <= 9; level += 1) {
        const slot = spells[`spell${level}`] ?? {};

        slots[level] = {
          value: Number(slot.value ?? 0),
          max: Number(slot.max ?? 0)
        };
      }

      return slots;
    }

    /**
     * Generate blank visible equipment lines.
     *
     * These are layout placeholders in the first build.
     * We will connect them to actor flags and inventory items next.
     */
    _makeBlankSlots(amount) {
      return Array.from(
        { length: amount },
        (_, index) => ({
          index,
          name: "",
          slots: ""
        })
      );
    }

    /**
     * Switch between the four visible sheet pages.
     */
    _activatePageTabs(root) {
      const buttons = root.querySelectorAll(
        ".brackenvale-sheet-tabs [data-page]"
      );

      const pages = root.querySelectorAll(
        ".brackenvale-page[data-page]"
      );

      for (const button of buttons) {
        button.addEventListener("click", (event) => {
          event.preventDefault();

          const selectedPage =
            button.dataset.page;

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

    /**
     * Open and roll actor items.
     */
    _activateItemListeners(root) {
      root
        .querySelectorAll(".item-open")
        .forEach((element) => {
          element.addEventListener(
            "click",
            (event) => {
              event.preventDefault();

              const itemId =
                element.dataset.itemId ??
                element.closest("[data-item-id]")
                  ?.dataset.itemId;

              const item = this.actor.items.get(itemId);
              item?.sheet?.render(true);
            }
          );
        });

      root
        .querySelectorAll(".item-roll")
        .forEach((element) => {
          element.addEventListener(
            "click",
            async (event) => {
              event.preventDefault();

              const itemId =
                element.dataset.itemId ??
                element.closest("[data-item-id]")
                  ?.dataset.itemId;

              const item = this.actor.items.get(itemId);

              if (!item) return;

              if (typeof item.use === "function") {
                await item.use({}, {});
                return;
              }

              if (typeof item.roll === "function") {
                await item.roll();
              }
            }
          );
        });
    }

    /**
     * Roll ability checks when supported by the D&D actor.
     */
    _activateAbilityListeners(root) {
      root
        .querySelectorAll(".ability-roll")
        .forEach((element) => {
          element.addEventListener(
            "click",
            async (event) => {
              event.preventDefault();

              const ability =
                element.dataset.ability;

              if (
                typeof this.actor.rollAbilityCheck ===
                "function"
              ) {
                await this.actor.rollAbilityCheck(ability);
              }
            }
          );
        });
    }

    /**
     * Roll skills when supported by the D&D actor.
     */
    _activateSkillListeners(root) {
      root
        .querySelectorAll(".skill-roll")
        .forEach((element) => {
          element.addEventListener(
            "click",
            async (event) => {
              event.preventDefault();

              const skill = element.dataset.skill;

              if (
                typeof this.actor.rollSkill === "function"
              ) {
                await this.actor.rollSkill(skill);
              }
            }
          );
        });
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