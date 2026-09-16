import { normalizePlayerAssignments, playerLimitForKernel } from "./project-model.js";
import { centeredCompositionGeometry, NUSIZ_MODES as NUSIZ, nusizMode } from "./display-geometry.js";

const KERNELS = ["STANDARD", "MULTISPRITE", "DPC+", "PXE"];
const DISPLAY_ROWS = { STANDARD: 96, MULTISPRITE: 88, "DPC+": 178, PXE: 180 };
const CONTENT_TYPES = new Set(["tables", "module", "demo"]);
export const YAJA_BB_FORMAT_VERSION = 1;
export const YAJA_BB_COLLECTION_FORMAT_VERSION = 2;
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
function normalizeContentType(options = {}) {
  if (CONTENT_TYPES.has(options.content)) return options.content;
  if (options.mode === "demo") return "demo";
  if (options.mode === "tables") return "tables";
  return "module";
}
export function animationExportFilename(name, mode = "module") {
  const content = mode === "data" ? "module" : mode;
  const suffix = content === "demo" ? "Demo" : content === "tables" ? "Tables" : "Module";
  return `${normalizeAnimationBase(name)}_${suffix}.bas`;
}

function activeSlotsFor(project) { return project.twoSpriteMode ? [0, 1] : [project.activePlayer === 1 ? 1 : 0]; }
function isSolidKernel(kernel) { return kernel === "STANDARD" || kernel === "MULTISPRITE"; }
function variableBase(namespace) { return String(namespace || "").replace(/^_+/, "") || "UntitledAnimation"; }
function frameNumber(index) { return String(index).padStart(2, "0"); }
function rowsFor(source, width, height) {
  return Array.from({ length: height }, (_, y) => Array.from({ length: 8 }, (_, x) => x < width && source?.pixels?.[y]?.[x] ? 1 : 0));
}
function frameTransition(frames, index) {
  const current = frames[index]?.players?.[0];
  const previous = frames[(index - 1 + frames.length) % frames.length]?.players?.[0];
  return {
    x: (current?.centeredXDelta || 0) - (previous?.centeredXDelta || 0),
    y: (current?.centeredYDelta || 0) - (previous?.centeredYDelta || 0)
  };
}

export function createAnimationIR(project, options = {}) {
  const kernel = KERNELS.includes(project.kernel) ? project.kernel : "PXE";
  const assignments = normalizePlayerAssignments(project.playerAssignments, kernel);
  const activeSlots = activeSlotsFor(project);
  const animationName = String(project.animationName || project.projectName || "Untitled Animation");
  const namespace = options.namespace || animationNamespace(animationName);
  const vars = options.variableBase || variableBase(namespace);
  const positioning = options.positioning === "anchor" ? "anchor" : "sprite";
  const content = normalizeContentType(options);
  const displayRows = DISPLAY_ROWS[kernel];
  const frames = (project.frames || []).map((frame, frameIndex) => {
    const width = Math.max(1, Math.min(8, Number.parseInt(frame.width, 10) || 8));
    const height = Math.max(1, Math.min(255, Number.parseInt(frame.height, 10) || frame.players?.[0]?.pixels?.length || 16));
    const players = activeSlots.map(slot => {
      const source = frame.players?.[slot] || {};
      const playerWidth = Math.max(1, Math.min(8, Number.parseInt(source.width, 10) || width));
      const playerHeight = Math.max(1, Math.min(255, Number.parseInt(source.height, 10) || source.pixels?.length || height));
      const nusiz = NUSIZ[source.nusiz] ? source.nusiz : "normal";
      const mode = nusizMode(nusiz);
      return {
        slot, player: assignments[slot], nusiz, nusizCode: mode.code, scale: mode.scale, width: playerWidth, height: playerHeight,
        xOffset: Math.trunc(Number(source.xOffset) || 0), yOffset: Math.trunc(Number(source.yOffset) || 0),
        solidColor: normalizeAtariCode(source.solidColor || source.colors?.[0]),
        pixels: rowsFor(source, playerWidth, playerHeight),
        colors: Array.from({ length: playerHeight }, (_, y) => normalizeAtariCode(source.colors?.[y] || source.solidColor))
      };
    });
    const composition = centeredCompositionGeometry(width, players);
    players.forEach((player, index) => {
      const widePlayerBias = player.scale > 1 ? -1 : 0;
      player.centeredXDelta = composition.centeredX[index] + widePlayerBias;
      player.centeredYDelta = spriteBottomAnchorYDelta(player.height, player.yOffset);
    });
    return {
      index: frameIndex, width, height,
      duration: Math.max(1, Math.min(60, Number.parseInt(frame.duration, 10) || 3)),
      totalWidth: composition.totalWidth, players
    };
  });
  frames.forEach((frame, index) => { frame.transition = frameTransition(frames, index); });
  const hasFrameCorrections = frames.length > 1 && frames.some(frame => frame.transition.x || frame.transition.y);
  const needsPositioning = positioning === "anchor" || activeSlots.length > 1 || hasFrameCorrections;
  const owned = content === "tables"
    ? []
    : [`${vars}Frame`, `${vars}Timer`, ...(positioning === "anchor" ? [`${vars}AnchorX`, `${vars}AnchorY`] : [])];
  return {
    schemaVersion: 4, formatVersion: YAJA_BB_FORMAT_VERSION, kind: content, content, positioning,
    projectName: String(project.projectName || "Untitled Project"), animationName, namespace, variableBase: vars,
    animationId: namespace.slice(2), kernel, region: project.region === "PAL" ? "PAL" : "NTSC",
    background: normalizeAtariCode(project.background, "$00"), compositionModel: project.compositionModel === "tia-right-copies" ? "tia-right-copies" : "adjacent",
    twoSpriteMode: !!project.twoSpriteMode, assignments, activeSlots, activePlayers: activeSlots.map(slot => assignments[slot]),
    displayRows, defaultOrigin: { x: 80, y: Math.floor(displayRows / 2) }, coordinateSystem: YAJA_COORDINATE_SYSTEM,
    needsPositioning, hasFrameCorrections,
    symbols: {
      owned, required: [],
      labels: frames.map((_, index) => `${namespace}_Frame${frameNumber(index)}`),
      transitionLabels: frames.map((_, index) => `${namespace}_TransitionFrame${frameNumber(index)}`)
    },
    ramBytes: owned.length, maxGeneratedGosubDepth: needsPositioning ? 2 : 1, frames
  };
}

export function validateAnimationIR(ir) {
  const diagnostics = [];
  if (!ir.frames.length) diagnostics.push({ severity: "error", code: "NO_FRAMES", message: "Add at least one frame before exporting." });
  if (new Set(ir.activePlayers).size !== ir.activePlayers.length) diagnostics.push({ severity: "error", code: "DUPLICATE_PLAYER", message: "Each sprite slot must use a different P# assignment." });
  const max = playerLimitForKernel(ir.kernel);
  ir.activePlayers.forEach(player => {
    if (player < 0 || player > max) diagnostics.push({ severity: "error", code: "PLAYER_RANGE", message: `${ir.kernel} supports P0 through P${max}; P${player} cannot be exported.` });
  });
  ir.frames.forEach(frame => frame.players.forEach(player => {
    if (player.pixels.length !== player.height) diagnostics.push({ severity: "error", code: "SPRITE_HEIGHT", message: `Frame ${frame.index + 1}, P${player.player} data does not match its ${player.height}-row height.` });
    if (!isSolidKernel(ir.kernel) && player.colors.length !== player.height) diagnostics.push({ severity: "error", code: "COLOR_HEIGHT", message: `Frame ${frame.index + 1}, P${player.player} color rows do not match sprite height.` });
  }));
  if (ir.twoSpriteMode && ir.activePlayers.every(player => player > 0)) diagnostics.push({ severity: "warning", code: "VIRTUAL_OVERLAP", message: "Two virtual P1+ sprites may flicker when their vertical ranges overlap; export will continue." });
  diagnostics.push({
    severity: "info", code: "VARIABLE_OWNERSHIP",
    message: ir.ramBytes
      ? `Uses ${ir.ramBytes} variable${ir.ramBytes === 1 ? "" : "s"}: ${ir.symbols.owned.join(", ")}. Maximum generated call depth is ${ir.maxGeneratedGosubDepth}.`
      : "Tables Only uses no variables."
  });
  return diagnostics;
}

export function yajaMetadataCommentLines(marker, payload, maxLineLength = 112) {
  const firstPrefix = `;@YAJA ${marker} `;
  const continuationPrefix = ";@YAJA+ ";
  const text = String(payload ?? "");
  const lines = [];
  let offset = 0;
  let prefix = firstPrefix;
  do {
    const available = Math.max(1, maxLineLength - prefix.length);
    lines.push(prefix + text.slice(offset, offset + available));
    offset += available;
    prefix = continuationPrefix;
  } while (offset < text.length);
  return lines;
}

function metadata(ir) {
  return JSON.stringify({
    formatVersion: ir.formatVersion, app: "YAJA 2600 Animator", projectName: ir.projectName,
    animationName: ir.animationName, symbol: ir.namespace, kernel: ir.kernel, region: ir.region,
    background: ir.background, assignments: ir.assignments, activeSlots: ir.activeSlots,
    twoSpriteMode: ir.twoSpriteMode, compositionModel: ir.compositionModel,
    pivotModel: ir.positioning === "anchor" ? "dedicated-anchor" : "primary-sprite",
    coordinateSystem: ir.coordinateSystem
  });
}
function frameMetadata(frame) {
  return JSON.stringify({
    index: frame.index, width: frame.width, height: frame.height, duration: frame.duration,
    players: frame.players.map(player => ({
      slot: player.slot, player: player.player, nusiz: player.nusiz,
      width: player.width, height: player.height, xOffset: player.xOffset, yOffset: player.yOffset, solidColor: player.solidColor
    }))
  });
}
function addExpr(symbol, delta) { return delta === 0 ? symbol : `${symbol} ${delta > 0 ? "+" : "-"} ${Math.abs(delta)}`; }
function relativeDelta(secondary, primary, axis) {
  const key = axis === "x" ? "centeredXDelta" : "centeredYDelta";
  return (secondary?.[key] || 0) - (primary?.[key] || 0);
}
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
  player.pixels.forEach(row => lines.push(`  %${row.map(Boolean).map(value => value ? "1" : "0").join("")}`));
  lines.push("end");
  if (!isSolidKernel(ir.kernel)) {
    lines.push(`  player${player.player}color:`);
    player.colors.forEach(color => lines.push(`  ${color}`));
    lines.push("end");
  }
  return lines;
}
function emitTableColor(ir, frame, player) {
  if (!isSolidKernel(ir.kernel)) return [];
  return [`  const ${ir.variableBase}Frame${frameNumber(frame.index)}P${player.player}Color = ${player.solidColor}`];
}
function emitPlayerSetup(ir, frame, player) {
  const lines = [`  ${nusizSymbol(ir.kernel, player.player)} = ${player.nusizCode}`];
  if (isSolidKernel(ir.kernel)) lines.push(`  ${colorSymbol(ir.kernel, player.player)} = ${player.solidColor}`);
  lines.push(`  player${player.player}height = ${player.height}`);
  return lines;
}

function emitPositionRoutine(ir) {
  if (!ir.needsPositioning) return [];
  const lines = [`${ir.namespace}_ApplyPosition`, `  on ${ir.variableBase}Frame goto ${ir.frames.map((_, index) => `${ir.namespace}_PositionFrame${frameNumber(index)}`).join(" ")}`, ""];
  ir.frames.forEach((frame, index) => {
    const primary = frame.players[0];
    lines.push(`${ir.namespace}_PositionFrame${frameNumber(index)}`);
    if (ir.positioning === "anchor") {
      frame.players.forEach(player => {
        lines.push(`  player${player.player}x = ${addExpr(`${ir.variableBase}AnchorX`, player.centeredXDelta)}`);
        lines.push(`  player${player.player}y = ${addExpr(`${ir.variableBase}AnchorY`, player.centeredYDelta)}`);
      });
    } else if (frame.players[1]) {
      const secondary = frame.players[1];
      lines.push(`  player${secondary.player}x = ${addExpr(`player${primary.player}x`, relativeDelta(secondary, primary, "x"))}`);
      lines.push(`  player${secondary.player}y = ${addExpr(`player${primary.player}y`, relativeDelta(secondary, primary, "y"))}`);
    }
    lines.push("  return", "");
  });
  return lines;
}
function emitTransitionRoutines(ir) {
  if (ir.positioning !== "sprite" || !ir.hasFrameCorrections) return [];
  const lines = [];
  ir.frames.forEach((frame, index) => {
    const player = frame.players[0].player;
    lines.push(ir.symbols.transitionLabels[index]);
    if (frame.transition.x) lines.push(`  player${player}x = ${addExpr(`player${player}x`, frame.transition.x)}`);
    if (frame.transition.y) lines.push(`  player${player}y = ${addExpr(`player${player}y`, frame.transition.y)}`);
    lines.push("  return", "");
  });
  return lines;
}

export function emitAnimationTables(ir, options = {}) {
  const includeProjectData = !!options.includeProjectData;
  const includeComments = options.includeComments !== false;
  const lines = [];
  if (includeComments) lines.push("; Animation art and color tables exported by YAJA 2600 Animator.");
  if (includeProjectData) lines.push(...yajaMetadataCommentLines("PROJECT", metadata(ir)));
  if (includeComments && !includeProjectData) lines.push("; Copy the frame blocks you need into your batari Basic project.");
  if (lines.length) lines.push("");
  ir.frames.forEach((frame, index) => {
    if (includeProjectData) lines.push(...yajaMetadataCommentLines(`FRAME_BEGIN ${index}`, frameMetadata(frame)));
    if (includeComments) lines.push(`; Frame ${index + 1}`);
    lines.push(ir.symbols.labels[index]);
    frame.players.forEach(player => lines.push(...emitTableColor(ir, frame, player), ...emitPlayerBlock(ir, player)));
    if (includeProjectData) lines.push(`;@YAJA FRAME_END ${index}`);
    lines.push("");
  });
  return lines.join("\n").trimEnd();
}

export function emitAnimationModule(ir, options = {}) {
  const n = ir.namespace;
  const v = ir.variableBase;
  const includeProjectData = !!options.includeProjectData;
  const includeComments = options.includeComments !== false;
  const lines = [];
  if (includeComments) {
    lines.push("; Reusable animation code exported by YAJA 2600 Animator.");
    lines.push("; Call Init once, then call Update once per game loop.");
    lines.push(ir.positioning === "anchor"
      ? `; Set ${v}AnchorX and ${v}AnchorY before Init, then change them to move the animation.`
      : `; Position P${ir.activePlayers[0]} before Init, then move it normally; frame changes stay centered.`);
  }
  if (includeProjectData) lines.push(...yajaMetadataCommentLines("PROJECT", metadata(ir)));
  lines.push(`  dim ${v}Frame = a`, `  dim ${v}Timer = b`);
  if (ir.positioning === "anchor") lines.push(`  dim ${v}AnchorX = c`, `  dim ${v}AnchorY = d`);
  lines.push("", `${n}_Init`);
  if (ir.content === "demo" && !isSolidKernel(ir.kernel)) lines.push("  gosub __YAJA_Demo_Background");
  lines.push(`  ${v}Frame = 0`, `  ${v}Timer = 1`, `  goto ${n}_LoadFrame`, "", `${n}_Update`);
  if (ir.needsPositioning) lines.push(`  gosub ${n}_ApplyPosition`);
  lines.push(`  if ${v}Timer > 1 then ${v}Timer = ${v}Timer - 1 : return`, `  ${v}Frame = ${v}Frame + 1`, `  if ${v}Frame >= ${ir.frames.length} then ${v}Frame = 0`);
  if (ir.positioning === "sprite" && ir.hasFrameCorrections) lines.push(`  on ${v}Frame gosub ${ir.symbols.transitionLabels.join(" ")}`);
  lines.push(`${n}_LoadFrame`, `  on ${v}Frame gosub ${ir.symbols.labels.join(" ")}`);
  if (ir.needsPositioning) lines.push(`  gosub ${n}_ApplyPosition`);
  lines.push("  return", "");
  ir.frames.forEach((frame, index) => {
    if (includeProjectData) lines.push(...yajaMetadataCommentLines(`FRAME_BEGIN ${index}`, frameMetadata(frame)));
    if (includeComments) lines.push(`; Frame ${index + 1}`);
    lines.push(ir.symbols.labels[index], `  ${v}Timer = ${frame.duration}`);
    frame.players.forEach(player => lines.push(...emitPlayerSetup(ir, frame, player), ...emitPlayerBlock(ir, player)));
    lines.push("  return");
    if (includeProjectData) lines.push(`;@YAJA FRAME_END ${index}`);
    lines.push("");
  });
  lines.push(...emitTransitionRoutines(ir), ...emitPositionRoutine(ir));
  return lines.join("\n").trimEnd();
}

function demoDirectives(ir) {
  if (ir.kernel === "PXE") return ["  set kernel PXE"];
  if (ir.kernel === "DPC+") return ["  set kernel DPC+", `  set tv ${ir.region.toLowerCase()}`, "  set smartbranching on"];
  if (ir.kernel === "MULTISPRITE") return ["  set kernel multisprite", `  set tv ${ir.region.toLowerCase()}`];
  return ["  const noscore = 1", `  set tv ${ir.region.toLowerCase()}`];
}
function demoHeader(ir, options = {}) {
  const lines = [];
  if (options.includeComments !== false) lines.push("; Complete animation preview exported by YAJA 2600 Animator.");
  lines.push(...demoDirectives(ir), "", "__YAJA_Demo_Start");
  const primary = ir.frames[0]?.players[0];
  if (ir.positioning === "anchor") {
    lines.push(`  ${ir.variableBase}AnchorX = ${ir.defaultOrigin.x}`, `  ${ir.variableBase}AnchorY = ${ir.defaultOrigin.y}`);
  } else if (primary) {
    lines.push(`  player${primary.player}x = ${ir.defaultOrigin.x + primary.centeredXDelta}`);
    lines.push(`  player${primary.player}y = ${ir.defaultOrigin.y + primary.centeredYDelta}`);
  }
  const callBank = ir.kernel === "DPC+" ? " bank2" : "";
  lines.push(`  gosub ${ir.namespace}_Init${callBank}`, "__YAJA_Demo_Loop");
  if (isSolidKernel(ir.kernel)) lines.push(`  COLUBK = ${ir.background}`);
  lines.push("  drawscreen", `  gosub ${ir.namespace}_Update${callBank}`, "  goto __YAJA_Demo_Loop", "");
  return lines.join("\n");
}
function demoBackground(ir) {
  if (isSolidKernel(ir.kernel)) return "";
  const lines = ["__YAJA_Demo_Background", "  bkcolors:"];
  for (let index = 0; index < ir.displayRows; index++) lines.push(`  ${ir.background}`);
  lines.push("end", "  return", "");
  return lines.join("\n");
}
export function emitAnimationDemo(ir, options = {}) {
  const moduleBank = ir.kernel === "DPC+" ? "\n  bank 2\n" : "\n";
  const backgroundData = demoBackground(ir);
  return `${demoHeader(ir, options)}${moduleBank}${emitAnimationModule(ir, options)}${backgroundData ? `\n\n${backgroundData}` : ""}`;
}

export function animationProjectView(project, animation) {
  return {
    ...project, animationName: animation.name, frames: animation.frames,
    currentFrame: animation.currentFrame, twoSpriteMode: animation.twoSpriteMode,
    activePlayer: animation.activePlayer, playerAssignments: animation.playerAssignments
  };
}
function collectionFilename(projectName, content) {
  const suffix = content === "demo" ? "Demo" : content === "tables" ? "Tables" : "Module";
  return `${normalizeAnimationBase(projectName)}_AllAnimations_${suffix}.bas`;
}
function collectionMetadata(project, irs, content, namespace) {
  return JSON.stringify({
    formatVersion: YAJA_BB_COLLECTION_FORMAT_VERSION, app: "YAJA 2600 Animator", kind: content,
    projectName: String(project.projectName || "Untitled Project"), symbol: namespace,
    kernel: irs[0].kernel, region: irs[0].region, background: irs[0].background,
    compositionModel: project.compositionModel === "tia-right-copies" ? "tia-right-copies" : "adjacent", activeAnimationId: project.activeAnimationId,
    animations: irs.map((ir, index) => ({ id: project.animations[index].id, name: ir.animationName, symbol: ir.namespace }))
  });
}
function collectionAnimationMetadata(animation, ir) {
  return JSON.stringify({ id: animation.id, name: ir.animationName, symbol: ir.namespace, assignments: ir.assignments, activeSlots: ir.activeSlots, twoSpriteMode: ir.twoSpriteMode });
}
function emitCollectionTables(project, irs, collectionNamespace, options = {}) {
  const includeProjectData = !!options.includeProjectData;
  const includeComments = options.includeComments !== false;
  const lines = [];
  if (includeComments) lines.push("; Animation art and color tables exported by YAJA 2600 Animator.");
  if (includeProjectData) lines.push(...yajaMetadataCommentLines("COLLECTION", collectionMetadata(project, irs, "tables", collectionNamespace)));
  if (lines.length) lines.push("");
  irs.forEach((ir, index) => {
    if (includeProjectData) lines.push(...yajaMetadataCommentLines(`ANIMATION_BEGIN ${index}`, collectionAnimationMetadata(project.animations[index], ir)));
    lines.push(emitAnimationTables(ir, { ...options, includeProjectData }));
    if (includeProjectData) lines.push(`;@YAJA ANIMATION_END ${index}`);
    lines.push("");
  });
  return lines.join("\n").trimEnd();
}
function emitCollectionSelector(project, irs, collectionNamespace, content) {
  const uniquePlayers = [...new Set(irs.flatMap(ir => ir.activePlayers))].sort((a, b) => a - b);
  const initLabels = irs.map(ir => `${ir.namespace}_Init`);
  const updateLabels = irs.map(ir => `${ir.namespace}_Update`);
  const prepareLabels = irs.map((_, index) => `${collectionNamespace}_Prepare${frameNumber(index)}`);
  const active = `${variableBase(collectionNamespace)}Active`;
  const lines = [
    `  dim ${active} = e`, "", `${collectionNamespace}_Init`, `  ${active} = 0`, `  goto ${collectionNamespace}_Select`, "",
    `${collectionNamespace}_Select`, `  if ${active} < ${irs.length} then goto ${collectionNamespace}_SelectValid`, `  ${active} = 0`,
    `${collectionNamespace}_SelectValid`, `  on ${active} gosub ${prepareLabels.join(" ")}`, `  on ${active} goto ${initLabels.join(" ")}`, "",
    `${collectionNamespace}_Update`, `  on ${active} goto ${updateLabels.join(" ")}`, "",
    `${collectionNamespace}_Next`, `  ${active} = ${active} + 1`, `  if ${active} < ${irs.length} then goto ${collectionNamespace}_Select`, `  ${active} = 0`, `  goto ${collectionNamespace}_Select`, "",
    `${collectionNamespace}_Previous`, `  if ${active} > 0 then goto ${collectionNamespace}_PreviousDecrement`, `  ${active} = ${irs.length}`,
    `${collectionNamespace}_PreviousDecrement`, `  ${active} = ${active} - 1`, `  goto ${collectionNamespace}_Select`, ""
  ];
  irs.forEach((ir, index) => {
    lines.push(prepareLabels[index]);
    uniquePlayers.filter(player => !ir.activePlayers.includes(player)).forEach(player => lines.push(`  player${player}y = 255`));
    if (content === "demo") {
      const primary = ir.frames[0]?.players[0];
      if (ir.positioning === "anchor") lines.push(`  ${ir.variableBase}AnchorX = ${ir.defaultOrigin.x}`, `  ${ir.variableBase}AnchorY = ${ir.defaultOrigin.y}`);
      else if (primary) lines.push(`  player${primary.player}x = ${ir.defaultOrigin.x + primary.centeredXDelta}`, `  player${primary.player}y = ${ir.defaultOrigin.y + primary.centeredYDelta}`);
    }
    lines.push("  return", "");
  });
  return lines.join("\n");
}
function emitCollectionModules(project, irs, collectionNamespace, content, options = {}) {
  const includeProjectData = !!options.includeProjectData;
  const lines = [];
  if (options.includeComments !== false) lines.push("; Reusable animation collection exported by YAJA 2600 Animator.");
  if (includeProjectData) lines.push(...yajaMetadataCommentLines("COLLECTION", collectionMetadata(project, irs, content, collectionNamespace)));
  lines.push(emitCollectionSelector(project, irs, collectionNamespace, content));
  irs.forEach((ir, index) => {
    if (includeProjectData) lines.push(...yajaMetadataCommentLines(`ANIMATION_BEGIN ${index}`, collectionAnimationMetadata(project.animations[index], ir)));
    lines.push(emitAnimationModule(ir, options));
    if (includeProjectData) lines.push(`;@YAJA ANIMATION_END ${index}`);
    lines.push("");
  });
  return lines.join("\n").trimEnd();
}
function emitCollectionDemo(project, irs, collectionNamespace, options = {}) {
  const first = irs[0];
  const latch = `${variableBase(collectionNamespace)}JoystickLatch`;
  const callBank = first.kernel === "DPC+" ? " bank2" : "";
  const lines = [];
  if (options.includeComments !== false) lines.push("; Complete multi-animation preview exported by YAJA 2600 Animator.");
  lines.push(...demoDirectives(first), "", `  dim ${latch} = f`, "", "__YAJA_Demo_Start");
  const primary = first.frames[0]?.players[0];
  if (first.positioning === "anchor") lines.push(`  ${first.variableBase}AnchorX = ${first.defaultOrigin.x}`, `  ${first.variableBase}AnchorY = ${first.defaultOrigin.y}`);
  else if (primary) lines.push(`  player${primary.player}x = ${first.defaultOrigin.x + primary.centeredXDelta}`, `  player${primary.player}y = ${first.defaultOrigin.y + primary.centeredYDelta}`);
  lines.push(`  ${latch} = 0`, `  gosub ${collectionNamespace}_Init${callBank}`, "__YAJA_Demo_Loop");
  if (isSolidKernel(first.kernel)) lines.push(`  COLUBK = ${first.background}`);
  lines.push(
    "  drawscreen", "  if joy0up then goto __YAJA_Demo_Previous", "  if joy0down then goto __YAJA_Demo_Next",
    `  ${latch} = 0`, "  goto __YAJA_Demo_Update", "__YAJA_Demo_Previous",
    `  if ${latch} then goto __YAJA_Demo_Update`, `  ${latch} = 1`, `  gosub ${collectionNamespace}_Previous${callBank}`, "  goto __YAJA_Demo_Update",
    "__YAJA_Demo_Next", `  if ${latch} then goto __YAJA_Demo_Update`, `  ${latch} = 1`, `  gosub ${collectionNamespace}_Next${callBank}`,
    "__YAJA_Demo_Update", `  gosub ${collectionNamespace}_Update${callBank}`, "  goto __YAJA_Demo_Loop", ""
  );
  const moduleBank = first.kernel === "DPC+" ? "\n  bank 2\n" : "\n";
  const backgroundData = demoBackground(first);
  return `${lines.join("\n")}${moduleBank}${emitCollectionModules(project, irs, collectionNamespace, "demo", options)}${backgroundData ? `\n\n${backgroundData}` : ""}`;
}
export function generateAnimationCollectionCode(project, options = {}) {
  const content = normalizeContentType(options);
  const positioning = options.positioning === "anchor" ? "anchor" : "sprite";
  const collectionNamespace = animationNamespace(project.projectName || "Untitled Project");
  const used = new Set();
  const irs = project.animations.map(animation => {
    const base = `${collectionNamespace}_${normalizeAnimationBase(animation.name)}`;
    let namespace = base;
    let suffix = 2;
    while (used.has(namespace.toLowerCase())) namespace = `${base}${suffix++}`;
    used.add(namespace.toLowerCase());
    return createAnimationIR(animationProjectView(project, animation), { content, positioning, namespace });
  });
  const diagnostics = irs.flatMap((ir, index) => validateAnimationIR(ir).filter(item => item.code !== "VARIABLE_OWNERSHIP").map(item => ({ ...item, animationIndex: index, message: `${ir.animationName}: ${item.message}` })));
  const primaryAssignments = new Set(irs.map(ir => ir.activePlayers[0]));
  if (content !== "tables" && positioning === "sprite" && primaryAssignments.size > 1) {
    diagnostics.push({ severity: "warning", code: "COLLECTION_PRIMARY_ASSIGNMENTS", message: "Animations use different first-sprite assignments. Position the newly selected sprite before switching, or choose a separate animation position." });
  }
  const moduleBytes = content === "tables" ? 0 : (positioning === "anchor" ? 5 : 3);
  const ramBytes = moduleBytes + (content === "demo" ? 1 : 0);
  diagnostics.push({ severity: "info", code: "VARIABLE_OWNERSHIP", message: content === "tables" ? "Tables Only uses no variables." : `All Animations shares ${ramBytes} variable${ramBytes === 1 ? "" : "s"} across the selected animations${content === "demo" ? ", including the joystick control" : ""}.` });
  const hasErrors = diagnostics.some(item => item.severity === "error");
  let output = "";
  if (!hasErrors) {
    if (content === "tables") output = emitCollectionTables(project, irs, collectionNamespace, options);
    else if (content === "demo") output = emitCollectionDemo(project, irs, collectionNamespace, options);
    else output = emitCollectionModules(project, irs, collectionNamespace, content, options);
  }
  return { ir: { kind: "collection", namespace: collectionNamespace, animations: irs }, diagnostics, output, ramBytes, filename: collectionFilename(project.projectName, content) };
}

export function generateAnimationCode(project, options = {}) {
  if (options.scope === "all" && Array.isArray(project.animations) && project.animations.length) return generateAnimationCollectionCode(project, options);
  const content = normalizeContentType(options);
  const positioning = options.positioning === "anchor" ? "anchor" : "sprite";
  const ir = createAnimationIR(project, { content, positioning });
  const diagnostics = validateAnimationIR(ir);
  let output = "";
  if (!diagnostics.some(item => item.severity === "error")) {
    if (content === "tables") output = emitAnimationTables(ir, options);
    else if (content === "demo") output = emitAnimationDemo(ir, options);
    else output = emitAnimationModule(ir, options);
  }
  return { ir, diagnostics, output, ramBytes: ir.ramBytes, filename: animationExportFilename(ir.animationName, content) };
}

export const emitAnimationSnippet = emitAnimationModule;
