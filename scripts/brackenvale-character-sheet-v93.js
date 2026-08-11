/**
 * Brackenvale Character Sheet
 * Native D&D data binding + GM layout calibration
 * Foundry VTT 14 / D&D 5e 5.3.3
 */

import { prepareSheetComponent } from "./sheet-components-v93.js";
import {
  deleteEquipmentItem,
  isArmorOrShieldItem,
  placeEquipmentItem,
  setEquipmentDamage
} from "./equipment-manager.js";

const MODULE_ID = "brackenvale-core";
console.info("Brackenvale Core character sheet runtime: 0.5.4-test.93");
const TEMPLATE_PATH =
  "modules/brackenvale-core/templates/character-sheet-v93.hbs";
const LAYOUT_ROOT =
  "modules/brackenvale-core/layouts";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Registering Brackenvale Character Sheet (equipment repository repair)`);

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
      form: {template: TEMPLATE_PATH}
    };

    static #layoutCache = null;

    _workingLayouts = null;
    _calibrationMode = false;
    _selectedCalibrationField = null;
    _activePage = 1;

    async _prepareContext(options) {
      const context = await super._prepareContext(options);

      if (!this._workingLayouts) {
        const layouts = await this._loadLayouts();
        this._workingLayouts = foundry.utils.deepClone(layouts);
      }

      const editable = Boolean(this.isEditable);

      context.actor = this.actor;
      context.system = this.actor.system ?? {};
      context.cssClass = "brackenvale-character-sheet";
      context.editable = editable;
      context.isGM = Boolean(game.user?.isGM);
      context.calibrationMode = this._calibrationMode;

      context.pages = this._workingLayouts.map((layout) => ({
        ...layout,
        active: Number(layout.page) === Number(this._activePage),
        components: layout.components.map((component) =>
          prepareSheetComponent(
            component,
            this.actor,
            MODULE_ID,
            editable
          )
        )
      }));

      return context;
    }

    _preparePage2DirectData() {
      const features = Array.from(this.actor.items ?? [])
        .filter((item) => item.type === "feat")
        .map((item) => ({
          id: item.id,
          name: item.name,
          type: foundry.utils.getProperty(item, "system.type.label")
            ?? foundry.utils.getProperty(item, "system.type.value")
            ?? ""
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const classes = Array.from(this.actor.items ?? [])
        .filter((item) => item.type === "class")
        .map((item) => ({
          id: item.id,
          name: item.name,
          levels: foundry.utils.getProperty(item, "system.levels")
            ?? foundry.utils.getProperty(item, "system.level")
            ?? ""
        }));

      const traitValues = (trait) => {
        if (!trait) return [];
        const values = trait.value ?? trait;
        const custom = trait.custom ?? "";
        let list = [];
        if (values instanceof Set) list.push(...values);
        else if (Array.isArray(values)) list.push(...values);
        else if (typeof values === "string") list.push(...values.split(/[;,]/));
        else if (values && typeof values === "object") {
          for (const [key, enabled] of Object.entries(values)) {
            if (enabled === true) list.push(key);
          }
        }
        if (typeof custom === "string" && custom.trim()) list.push(...custom.split(/[;,]/));
        return list.map((v) => String(v ?? "").trim()).filter(Boolean);
      };

      const localizeValues = (values, config = {}) =>
        Array.from(new Set(values.map((value) => {
          const configured = config?.[value];
          if (typeof configured === "string") return game.i18n?.localize(configured) ?? configured;
          if (configured && typeof configured === "object") {
            const label = configured.label ?? configured.name ?? value;
            return game.i18n?.localize(label) ?? label;
          }
          return value;
        }))).sort((a, b) => a.localeCompare(b));

      const languages = localizeValues(
        traitValues(foundry.utils.getProperty(this.actor, "system.traits.languages")),
        CONFIG.DND5E?.languages ?? {}
      );

      const proficiencyGroups = [
        ["Armor", "system.traits.armorProf", CONFIG.DND5E?.armorProficiencies ?? {}],
        ["Weapons", "system.traits.weaponProf", CONFIG.DND5E?.weaponProficiencies ?? {}],
        ["Tools", "system.traits.toolProf", CONFIG.DND5E?.toolProficiencies ?? {}]
      ].map(([label, path, config]) => ({
        label,
        values: localizeValues(traitValues(foundry.utils.getProperty(this.actor, path)), config)
      })).filter((group) => group.values.length);

      return {features, classes, languages, proficiencyGroups};
    }


    async _loadLayouts() {
      if (BrackenvaleCharacterSheet.#layoutCache) {
        return BrackenvaleCharacterSheet.#layoutCache;
      }

      const pageNumbers = [1, 2, 3, 4];
      const layouts = await Promise.all(
        pageNumbers.map(async (pageNumber) => {
          const response = await fetch(
            `${LAYOUT_ROOT}/page${pageNumber}-v69.json`,
            {cache: "no-store"}
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
      const root = this.element;
      if (!root) return;

      this._activateArtworkPageTabs(root);
      this._activateItemEditors(root);
      this._activatePage2FeatureControls(root);
      this._activateClassIntegration(root);
      this._activateNativeDataBindings(root);
      this._activateCalibrationControls(root);
      this._activateAbilityRolls(root);
      this._activateProficiencyControls(root);
      this._activateDeathSaveControls(root);
      this._activateHitDiceControls(root);
      this._activateWeaponControls(root);
      this._activateEquipmentDamageControls(root);
      this._activateEquipmentDropZones(root);
      this._activateEquipmentControls(root);
      this._activateEquipmentDragging(root);
      this._activateSupplyControls(root);
      this._activateFlagTextAreas(root);
    }
    _activateSupplyControls(root) {
      const getRows = () => {
        const stored = foundry.utils.getProperty(
          this.actor,
          `flags.${MODULE_ID}.supplyDice`
        );
        return Array.from({length: 5}, (_, index) => ({
          name: String(stored?.[index]?.name ?? ""),
          itemId: String(stored?.[index]?.itemId ?? ""),
          die: ["d12", "d10", "d8", "d6", "d4", "empty"].includes(stored?.[index]?.die)
            ? stored[index].die
            : "empty"
        }));
      };

      const saveRows = async (rows) => {
        await this.actor.update({
          [`flags.${MODULE_ID}.supplyDice`]: rows
        });
        this.render();
      };

      const clearSupplyRow = () => ({
        name: "",
        itemId: "",
        die: "empty"
      });

      const deleteSupply = async (index, {confirm = true} = {}) => {
        const rows = getRows();
        const row = rows[index];
        if (!row) return false;

        const supplyName = row.name || "this supply";
        if (confirm) {
          let approved = false;
          const DialogV2 = foundry.applications?.api?.DialogV2;
          if (DialogV2?.confirm) {
            approved = await DialogV2.confirm({
              window: {title: "Delete Supply Item"},
              content: `<p>Delete <strong>${foundry.utils.escapeHTML(supplyName)}</strong> from Supplies and from the character's inventory?</p>`,
              yes: {label: "Delete"},
              no: {label: "Cancel"},
              modal: true
            });
          } else {
            approved = window.confirm(
              `Delete ${supplyName} from Supplies and from the character's inventory?`
            );
          }
          if (!approved) return false;
        }

        const linkedItem = row.itemId
          ? this.actor.items.get(row.itemId) ?? null
          : null;

        rows[index] = clearSupplyRow();

        if (linkedItem) {
          await linkedItem.delete();
        }

        await this.actor.update({
          [`flags.${MODULE_ID}.supplyDice`]: rows
        });

        this.render();
        return true;
      };

      const supplyZone = root.querySelector("[data-supply-drop-zone]");
      if (supplyZone) {
        const clearSupplyHighlight = () => {
          supplyZone.classList.remove("supply-drag-target");
        };

        supplyZone.addEventListener("dragenter", (event) => {
          if (this._calibrationMode || !this.isEditable) return;
          event.preventDefault();
          supplyZone.classList.add("supply-drag-target");
        });

        supplyZone.addEventListener("dragover", (event) => {
          if (this._calibrationMode || !this.isEditable) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "link";
        });

        supplyZone.addEventListener("dragleave", (event) => {
          if (supplyZone.contains(event.relatedTarget)) return;
          clearSupplyHighlight();
        });

        supplyZone.addEventListener("drop", async (event) => {
          clearSupplyHighlight();
          if (this._calibrationMode || !this.isEditable) return;
          event.preventDefault();
          event.stopPropagation();

          let data = null;
          const raw = event.dataTransfer?.getData("application/json")
            || event.dataTransfer?.getData("text/plain");
          if (raw) {
            try {
              data = JSON.parse(raw);
            } catch (_error) {
              data = null;
            }
          }
          if (data) await this._handleSupplyDrop(data);
        });
      }

      for (const input of root.querySelectorAll(
        "[data-action='edit-supply-name']"
      )) {
        input.addEventListener("change", async (event) => {
          if (this._calibrationMode || !this.isEditable) return;
          const index = Number(event.currentTarget.dataset.supplyIndex);
          if (!Number.isInteger(index)) return;

          const rows = getRows();
          if (rows[index].itemId) return;
          rows[index].name = event.currentTarget.value.trim();
          await saveRows(rows);
        });
      }

      for (const select of root.querySelectorAll(
        "[data-action='set-supply-die']"
      )) {
        select.addEventListener("change", async (event) => {
          if (this._calibrationMode || !this.isEditable) return;
          const index = Number(event.currentTarget.dataset.supplyIndex);
          if (!Number.isInteger(index)) return;

          const rows = getRows();
          const nextDie = event.currentTarget.value;

          if (nextDie === "empty") {
            await deleteSupply(index, {confirm: false});
            return;
          }

          rows[index].die = nextDie;
          await saveRows(rows);
        });
      }

      for (const button of root.querySelectorAll(
        "[data-action='delete-supply']"
      )) {
        button.addEventListener("click", async (event) => {
          if (this._calibrationMode || !this.isEditable) return;
          event.preventDefault();
          event.stopPropagation();

          const index = Number(event.currentTarget.dataset.supplyIndex);
          if (!Number.isInteger(index)) return;
          await deleteSupply(index, {confirm: true});
        });
      }

      for (const button of root.querySelectorAll(
        "[data-action='roll-supply-die']"
      )) {
        button.addEventListener("click", async (event) => {
          if (this._calibrationMode || !this.isEditable) return;
          event.preventDefault();

          const index = Number(event.currentTarget.dataset.supplyIndex);
          if (!Number.isInteger(index)) return;

          const rows = getRows();
          const row = rows[index];
          const supplyName = row.name || "Supply";

          if (row.die === "empty") {
            ui.notifications.warn(`${supplyName} is exhausted.`);
            return;
          }

          const faces = Number(row.die.slice(1));
          const roll = await (new Roll(`1d${faces}`)).evaluate();
          const result = Number(roll.total);
          const steps = ["d12", "d10", "d8", "d6", "d4", "empty"];
          const currentIndex = steps.indexOf(row.die);
          let nextDie = row.die;

          if (result <= 2) {
            nextDie = steps[Math.min(currentIndex + 1, steps.length - 1)];
            rows[index].die = nextDie;
            if (nextDie !== "empty") {
              await this.actor.update({
                [`flags.${MODULE_ID}.supplyDice`]: rows
              });
            }
          }

          const outcome = result <= 2
            ? nextDie === "empty"
              ? `${supplyName} is exhausted and has been removed from inventory.`
              : `${supplyName} decreases to ${nextDie}.`
            : `${supplyName} remains at ${row.die}.`;

          await roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor: this.actor}),
            flavor: `<strong>${supplyName} Supply Die</strong><br>${outcome}`
          });

          if (nextDie === "empty") {
            await deleteSupply(index, {confirm: false});
          } else {
            this.render();
          }
        });
      }
    }

    async _handleSupplyDrop(data) {
      if (!data || data.type !== "Item") {
        ui.notifications?.warn("Only items can be tracked as supplies.");
        return;
      }

      let item = data.id ? this.actor.items.get(data.id) ?? null : null;
      if (!item && data.uuid) {
        const source = await fromUuid(data.uuid);
        if (source?.parent === this.actor) {
          item = source;
        } else if (source?.documentName === "Item") {
          const itemData = source.toObject();
          delete itemData._id;
          [item] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
        }
      }

      if (!item) {
        ui.notifications?.warn("Brackenvale could not find that supply item.");
        return;
      }

      const stored = foundry.utils.getProperty(
        this.actor,
        `flags.${MODULE_ID}.supplyDice`
      );
      const rows = Array.from({length: 5}, (_, index) => ({
        name: String(stored?.[index]?.name ?? ""),
        itemId: String(stored?.[index]?.itemId ?? ""),
        die: ["d12", "d10", "d8", "d6", "d4", "empty"].includes(stored?.[index]?.die)
          ? stored[index].die
          : "empty"
      }));

      const existingIndex = rows.findIndex((row) => row.itemId === item.id);
      if (existingIndex >= 0) {
        ui.notifications?.info(`${item.name} is already tracked as a Supply Die.`);
        return;
      }

      const emptyIndex = rows.findIndex(
        (row) => !row.itemId && !row.name && row.die === "empty"
      );
      if (emptyIndex < 0) {
        ui.notifications?.warn("All Supply rows are currently in use.");
        return;
      }

      rows[emptyIndex] = {
        name: item.name,
        itemId: item.id,
        die: "d12"
      };

      await item.update({
        [`flags.${MODULE_ID}.supplyTracked`]: true,
        [`flags.${MODULE_ID}.slots`]: 1
      });

      await this.actor.update({
        [`flags.${MODULE_ID}.supplyDice`]: rows
      });

      ui.notifications?.info(`${item.name} is now tracked as a d12 Supply Die.`);
      this._activePage = 3;
      this.render();
    }

    _activateFlagTextAreas(root) {
      for (const field of root.querySelectorAll(
        "textarea[data-flag-name]"
      )) {
        field.addEventListener("change", async (event) => {
          if (this._calibrationMode || !this.isEditable) return;

          const flagName = event.currentTarget.dataset.flagName;
          if (!flagName) return;

          await this.actor.update({
            [`flags.${MODULE_ID}.${flagName}`]: event.currentTarget.value
          });
        });
      }
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
          this._activePage = Number(selectedPage);

          for (const tabButton of buttons) {
            tabButton.classList.toggle("active", tabButton === button);
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

    _renderPage2DirectDOM(root) {
      const page = root.querySelector('.brackenvale-art-page[data-page="2"]');
      if (!page) {
        console.warn(`${MODULE_ID} | Page 2 DOM container was not found.`);
        return;
      }

      page.querySelectorAll(".brackenvale-page2-dom").forEach((node) => node.remove());

      const page2Layout = this._workingLayouts?.find(
        (entry) => Number(entry.page) === 2
      );
      const componentByKey = (key) =>
        page2Layout?.components?.find((entry) => entry.key === key);
      const layoutStyle = (component, fallback) => {
        const source = component ?? fallback;
        return [
          `left:${Number(source.left)}%`,
          `top:${Number(source.top)}%`,
          `width:${Number(source.width)}%`,
          `height:${Number(source.height)}%`
        ].join(";");
      };

      const data = this._preparePage2DirectData();
      const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));

      const featureRows = [
        ...data.classes.map((entry) => `
          <div class="page2-class-actions">
            <button
              type="button"
              class="page2-run-advancement"
              data-action="run-class-advancement"
              data-item-id="${escape(entry.id)}"
              title="Run ${escape(entry.name)} through D&D5e Advancement"
            >Run Advancement</button>
            <button
              type="button"
              class="page2-manage-class"
              data-action="manage-class"
              data-item-id="${escape(entry.id)}"
              title="Open ${escape(entry.name)} class"
            >Open ${escape(entry.name)}${entry.levels ? ` ${escape(entry.levels)}` : ""}</button>
          </div>
        `),
        ...data.features.map((entry) => `
          <button
            type="button"
            class="page2-feature-row"
            data-action="open-feature"
            data-item-id="${escape(entry.id)}"
            title="Open ${escape(entry.name)}"
          >
            <span class="page2-feature-name">${escape(entry.name)}</span>
            ${entry.type ? `<span class="page2-feature-type">${escape(entry.type)}</span>` : ""}
          </button>
        `)
      ].join("") || `
        <div class="page2-empty-list">
          No granted features yet. Open the class and use its Advancement tab.
        </div>
      `;

      const languageRows = data.languages.length
        ? data.languages.map((name) => `<div class="page2-simple-row">${escape(name)}</div>`).join("")
        : `<div class="page2-empty-list">No languages recorded.</div>`;

      const proficiencyRows = data.proficiencyGroups.length
        ? data.proficiencyGroups.map((group) => `
            <div class="page2-proficiency-group">
              <strong>${escape(group.label)}</strong>
              ${group.values.map((name) => `<div class="page2-simple-row">${escape(name)}</div>`).join("")}
            </div>
          `).join("")
        : `<div class="page2-empty-list">No proficiencies recorded.</div>`;

      const overlay = document.createElement("div");
      overlay.className = "brackenvale-page2-dom";
      overlay.innerHTML = `
        <section
          class="page2-dom-panel page2-dom-features overlay-field"
          style="${layoutStyle(componentByKey("features-traits"), {left:5.4,top:10,width:48.1,height:79.2})}"
          data-component-key="features-traits"
          data-layout-part="root"
          aria-label="Features & Traits"
          tabindex="0"
        >
          <div class="page2-calibration-handle">MOVE FEATURES & TRAITS</div>
          <div class="page2-dom-scroll">${featureRows}</div>
        </section>
        <section
          class="page2-dom-panel page2-dom-languages overlay-field"
          style="${layoutStyle(componentByKey("languages"), {left:58.1,top:10,width:36.9,height:28.9})}"
          data-component-key="languages"
          data-layout-part="root"
          aria-label="Languages"
          tabindex="0"
        >
          <div class="page2-calibration-handle">MOVE LANGUAGES</div>
          <div class="page2-dom-scroll">${languageRows}</div>
        </section>
        <section
          class="page2-dom-panel page2-dom-proficiencies overlay-field"
          style="${layoutStyle(componentByKey("proficiencies"), {left:58.1,top:44.4,width:36.9,height:44.8})}"
          data-component-key="proficiencies"
          data-layout-part="root"
          aria-label="Proficiencies"
          tabindex="0"
        >
          <div class="page2-calibration-handle">MOVE PROFICIENCIES</div>
          <div class="page2-dom-scroll">${proficiencyRows}</div>
        </section>
      `;

      page.append(overlay);
      console.info(`${MODULE_ID} | Page 2 direct DOM overlay rendered`, {
        features: data.features.length,
        classes: data.classes.length,
        languages: data.languages.length,
        proficiencyGroups: data.proficiencyGroups.length
      });
    }


    _activatePage2FeatureControls(root) {
      for (const button of root.querySelectorAll('[data-action="open-feature"]')) {
        button.addEventListener("click", (event) => {
          if (this._calibrationMode) return;
          event.preventDefault();
          event.stopPropagation();

          const itemId = button.dataset.itemId;
          if (!itemId) return;
          this.actor.items.get(itemId)?.sheet?.render(true);
        });
      }

      for (const button of root.querySelectorAll('[data-action="manage-class"]')) {
        button.addEventListener("click", (event) => {
          if (this._calibrationMode) return;
          event.preventDefault();
          event.stopPropagation();

          const itemId = button.dataset.itemId;
          if (!itemId) return;
          this.actor.items.get(itemId)?.sheet?.render(true);
        });
      }

      for (const button of root.querySelectorAll('[data-action="run-class-advancement"]')) {
        button.addEventListener("click", async (event) => {
          if (this._calibrationMode) return;
          event.preventDefault();
          event.stopPropagation();

          const itemId = button.dataset.itemId;
          const classItem = itemId ? this.actor.items.get(itemId) : null;
          if (!classItem) return;

          await this._rerunClassAdvancement(classItem);
        });
      }
    }


    _activateClassIntegration(root) {
      const overlayButton = root.querySelector('[data-action="class-level-overlay"]');
      if (!overlayButton) {
        console.warn(`${MODULE_ID} | Class overlay control not found.`);
        return;
      }

      const wrapper = overlayButton.closest('[data-component-key="classLevel"]');

      const openClassControl = async (event) => {
        if (this._calibrationMode) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const itemId = overlayButton.dataset.itemId;

        if (itemId) {
          this.actor.items.get(itemId)?.sheet?.render(true);
          return;
        }

        if (!this.isEditable) return;

        overlayButton.disabled = true;
        wrapper?.classList.add("class-picker-loading");
        try {
          await this._openBrackenvaleClassPicker();
        } finally {
          overlayButton.disabled = false;
          wrapper?.classList.remove("class-picker-loading");
        }
      };

      overlayButton.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }, {capture: true});

      overlayButton.addEventListener("click", openClassControl, {capture: true});

      overlayButton.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }, {capture: true});

      const removeButton = root.querySelector('[data-action="remove-class"]');
      if (removeButton) {
        removeButton.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }, {capture: true});

        removeButton.addEventListener("click", async (event) => {
          if (this._calibrationMode || !this.isEditable) return;

          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          const itemId = removeButton.dataset.itemId;
          const classItem = this.actor.items.get(itemId);
          if (!classItem || classItem.type !== "class") return;

          const DialogV2 = foundry.applications?.api?.DialogV2;
          let approved = false;

          if (DialogV2?.confirm) {
            approved = await DialogV2.confirm({
              window: {title: "Remove Class"},
              content: `
                <p>Remove <strong>${foundry.utils.escapeHTML(classItem.name)}</strong>
                from <strong>${foundry.utils.escapeHTML(this.actor.name)}</strong>?</p>
                <p class="hint">This deletes the Class item from the character.
                Features already granted by D&D advancement may need to be reviewed separately.</p>
              `,
              yes: {label: "Remove Class"},
              no: {label: "Cancel"},
              modal: true
            });
          } else {
            approved = window.confirm(
              `Remove ${classItem.name} from ${this.actor.name}?`
            );
          }

          if (!approved) return;

          await classItem.delete();
          ui.notifications?.info(`${classItem.name} removed from ${this.actor.name}.`);
          this.render();
        }, {capture: true});
      }

      const clearHighlight = () => wrapper?.classList.remove("class-drop-target");

      wrapper?.addEventListener("dragenter", (event) => {
        if (this._calibrationMode || !this.isEditable) return;
        event.preventDefault();
        wrapper.classList.add("class-drop-target");
      });

      wrapper?.addEventListener("dragover", (event) => {
        if (this._calibrationMode || !this.isEditable) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      });

      wrapper?.addEventListener("dragleave", (event) => {
        if (wrapper.contains(event.relatedTarget)) return;
        clearHighlight();
      });

      wrapper?.addEventListener("drop", async (event) => {
        clearHighlight();
        if (this._calibrationMode || !this.isEditable) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        try {
          const raw = event.dataTransfer?.getData("application/json")
            || event.dataTransfer?.getData("text/plain");
          let data = null;

          if (raw) {
            try {
              data = JSON.parse(raw);
            } catch (_error) {
              data = null;
            }
          }

          let sourceItem = null;
          if (data?.type === "Item" && data.id) {
            sourceItem = this.actor.items.get(data.id) ?? null;
          }
          if (!sourceItem && data?.uuid) {
            sourceItem = await fromUuid(data.uuid);
          }

          if (!sourceItem || sourceItem.documentName !== "Item" || sourceItem.type !== "class") {
            await this._openBrackenvaleClassPicker();
            return;
          }

          await this._addBrackenvaleClass(sourceItem);
        } catch (error) {
          console.error(`${MODULE_ID} | Could not add dropped class`, error);
          ui.notifications?.error("Brackenvale could not add that class.");
        }
      });
    }


    async _openBrackenvaleClassPicker() {
      const canonicalOrder = [
        "barbarian",
        "bard",
        "cleric",
        "druid",
        "fighter",
        "monk",
        "paladin",
        "ranger",
        "rogue",
        "sorcerer",
        "warlock",
        "wizard"
      ];

      const displayNames = {
        barbarian: "Barbarian",
        bard: "Bard",
        cleric: "Cleric",
        druid: "Druid",
        fighter: "Fighter",
        monk: "Monk",
        paladin: "Paladin",
        ranger: "Ranger",
        rogue: "Rogue",
        sorcerer: "Sorcerer",
        warlock: "Warlock",
        wizard: "Wizard"
      };

      const candidates = [];

      for (const pack of game.packs ?? []) {
        if (pack.documentName !== "Item") continue;

        const label = String(
          pack.metadata?.label
            ?? pack.title
            ?? pack.collection
            ?? ""
        ).trim();

        const collection = String(pack.collection ?? "").trim();
        const packageName = String(
          pack.metadata?.packageName
            ?? pack.metadata?.package
            ?? pack.metadata?.packageId
            ?? ""
        ).trim();

        const sourceText = `${label} ${collection} ${packageName}`.toLowerCase();

        if (
          sourceText.includes("srd")
          || sourceText.includes("legacy")
          || sourceText.includes("2014")
        ) {
          continue;
        }

        try {
          const index = await pack.getIndex({fields: ["type"]});

          for (const entry of index) {
            if (entry.type !== "class") continue;

            const key = String(entry.name ?? "").trim().toLowerCase();
            if (!canonicalOrder.includes(key)) continue;

            let score = 0;
            if (label === "Character Classes") score += 100;
            if (collection.toLowerCase().startsWith("dnd-players-handbook.")) score += 50;
            if (packageName.toLowerCase() === "dnd-players-handbook") score += 50;

            candidates.push({
              key,
              name: entry.name,
              uuid: `Compendium.${pack.collection}.${entry._id}`,
              source: label || pack.collection,
              score
            });
          }
        } catch (error) {
          console.debug(
            `${MODULE_ID} | Skipping unavailable class compendium ${pack.collection}`,
            error
          );
        }
      }

      const selectedByClass = new Map();

      for (const candidate of candidates.sort((a, b) =>
        b.score - a.score
        || a.source.localeCompare(b.source)
        || a.uuid.localeCompare(b.uuid)
      )) {
        if (!selectedByClass.has(candidate.key)) {
          selectedByClass.set(candidate.key, candidate);
        }
      }

      const availableKeys = canonicalOrder.filter((key) =>
        selectedByClass.has(key)
      );

      if (!availableKeys.length) {
        ui.notifications?.warn(
          "No modern 2024 / 5.5e class items were found after excluding SRD, legacy, and 2014 sources."
        );
        return;
      }

      // Do not use DialogV2 or a native <select> here. The picker is an
      // isolated Brackenvale modal with twelve explicit buttons so no D&D
      // system selector can inject SRD/legacy alternatives into the UI.
      const existing = document.querySelector(".brackenvale-class-modal");
      existing?.remove();

      const overlay = document.createElement("div");
      overlay.className = "brackenvale-class-modal";

      const panel = document.createElement("div");
      panel.className = "brackenvale-class-modal-panel";

      const heading = document.createElement("h2");
      heading.textContent = "Add a Class";

      const intro = document.createElement("p");
      intro.textContent = `Choose a 2024 / 5.5e class for ${this.actor.name}.`;

      const grid = document.createElement("div");
      grid.className = "brackenvale-class-button-grid";

      const closeModal = () => {
        document.removeEventListener("keydown", onKeyDown, true);
        overlay.remove();
      };

      const onKeyDown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeModal();
        }
      };

      for (const key of canonicalOrder) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "brackenvale-class-pick-button";
        button.textContent = displayNames[key];

        const candidate = selectedByClass.get(key);
        if (!candidate) {
          button.disabled = true;
          button.title = "Modern class source not available";
        } else {
          button.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();

            button.disabled = true;

            try {
              const sourceItem = await fromUuid(candidate.uuid);
              if (
                !sourceItem
                || sourceItem.documentName !== "Item"
                || sourceItem.type !== "class"
              ) {
                ui.notifications?.error(
                  `${displayNames[key]} could not be loaded from the modern class source.`
                );
                button.disabled = false;
                return;
              }

              closeModal();
              await this._addBrackenvaleClass(sourceItem);
            } catch (error) {
              console.error(
                `${MODULE_ID} | Could not add ${displayNames[key]}`,
                error
              );
              ui.notifications?.error(
                `${displayNames[key]} could not be added.`
              );
              button.disabled = false;
            }
          });
        }

        grid.append(button);
      }

      const footer = document.createElement("div");
      footer.className = "brackenvale-class-modal-footer";

      const note = document.createElement("p");
      note.textContent =
        "SRD, legacy, and 2014 class sources are excluded from this picker.";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "brackenvale-class-cancel-button";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeModal();
      });

      footer.append(note, cancel);
      panel.append(heading, intro, grid, footer);
      overlay.append(panel);

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeModal();
      });

      document.addEventListener("keydown", onKeyDown, true);
      document.body.append(overlay);
    }


    async _addBrackenvaleClass(sourceItem) {
      if (!sourceItem || sourceItem.type !== "class") return;

      if (sourceItem.parent === this.actor) {
        sourceItem.sheet?.render(true);
        return;
      }

      const existing = (this.actor.items ?? []).find((item) =>
        item.type === "class"
        && (
          item.name === sourceItem.name
          || (
            foundry.utils.getProperty(item, "system.identifier")
            && foundry.utils.getProperty(item, "system.identifier")
              === foundry.utils.getProperty(sourceItem, "system.identifier")
          )
        )
      );

      if (existing) {
        ui.notifications?.info(
          `${existing.name} is already on this character. Use Run Advancement on Page 2 to repair an older class.`
        );
        return;
      }

      await this._runNativeClassDrop(sourceItem);
    }

    async _runNativeClassDrop(sourceItem) {
      if (!sourceItem || sourceItem.type !== "class") return false;

      const dragData =
        typeof sourceItem.toDragData === "function"
          ? sourceItem.toDragData()
          : {type: "Item", uuid: sourceItem.uuid};

      const target =
        this.element?.querySelector?.(".brackenvale-art-page.active")
        ?? this.element
        ?? document.body;

      const fakeEvent = {
        target,
        currentTarget: target,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {},
        dataTransfer: {
          getData(type) {
            if (type === "text/plain" || type === "application/json") {
              return JSON.stringify(dragData);
            }
            return "";
          }
        }
      };

      try {
        // CharacterActorSheet's native item-drop path is what invokes the
        // D&D5e Advancement Manager for classes, subclasses, and backgrounds.
        if (typeof this._onDropItem === "function") {
          await this._onDropItem(fakeEvent, sourceItem);
          return true;
        }

        if (typeof this._onDrop === "function") {
          await this._onDrop(fakeEvent);
          return true;
        }

        throw new Error("No native D&D5e drop handler is available on this sheet.");
      } catch (error) {
        console.error(`${MODULE_ID} | Native class Advancement drop failed`, error);
        ui.notifications?.error(
          `D&D5e could not start Advancement for ${sourceItem.name}.`
        );
        return false;
      }
    }

    async _rerunClassAdvancement(classItem) {
      if (!classItem || classItem.type !== "class") return;

      const sourceUuid =
        foundry.utils.getProperty(classItem, "flags.core.sourceId")
        ?? foundry.utils.getProperty(classItem, "_stats.compendiumSource")
        ?? null;

      if (!sourceUuid) {
        ui.notifications?.warn(
          `${classItem.name} has no original compendium source recorded. Remove it and add it again with the Brackenvale class picker.`
        );
        return;
      }

      const sourceItem = await fromUuid(sourceUuid);
      if (!sourceItem || sourceItem.type !== "class") {
        ui.notifications?.warn(
          `Brackenvale could not load the original ${classItem.name} class.`
        );
        return;
      }

      const DialogV2 = foundry.applications?.api?.DialogV2;
      let approved = false;

      if (DialogV2?.confirm) {
        approved = await DialogV2.confirm({
          window: {title: `Run ${classItem.name} Advancement`},
          content: `
            <p>This class was added before Brackenvale used D&D5e's native Advancement workflow.</p>
            <p>Brackenvale will remove the embedded <strong>${foundry.utils.escapeHTML(classItem.name)}</strong>
            class and immediately re-add its original compendium class through D&D5e Advancement.</p>
          `,
          yes: {label: "Run Advancement"},
          no: {label: "Cancel"},
          modal: true
        });
      } else {
        approved = window.confirm(
          `Re-add ${classItem.name} through D&D5e Advancement?`
        );
      }

      if (!approved) return;

      await classItem.delete();
      await this._runNativeClassDrop(sourceItem);
    }


    _activateNativeDataBindings(root) {
      const fields = root.querySelectorAll(
        ".brackenvale-page-fields input[name]"
      );

      for (const field of fields) {
        field.addEventListener("change", async (event) => {
          if (this._calibrationMode) return;

          const input = event.currentTarget;
          const path = input.name;

          if (!path || input.disabled || input.readOnly) return;

          let value;
          if (input.type === "checkbox") {
            value = input.checked;
          } else if (input.type === "number") {
            value = input.value === "" ? null : Number(input.value);
          } else {
            value = input.value;
          }

          try {
            await this.actor.update({[path]: value});
          } catch (error) {
            console.error(
              `${MODULE_ID} | Could not update actor field ${path}`,
              error
            );
            ui.notifications.error(
              `Brackenvale could not save ${input.getAttribute("aria-label") ?? path}.`
            );
          }
        });
      }
    }

    _activateItemEditors(root) {
      for (const field of root.querySelectorAll("[data-item-id]")) {
        if (field.closest?.('[data-component-key="classLevel"]')) continue;
        if (field.dataset.action === "remove-class") continue;

        field.addEventListener("dblclick", (event) => {
          if (this._calibrationMode) return;

          event.preventDefault();
          const itemId = field.dataset.itemId;
          if (!itemId) return;
          this.actor.items.get(itemId)?.sheet?.render(true);
        });
      }
    }

    _activateAbilityRolls(root) {
      for (const row of root.querySelectorAll("[data-roll-type][data-roll-key]")) {
        row.addEventListener("click", async (event) => {
          if (this._calibrationMode) return;

          event.preventDefault();
          event.stopPropagation();

          const rollType = row.dataset.rollType;
          const rollKey = row.dataset.rollKey;

          try {
            if (rollType === "skill") {
              await this._rollSkill(rollKey);
            } else if (rollType === "savingThrow") {
              await this._rollSavingThrow(rollKey);
            }
          } catch (error) {
            console.error(`${MODULE_ID} | Could not roll ${rollType} ${rollKey}`, error);
            ui.notifications.error(`Brackenvale could not roll ${row.getAttribute("aria-label") ?? rollKey}.`);
          }
        });
      }
    }

    async _rollSkill(skill) {
      if (typeof this.actor.rollSkill === "function") {
        try {
          return await this.actor.rollSkill({skill});
        } catch (error) {
          return this.actor.rollSkill(skill);
        }
      }

      const command = `[[/rollSkill ${skill}]]`;
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({actor: this.actor}),
        content: command
      });
    }

    async _rollSavingThrow(ability) {
      if (typeof this.actor.rollSavingThrow === "function") {
        try {
          return await this.actor.rollSavingThrow({ability});
        } catch (error) {
          return this.actor.rollSavingThrow(ability);
        }
      }

      if (typeof this.actor.rollAbilitySave === "function") {
        return this.actor.rollAbilitySave(ability);
      }

      const command = `[[/rollSave ${ability}]]`;
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({actor: this.actor}),
        content: command
      });
    }

    _activateProficiencyControls(root) {
      for (const button of root.querySelectorAll("[data-action='cycle-proficiency']")) {
        button.addEventListener("click", async (event) => {
          if (this._calibrationMode) return;

          event.preventDefault();
          event.stopPropagation();

          const path = button.dataset.path;
          const current = Number(button.dataset.rank ?? 0);
          const maximum = Number(button.dataset.maximumRank ?? 1);
          const next = current >= maximum ? 0 : current + 1;

          await this.actor.update({[path]: next});
        });
      }
    }

    _activateDeathSaveControls(root) {
      for (const button of root.querySelectorAll("[data-action='set-death-save']")) {
        button.addEventListener("click", async (event) => {
          if (this._calibrationMode) return;

          event.preventDefault();
          event.stopPropagation();

          const path = button.dataset.path;
          const clicked = Number(button.dataset.value ?? 0);
          const current = Number(foundry.utils.getProperty(this.actor, path) ?? 0);
          const next = current === clicked ? clicked - 1 : clicked;

          await this.actor.update({[path]: Math.max(0, next)});
        });
      }
    }

    _activateHitDiceControls(root) {
      for (const button of root.querySelectorAll("[data-action='edit-hit-dice-class']")) {
        button.addEventListener("click", (event) => {
          if (this._calibrationMode) return;

          event.preventDefault();
          event.stopPropagation();

          const itemId = button.dataset.itemId;
          if (!itemId) return;
          this.actor.items.get(itemId)?.sheet?.render(true);
        });
      }

      for (const input of root.querySelectorAll("[data-action='update-hit-dice-used']")) {
        input.addEventListener("change", async (event) => {
          if (this._calibrationMode) return;

          event.preventDefault();
          event.stopPropagation();

          const itemId = input.dataset.itemId;
          const path = input.dataset.itemPath;
          const item = this.actor.items.get(itemId);
          if (!item || !path) return;

          const maximum = Number(input.max || 0);
          const requested = Number(input.value || 0);
          const value = Math.max(0, maximum ? Math.min(maximum, requested) : requested);

          await item.update({[path]: value});
        });
      }
    }

    _buildBrackenvaleCriticalFormula(formula) {
      const normalized = String(formula ?? "")
        .replace(/−/g, "-")
        .replace(/\s+/g, " ")
        .trim();

      if (!normalized) return "";

      let maximumDice = 0;
      normalized.replace(/(\d*)d(\d+)/gi, (_match, rawCount, rawFaces) => {
        const count = rawCount ? Number(rawCount) : 1;
        const faces = Number(rawFaces);
        if (Number.isFinite(count) && Number.isFinite(faces)) {
          maximumDice += count * faces;
        }
        return _match;
      });

      return maximumDice > 0
        ? `${normalized} + ${maximumDice}`
        : normalized;
    }

    async _promptBrackenvaleDamageRoll(item, baseFormula) {
      const DialogV2 = foundry.applications?.api?.DialogV2;
      const safeName = foundry.utils.escapeHTML(item.name);
      let result = null;

      if (DialogV2?.wait) {
        result = await DialogV2.wait({
          window: {title: `${item.name} Damage`},
          content: `
            <form class="brackenvale-damage-dialog">
              <p><strong>${safeName}</strong></p>
              <div class="form-group">
                <label>Base Damage</label>
                <input type="text" name="baseFormula" value="${foundry.utils.escapeHTML(baseFormula)}" readonly>
              </div>
              <div class="form-group">
                <label>Extra Damage Dice</label>
                <input type="text" name="extraFormula" placeholder="For example: 3d6 or 3d8">
                <p class="hint">Sneak Attack, Divine Smite, spell, magic-item, or other attack damage dice.</p>
              </div>
            </form>
          `,
          buttons: [
            {
              action: "normal",
              label: "Normal Damage",
              default: true,
              callback: (_event, button) => ({
                mode: "normal",
                extra: button.form?.elements?.extraFormula?.value ?? ""
              })
            },
            {
              action: "critical",
              label: "Critical Damage",
              callback: (_event, button) => ({
                mode: "critical",
                extra: button.form?.elements?.extraFormula?.value ?? ""
              })
            },
            {
              action: "cancel",
              label: "Cancel",
              callback: () => null
            }
          ],
          close: () => null,
          modal: true
        });
      } else {
        const critical = window.confirm(
          `Roll ${item.name} as critical damage?\n\nChoose OK for Critical or Cancel for Normal.`
        );
        result = {mode: critical ? "critical" : "normal", extra: ""};
      }

      if (!result) return null;

      const extra = String(result.extra ?? "")
        .replace(/−/g, "-")
        .replace(/\s+/g, " ")
        .trim();

      const combined = extra
        ? `(${baseFormula}) + (${extra})`
        : baseFormula;

      return result.mode === "critical"
        ? this._buildBrackenvaleCriticalFormula(combined)
        : combined;
    }


    _activateWeaponControls(root) {
      for (const button of root.querySelectorAll("[data-action='show-weapon-mastery']")) {
        button.addEventListener("click", async (event) => {
          if (this._calibrationMode) return;

          event.preventDefault();
          event.stopPropagation();

          const masteryName = button.dataset.masteryName || "Weapon Mastery";
          const masteryReference = button.dataset.masteryReference;

          if (!masteryReference) {
            ui.notifications?.warn(`${masteryName} does not have a linked D&D rules entry.`);
            return;
          }

          try {
            const document = await fromUuid(masteryReference);

            if (!document) {
              ui.notifications?.warn(`Could not find the D&D rules entry for ${masteryName}.`);
              return;
            }

            if (document.sheet?.render) {
              document.sheet.render(true);
              return;
            }

            if (document.parent?.sheet?.render) {
              document.parent.sheet.render(true);
              return;
            }

            ui.notifications?.warn(`Could not open the D&D rules entry for ${masteryName}.`);
          } catch (error) {
            console.error(`${MODULE_ID} | Could not open mastery reference ${masteryReference}`, error);
            ui.notifications?.error(`Brackenvale could not open the rules entry for ${masteryName}.`);
          }
        });
      }

      for (const button of root.querySelectorAll("[data-action='edit-weapon']")) {
        button.addEventListener("click", (event) => {
          if (this._calibrationMode) return;

          event.preventDefault();
          event.stopPropagation();

          const itemId = button.dataset.itemId;
          if (!itemId) return;
          this.actor.items.get(itemId)?.sheet?.render(true);
        });
      }

      for (const button of root.querySelectorAll("[data-action='use-weapon']")) {
        button.addEventListener("click", async (event) => {
          if (this._calibrationMode) return;

          event.preventDefault();
          event.stopPropagation();

          const itemId = button.dataset.itemId;
          const item = this.actor.items.get(itemId);
          if (!item) return;

          const conditionPenalty = Number(
            foundry.utils.getProperty(
              item,
              `flags.${MODULE_ID}.equipmentDamage`
            ) ?? 0
          );

          let penaltyEffect = null;

          try {
            if (conditionPenalty > 0) {
              [penaltyEffect] = await this.actor.createEmbeddedDocuments(
                "ActiveEffect",
                [{
                  name: `${item.name} Condition Penalty`,
                  icon: item.img ?? "icons/svg/sword.svg",
                  disabled: false,
                  transfer: false,
                  changes: [
                    {
                      key: "system.bonuses.mwak.attack",
                      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                      value: `-${conditionPenalty}`,
                      priority: 100
                    },
                    {
                      key: "system.bonuses.rwak.attack",
                      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                      value: `-${conditionPenalty}`,
                      priority: 100
                    }
                  ],
                  flags: {
                    [MODULE_ID]: {
                      temporaryWeaponCondition: true,
                      itemId: item.id
                    }
                  }
                }]
              );
            }

            if (typeof item.use === "function") {
              await item.use();
            } else {
              item.sheet?.render(true);
            }
          } finally {
            if (penaltyEffect?.id && this.actor.effects?.get(penaltyEffect.id)) {
              await this.actor.deleteEmbeddedDocuments(
                "ActiveEffect",
                [penaltyEffect.id]
              );
            }
          }
        });
      }

      for (const button of root.querySelectorAll("[data-action='roll-weapon-damage']")) {
        button.addEventListener("click", async (event) => {
          if (this._calibrationMode) return;

          event.preventDefault();
          event.stopPropagation();

          const itemId = button.dataset.itemId;
          const item = this.actor.items.get(itemId);
          if (!item) return;

          const displayed = String(button.textContent ?? "").trim();
          const baseFormula = displayed
            .replace(/−/g, "-")
            .replace(/\s+/g, " ")
            .trim();

          if (!baseFormula) {
            ui.notifications?.warn(`${item.name} does not expose a damage formula.`);
            item.sheet?.render(true);
            return;
          }

          const formula = await this._promptBrackenvaleDamageRoll(
            item,
            baseFormula
          );
          if (!formula) return;

          try {
            const roll = await (new Roll(formula)).evaluate();
            const isCritical = formula !== baseFormula
              && formula.includes(this._buildBrackenvaleCriticalFormula(baseFormula).split("+").at(-1)?.trim() ?? "");

            await roll.toMessage({
              speaker: ChatMessage.getSpeaker({actor: this.actor}),
              flavor: `<strong>${foundry.utils.escapeHTML(item.name)} Damage</strong><br>${isCritical ? "Brackenvale critical damage" : "Damage roll"}`
            });
          } catch (error) {
            console.error(`${MODULE_ID} | Could not roll Brackenvale damage`, error);
            ui.notifications?.warn(
              `${item.name}'s damage formula could not be rolled.`
            );
            item.sheet?.render(true);
          }
        });
      }
    }


    _activateEquipmentDamageControls(root) {
      for (const button of root.querySelectorAll(
        "[data-action='set-equipment-damage']"
      )) {
        button.addEventListener("click", async (event) => {
          if (this._calibrationMode || !this.isEditable) return;

          event.preventDefault();
          event.stopPropagation();

          const item = this.actor.items.get(button.dataset.itemId);
          if (!item) return;

          await setEquipmentDamage(
            item,
            Number(button.dataset.value),
            MODULE_ID
          );
          this.render();
        });
      }
    }

    _activateEquipmentDropZones(root) {
      const zones = root.querySelectorAll("[data-equipment-drop-zone]");

      for (const zone of zones) {
        const clearHighlight = () => {
          zone.style.background = "transparent";
          zone.style.outline = "none";
        };

        zone.addEventListener("dragenter", (event) => {
          if (this._calibrationMode || !this.isEditable) return;
          event.preventDefault();
          zone.style.background = "rgba(60, 100, 60, 0.12)";
          zone.style.outline = "2px dashed rgba(40, 80, 40, 0.75)";
        });

        zone.addEventListener("dragover", (event) => {
          if (this._calibrationMode || !this.isEditable) return;
          event.preventDefault();
          if (event.dataTransfer) {
            const raw = event.dataTransfer.getData("application/json")
              || event.dataTransfer.getData("text/plain");
            event.dataTransfer.dropEffect = raw?.includes("brackenvaleOwnedItem")
              ? "move"
              : "copy";
          }
        });

        zone.addEventListener("dragleave", (event) => {
          if (zone.contains(event.relatedTarget)) return;
          clearHighlight();
        });

        zone.addEventListener("drop", async (event) => {
          clearHighlight();
          if (this._calibrationMode || !this.isEditable) return;

          event.preventDefault();
          event.stopPropagation();

          try {
            let data = null;

            if (event.dataTransfer) {
              const raw =
                event.dataTransfer.getData("application/json")
                || event.dataTransfer.getData("text/plain");

              if (raw) {
                try {
                  data = JSON.parse(raw);
                } catch (_error) {
                  data = null;
                }
              }
            }

            if (!data?.type) return;

            await this._handleEquipmentDrop(
              data,
              zone.dataset.equipmentDropZone
            );
          } catch (error) {
            console.error(`${MODULE_ID} | Could not process equipment drop`, error);
            ui.notifications?.error("Brackenvale could not add that item.");
          }
        });
      }
    }

    async _handleEquipmentDrop(data, zoneType) {
      if (!data || data.type !== "Item") {
        ui.notifications?.warn("Only items can be dropped into equipment sections.");
        return;
      }

      let sourceItem = null;

      if (data.id) {
        sourceItem = this.actor.items.get(data.id) ?? null;
      }

      if (!sourceItem && data.uuid) {
        sourceItem = await fromUuid(data.uuid);
      }

      if (!sourceItem) {
        ui.notifications?.warn("Brackenvale could not find the dropped item.");
        return;
      }

      if (zoneType === "weapons" && sourceItem.type !== "weapon") {
        ui.notifications?.warn("Only weapons can be dropped into the Weapons section.");
        return;
      }

      if (zoneType === "armor" && !isArmorOrShieldItem(sourceItem)) {
        ui.notifications?.warn("Only armor or shields can be dropped into the Armor & Shield section.");
        return;
      }

      await placeEquipmentItem(this.actor, sourceItem, zoneType, MODULE_ID);

      const sectionName = {
        armor: "Armor & Shield",
        weapons: "Weapons",
        worn: "Worn Equipment",
        "packed-left": "Packed Gear",
        "packed-right": "Packed Gear"
      }[zoneType] ?? "Equipment";

      ui.notifications?.info(`${sourceItem.name} added to ${sectionName}.`);
      this._activePage = 3;
    }



    _activateEquipmentDragging(root) {
      const handles = root.querySelectorAll(
        ".equipment-item-name[data-equipment-item-id]"
      );

      for (const handle of handles) {
        handle.draggable = false;

        handle.addEventListener("pointerdown", (event) => {
          if (
            this._calibrationMode
            || !this.isEditable
            || event.button !== 0
          ) {
            return;
          }

          const itemId = handle.dataset.equipmentItemId;
          const item = this.actor.items.get(itemId);
          if (!item) return;

          const startX = event.clientX;
          const startY = event.clientY;
          let dragging = false;
          let targetZone = null;

          const ghost = document.createElement("div");
          ghost.className = "brackenvale-equipment-drag-ghost";
          ghost.textContent = item.name;

          const clearTarget = () => {
            targetZone?.classList.remove("equipment-drag-target");
            targetZone = null;
          };

          const findTarget = (clientX, clientY) => {
            const element = document.elementFromPoint(clientX, clientY);
            return element?.closest?.(
              "[data-equipment-drop-zone], [data-supply-drop-zone]"
            ) ?? null;
          };

          const moveGhost = (clientX, clientY) => {
            ghost.style.left = `${clientX + 12}px`;
            ghost.style.top = `${clientY + 12}px`;
          };

          const onPointerMove = (moveEvent) => {
            const distance = Math.hypot(
              moveEvent.clientX - startX,
              moveEvent.clientY - startY
            );

            if (!dragging && distance < 6) return;

            if (!dragging) {
              dragging = true;
              handle.classList.add("dragging");
              document.body.append(ghost);
            }

            moveEvent.preventDefault();
            moveGhost(moveEvent.clientX, moveEvent.clientY);

            const nextTarget = findTarget(
              moveEvent.clientX,
              moveEvent.clientY
            );

            if (nextTarget !== targetZone) {
              clearTarget();
              targetZone = nextTarget;
              targetZone?.classList.add("equipment-drag-target");
            }
          };

          const finish = async (upEvent) => {
            window.removeEventListener("pointermove", onPointerMove, true);
            window.removeEventListener("pointerup", finish, true);
            window.removeEventListener("pointercancel", cancel, true);

            handle.classList.remove("dragging");
            ghost.remove();

            const finalTarget = dragging
              ? findTarget(upEvent.clientX, upEvent.clientY)
              : null;

            clearTarget();

            if (!dragging || !finalTarget) return;

            upEvent.preventDefault();
            upEvent.stopPropagation();

            try {
              const dropData = {
                type: "Item",
                id: item.id,
                uuid: item.uuid,
                actorId: this.actor.id,
                brackenvaleOwnedItem: true
              };

              if (finalTarget.dataset.supplyDropZone) {
                await this._handleSupplyDrop(dropData);
              } else {
                await this._handleEquipmentDrop(
                  dropData,
                  finalTarget.dataset.equipmentDropZone
                );
              }
            } catch (error) {
              console.error(
                `${MODULE_ID} | Could not move owned equipment item`,
                error
              );
              ui.notifications?.error(
                `Brackenvale could not move ${item.name}.`
              );
            }
          };

          const cancel = () => {
            window.removeEventListener("pointermove", onPointerMove, true);
            window.removeEventListener("pointerup", finish, true);
            window.removeEventListener("pointercancel", cancel, true);
            handle.classList.remove("dragging");
            clearTarget();
            ghost.remove();
          };

          window.addEventListener("pointermove", onPointerMove, true);
          window.addEventListener("pointerup", finish, true);
          window.addEventListener("pointercancel", cancel, true);
        });
      }
    }

    _activateEquipmentControls(root) {
      for (const button of root.querySelectorAll("[data-action='delete-equipment-item']")) {
        button.addEventListener("click", async (event) => {
          if (this._calibrationMode || !this.isEditable) return;

          event.preventDefault();
          event.stopPropagation();

          const itemId = button.dataset.itemId;
          const item = this.actor.items.get(itemId);
          if (!item) return;

          const confirmed = globalThis.confirm(`Delete ${item.name} from this character?`);
          if (!confirmed) return;

          await deleteEquipmentItem(this.actor, item, MODULE_ID);
          this._activePage = 3;
        });
      }
    }

    _activateCalibrationControls(root) {
      if (!game.user?.isGM) return;

      const toggle = root.querySelector("[data-action='toggle-calibration']");
      const exportButton = root.querySelector("[data-action='export-layout']");

      toggle?.addEventListener("click", (event) => {
        event.preventDefault();
        this._calibrationMode = !this._calibrationMode;
        root.classList.toggle("calibration-mode", this._calibrationMode);
        toggle.classList.toggle("active", this._calibrationMode);
        toggle.textContent = this._calibrationMode ? "Finish Layout" : "Calibrate";

        if (!this._calibrationMode) {
          this._selectedCalibrationField = null;
        }

        this._setCalibrationFieldState(root);
        this._updateCalibrationStatus(root);
      });

      exportButton?.addEventListener("click", (event) => {
        event.preventDefault();
        this._exportActiveLayout(root);
      });

      this._setCalibrationFieldState(root);
      this._activateCalibrationDragging(root);
      this._activateCalibrationKeyboard(root);

      root.addEventListener("pointerdown", (event) => {
        if (!this._calibrationMode) return;

        const field = event.target.closest(
          ".brackenvale-page-fields .overlay-field[data-component-key], .brackenvale-page2-dom .overlay-field[data-component-key]"
        );
        if (!field || !root.contains(field)) return;

        // The normal per-field handler performs dragging. This capture
        // listener only guarantees that the intended overlay is selected.
        if (
          field.classList.contains("equipment-slot-only-region")
          || field.classList.contains("slot-summary-field")
          || field.classList.contains("page2-dom-panel")
        ) {
          this._selectCalibrationField(root, field);
        }
      }, true);
    }

    _setCalibrationFieldState(root) {
      root.classList.toggle("calibration-mode", this._calibrationMode);

      for (const field of root.querySelectorAll(
        ".brackenvale-page-fields .overlay-field, .brackenvale-page2-dom .overlay-field"
      )) {
        if (this._calibrationMode) {
          field.dataset.wasDisabled = String(field.disabled);
          field.dataset.wasReadonly = String(field.readOnly);
          field.dataset.wasZIndex = field.style.zIndex ?? "";
          field.dataset.wasPointerEvents = field.style.pointerEvents ?? "";
          field.disabled = false;
          field.readOnly = true;
          field.tabIndex = 0;

          // Slot columns are narrow overlays that sit inside the larger
          // equipment regions. Raise them explicitly while calibrating so
          // pointer targeting cannot be intercepted by a drop zone.
          if (
            field.classList.contains("equipment-slot-only-region")
            || field.classList.contains("equipment-damage-only-region")
            || field.classList.contains("supply-widget")
            || field.classList.contains("flag-text-area")
            || field.classList.contains("slot-summary-field")
            || field.classList.contains("page2-dom-panel")
          ) {
            field.style.zIndex = "1000";
            field.style.pointerEvents = "auto";
          }
        } else {
          field.disabled = field.dataset.wasDisabled === "true";
          field.readOnly = field.dataset.wasReadonly === "true";
          field.style.zIndex = field.dataset.wasZIndex ?? "";
          field.style.pointerEvents = field.dataset.wasPointerEvents ?? "";
          field.classList.remove("calibration-selected");
          delete field.dataset.wasDisabled;
          delete field.dataset.wasReadonly;
          delete field.dataset.wasZIndex;
          delete field.dataset.wasPointerEvents;
        }
      }
    }

    _activateCalibrationDragging(root) {
      const fields = root.querySelectorAll(
        ".brackenvale-page-fields .overlay-field[data-component-key], .brackenvale-page2-dom .overlay-field[data-component-key]"
      );

      for (const field of fields) {
        field.addEventListener("pointerdown", (event) => {
          if (!this._calibrationMode) return;

          event.preventDefault();
          event.stopPropagation();

          this._selectCalibrationField(root, field);
          field.setPointerCapture(event.pointerId);

          const page = field.closest(".brackenvale-art-page");
          const pageRect = page.getBoundingClientRect();
          const fieldRect = field.getBoundingClientRect();
          const startX = event.clientX;
          const startY = event.clientY;
          const startLeft = fieldRect.left - pageRect.left;
          const startTop = fieldRect.top - pageRect.top;

          const move = (moveEvent) => {
            const leftPx = startLeft + (moveEvent.clientX - startX);
            const topPx = startTop + (moveEvent.clientY - startY);
            const left = this._clamp((leftPx / pageRect.width) * 100, 0, 100);
            const top = this._clamp((topPx / pageRect.height) * 100, 0, 100);

            field.style.left = `${left}%`;
            field.style.top = `${top}%`;
            this._updateWorkingLayoutFromField(field, {left, top});
          };

          const finish = () => {
            field.removeEventListener("pointermove", move);
            field.removeEventListener("pointerup", finish);
            field.removeEventListener("pointercancel", finish);
          };

          field.addEventListener("pointermove", move);
          field.addEventListener("pointerup", finish);
          field.addEventListener("pointercancel", finish);
        });

        field.addEventListener("click", (event) => {
          if (!this._calibrationMode) return;
          event.preventDefault();
          this._selectCalibrationField(root, field);
        });
      }
    }

    _activateCalibrationKeyboard(root) {
      root.addEventListener("keydown", (event) => {
        if (!this._calibrationMode || !this._selectedCalibrationField) return;
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
          return;
        }

        event.preventDefault();

        const field = this._selectedCalibrationField;
        const page = field.closest(".brackenvale-art-page");
        const pageRect = page.getBoundingClientRect();
        const stepPixels = event.shiftKey ? 10 : 1;
        const horizontalStep = (stepPixels / pageRect.width) * 100;
        const verticalStep = (stepPixels / pageRect.height) * 100;

        let left = parseFloat(field.style.left);
        let top = parseFloat(field.style.top);

        if (event.key === "ArrowLeft") left -= horizontalStep;
        if (event.key === "ArrowRight") left += horizontalStep;
        if (event.key === "ArrowUp") top -= verticalStep;
        if (event.key === "ArrowDown") top += verticalStep;

        left = this._clamp(left, 0, 100);
        top = this._clamp(top, 0, 100);

        field.style.left = `${left}%`;
        field.style.top = `${top}%`;
        this._updateWorkingLayoutFromField(field, {left, top});
        this._updateCalibrationStatus(root);
      });
    }

    _selectCalibrationField(root, field) {
      root.querySelectorAll(".calibration-selected").forEach((element) => {
        element.classList.remove("calibration-selected");
      });

      field.classList.add("calibration-selected");
      field.focus({preventScroll: true});
      this._selectedCalibrationField = field;
      this._updateCalibrationStatus(root);
    }

    _updateCalibrationStatus(root) {
      const status = root.querySelector(".brackenvale-calibration-status");
      if (!status) return;

      if (!this._calibrationMode) {
        status.textContent = "";
        return;
      }

      const field = this._selectedCalibrationField;
      if (!field) {
        status.textContent = "No field selected";
        return;
      }

      const label =
        field.getAttribute("aria-label")
        ?? field.dataset.componentKey
        ?? "Selected field";

      const left = Number.parseFloat(field.style.left || "0").toFixed(2);
      const top = Number.parseFloat(field.style.top || "0").toFixed(2);

      status.textContent = `${label} · Left ${left}% · Top ${top}%`;
    }

    _updateWorkingLayoutFromField(field, values) {
      const pageNumber = Number(
        field.closest(".brackenvale-art-page")?.dataset.page
      );
      const componentKey = field.dataset.componentKey;
      const layoutPart = field.dataset.layoutPart ?? "root";

      const layout = this._workingLayouts.find(
        (entry) => Number(entry.page) === pageNumber
      );
      const component = layout?.components.find(
        (entry) => entry.key === componentKey
      );

      if (!component) return;

      if (layoutPart === "root") {
        Object.assign(component, values);
      } else {
        component[layoutPart] ??= {};
        Object.assign(component[layoutPart], values);
      }
    }

    _exportActiveLayout(root) {
      const activePage = root.querySelector(
        ".brackenvale-art-page.active[data-page]"
      );
      const pageNumber = Number(activePage?.dataset.page ?? 1);
      const layout = this._workingLayouts.find(
        (entry) => Number(entry.page) === pageNumber
      );

      if (!layout) {
        ui.notifications.error("Brackenvale could not find the active layout.");
        return;
      }

      const contents = JSON.stringify(layout, null, 2) + "\n";
      const blob = new Blob([contents], {type: "application/json"});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `page${pageNumber}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      ui.notifications.info(
        `Exported page${pageNumber}.json. Replace the module layout file to apply it to every actor.`
      );
    }

    _clamp(value, minimum, maximum) {
      return Math.min(Math.max(value, minimum), maximum);
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
