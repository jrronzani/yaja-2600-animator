export const EDITOR_PREFERENCES_KEY = "yaja2600animator_editor_preferences";

export function normalizeGridColor(value) {
  const text = String(value ?? "").trim();
  const short = /^#?([\da-f]{3})$/i.exec(text);
  if (short) return `#${[...short[1]].map(character => character + character).join("")}`.toUpperCase();
  const full = /^#?([\da-f]{6})$/i.exec(text);
  return full ? `#${full[1].toUpperCase()}` : null;
}

export function normalizeEditorPreferences(value) {
  const source = value && typeof value === "object" ? value : {};
  const grids = {};
  for (const [theme, grid] of Object.entries(source.grids || {})) {
    const color = normalizeGridColor(grid?.color);
    const intensity = Number(grid?.intensity);
    if (color && Number.isFinite(intensity)) grids[theme] = {
      color,
      intensity: Math.max(0, Math.min(100, intensity))
    };
  }
  return {
    autoSpriteSelection: source.autoSpriteSelection === true,
    grids
  };
}

export function loadEditorPreferences(storage = globalThis.localStorage) {
  try {
    return normalizeEditorPreferences(JSON.parse(storage?.getItem(EDITOR_PREFERENCES_KEY) || "null"));
  } catch {
    return normalizeEditorPreferences(null);
  }
}

export function saveEditorPreferences(preferences, storage = globalThis.localStorage) {
  try {
    storage?.setItem(EDITOR_PREFERENCES_KEY, JSON.stringify(normalizeEditorPreferences(preferences)));
  } catch {
    // Editing must remain available when browser storage is unavailable.
  }
}

export function gridLineColor({ color, intensity }) {
  const rgb = [1, 3, 5].map(start => Number.parseInt(color.slice(start, start + 2), 16));
  return `rgba(${rgb.join(", ")}, ${intensity / 100})`;
}
