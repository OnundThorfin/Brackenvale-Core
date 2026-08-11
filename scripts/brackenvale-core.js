const MODULE_ID = "brackenvale-core";
const MODULE_VERSION = "0.2.2";

const CALENDAR = {
  months: [
    { name: "Hearthswell", season: "Winter" },
    { name: "Mossweep", season: "Spring" },
    { name: "Mendsun", season: "Spring" },
    { name: "Stormspeak", season: "Summer" },
    { name: "Highsun", season: "Summer" },
    { name: "Spearbreak", season: "Summer" },
    { name: "Tombhollow", season: "Autumn" },
    { name: "Honorfall", season: "Autumn" },
    { name: "Scribesmoot", season: "Winter" }
  ],
  weekdays: [
    "Fool", "Magician", "Oracle", "Queen", "King", "Priest", "Lover", "Chariot", "Sword", "Hermit", "Wheel",
    "Strength", "Hanged Man", "Death", "Balance", "Devil", "Tower", "Star", "Moon", "Sun", "Judgment", "World"
  ],
  daysPerMonth: 44,
  holidays: {
    "0-1": ["The Feast of Fools"],
    "0-6": ["Gedeon’s Day"],
    "0-20": ["Market Day"],
    "0-40": ["Moradin’s Day"],
    "0-44": ["Freedom Day"],
    "1-12": ["Modock’s Day"],
    "1-20": ["Market Day"],
    "1-23": ["Yondalla’s Day"],
    "2-4": ["Ahtanka’s Day"],
    "2-20": ["Market Day"],
    "3-19": ["Nautilon’s Day"],
    "3-20": ["Market Day"],
    "4-17": ["Shiva’s Day"],
    "4-20": ["Market Day"],
    "5-8": ["Rashad’s Day"],
    "5-20": ["Market Day"],
    "6-9": ["Tyr’s Day"],
    "6-20": ["Market Day"],
    "7-16": ["Veselko’s Day"],
    "7-20": ["Market Day"],
    "8-2": ["Mishra’s Day"],
    "8-20": ["Market Day"],
    "8-33": ["Zosimos’ Day"],
    "8-44": ["The Feast of Journey’s End"]
  }
};

const WEATHER = {
  Winter: {
    2: ["Deep freeze beneath a clear sky", "E"],
    3: ["Heavy snowfall and rising wind", "I,V,W,E"],
    4: ["Relentless northern wind", "E"],
    5: ["Bitter, cloudless cold", "E"],
    6: ["Grey skies and scattered flurries", ""],
    7: ["Clear and cold", ""],
    8: ["Freezing rain", "V,W,E"],
    9: ["Cold wind beneath dark clouds", ""],
    10: ["Frigid ground fog", "V"],
    11: ["Steady snowfall", "V,W"],
    12: ["Blizzard", "I,V,W,E"]
  },
  Spring: {
    2: ["Cold downpour with sleet", "I,V,W"],
    3: ["Relentless rain", "I,V,W"],
    4: ["Chilly, persistent drizzle", "W"],
    5: ["Blustery showers", "W"],
    6: ["Mild beneath low clouds", ""],
    7: ["Warm with scattered showers", "W"],
    8: ["Bright intervals between showers", "W"],
    9: ["Steady rain", "W"],
    10: ["Heavy rain", "I,V,W"],
    11: ["Torrential rain and rising streams", "I,V,W"],
    12: ["Violent thunderstorm", "I,V,W"]
  },
  Summer: {
    2: ["Cool winds from the coast", ""],
    3: ["Low clouds and morning mist", "V"],
    4: ["Warm, gentle rain", "W"],
    5: ["Brooding clouds and distant thunder", ""],
    6: ["Balmy and clear", ""],
    7: ["Hot and humid", ""],
    8: ["Overcast and muggy", ""],
    9: ["Sweltering and still", "E"],
    10: ["Baking heat beneath a clear sky", "E"],
    11: ["Warm, steady wind", ""],
    12: ["Violent thunderstorm", "V,W"]
  },
  Autumn: {
    2: ["Torrential rain", "I,V,W"],
    3: ["Rolling fog", "V"],
    4: ["Cold, driving rain", "V,W"],
    5: ["Bracing wind", ""],
    6: ["Mild and clement", ""],
    7: ["Clear and chilly", ""],
    8: ["Damp drizzle", "W"],
    9: ["Cloudy with drifting mist", "V"],
    10: ["Brooding storm clouds", ""],
    11: ["Frosty and cold", ""],
    12: ["Early snow", "W"]
  }
};

const EFFECT_LABELS = {
  I: "Impeded Travel",
  V: "Poor Visibility",
  W: "Wet Conditions",
  E: "Exposure"
};

function dateKey(date) {
  return `${date.year}-${date.monthIndex}-${date.day}`;
}

function normalizeDate(date) {
  let { year, monthIndex, day } = date;
  year = Math.max(1, Number(year) || 1307);
  monthIndex = Number(monthIndex) || 0;
  day = Number(day) || 1;
  while (day > CALENDAR.daysPerMonth) {
    day -= CALENDAR.daysPerMonth;
    monthIndex += 1;
    if (monthIndex >= CALENDAR.months.length) {
      monthIndex = 0;
      year += 1;
    }
  }
  while (day < 1) {
    day += CALENDAR.daysPerMonth;
    monthIndex -= 1;
    if (monthIndex < 0) {
      monthIndex = CALENDAR.months.length - 1;
      year = Math.max(1, year - 1);
    }
  }
  monthIndex = ((monthIndex % CALENDAR.months.length) + CALENDAR.months.length) % CALENDAR.months.length;
  return { year, monthIndex, day };
}

function getState() {
  return foundry.utils.deepClone(game.settings.get(MODULE_ID, "state"));
}

async function setState(state) {
  await game.settings.set(MODULE_ID, "state", state);
}

function formatDate(date) {
  const month = CALENDAR.months[date.monthIndex];
  return {
    ...date,
    month: month.name,
    season: month.season,
    weekday: CALENDAR.weekdays[(date.day - 1) % CALENDAR.weekdays.length]
  };
}

function getWeatherForDate(state, date) {
  const weather = state.weather?.[dateKey(date)];
  if (!weather) return null;
  return {
    ...weather,
    effectLabels: weather.effects ? weather.effects.split(",").filter(Boolean).map((effect) => EFFECT_LABELS[effect]) : []
  };
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function weatherIcon(weatherText = "") {
  const text = weatherText.toLowerCase();
  if (text.includes("snow") || text.includes("blizzard") || text.includes("flurr")) return "fa-snowflake";
  if (text.includes("thunder")) return "fa-cloud-bolt";
  if (text.includes("rain") || text.includes("drizzle") || text.includes("shower") || text.includes("downpour")) return "fa-cloud-rain";
  if (text.includes("fog") || text.includes("mist")) return "fa-smog";
  if (text.includes("clear") || text.includes("bright") || text.includes("sun")) return "fa-sun";
  if (text.includes("wind")) return "fa-wind";
  return "fa-cloud";
}

class BrackenvaleDashboard extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "brackenvale-core-dashboard",
    tag: "section",
    classes: ["brackenvale-core-window"],
    window: { title: "Brackenvale Core", icon: "fa-solid fa-compass", resizable: true },
    position: { width: 620, height: 760 }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/dashboard.hbs` }
  };

  async _prepareContext() {
    const state = getState();
    const date = formatDate(state.date);
    const maximum = Math.max(1, Number(state.travel.maximum) || 6);
    const current = Math.max(0, Math.min(maximum, Number(state.travel.current) || 0));
    return {
      version: MODULE_VERSION,
      isGM: game.user.isGM,
      date,
      months: CALENDAR.months.map((month, index) => ({ index, name: month.name, selected: index === date.monthIndex })),
      holidays: CALENDAR.holidays[`${date.monthIndex}-${date.day}`] ?? [],
      weather: getWeatherForDate(state, state.date),
      travel: { current, maximum, percent: Math.round((current / maximum) * 100) },
      location: state.location ?? "",
      notes: state.notes ?? ""
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    if (!root) return;

    const dashboardActions = new Set([
      "previousDay", "nextDay", "nextWeek", "nextMonth", "weather",
      "travelDown", "travelUp", "travelReset"
    ]);
    root.querySelectorAll("[data-action]").forEach((button) => {
      const action = button.dataset.action;
      // Foundry's own window controls (including the X/close button) also use
      // data-action. Only intercept actions which belong to Brackenvale Core.
      if (!dashboardActions.has(action)) return;
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await this.handleAction(action);
      });
    });

    const form = root.querySelector("form.bv-settings-form");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await this.saveForm(form);
    });
  }

  async refresh() {
    if (this.rendered) await this.render({ force: true });
    game.brackenvaleCore?.overlay?.render();
  }

  async handleAction(action) {
    if (!game.user.isGM) return;
    try {
      if (action === "previousDay") await this.shiftDays(-1);
      else if (action === "nextDay") await this.shiftDays(1);
      else if (action === "nextWeek") await this.shiftDays(11);
      else if (action === "nextMonth") await this.shiftDays(CALENDAR.daysPerMonth);
      else if (action === "weather") await this.generateWeather();
      else if (action === "travelDown") await this.adjustTravel(-1);
      else if (action === "travelUp") await this.adjustTravel(1);
      else if (action === "travelReset") await this.adjustTravel(0, true);
    } catch (error) {
      console.error(`${MODULE_ID} | Dashboard action failed`, error);
      ui.notifications.error("Brackenvale Core could not complete that action. Check the console for details.");
    }
  }

  async saveForm(form) {
    if (!game.user.isGM) return;
    try {
      const data = new FormData(form);
      const state = getState();
      state.date = normalizeDate({
        year: data.get("year"),
        monthIndex: data.get("monthIndex"),
        day: data.get("day")
      });
      state.travel.maximum = Math.max(1, Number(data.get("travelMaximum")) || 1);
      state.travel.current = Math.max(0, Math.min(state.travel.maximum, Number(data.get("travelCurrent")) || 0));
      state.location = String(data.get("location") ?? "").trim();
      state.notes = String(data.get("notes") ?? "").trim();
      await setState(state);
      await this.refresh();
      ui.notifications.info("Brackenvale Core updated.");
    } catch (error) {
      console.error(`${MODULE_ID} | Saving dashboard failed`, error);
      ui.notifications.error("Brackenvale Core could not save those changes. Check the console for details.");
    }
  }

  async shiftDays(days) {
    const state = getState();
    state.date = normalizeDate({ ...state.date, day: state.date.day + days });
    await setState(state);
    await this.refresh();
  }

  async generateWeather() {
    const state = getState();
    const date = formatDate(state.date);
    const roll = await new Roll("2d6").evaluate();
    const [text, effects] = WEATHER[date.season][roll.total];
    state.weather ??= {};
    state.weather[dateKey(state.date)] = { roll: roll.total, text, effects };
    await setState(state);
    await roll.toMessage({ flavor: `${date.season} weather for ${date.month} ${date.day}, ${date.year}` });
    await this.refresh();
  }

  async adjustTravel(delta, reset = false) {
    const state = getState();
    const maximum = Math.max(1, Number(state.travel.maximum) || 6);
    const current = Number(state.travel.current) || 0;
    state.travel.current = reset ? maximum : Math.max(0, Math.min(maximum, current + delta));
    await setState(state);
    await this.refresh();
  }
}

class BrackenvaleOverlay {
  constructor() {
    this.element = null;
    this.dragState = null;
    this.suppressOpen = false;
  }

  get preferences() {
    return foundry.utils.deepClone(game.settings.get(MODULE_ID, "overlayPreferences"));
  }

  async setPreferences(changes) {
    const current = this.preferences;
    await game.settings.set(MODULE_ID, "overlayPreferences", { ...current, ...changes });
  }

  mount() {
    if (this.element?.isConnected) return;
    document.getElementById("brackenvale-core-overlay")?.remove();
    this.element = document.createElement("aside");
    this.element.id = "brackenvale-core-overlay";
    this.element.setAttribute("aria-label", "Brackenvale Core overlay");
    document.body.appendChild(this.element);

    this.element.addEventListener("click", (event) => {
      const control = event.target.closest("[data-bv-action]");
      if (control) {
        event.stopPropagation();
        this.handleOverlayAction(control.dataset.bvAction);
        return;
      }
      if (this.suppressOpen || event.target.closest(".bv-overlay-drag")) return;
      game.brackenvaleCore.open();
    });

    this.element.addEventListener("pointerdown", (event) => this.beginDrag(event));
    window.addEventListener("resize", () => this.keepInBounds());
    this.render();
  }

  async handleOverlayAction(action) {
    if (action === "toggle-minimize") {
      await this.setPreferences({ minimized: !this.preferences.minimized });
      this.render();
      return;
    }
    if (action === "reset-position") {
      await this.setPreferences({ left: null, top: 74 });
      this.applyPosition();
      return;
    }
    if (!game.user.isGM) return;
    if (action === "next-day") await game.brackenvaleCore.dashboard.shiftDays(1);
    if (action === "weather") await game.brackenvaleCore.dashboard.generateWeather();
    if (action === "spend-tp") await game.brackenvaleCore.dashboard.adjustTravel(-1);
    if (action === "refund-tp") await game.brackenvaleCore.dashboard.adjustTravel(1);
  }

  beginDrag(event) {
    if (event.button !== 0 || !event.target.closest(".bv-overlay-drag")) return;
    if (event.target.closest("button")) return;
    const rect = this.element.getBoundingClientRect();
    this.dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false
    };
    this.element.setPointerCapture(event.pointerId);
    this.element.classList.add("is-dragging");
    const move = (moveEvent) => this.drag(moveEvent);
    const up = (upEvent) => this.endDrag(upEvent, move, up);
    this.element.addEventListener("pointermove", move);
    this.element.addEventListener("pointerup", up, { once: true });
    this.element.addEventListener("pointercancel", up, { once: true });
    event.preventDefault();
  }

  drag(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
    const dx = event.clientX - this.dragState.startX;
    const dy = event.clientY - this.dragState.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) this.dragState.moved = true;
    const maxLeft = Math.max(8, window.innerWidth - this.element.offsetWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - this.element.offsetHeight - 8);
    const left = Math.min(maxLeft, Math.max(8, this.dragState.left + dx));
    const top = Math.min(maxTop, Math.max(8, this.dragState.top + dy));
    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
    this.element.style.right = "auto";
  }

  async endDrag(event, moveHandler, upHandler) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return;
    this.element.removeEventListener("pointermove", moveHandler);
    this.element.removeEventListener("pointerup", upHandler);
    this.element.removeEventListener("pointercancel", upHandler);
    this.element.classList.remove("is-dragging");
    const moved = this.dragState.moved;
    this.dragState = null;
    if (moved) {
      const rect = this.element.getBoundingClientRect();
      this.suppressOpen = true;
      setTimeout(() => { this.suppressOpen = false; }, 0);
      await this.setPreferences({ left: Math.round(rect.left), top: Math.round(rect.top) });
    }
  }

  applyPosition() {
    if (!this.element?.isConnected) return;
    const prefs = this.preferences;
    const width = this.element.offsetWidth || 292;
    const height = this.element.offsetHeight || 100;
    const defaultLeft = Math.max(8, window.innerWidth - width - 324);
    const left = Number.isFinite(Number(prefs.left)) ? Number(prefs.left) : defaultLeft;
    const top = Number.isFinite(Number(prefs.top)) ? Number(prefs.top) : 74;
    const boundedLeft = Math.min(Math.max(8, window.innerWidth - width - 8), Math.max(8, left));
    const boundedTop = Math.min(Math.max(8, window.innerHeight - height - 8), Math.max(8, top));
    this.element.style.left = `${boundedLeft}px`;
    this.element.style.top = `${boundedTop}px`;
    this.element.style.right = "auto";
  }

  keepInBounds() {
    this.applyPosition();
  }

  render() {
    if (!this.element?.isConnected) return;
    const state = getState();
    const prefs = this.preferences;
    const date = formatDate(state.date);
    const weather = getWeatherForDate(state, state.date);
    const maximum = Math.max(1, Number(state.travel.maximum) || 6);
    const current = Math.max(0, Math.min(maximum, Number(state.travel.current) || 0));
    const percent = Math.round((current / maximum) * 100);
    const holidays = CALENDAR.holidays[`${date.monthIndex}-${date.day}`] ?? [];
    const holidayMarkup = holidays.length
      ? `<div class="bv-overlay-holiday"><i class="fa-solid fa-bell"></i> ${holidays.map(escapeHtml).join(" · ")}</div>`
      : "";
    const locationMarkup = state.location
      ? `<div class="bv-overlay-location"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(state.location)}</div>`
      : "";
    const weatherText = weather?.text ?? "Weather not yet generated";
    const gmControls = game.user.isGM
      ? `<div class="bv-overlay-quick" aria-label="Game Master quick controls">
          <button type="button" data-bv-action="next-day" title="Advance one day"><i class="fa-solid fa-forward-step"></i></button>
          <button type="button" data-bv-action="weather" title="Generate today's weather"><i class="fa-solid fa-cloud-rain"></i></button>
          <button type="button" data-bv-action="spend-tp" title="Spend one Travel Point"><i class="fa-solid fa-minus"></i></button>
          <button type="button" data-bv-action="refund-tp" title="Refund one Travel Point"><i class="fa-solid fa-plus"></i></button>
        </div>`
      : "";

    this.element.classList.toggle("is-minimized", Boolean(prefs.minimized));
    this.element.innerHTML = prefs.minimized
      ? `<div class="bv-overlay-drag bv-overlay-compact" title="Drag to move; click to open Brackenvale Core">
          <i class="fa-solid fa-leaf"></i>
          <span>${escapeHtml(date.month)} ${date.day}</span>
          <strong>${current}/${maximum} TP</strong>
          <button type="button" data-bv-action="toggle-minimize" title="Expand overlay"><i class="fa-solid fa-window-maximize"></i></button>
        </div>`
      : `<div class="bv-overlay-drag">
          <div class="bv-overlay-crest"><i class="fa-solid fa-leaf"></i></div>
          <div class="bv-overlay-body">
            <div class="bv-overlay-toolbar">
              <div class="bv-overlay-title">BRACKENVALE</div>
              <div class="bv-overlay-window-controls">
                <button type="button" data-bv-action="reset-position" title="Reset overlay position"><i class="fa-solid fa-location-crosshairs"></i></button>
                <button type="button" data-bv-action="toggle-minimize" title="Minimize overlay"><i class="fa-solid fa-window-minimize"></i></button>
              </div>
            </div>
            <div class="bv-overlay-date">${escapeHtml(date.month)} ${date.day}, ${date.year}</div>
            <div class="bv-overlay-subdate">${escapeHtml(date.weekday)} · ${escapeHtml(date.season)}</div>
            ${holidayMarkup}
            <div class="bv-overlay-weather"><i class="fa-solid ${weatherIcon(weatherText)}"></i><span>${escapeHtml(weatherText)}</span></div>
            ${locationMarkup}
            <div class="bv-overlay-travel-row">
              <span><i class="fa-solid fa-route"></i> Travel Points</span>
              <strong>${current}/${maximum}</strong>
            </div>
            <div class="bv-overlay-meter" aria-label="${current} of ${maximum} Travel Points"><span style="width:${percent}%"></span></div>
            ${gmControls}
          </div>
        </div>`;
    requestAnimationFrame(() => this.applyPosition());
  }
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "state", {
    scope: "world",
    config: false,
    type: Object,
    default: {
      date: { year: 1307, monthIndex: 0, day: 1 },
      weather: {},
      travel: { current: 6, maximum: 6 },
      location: "",
      notes: ""
    },
    onChange: () => {
      game.brackenvaleCore?.overlay?.render();
    }
  });

  game.settings.register(MODULE_ID, "overlayPreferences", {
    scope: "client",
    config: false,
    type: Object,
    default: { left: null, top: 74, minimized: false },
    onChange: () => game.brackenvaleCore?.overlay?.render()
  });
});

Hooks.once("ready", () => {
  const dashboard = new BrackenvaleDashboard();
  const overlay = new BrackenvaleOverlay();
  game.brackenvaleCore = {
    dashboard,
    overlay,
    open: () => dashboard.render(true),
    calendar: CALENDAR,
    weather: WEATHER
  };

  overlay.mount();

  if (game.system.id !== "dnd5e") {
    ui.notifications.warn("Brackenvale Core was designed for the D&D Fifth Edition system.");
  }
});

Hooks.on("renderSettings", (_app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || root.querySelector("#brackenvale-core-launcher")) return;
  const launcher = document.createElement("div");
  launcher.id = "brackenvale-core-launcher";
  launcher.innerHTML = `<button type="button"><i class="fa-solid fa-compass"></i> Open Brackenvale Core</button>`;
  launcher.querySelector("button").addEventListener("click", () => game.brackenvaleCore.open());
  const settingsGame = root.querySelector("#settings-game") ?? root.querySelector(".settings-sidebar") ?? root;
  settingsGame.prepend(launcher);
});

Hooks.on("chatMessage", (_chatLog, message) => {
  if (message.trim().toLowerCase() !== "/brackenvale") return true;
  game.brackenvaleCore.open();
  return false;
});
