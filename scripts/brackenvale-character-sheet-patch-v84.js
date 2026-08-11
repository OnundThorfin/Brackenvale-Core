
const MODULE_ID = "brackenvale-core";

function patchBrackenvaleCharacterSheet() {
  const SheetClass = game.brackenvaleCore?.BrackenvaleCharacterSheet;
  if (!SheetClass) {
    console.warn(`${MODULE_ID} | test.84 patch: Brackenvale sheet class not available yet.`);
    return false;
  }

  const proto = SheetClass.prototype;
  if (proto.__brackenvaleTest84Patched) return true;
  proto.__brackenvaleTest84Patched = true;

  console.info(`${MODULE_ID} | Applying test.84 Page 2 + Advancement patch`);

  // ------------------------------------------------------------------
  // Page 2: decorate the already-working v71 panels AFTER v71 renders them.
  // ------------------------------------------------------------------
  const originalRenderPage2 = proto._renderPage2DirectDOM;
  proto._renderPage2DirectDOM = function(root) {
    originalRenderPage2.call(this, root);

    const page = root?.querySelector?.('.brackenvale-art-page[data-page="2"]');
    if (!page) return;

    const layout = this._workingLayouts?.find((entry) => Number(entry.page) === 2);
    const byKey = (key) => layout?.components?.find((entry) => entry.key === key);

    const decorate = (selector, key, label, fallback) => {
      const panel = page.querySelector(selector);
      if (!panel) return;

      const component = byKey(key) ?? fallback;
      panel.classList.add("overlay-field", "page2-v84-calibratable");
      panel.dataset.componentKey = key;
      panel.dataset.layoutPart = "root";
      panel.setAttribute("aria-label", label);
      panel.tabIndex = 0;

      panel.style.left = `${Number(component.left)}%`;
      panel.style.top = `${Number(component.top)}%`;
      panel.style.width = `${Number(component.width)}%`;
      panel.style.height = `${Number(component.height)}%`;

      if (!panel.querySelector(".page2-v84-calibration-grip")) {
        const grip = document.createElement("div");
        grip.className = "page2-v84-calibration-grip";
        grip.textContent = `MOVE ${label.toUpperCase()}`;
        panel.prepend(grip);
      }
    };

    decorate(
      ".page2-dom-features",
      "features-traits",
      "Features & Traits",
      {left:5.4, top:10, width:48.1, height:79.2}
    );
    decorate(
      ".page2-dom-languages",
      "languages",
      "Languages",
      {left:58.1, top:10, width:36.9, height:28.9}
    );
    decorate(
      ".page2-dom-proficiencies",
      "proficiencies",
      "Proficiencies",
      {left:58.1, top:44.4, width:36.9, height:44.8}
    );
  };

  // Extend calibration so the newly decorated Page 2 panels are handled
  // without replacing the known-good v71 calibration toggle itself.
  const originalActivateDragging = proto._activateCalibrationDragging;
  proto._activateCalibrationDragging = function(root) {
    originalActivateDragging.call(this, root);

    const fields = root.querySelectorAll(
      '.brackenvale-page2-dom .page2-v84-calibratable[data-component-key]'
    );

    for (const field of fields) {
      if (field.dataset.v84DragBound === "true") continue;
      field.dataset.v84DragBound = "true";

      field.addEventListener("pointerdown", (event) => {
        if (!this._calibrationMode) return;
        if (event.button !== 0) return;

        event.preventDefault();
        event.stopPropagation();

        this._selectCalibrationField(root, field);

        const page = field.closest(".brackenvale-art-page");
        const pageRect = page?.getBoundingClientRect();
        if (!pageRect?.width || !pageRect?.height) return;

        const startX = event.clientX;
        const startY = event.clientY;
        const startLeft = Number.parseFloat(field.style.left || "0");
        const startTop = Number.parseFloat(field.style.top || "0");

        field.setPointerCapture?.(event.pointerId);

        const move = (moveEvent) => {
          const dx = ((moveEvent.clientX - startX) / pageRect.width) * 100;
          const dy = ((moveEvent.clientY - startY) / pageRect.height) * 100;
          const left = this._clamp(startLeft + dx, 0, 100);
          const top = this._clamp(startTop + dy, 0, 100);

          field.style.left = `${left}%`;
          field.style.top = `${top}%`;
          this._updateWorkingLayoutFromField(field, {left, top});
          this._updateCalibrationStatus(root);
        };

        const up = (upEvent) => {
          field.releasePointerCapture?.(upEvent.pointerId);
          field.removeEventListener("pointermove", move);
          field.removeEventListener("pointerup", up);
          field.removeEventListener("pointercancel", up);
        };

        field.addEventListener("pointermove", move);
        field.addEventListener("pointerup", up);
        field.addEventListener("pointercancel", up);
      });
    }
  };

  const originalSetState = proto._setCalibrationFieldState;
  proto._setCalibrationFieldState = function(root) {
    originalSetState.call(this, root);

    for (const field of root.querySelectorAll(".page2-v84-calibratable")) {
      field.style.pointerEvents = this._calibrationMode ? "auto" : "";
      field.style.cursor = this._calibrationMode ? "move" : "";
      field.style.zIndex = this._calibrationMode ? "20000" : "";
    }
  };

  // ------------------------------------------------------------------
  // Advancement: new class additions go through D&D5e's native drop handler.
  // ------------------------------------------------------------------
  proto._addBrackenvaleClass = async function(sourceItem) {
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
        `${existing.name} is already on this character. Use Run Advancement on Page 2.`
      );
      return;
    }

    await this._addClassThroughNativeDropV84(sourceItem);
  };

  proto._addClassThroughNativeDropV84 = async function(sourceItem) {
    const nativeDrop = this._onDropItem;
    if (typeof nativeDrop !== "function") {
      ui.notifications?.error("D&D5e's native item drop handler is unavailable.");
      return false;
    }

    const target =
      this.element?.querySelector?.(".brackenvale-art-page.active")
      ?? this.element
      ?? document.body;

    const dragData =
      typeof sourceItem.toDragData === "function"
        ? sourceItem.toDragData()
        : {type: "Item", uuid: sourceItem.uuid};

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
      await nativeDrop.call(this, fakeEvent, dragData);
      return true;
    } catch (error) {
      console.error(`${MODULE_ID} | Native class drop failed`, error);
      ui.notifications?.error("D&D5e could not start class Advancement.");
      return false;
    }
  };

  proto._rerunExistingClassAdvancementV84 = async function(classItem) {
    if (!classItem || classItem.type !== "class") return;

    const sourceUuid =
      foundry.utils.getProperty(classItem, "flags.core.sourceId")
      ?? foundry.utils.getProperty(classItem, "_stats.compendiumSource")
      ?? null;

    if (!sourceUuid) {
      ui.notifications?.warn(
        `${classItem.name} does not have an original compendium source recorded.`
      );
      return;
    }

    const sourceItem = await fromUuid(sourceUuid);
    if (!sourceItem || sourceItem.type !== "class") {
      ui.notifications?.warn(`Could not find the original ${classItem.name} class.`);
      return;
    }

    const DialogV2 = foundry.applications?.api?.DialogV2;
    let approved = false;

    if (DialogV2?.confirm) {
      approved = await DialogV2.confirm({
        window: {title: `Run ${classItem.name} Advancement`},
        content: `
          <p>This will remove the current embedded
          <strong>${foundry.utils.escapeHTML(classItem.name)}</strong> class and
          immediately re-add the original class through D&D5e's native
          Advancement workflow.</p>
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
    await this._addClassThroughNativeDropV84(sourceItem);
  };

  // Add a Run Advancement button to the already-working Page 2 class controls.
  const originalPage2Controls = proto._activatePage2FeatureControls;
  proto._activatePage2FeatureControls = function(root) {
    originalPage2Controls.call(this, root);

    for (const manageButton of root.querySelectorAll('[data-action="manage-class"]')) {
      if (manageButton.dataset.v84Enhanced === "true") continue;
      manageButton.dataset.v84Enhanced = "true";

      const itemId = manageButton.dataset.itemId;
      if (!itemId) continue;

      manageButton.textContent = "Open Class";

      const runButton = document.createElement("button");
      runButton.type = "button";
      runButton.className = "page2-v84-run-advancement";
      runButton.dataset.itemId = itemId;
      runButton.textContent = "Run Advancement";

      runButton.addEventListener("click", async (event) => {
        if (this._calibrationMode) return;
        event.preventDefault();
        event.stopPropagation();

        const classItem = this.actor.items.get(itemId);
        if (!classItem) return;

        await this._rerunExistingClassAdvancementV84(classItem);
      });

      manageButton.before(runButton);
    }
  };

  return true;
}

Hooks.once("ready", () => {
  if (patchBrackenvaleCharacterSheet()) {
    // Re-render any currently open Brackenvale sheets so the patch is immediately visible.
    for (const actor of game.actors ?? []) {
      const sheet = actor.sheet;
      if (sheet?.constructor === game.brackenvaleCore?.BrackenvaleCharacterSheet && sheet.rendered) {
        sheet.render(false);
      }
    }
  }
});
