/**
 * Brackenvale Character Sheet
 * Native D&D data binding + GM layout calibration
 * Foundry VTT 14 / D&D 5e 5.3.3
 */

import { prepareSheetComponent } from "./sheet-components.js";
import {
  isArmorOrShieldItem,
  placeEquipmentItem
} from "./equipment-manager.js";

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

    async _loadLayouts() {
      if (BrackenvaleCharacterSheet.#layoutCache) {
        return BrackenvaleCharacterSheet.#layoutCache;
      }

      const pageNumbers = [1, 2, 3, 4];
      const layouts = await Promise.all(
        pageNumbers.map(async (pageNumber) => {
          const response = await fetch(`${LAYOUT_ROOT}/page${pageNumber}.json`);
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
      this._activateItemEditors(root);
      this._activateNativeDataBindings(root);
      this._activateCalibrationControls(root);
      this._activateAbilityRolls(root);
      this._activateProficiencyControls(root);
      this._activateDeathSaveControls(root);
      this._activateHitDiceControls(root);
      this._activateWeaponControls(root);
      this._activateEquipmentDropZones(root);
      this._activateEquipmentControls(root);
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

          if (typeof item.use === "function") {
            await item.use();
          } else {
            item.sheet?.render(true);
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

          const activities = foundry.utils.getProperty(item, "system.activities");
          let attackActivity = null;

          if (typeof activities?.getByType === "function") {
            attackActivity = activities.getByType("attack")?.[0] ?? null;
          }

          if (!attackActivity && typeof activities?.values === "function") {
            attackActivity = Array.from(activities.values()).find(
              (activity) => typeof activity?.rollDamage === "function"
            ) ?? null;
          }

          if (!attackActivity && activities && typeof activities === "object") {
            attackActivity = Object.values(activities).find(
              (activity) => typeof activity?.rollDamage === "function"
            ) ?? null;
          }

          if (typeof attackActivity?.rollDamage === "function") {
            await attackActivity.rollDamage({event});
            return;
          }

          ui.notifications?.warn(
            `${item.name} does not expose a damage activity. Open the weapon item to review its activities.`
          );
          item.sheet?.render(true);
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
          if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
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
            const data = TextEditor.getDragEventData(event);
            await this._handleEquipmentDrop(data, zone.dataset.equipmentDropZone);
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
      if (data.uuid) sourceItem = await fromUuid(data.uuid);
      if (!sourceItem && data.id) sourceItem = this.actor.items.get(data.id) ?? null;

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
        packed: "Packed Gear"
      }[zoneType] ?? "Equipment";

      ui.notifications?.info(`${sourceItem.name} added to ${sectionName}.`);
      this._activePage = 3;
      this.render();
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

          await item.delete();
          this._activePage = 3;
          this.render();
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
    }

    _setCalibrationFieldState(root) {
      root.classList.toggle("calibration-mode", this._calibrationMode);

      for (const field of root.querySelectorAll(
        ".brackenvale-page-fields .overlay-field"
      )) {
        if (this._calibrationMode) {
          field.dataset.wasDisabled = String(field.disabled);
          field.dataset.wasReadonly = String(field.readOnly);
          field.disabled = false;
          field.readOnly = true;
          field.tabIndex = 0;
        } else {
          field.disabled = field.dataset.wasDisabled === "true";
          field.readOnly = field.dataset.wasReadonly === "true";
          field.classList.remove("calibration-selected");
          delete field.dataset.wasDisabled;
          delete field.dataset.wasReadonly;
        }
      }
    }

    _activateCalibrationDragging(root) {
      const fields = root.querySelectorAll(
        ".brackenvale-page-fields .overlay-field[data-component-key]"
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
