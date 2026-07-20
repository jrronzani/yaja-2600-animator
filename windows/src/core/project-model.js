export const CURRENT_SCHEMA_VERSION = 9;

const SUPPORTED_THEMES = new Set(["atari-console", "atari-controller", "synthwave", "synthwave-bright", "blue", "classic-dark", "classic-light"]);

export function playerLimitForKernel(kernel) {
  if (kernel === "STANDARD") return 1;
  if (kernel === "MULTISPRITE") return 5;
  if (kernel === "DPC+") return 9;
  return 16;
}

export function normalizePlayerAssignments(assignments, kernel = "PXE") {
  const max = playerLimitForKernel(kernel);
  const source = Array.isArray(assignments) ? assignments : [0, 1];
  const result = [];
  for (let slot = 0; slot < 2; slot++) {
    let value = Math.max(0, Math.min(max, Number.parseInt(source[slot], 10) || 0));
    if (result.includes(value)) value = Array.from({ length: max + 1 }, (_, index) => index).find(index => !result.includes(index)) ?? 0;
    result.push(value);
  }
  return result;
}

function normalizeReference(reference) {
  if (!reference || typeof reference !== "object") return null;
  const dataUrl = typeof reference.dataUrl === "string" && reference.dataUrl.startsWith("data:image/") ? reference.dataUrl : "";
  if (!dataUrl) return null;
  return {
    dataUrl,
    name: String(reference.name || "Reference image"),
    visible: reference.visible !== false,
    opacity: Math.max(0, Math.min(100, Number(reference.opacity ?? 100))),
    fitMode: ["fit", "crop", "stretch", "manual"].includes(reference.fitMode) ? reference.fitMode : "fit",
    scale: Math.max(10, Math.min(500, Number(reference.scale) || 100)),
    xOffset: Math.max(-100, Math.min(100, Number(reference.xOffset) || 0)),
    yOffset: Math.max(-200, Math.min(200, Number(reference.yOffset) || 0)),
    threshold: Math.max(0, Math.min(255, Number(reference.threshold ?? 64))),
    dither: !!reference.dither,
    brightness: Math.max(0, Math.min(400, Number(reference.brightness) || 100)),
    contrast: Math.max(0, Math.min(400, Number(reference.contrast) || 100))
  };
}

function normalizePlayer(player, legacyNusiz = "normal", legacyX = 0) {
  const normalized = player && typeof player === "object" ? { ...player } : {};
  normalized.pixels = Array.isArray(normalized.pixels) ? normalized.pixels : [];
  normalized.colors = Array.isArray(normalized.colors) ? normalized.colors : [];
  normalized.solidColor = String(normalized.solidColor || normalized.colors[0] || "$48");
  normalized.nusiz = ["normal", "double", "quad"].includes(normalized.nusiz) ? normalized.nusiz : legacyNusiz;
  normalized.xOffset = Number.isFinite(Number(normalized.xOffset)) ? Number(normalized.xOffset) : legacyX;
  normalized.yOffset = Number.isFinite(Number(normalized.yOffset)) ? Number(normalized.yOffset) : 0;
  normalized.reference = normalizeReference(normalized.reference);
  return normalized;
}

export function migrateProject(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Project file must contain a JSON object.");
  const project = structuredClone(input);
  const sourceVersion = Number(project.schemaVersion || 1);
  if (sourceVersion > CURRENT_SCHEMA_VERSION) throw new Error(`Project schema ${sourceVersion} is newer than this Animator supports.`);
  if (!Array.isArray(project.frames) || !project.frames.length) throw new Error("Project must contain at least one frame.");

  project.schemaVersion = CURRENT_SCHEMA_VERSION;
  project.version = "1.0.5";
  project.app = "YAJA 2600 Animator";
  project.projectName = String(project.projectName || "Untitled Project");
  project.theme = SUPPORTED_THEMES.has(project.theme) ? project.theme : "atari-console";
  project.animationName = String(project.animationName || project.projectName || "Untitled Animation");
  project.kernel = ["STANDARD", "MULTISPRITE", "DPC+", "PXE"].includes(project.kernel) ? project.kernel : "PXE";
  project.compositionModel = project.compositionModel === "adjacent" ? "adjacent" : (sourceVersion >= 6 ? "adjacent" : "legacy-absolute");
  project.playerAssignments = normalizePlayerAssignments(project.playerAssignments, project.kernel);
  project.region = project.region === "PAL" ? "PAL" : "NTSC";
  project.brushWidth = Math.max(1, Math.min(8, Number.parseInt(project.brushWidth, 10) || 1));
  project.brushHeight = Math.max(1, Math.min(32, Number.parseInt(project.brushHeight, 10) || 1));
  project.onionFrames = Math.max(1, Math.min(10, Number.parseInt(project.onionFrames, 10) || 1));
  project.zoom = Math.max(1, Math.min(42, Number(project.zoom) || 13));
  project.showColorColumns = project.showColorColumns !== false;
  project.currentColor = String(project.currentColor || "$48");
  project.colorBlocks = Array.isArray(project.colorBlocks) ? project.colorBlocks.map(block => ({
    ...block,
    colors: Array.isArray(block?.colors) && block.colors.length ? block.colors.slice() : ["$48"],
    hueOffset: Math.max(0, Math.min(15, Math.round(Number(block?.hueOffset) || 0))),
    lightnessOffset: Math.max(0, Math.min(7, Math.round(Number(block?.lightnessOffset) || 0)))
  })) : [];
  project.stamps = Array.isArray(project.stamps) ? project.stamps : [];
  const legacyNusiz = Array.isArray(project.nusiz) ? project.nusiz : ["normal", "normal"];
  const legacyP1Offset = Number.isFinite(Number(project.p1Offset)) ? Number(project.p1Offset) : 0;
  project.verticalStretch = ["STANDARD", "MULTISPRITE"].includes(project.kernel) ? 2 : 1;
  project.frames = project.frames.map((frame, index) => {
    const payloadHeight = Math.max(frame?.players?.[0]?.pixels?.length || 0, frame?.players?.[1]?.pixels?.length || 0);
    const height = Math.max(1, Math.min(255, Number.parseInt(frame?.height, 10) || payloadHeight || project.height || 16));
    const width = Math.max(1, Math.min(8, Number.parseInt(frame?.width, 10) || project.width || 8));
    const players = [0, 1].map(slot => normalizePlayer(frame?.players?.[slot], legacyNusiz[slot] || "normal", slot === 1 ? legacyP1Offset : 0));
    return {
      ...frame,
      name: String(frame?.name || `Frame ${index}`),
      height,
      width,
      duration: Math.max(1, Math.min(60, Number.parseInt(frame?.duration, 10) || 3)),
      players
    };
  });
  if (project.compositionModel === "legacy-absolute") {
    const scales = { normal: 1, double: 2, quad: 4 };
    project.frames.forEach(frame => {
      frame.players[1].xOffset -= frame.width * (scales[frame.players[0].nusiz] || 1);
    });
    project.compositionModel = "adjacent";
  }
  delete project.nusiz;
  delete project.p1Offset;
  delete project.frameRepeat;
  return project;
}

export function projectCompatibility(project) {
  return {
    schemaVersion: Number(project?.schemaVersion || 1),
    currentSchemaVersion: CURRENT_SCHEMA_VERSION,
    canLoad: Number(project?.schemaVersion || 1) <= CURRENT_SCHEMA_VERSION,
    frameCount: Array.isArray(project?.frames) ? project.frames.length : 0
  };
}
