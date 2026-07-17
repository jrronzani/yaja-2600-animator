import { normalizePlayerAssignments, playerLimitForKernel } from "./project-model.js";
import { centeredCompositionGeometry, NUSIZ_MODES as NUSIZ, nusizMode } from "./display-geometry.js";
const KERNELS = ["STANDARD", "MULTISPRITE", "DPC+", "PXE"];
const DISPLAY_ROWS = { STANDARD: 96, MULTISPRITE: 88, "DPC+": 178, PXE: 180 };
export const YAJA_BB_FORMAT_VERSION = 1;
export const YAJA_COORDINATE_SYSTEM = Object.freeze({ screenYAxis: "down", spriteAnchor: "bottom-left" });

export function spriteBottomAnchorYDelta(height, yOffset = 0) {
  const rows = Math.max(1, Math.trunc(Number(height) || 1));
  return Math.floor((rows - 1) / 2) + Math.trunc(Number(yOffset) || 0);
}

export function normalizeAtariCode(value, fallback = "$0E") {
  const raw = String(value ?? "").trim().toUpperCase().replace(/^\$/, "");
  return /^[0-9A-F]{1,2}$/.test(raw) ? `$${raw.padStart(2, "0")}` : fallback;
}

export function normalizeAnimationBase(name) {
  const source = String(name || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/^_+/, "");
  const words = source.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  let base = words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join("") || "UntitledAnimation";
  if (/^\d/.test(base)) base = `Animation${base}`;
  return base;
}

export function animationNamespace(name) { return `__${normalizeAnimationBase(name)}`; }
export function animationExportFilename(name, mode = "data") { return `${normalizeAnimationBase(name)}_${mode === "demo" ? "Demo" : "Data"}.bas`; }

function activeSlotsFor(project) { return project.twoSpriteMode ? [0, 1] : [project.activePlayer === 1 ? 1 : 0]; }
function isSolidKernel(kernel) { return kernel === "STANDARD" || kernel === "MULTISPRITE"; }

function rowsFor(source, width, height) {
  return Array.from({ length: height }, (_, y) => Array.from({ length: 8 }, (_, x) => x < width && source?.pixels?.[y]?.[x] ? 1 : 0));
}

export function createAnimationIR(project, options = {}) {
  const kernel = KERNELS.includes(project.kernel) ? project.kernel : "PXE";
  const assignments = normalizePlayerAssignments(project.playerAssignments, kernel);
  const activeSlots = activeSlotsFor(project);
  const animationName = String(project.animationName || project.projectName || "Untitled Animation");
  const namespace = animationNamespace(animationName);
  const displayRows = DISPLAY_ROWS[kernel];
  const frames = (project.frames || []).map((frame, frameIndex) => {
    const width = Math.max(1, Math.min(8, Number.parseInt(frame.width, 10) || 8));
    const height = Math.max(1, Math.min(255, Number.parseInt(frame.height, 10) || frame.players?.[0]?.pixels?.length || 16));
    const players = activeSlots.map(slot => {
      const source = frame.players?.[slot] || {};
      const nusiz = NUSIZ[source.nusiz] ? source.nusiz : "normal";
      const mode = nusizMode(nusiz);
      return {
        slot, player: assignments[slot], nusiz, nusizCode: mode.code, scale: mode.scale,
        xOffset: Math.trunc(Number(source.xOffset) || 0), yOffset: Math.trunc(Number(source.yOffset) || 0),
        solidColor: normalizeAtariCode(source.solidColor || source.colors?.[0]),
        pixels: rowsFor(source, width, height),
        colors: Array.from({ length: height }, (_, y) => normalizeAtariCode(source.colors?.[y] || source.solidColor))
      };
    });
    const composition = centeredCompositionGeometry(width, players);
    const totalWidth = composition.totalWidth;
    players.forEach((player, index) => {
      // Wide TIA players begin one hardware pixel to the right of the bB X
      // coordinate used by normal-width players. Compensate so the ROM's
      // visible bounds match the editor's centered NUSIZ composition.
      const widePlayerBias = player.scale > 1 ? -1 : 0;
      player.centeredXDelta = composition.centeredX[index] + widePlayerBias;
      // Atari player Y increases downward and addresses the sprite's bottom row.
      // Add half the sprite height so OriginY remains the visual center.
      player.centeredYDelta = spriteBottomAnchorYDelta(height, player.yOffset);
    });
    return { index: frameIndex, width, height, duration: Math.max(1, Math.min(60, Number.parseInt(frame.duration, 10) || 3)), totalWidth, players };
  });
  const owned = [`${namespace}_Frame`, `${namespace}_Timer`, `${namespace}_PivotX`, `${namespace}_PivotY`];
  const positionLabels = frames.map((_, index) => `${namespace}_PositionFrame${String(index).padStart(2, "0")}`);
  return {
    schemaVersion: 3, formatVersion: YAJA_BB_FORMAT_VERSION, kind: options.mode === "demo" ? "demo" : "data",
    projectName: String(project.projectName || "Untitled Project"), animationName, namespace,
    animationId: namespace.slice(2), kernel, region: project.region === "PAL" ? "PAL" : "NTSC",
    background: normalizeAtariCode(project.background, "$00"), compositionModel: "adjacent",
    twoSpriteMode: !!project.twoSpriteMode, assignments, activeSlots, activePlayers: activeSlots.map(slot => assignments[slot]),
    displayRows, defaultOrigin: { x: 80, y: Math.floor(displayRows / 2) }, coordinateSystem: YAJA_COORDINATE_SYSTEM,
    symbols: { owned, required: [], labels: frames.map((_, index) => `${namespace}_Frame${String(index).padStart(2, "0")}`), positionLabels },
    maxGeneratedGosubDepth: 3, frames
  };
}

export function validateAnimationIR(ir) {
  const diagnostics = [];
  if (!ir.frames.length) diagnostics.push({ severity: "error", code: "NO_FRAMES", message: "Add at least one frame before exporting." });
  if (new Set(ir.activePlayers).size !== ir.activePlayers.length) diagnostics.push({ severity: "error", code: "DUPLICATE_PLAYER", message: "Each sprite slot must use a different P# assignment." });
  const max = playerLimitForKernel(ir.kernel);
  ir.activePlayers.forEach(player => { if (player < 0 || player > max) diagnostics.push({ severity: "error", code: "PLAYER_RANGE", message: `${ir.kernel} supports P0 through P${max}; P${player} cannot be exported.` }); });
  ir.frames.forEach(frame => frame.players.forEach(player => {
    if (player.pixels.length !== frame.height) diagnostics.push({ severity: "error", code: "SPRITE_HEIGHT", message: `Frame ${frame.index}, P${player.player} data does not match its ${frame.height}-row height.` });
    if (!isSolidKernel(ir.kernel) && player.colors.length !== frame.height) diagnostics.push({ severity: "error", code: "COLOR_HEIGHT", message: `Frame ${frame.index}, P${player.player} color rows do not match sprite height.` });
  }));
  if (ir.twoSpriteMode && ir.activePlayers.every(player => player > 0)) diagnostics.push({ severity: "warning", code: "VIRTUAL_OVERLAP", message: "Two virtual P1+ sprites may flicker when their vertical ranges overlap; export will continue." });
  diagnostics.push({ severity: "info", code: "VARIABLE_OWNERSHIP", message: `Module aliases four bytes: ${ir.symbols.owned.join(", ")}. Generated hot-path call depth is ${ir.maxGeneratedGosubDepth}.` });
  return diagnostics;
}

function metadata(ir) {
  return JSON.stringify({ formatVersion: ir.formatVersion, app: "YAJA 2600 Animator", projectName: ir.projectName, animationName: ir.animationName, symbol: ir.namespace, kernel: ir.kernel, region: ir.region, background: ir.background, assignments: ir.assignments, activeSlots: ir.activeSlots, twoSpriteMode: ir.twoSpriteMode, compositionModel: ir.compositionModel, pivotModel: "shared-origin", coordinateSystem: ir.coordinateSystem });
}
function frameMetadata(frame) {
  return JSON.stringify({ index: frame.index, width: frame.width, height: frame.height, duration: frame.duration, players: frame.players.map(p => ({ slot: p.slot, player: p.player, nusiz: p.nusiz, xOffset: p.xOffset, yOffset: p.yOffset, solidColor: p.solidColor })) });
}
function addExpr(symbol, delta) { return delta === 0 ? symbol : `${symbol} ${delta > 0 ? "+" : "-"} ${Math.abs(delta)}`; }
function nusizSymbol(kernel, player) {
  if ((kernel === "MULTISPRITE" || kernel === "DPC+" || kernel === "PXE") && player === 1) return "_NUSIZ1";
  return `NUSIZ${player}`;
}
function colorSymbol(kernel, player) {
  if (kernel === "MULTISPRITE" && player === 1) return "_COLUP1";
  return `COLUP${player}`;
}
function emitPlayerBlock(ir, player) {
  const lines = [`  player${player.player}:`];
  player.pixels.forEach(row => lines.push(`  %${row.map(Boolean).map(v => v ? "1" : "0").join("")}`));
  lines.push("end");
  if (!isSolidKernel(ir.kernel)) {
    lines.push(`  player${player.player}color:`);
    player.colors.forEach(color => lines.push(`  ${color}`));
    lines.push("end");
  }
  return lines;
}
function emitPlayerSetup(ir, frame, player) {
  const lines = [`  ${nusizSymbol(ir.kernel, player.player)} = ${player.nusizCode}`];
  if (isSolidKernel(ir.kernel)) lines.push(`  ${colorSymbol(ir.kernel, player.player)} = ${player.solidColor}`);
  lines.push(`  player${player.player}height = ${frame.height}`);
  lines.push(`  player${player.player}x = ${addExpr(`${ir.namespace}_OriginX`, player.centeredXDelta)}`);
  lines.push(`  player${player.player}y = ${addExpr(`${ir.namespace}_OriginY`, player.centeredYDelta)}`);
  return lines;
}

function emitPlayerPosition(ir, player) {
  return [
    `  player${player.player}x = ${addExpr(`${ir.namespace}_OriginX`, player.centeredXDelta)}`,
    `  player${player.player}y = ${addExpr(`${ir.namespace}_OriginY`, player.centeredYDelta)}`
  ];
}

export function emitAnimationModule(ir) {
  const n = ir.namespace;
  const lines = [
    "; YAJA 2600 Animator callable animation module", `;@YAJA PROJECT ${metadata(ir)}`,
    "; Coordinates: screen Y increases downward; player#y is the sprite's bottom-left anchor.",
    "; OriginY is the composition center; each frame adds half its height plus its Y Offset.",
    "; Movement API: set PivotX/PivotY, then gosub Update once before each drawscreen.",
    "; Update reapplies the active frame's relative NUSIZ/offset position every tick.",
    "; OriginX/OriginY are compatibility aliases for the same shared pivot bytes.",
    "; Owned aliases: a=frame, b=timer, c=shared pivot X, d=shared pivot Y.",
    `  dim ${n}_Frame = a`, `  dim ${n}_Timer = b`, `  dim ${n}_PivotX = c`, `  dim ${n}_PivotY = d`,
    `  dim ${n}_OriginX = c`, `  dim ${n}_OriginY = d`, "",
    `${n}_Init`, ...(ir.kind === "demo" && !isSolidKernel(ir.kernel) ? ["  gosub __YAJA_Demo_Background"] : []), `  ${n}_Frame = 0`, `  ${n}_Timer = 1`, `  goto ${n}_LoadFrame`, "",
    `${n}_Update`, `  gosub ${n}_ApplyPivot`, `  if ${n}_Timer > 1 then ${n}_Timer = ${n}_Timer - 1 : return`,
    `  ${n}_Frame = ${n}_Frame + 1`, `  if ${n}_Frame >= ${ir.frames.length} then ${n}_Frame = 0`,
    `${n}_LoadFrame`, `  on ${n}_Frame gosub ${ir.symbols.labels.join(" ")}`, "  return", ""
  ];
  ir.frames.forEach((frame, index) => {
    lines.push(`;@YAJA FRAME_BEGIN ${index} ${frameMetadata(frame)}`, ir.symbols.labels[index], `  ${n}_Timer = ${frame.duration}`);
    frame.players.forEach(player => { lines.push(...emitPlayerSetup(ir, frame, player), ...emitPlayerBlock(ir, player)); });
    lines.push("  return", `;@YAJA FRAME_END ${index}`, "");
  });
  lines.push(`${n}_ApplyPivot`, `  on ${n}_Frame gosub ${ir.symbols.positionLabels.join(" ")}`, "  return", "");
  ir.frames.forEach((frame, index) => {
    lines.push(ir.symbols.positionLabels[index]);
    frame.players.forEach(player => lines.push(...emitPlayerPosition(ir, player)));
    lines.push("  return", "");
  });
  return lines.join("\n");
}

function demoHeader(ir) {
  const lines = [`; Compilable centered YAJA animation demo`, `  const noscore = 1`, `  set tv ${ir.region.toLowerCase()}`];
  const callBank = ir.kernel === "DPC+" ? " bank2" : "";
  if (ir.kernel === "DPC+") lines.push("  set smartbranching on");
  if (ir.kernel === "MULTISPRITE") lines.push("  set kernel multisprite");
  else if (ir.kernel !== "STANDARD") lines.push(`  set kernel ${ir.kernel}`);
  lines.push("", "__YAJA_Demo_Start", `  ${ir.namespace}_PivotX = ${ir.defaultOrigin.x}`, `  ${ir.namespace}_PivotY = ${ir.defaultOrigin.y}`, `  gosub ${ir.namespace}_Init${callBank}`, "__YAJA_Demo_Loop");
  if (isSolidKernel(ir.kernel)) lines.push(`  COLUBK = ${ir.background}`);
  lines.push("  drawscreen", `  gosub ${ir.namespace}_Update${callBank}`, "  goto __YAJA_Demo_Loop", "");
  return lines.join("\n");
}

function demoBackground(ir) {
  if (isSolidKernel(ir.kernel)) return "";
  const lines = ["__YAJA_Demo_Background", "  bkcolors:"];
  for (let i = 0; i < ir.displayRows; i++) lines.push(`  ${ir.background}`);
  lines.push("end", "  return", "");
  return lines.join("\n");
}

export function emitAnimationDemo(ir) {
  const moduleBank = ir.kernel === "DPC+" ? "\n  bank 2\n" : "\n";
  return `${demoHeader(ir)}${moduleBank}${demoBackground(ir)}\n${emitAnimationModule(ir)}`;
}

export function generateAnimationCode(project, options = {}) {
  const mode = options.mode === "demo" ? "demo" : "data";
  const ir = createAnimationIR(project, { mode });
  const diagnostics = validateAnimationIR(ir);
  const output = diagnostics.some(item => item.severity === "error") ? "" : (mode === "demo" ? emitAnimationDemo(ir) : emitAnimationModule(ir));
  return { ir, diagnostics, output, filename: animationExportFilename(ir.animationName, mode) };
}

// Backward-compatible name retained for older integrations/tests.
export const emitAnimationSnippet = emitAnimationModule;
