export const DEFAULT_THEME_ID = "atari-console";
export const THEME_STORAGE_KEY = "yaja2600animator_theme";

export const THEME_REGISTRY = Object.freeze({
  "atari-console": Object.freeze({
    id: "atari-console",
    label: "2600 Console",
    className: "theme-atari"
  }),
  "atari-controller": Object.freeze({
    id: "atari-controller",
    label: "2600 Controller",
    className: "theme-atari-controller"
  }),
  synthwave: Object.freeze({
    id: "synthwave",
    label: "Synthwave",
    className: "theme-synthwave"
  }),
  "synthwave-bright": Object.freeze({
    id: "synthwave-bright",
    label: "Synthwave Bright",
    className: "theme-synthwave-bright"
  }),
  blue: Object.freeze({
    id: "blue",
    label: "Blue",
    className: "theme-blue"
  }),
  "classic-dark": Object.freeze({
    id: "classic-dark",
    label: "Classic Dark",
    className: "theme-classic-dark"
  }),
  "classic-light": Object.freeze({
    id: "classic-light",
    label: "Classic Light",
    className: "theme-classic-light"
  })
});

export function normalizeThemeId(themeId) {
  return THEME_REGISTRY[themeId] ? themeId : DEFAULT_THEME_ID;
}

export function getPreferredTheme(storage = globalThis.localStorage) {
  try { return normalizeThemeId(storage?.getItem(THEME_STORAGE_KEY)); }
  catch { return DEFAULT_THEME_ID; }
}

export function applyTheme(themeId, { root = document.body, storage = globalThis.localStorage, persist = true } = {}) {
  const resolved = normalizeThemeId(themeId);
  Object.values(THEME_REGISTRY).forEach(theme => root.classList.remove(theme.className));
  root.classList.add(THEME_REGISTRY[resolved].className);
  root.dataset.yajaTheme = resolved;
  if (persist) {
    try { storage?.setItem(THEME_STORAGE_KEY, resolved); }
    catch { /* Theme application must still work when storage is unavailable. */ }
  }
  return resolved;
}
