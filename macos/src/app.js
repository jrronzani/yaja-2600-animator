import { animationExportFilename, generateAnimationCode } from "./core/codegen.js";
import { assemblyExportFilename, generateAssemblyData } from "./core/assembly-codegen.js";
import { parseAssemblyData } from "./core/assembly-parser.js";
import { CURRENT_SCHEMA_VERSION, migrateProject, normalizePlayerAssignments, playerLimitForKernel } from "./core/project-model.js";
import { createRotationSession } from "./core/sprite-transform.js";
import { applyOffsetsToAllFrames, brushCells, circlePivotFromPointer, combineRasterSelections, compositeSelectionGrid, cropPixelsToSelection, duplicateSelectedFrames, extractSelectionPixels, flipSelectionInFrame, floodFillPixels, floodFillScanlines, fullSelectionMask, growRasterArtwork, maskBoundarySegments, morphSelectionInFrame, moveSelectedScanlineColors, moveSelection, placeSelectionPixels, rasterCellFromLocal, rasterLineCells, reorderSelectedFrameBlock, resampleValues, reverseSelectedFrames, scaleRasterArtwork, scaleSelectionInFrame, selectionContains, selectionFromMask, selectionFromRectangle, selectionToMask, tightenSelectionToLivePixels, visualCircleCells } from "./core/editor-ops.js";
import { parseBatariBasicSpriteData } from "./core/bb-parser.js";
import { applyTheme, getPreferredTheme, normalizeThemeId } from "./themes.js";
import { buildStoredZip } from "./core/zip.js";
import { canvasCellSize, centeredCompositionGeometry, centeredCompositionMargins, NUSIZ_MODES as NUSIZ, nusizMode, nusizSourceColumn, rasterCellBoundary, rasterCellBoundaryFromOrigin, rasterCellRect, smoothRasterCellGeometry, renderedSpriteSpan, timelineThumbnailGeometry } from "./core/display-geometry.js";
import { averageReferenceGridRow, estimateUniformBorderColor, fittedReferenceRect, nearestPaletteColor, referenceCellGrid, referenceCellIsForeground } from "./core/reference-image.js";
import { animationRecordFromWorkspace, duplicateAnimationRecord, ensureAnimationCollection, loadAnimationWorkspace, nextAnimationId, syncActiveAnimation, uniqueAnimationName } from "./core/animation-collection.js";
import { ATARI_NTSC, ATARI_PAL, convertColorCode, displayCodesForRegion, migrateLegacyPalCode, paletteForRegion } from "./core/atari-palettes.js";
import { gridLineColor, loadEditorPreferences, normalizeGridColor, saveEditorPreferences } from "./core/editor-preferences.js";

const CODES = Object.keys(ATARI_NTSC);
const FONT_3X5 = {
  A: ["010", "101", "111", "101", "101"], B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"], D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"], F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"], H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"], J: ["001", "001", "001", "101", "010"],
  K: ["101", "101", "110", "101", "101"], L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"], N: ["101", "111", "111", "111", "101"],
  O: ["010", "101", "101", "101", "010"], P: ["110", "101", "110", "100", "100"],
  Q: ["010", "101", "101", "111", "011"], R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"], T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"], V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "111", "111", "101"], X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"], Z: ["111", "001", "010", "100", "111"],
  "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
  "2": ["110", "001", "010", "100", "111"], "3": ["110", "001", "010", "001", "110"],
  "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "110", "001", "110"],
  "6": ["011", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "110"],
  " ": ["000", "000", "000", "000", "000"], ".": ["000", "000", "000", "000", "010"],
  "-": ["000", "000", "111", "000", "000"], "!": ["010", "010", "010", "000", "010"]
};

const el = {};
let state;
const editorPreferences = loadEditorPreferences();
let spriteVisibility = [true, true];
let desktopCurrentProjectPath = null;
let saveInProgress = false;
let lastDesktopMenuState = "";
const PROJECT_PICKER_ID = "yaja-animator-project-files";
const SHARED_PICKER_HANDLE_KEY = "__yajaAnimatorLastProjectPickerHandle";
let currentProjectFileHandle = null;
let lastProjectPickerHandle = null;
let currentExportFormat = "bb";
let currentBbExportMode = "tables";
let currentBbExportScope = "current";
let currentBbExportWithProjectData = false;
let currentBbExportWithComments = true;
let currentBbPositioning = "sprite";
let currentBbExportFilename = "UntitledAnimation_Tables.bas";
let history = [];
let redoStack = [];
let isPointerDown = false;
let dragStart = null;
let dragSnapshot = null;
let toggledDuringStroke = new Set();
let selection = null;
let movingSelection = false;
let selectionMoveOrigin = null;
let selectionMoveData = null;
let clipboard = null;
let colorSelection = null;
let isSelectingColors = false;
let colorSelectionAnchor = null;
let colorSelectionBefore = null;
let colorSelectionMode = "replace";
let isPaintingColorBlock = false;
let isPaintingRowColors = false;
let rowColorStroke = null;
let activeStampIndex = null;
let activeColorBlockIndex = null;
let colorBlockHoverRow = null;
let editingColorBlockIndex = null;
let editingStampIndex = null;
let stampEditorData = null;
let stampEditorHistory = [];
let stampEditorRedoStack = [];
let stampEditorSelection = null;
let stampEditorPointer = null;
let stampEditorCellWidth = 20;
let stampEditorCellHeight = 20;
let stampEditorHoverCell = null;
let colorBlockEditorData = [];
let colorBlockEditorHueOffset = 0;
let colorBlockEditorLightnessOffset = 0;
let colorBlockEditorHistory = [];
let colorBlockEditorRedoStack = [];
let colorBlockEditorSelection = null;
let colorBlockEditorPointer = null;
let paletteEyedropperArmed = false;
const referenceImages = new Map();
let rotationSession = null;

function rememberSharedPickerHandle(fileHandle) {
  if (!fileHandle) return;
  window[SHARED_PICKER_HANDLE_KEY] = fileHandle;
}

function getSharedPickerHandle() {
  return window[SHARED_PICKER_HANDLE_KEY] || null;
}

function rememberProjectPickerHandle(fileHandle) {
  if (!fileHandle) return;
  lastProjectPickerHandle = fileHandle;
  rememberSharedPickerHandle(fileHandle);
}

function bindCurrentProjectFileHandle(fileHandle = null) {
  currentProjectFileHandle = fileHandle || null;
  if (fileHandle) rememberProjectPickerHandle(fileHandle);
}

function getProjectPickerStartHandle() {
  return currentProjectFileHandle || lastProjectPickerHandle || getSharedPickerHandle() || null;
}

function addProjectPickerStart(options) {
  const startHandle = getProjectPickerStartHandle();
  if (startHandle) options.startIn = startHandle;
  return options;
}
let pendingSequenceFiles = [];
let referenceTransformActive = false;
let referenceDrag = null;
let playTimer = null;
let playbackRunning = false;
let playbackThumbnailDrag = null;
let playbackThumbnailResize = null;
let playbackThumbnailZoom = 6;
let playbackThumbnailCollapsed = false;
let playbackThumbnailExpandedHeight = 169;
let playbackThumbnailUserSized = false;
let playbackThumbnailTallestHeightAtManualSize = 0;
let playbackThumbnailWidestWidthAtManualSize = 0;
let selectedFrames = new Set([0]);
let frameSelectionAnchor = 0;
let framePointerSession = null;
let suppressFrameClick = false;
let lastCell = { col: 0, row: 0, player: 0 };
let pointerInsideCanvas = false;
let rightEraseStroke = false;
let selectionBeforeDrag = null;
let selectionDragMode = "replace";

function normalizeCode(value, fallback = "$0E") {
  let text = String(value || "").trim().toUpperCase();
  if (!text.startsWith("$")) text = `$${text}`;
  if (text.length === 2) text = `$0${text.slice(1)}`;
  return ATARI_NTSC[text] ? text : fallback;
}

function makePlayer(height, color = "$48", width = 8) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    pixels: Array.from({ length: height }, () => Array(8).fill(0)),
    colors: Array.from({ length: height }, () => color),
    solidColor: color,
    nusiz: "normal",
    xOffset: 0,
    yOffset: 0,
    reference: null
    ,width: Math.max(1, Math.min(8, Number(width) || 8))
    ,height: Math.max(1, Math.min(255, Number(height) || 16))
  };
}

function makeFrame(height, index = 0, width = 8, duration = 3) {
  return {
    name: `Frame ${index}`,
    duration: Math.max(1, Math.min(60, Number.parseInt(duration, 10) || 3)),
    height,
    width,
    players: [makePlayer(height, "$48", width), makePlayer(height, "$48", width)]
  };
}

function defaultState() {
  const height = 16, width = 8;
  const project = {
    app: "YAJA 2600 Animator",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: "1.5.0",
    theme: getPreferredTheme(),
    projectName: "Untitled Project",
    animationName: "Untitled Animation",
    kernel: "PXE",
    height,
    width,
    background: "$00",
    currentColor: "$48",
    twoSpriteMode: false,
    activePlayer: 0,
    playerAssignments: [0, 1],
    compositionModel: "tia-right-copies",
    verticalStretch: 1,
    showGrid: true,
    showColorColumns: true,
    onion: false,
    onionOpacity: 35,
    onionFrames: 1,
    loopPlayback: true,
    mirrorDraw: false,
    fillShapes: false,
    brushWidth: 1,
    brushHeight: 1,
    region: "NTSC",
    zoom: 13,
    tool: "pencil",
    frames: [makeFrame(height, 0, width)],
    currentFrame: 0,
    colorBlocks: [],
    stamps: []
  };
  project.activeAnimationId = "animation-1";
  project.animations = [animationRecordFromWorkspace(project, project.activeAnimationId)];
  return project;
}

function currentFrame() {
  return state.frames[state.currentFrame];
}

function currentPlayer() {
  return currentFrame().players[state.activePlayer];
}

function playerWidth(frame, slot) {
  return Math.max(1, Math.min(8, Number.parseInt(frame?.players?.[slot]?.width, 10) || Number.parseInt(frame?.width, 10) || 8));
}

function playerHeight(frame, slot) {
  return Math.max(1, Math.min(255, Number.parseInt(frame?.players?.[slot]?.height, 10) || frame?.players?.[slot]?.pixels?.length || Number.parseInt(frame?.height, 10) || 16));
}

function forEachSelectedFrame(callback) {
  selectedFrameIndices().forEach(index => callback(state.frames[index], index));
}

function selectedFrameLabel() {
  const count = selectedFrameIndices().length;
  return count === 1 ? "frame" : `${count} frames`;
}

function usesSolidColor() { return state.kernel === "STANDARD" || state.kernel === "MULTISPRITE"; }

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function resizeRegionColorStream(colors, height, fallback) {
  const source = Array.isArray(colors) && colors.length ? colors : [fallback];
  if (source.length === height) return source.map(code => normalizeCode(code, fallback));
  return Array.from({ length: height }, (_, row) => {
    const index = height <= 1 ? 0 : Math.round(row * (source.length - 1) / (height - 1));
    return normalizeCode(source[index], fallback);
  });
}

function allProjectPlayers(project, callback) {
  ensureAnimationCollection(project);
  project.animations.forEach(animation => animation.frames.forEach(frame => frame.players.forEach(player => callback(player, frame))));
}

function captureRegionColors(project, region) {
  syncActiveAnimation(project);
  allProjectPlayers(project, (player, frame) => {
    player.regionalColors ||= {};
    player.regionalColors[region] = {
      solidColor: normalizeCode(player.solidColor, "$48"),
      colors: resizeRegionColorStream(player.colors, player.height || player.pixels?.length || frame.height, player.solidColor || "$48")
    };
  });
  project.colorBlocks.forEach(block => {
    block.regionalColors ||= {};
    block.regionalColors[region] = block.colors.map(code => normalizeCode(code, "$48"));
  });
  project.regionalProjectColors ||= {};
  project.regionalProjectColors[region] = {
    background: normalizeCode(project.background, "$00"),
    currentColor: normalizeCode(project.currentColor, "$48")
  };
  loadAnimationWorkspace(project, project.activeAnimationId);
}

function restoreRegionColors(project, fromRegion, toRegion) {
  allProjectPlayers(project, (player, frame) => {
    player.regionalColors ||= {};
    const source = player.regionalColors[fromRegion] || { solidColor: player.solidColor, colors: player.colors };
    const target = player.regionalColors[toRegion] || {
      solidColor: convertColorCode(source.solidColor, fromRegion, toRegion),
      colors: source.colors.map(code => convertColorCode(code, fromRegion, toRegion))
    };
    player.regionalColors[toRegion] = cloneData(target);
    player.solidColor = normalizeCode(target.solidColor, "$48");
    player.colors = resizeRegionColorStream(target.colors, player.height || player.pixels?.length || frame.height, player.solidColor);
  });
  project.colorBlocks.forEach(block => {
    block.regionalColors ||= {};
    const source = block.regionalColors[fromRegion] || block.colors;
    const target = block.regionalColors[toRegion] || source.map(code => convertColorCode(code, fromRegion, toRegion));
    block.regionalColors[toRegion] = target.slice();
    block.colors = target.slice();
  });
  project.regionalProjectColors ||= {};
  const source = project.regionalProjectColors[fromRegion] || { background: project.background, currentColor: project.currentColor };
  const target = project.regionalProjectColors[toRegion] || {
    background: convertColorCode(source.background, fromRegion, toRegion),
    currentColor: convertColorCode(source.currentColor, fromRegion, toRegion)
  };
  project.regionalProjectColors[toRegion] = { ...target };
  project.background = normalizeCode(target.background, "$00");
  project.currentColor = normalizeCode(target.currentColor, "$48");
}

function initializeRegionalColors(project) {
  if (project.paletteDataVersion >= 1) return;
  const region = project.region === "PAL" ? "PAL" : "NTSC";
  if (region === "PAL") {
    allProjectPlayers(project, player => {
      player.solidColor = migrateLegacyPalCode(player.solidColor);
      player.colors = player.colors.map(migrateLegacyPalCode);
    });
    project.colorBlocks.forEach(block => block.colors = block.colors.map(migrateLegacyPalCode));
    project.background = migrateLegacyPalCode(project.background);
    project.currentColor = migrateLegacyPalCode(project.currentColor);
  }
  captureRegionColors(project, region);
  project.paletteDataVersion = 1;
}

function switchProjectRegion(nextRegion) {
  const target = nextRegion === "PAL" ? "PAL" : "NTSC";
  if (target === state.region) return;
  pushHistory();
  const previous = state.region;
  captureRegionColors(state, previous);
  restoreRegionColors(state, previous, target);
  state.region = target;
  loadAnimationWorkspace(state, state.activeAnimationId);
  normalizeProject();
  syncControls();
  renderAll();
}

function snapshot() {
  syncActiveAnimation(state);
  const snap = cloneData(state);
  if (selection) snap.__selection = cloneData(selection);
  return snap;
}

function pushHistory(preserveRotation = false) {
  if (!preserveRotation) rotationSession = null;
  history.push(snapshot());
  if (history.length > 100) history.shift();
  redoStack.length = 0;
}

function restore(snap) {
  rotationSession = null;
  state = cloneData(snap);
  selection = state.__selection ? cloneData(state.__selection) : null;
  delete state.__selection;
  normalizeProject();
  syncControls();
  renderAll();
}

function normalizeProject() {
  state.schemaVersion = CURRENT_SCHEMA_VERSION;
  state.version = "1.5.0";
  ensureAnimationCollection(state);
  state.theme = applyTheme(normalizeThemeId(state.theme));
  state.animationName = String(state.animationName || state.projectName || "Untitled Animation");
  state.currentColor = normalizeCode(state.currentColor, "$48");
  state.background = normalizeCode(state.background, "$00");
  state.zoom = Math.max(1, Math.min(42, Number(state.zoom) || 13));
  state.height = Math.max(1, Math.min(255, parseInt(state.height) || 16));
  state.width = Math.max(1, Math.min(8, parseInt(state.width) || 8));
  state.playerAssignments = normalizePlayerAssignments(state.playerAssignments, state.kernel);
  state.compositionModel = "tia-right-copies";
  state.verticalStretch = ["STANDARD", "MULTISPRITE"].includes(state.kernel) ? 2 : 1;
  state.currentFrame = Math.max(0, Math.min(state.currentFrame || 0, state.frames.length - 1));
  state.activePlayer = state.activePlayer === 1 ? 1 : 0;
  if (!state.twoSpriteMode) state.activePlayer = 0;
  state.region = state.region === "PAL" ? "PAL" : "NTSC";
  state.brushWidth = Math.max(1, Math.min(8, parseInt(state.brushWidth) || 1));
  state.brushHeight = Math.max(1, Math.min(32, parseInt(state.brushHeight) || 1));
  state.onionFrames = Math.max(1, Math.min(10, parseInt(state.onionFrames) || 1));
  state.loopPlayback = state.loopPlayback !== false;
  state.showColorColumns = state.showColorColumns !== false;
  state.colorBlocks = Array.isArray(state.colorBlocks) ? state.colorBlocks.filter(block => Array.isArray(block?.colors) && block.colors.length).map(block => ({
    ...block,
    hueOffset: Math.max(0, Math.min(15, Math.round(Number(block.hueOffset) || 0))),
    lightnessOffset: Math.max(0, Math.min(7, Math.round(Number(block.lightnessOffset) || 0)))
  })) : [];
  state.stamps = Array.isArray(state.stamps) ? state.stamps : [];
  state.frames.forEach((frame, frameIndex) => {
    frame.name ||= `Frame ${frameIndex}`;
    frame.duration = Math.max(1, Math.min(60, parseInt(frame.duration ?? 3) || 3));
    const payloadHeight = Math.max(frame.players?.[0]?.pixels?.length || 0, frame.players?.[1]?.pixels?.length || 0);
    frame.height = Math.max(1, Math.min(255, parseInt(frame.height) || payloadHeight || state.height));
    frame.width = Math.max(1, Math.min(8, parseInt(frame.width) || state.width || 8));
    if (!frame.players) frame.players = [makePlayer(frame.height), makePlayer(frame.height)];
    for (let p = 0; p < 2; p++) {
      if (!frame.players[p]) frame.players[p] = makePlayer(frame.height, "$48", frame.width);
      frame.players[p].width = playerWidth(frame, p);
      frame.players[p].height = playerHeight(frame, p);
      resizePlayer(frame.players[p], frame.players[p].height);
      frame.players[p].nusiz = NUSIZ[frame.players[p].nusiz] ? frame.players[p].nusiz : "normal";
      frame.players[p].solidColor = normalizeCode(frame.players[p].solidColor || frame.players[p].colors[0], "$48");
      frame.players[p].xOffset = Number(frame.players[p].xOffset) || 0;
      frame.players[p].yOffset = Number(frame.players[p].yOffset) || 0;
      if (frame.players[p].reference) frame.players[p].reference = normalizeReference(frame.players[p].reference);
    }
  });
  initializeRegionalColors(state);
  syncFrameSize();
}

function syncFrameSize() {
  const frame = state?.frames?.[state.currentFrame];
  if (frame) {
    state.height = playerHeight(frame, state.activePlayer);
    state.width = playerWidth(frame, state.activePlayer);
    frame.height = state.height;
    frame.width = state.width;
  }
}

function resizePlayer(player, height) {
  while (player.pixels.length < height) player.pixels.push(Array(8).fill(0));
  while (player.colors.length < height) player.colors.push(state.currentColor || "$48");
  player.pixels.length = height;
  player.colors.length = height;
  player.pixels = player.pixels.map(row => Array.from({ length: 8 }, (_, x) => row?.[x] ? 1 : 0));
  player.colors = player.colors.map(c => normalizeCode(c, state.currentColor || "$48"));
  player.height = height;
}

function resizePlayerBottomAnchored(player, height) {
  const oldHeight = Math.max(1, Number(player.height) || player.pixels?.length || 1);
  const nextHeight = Math.max(1, Math.min(255, Number(height) || oldHeight));
  const delta = nextHeight - oldHeight;
  if (delta > 0) {
    player.pixels = [
      ...Array.from({ length: delta }, () => Array(8).fill(0)),
      ...player.pixels
    ];
    player.colors = [
      ...Array(delta).fill(state.currentColor || "$48"),
      ...player.colors
    ];
  } else if (delta < 0) {
    const remove = -delta;
    player.pixels = player.pixels.slice(remove);
    player.colors = player.colors.slice(remove);
  }
  player.yOffset = (Number(player.yOffset) || 0) - delta;
  resizePlayer(player, nextHeight);
}

function resetSpriteVisibility() {
  spriteVisibility = [true, true];
}

function normalizeReference(ref) {
  return {
    dataUrl: String(ref.dataUrl || ""), name: String(ref.name || ref.imageName || "Reference"),
    visible: ref.visible !== false, opacity: Math.max(0, Math.min(100, Number(ref.opacity ?? 100))),
    fitMode: ["fit", "crop", "stretch", "manual"].includes(ref.fitMode) ? ref.fitMode : "fit",
    scale: Math.max(10, Math.min(500, Number(ref.scale) || 100)),
    xOffset: Math.max(-100, Math.min(100, Number(ref.xOffset ?? ref.x) || 0)),
    yOffset: Math.max(-200, Math.min(200, Number(ref.yOffset ?? ref.y) || 0)),
    threshold: Math.max(0, Math.min(255, Number(ref.threshold ?? 64))), dither: !!ref.dither,
    ignoreBlackBackground: ref.ignoreBlackBackground !== false,
    brightness: Math.max(0, Math.min(200, Number(ref.brightness) || 100)),
    contrast: Math.max(0, Math.min(200, Number(ref.contrast) || 100))
  };
}

function aspectForKernel() {
  if (["STANDARD", "MULTISPRITE"].includes(state.kernel)) return { w: 1.7, h: 1.0, label: `${state.kernel === "STANDARD" ? "Standard" : "Multisprite"} double-line kernel` };
  return { w: 1.7, h: 1.0, label: `${state.kernel} pixel aspect 1.7:1` };
}

function layout(playerIndex = state.activePlayer, frame = currentFrame()) {
  const requested = canvasCellSize(state.zoom, state.verticalStretch, state.kernel === "STANDARD" ? 2 : 1);
  const p0 = 0, p1 = 0, cols = playerWidth(frame, playerIndex), rows = playerHeight(frame, playerIndex);
  const cell = smoothRasterCellGeometry(requested.cellW, requested.cellH, window.devicePixelRatio || 1);
  const width = rasterCellBoundary(cell.cellW, cols, 0, cell.pixelRatio);
  const height = rasterCellBoundary(cell.cellH, rows, 0, cell.pixelRatio);
  return {
    cellW: cell.cellW,
    cellH: cell.cellH,
    p0,
    p1,
    cols,
    rows,
    w: width,
    h: height,
    dpr: cell.pixelRatio,
    deviceW: cell.deviceCellWidth * cols,
    deviceH: cell.deviceCellHeight * rows
  };
}

function setCanvasSize(canvas, cssW, cssH, dpr = window.devicePixelRatio || 1) {
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  canvas.style.width = `${canvas.width / dpr}px`;
  canvas.style.height = `${canvas.height / dpr}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

function fillRasterCell(ctx, l, x, y, offsetX = 0, offsetY = 0) {
  const originX = Number(l.rasterOriginX) || 0;
  const originY = Number(l.rasterOriginY) || 0;
  const left = rasterCellBoundaryFromOrigin(l.cellW, x + offsetX, originX, l.dpr);
  const right = rasterCellBoundaryFromOrigin(l.cellW, x + offsetX + 1, originX, l.dpr);
  const top = rasterCellBoundaryFromOrigin(l.cellH, y + offsetY, originY, l.dpr);
  const bottom = rasterCellBoundaryFromOrigin(l.cellH, y + offsetY + 1, originY, l.dpr);
  const rect = { x: left, y: top, w: Math.max(1 / l.dpr, right - left), h: Math.max(1 / l.dpr, bottom - top) };
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  return rect;
}

function copyOriginsInCells(l) {
  return Array.isArray(l.copyOrigins) && l.copyOrigins.length ? l.copyOrigins : [0];
}

function forEachDisplayedCopy(l, callback) {
  copyOriginsInCells(l).forEach((origin, copyIndex) => callback(origin, copyIndex));
}

function colorHex(code) {
  const normalized = normalizeCode(code, "$00");
  return (state?.region === "PAL" ? ATARI_PAL[normalized] : ATARI_NTSC[normalized]) || ATARI_NTSC[normalized] || "#000";
}

function transformAtariColor(code, hueOffset = 0, lightnessOffset = 0) {
  const normalized = normalizeCode(code, "$00").slice(1);
  const hue = (Number.parseInt(normalized[0], 16) + Math.max(0, Math.min(15, Math.round(Number(hueOffset) || 0)))) % 16;
  const lightness = (Math.round(Number.parseInt(normalized[1], 16) / 2) + Math.max(0, Math.min(7, Math.round(Number(lightnessOffset) || 0)))) % 8;
  return `$${hue.toString(16).toUpperCase()}${(lightness * 2).toString(16).toUpperCase()}`;
}

function colorBlockColor(block, index) {
  return transformAtariColor(block?.colors?.[index] || "$00", block?.hueOffset, block?.lightnessOffset);
}

function playerLayerPriority(slot) {
  const assignment = Number(state.playerAssignments?.[slot]) || 0;
  return assignment === 0 ? 1000 : assignment;
}

function resolveSpriteLabelLayout(items, gap = 4) {
  const tops = Object.fromEntries(items.map(item => [item.slot, item.top]));
  if (items.length < 2) return { stacked: false, tops };
  const [a, b] = items;
  const horizontalTouch = a.left <= b.left + b.width + gap && b.left <= a.left + a.width + gap;
  const verticalTouch = a.top <= b.top + b.height + gap && b.top <= a.top + a.height + gap;
  if (!horizontalTouch || !verticalTouch) return { stacked: false, tops };
  const stackTop = Math.max(...items.map(item => item.canvasBottom)) + 5;
  [...items]
    .sort((leftItem, rightItem) => rightItem.priority - leftItem.priority || leftItem.slot - rightItem.slot)
    .forEach((item, index) => { tops[item.slot] = stackTop + index * (item.height + gap); });
  return { stacked: true, tops };
}

function syncCanvasReadoutDock() {
  if (!el.canvasStageScroll || !el.canvasBand) return;
  const viewport = el.canvasStageScroll.getBoundingClientRect();
  const style = getComputedStyle(el.canvasStageScroll);
  const borders = (Number.parseFloat(style.borderTopWidth) || 0) + (Number.parseFloat(style.borderBottomWidth) || 0);
  const horizontalScrollbarHeight = Math.max(0, viewport.height - el.canvasStageScroll.clientHeight - borders);
  el.canvasBand.style.setProperty("--canvas-horizontal-scrollbar-height", `${horizontalScrollbarHeight}px`);
}

function renderEditor() {
  const base = layout();
  const solidKernel = ["STANDARD", "MULTISPRITE"].includes(state.kernel);
  el.spriteStage.classList.toggle("solid-color-kernel", solidKernel);
  const frame = currentFrame();
  const visibleSlots = state.twoSpriteMode ? [0, 1] : [state.activePlayer];
  const spans = [0, 1].map(slot => renderedSpriteSpan(playerWidth(frame, slot), frame.players[slot].nusiz));
  const horizontalGeometry = centeredCompositionGeometry(state.width, visibleSlots.map(slot => ({
    ...frame.players[slot],
    width: playerWidth(frame, slot)
  })));
  const startsX = [0, 0];
  visibleSlots.forEach((slot, index) => { startsX[slot] = horizontalGeometry.starts[index]; });
  const left = horizontalGeometry.minX;
  const right = horizontalGeometry.maxX;
  const spritesTouch = state.twoSpriteMode && startsX[1] === startsX[0] + spans[0];
  const top = Math.min(...visibleSlots.map(slot => frame.players[slot].yOffset));
  const bottom = Math.max(...visibleSlots.map(slot => frame.players[slot].yOffset + playerHeight(frame, slot)));
  const titlePad = 22;
  const columnGap = !state.showColorColumns ? 0 : 10;
  const columnsWidth = !state.showColorColumns ? 0 : (state.twoSpriteMode ? 51 : 24);
  const compositionWidth = Math.max(1, rasterCellBoundary(base.cellW, right - left, 0, base.dpr));
  const compositionHeight = Math.max(1, rasterCellBoundary(base.cellH, bottom - top, 0, base.dpr));
  const labelHeight = 27;
  const labelMetrics = state.twoSpriteMode ? [0, 1].map(slot => {
    const player = frame.players[slot];
    const canvasLeft = rasterCellBoundary(base.cellW, startsX[slot] - left, 0, base.dpr);
    const canvasTop = titlePad + rasterCellBoundary(base.cellH, player.yOffset - top, 0, base.dpr);
    const canvasWidth = rasterCellBoundary(base.cellW, spans[slot], 0, base.dpr);
    const canvasBottom = canvasTop + rasterCellBoundary(base.cellH, playerHeight(frame, slot), 0, base.dpr);
    const label = el[`spriteCanvasLabel${slot}`];
    const labelWidth = Math.max(136, label?.offsetWidth || label?.getBoundingClientRect?.().width || 0);
    return {
      slot,
      left: canvasLeft + (canvasWidth - labelWidth) / 2,
      top: canvasBottom + 5,
      width: labelWidth,
      height: labelHeight,
      canvasBottom,
      priority: playerLayerPriority(slot)
    };
  }) : [];
  const labelLayout = resolveSpriteLabelLayout(labelMetrics);
  const labelBottom = labelMetrics.length
    ? Math.max(...labelMetrics.map(item => labelLayout.tops[item.slot] + item.height))
    : 0;
  const minimumLeft = Math.min(0, ...labelMetrics.map(item => item.left));
  const maximumRight = Math.max(compositionWidth + columnGap + columnsWidth, ...labelMetrics.map(item => item.left + item.width));
  const compositionOriginX = -minimumLeft;
  const compositionOriginY = titlePad;
  const readoutHeight = Math.max(25, el.canvasReadout?.offsetHeight || el.canvasReadout?.getBoundingClientRect?.().height || 0);
  const contentBottom = Math.max(compositionOriginY + compositionHeight, labelBottom);
  const stageWidth = Math.max(1, maximumRight - minimumLeft);
  const stageHeight = Math.max(1, contentBottom + readoutHeight + 12);
  Object.assign(el.spriteStage.style, { width: `${stageWidth}px`, height: `${stageHeight}px` });
  el.spriteStage.classList.toggle("stacked-sprite-labels", labelLayout.stacked);
  el.compositionBackdrop.classList.remove("hidden");
  Object.assign(el.compositionBackdrop.style, {
    left: `${compositionOriginX}px`,
    top: `${compositionOriginY}px`,
    width: `${compositionWidth}px`,
    height: `${compositionHeight}px`,
    background: colorHex(state.background)
  });
  const manualSpriteLock = state.twoSpriteMode && !editorPreferences.autoSpriteSelection;
  el.lockedSpriteFeedback.classList.toggle("hidden", !manualSpriteLock);
  Object.assign(el.compositionColorColumns.style, {
    position: "absolute",
    left: `${compositionOriginX + compositionWidth + columnGap}px`,
    top: `${compositionOriginY}px`,
    marginLeft: "0"
  });
  if (el.canvasStageScroll) {
    const viewport = el.canvasStageScroll.getBoundingClientRect();
    const scrollStyle = getComputedStyle(el.canvasStageScroll);
    const margins = centeredCompositionMargins({
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      compositionWidth,
      compositionHeight,
      paddingLeft: Number.parseFloat(scrollStyle.paddingLeft) || 0,
      paddingTop: Number.parseFloat(scrollStyle.paddingTop) || 0,
      compositionOriginX,
      compositionOriginY
    });
    el.spriteStage.style.marginLeft = `${margins.left}px`;
    el.spriteStage.style.marginTop = `${margins.top}px`;
  }
  [0, 1].forEach(playerIndex => {
    const group = el[`playerCanvasGroup${playerIndex}`];
    const visible = state.twoSpriteMode || playerIndex === state.activePlayer;
    group.classList.toggle("hidden", !visible);
    group.classList.toggle("sprite-hidden", !spriteVisibility[playerIndex]);
    // Both visible sprites are direct editing surfaces. Pointer-down selects
    // the target slot before applying the active tool.
    group.style.pointerEvents = "auto";
    if (!visible) return;
    const player = currentFrame().players[playerIndex];
    const playerBase = layout(playerIndex, frame);
    const mode = nusizMode(player.nusiz);
    group.classList.toggle("nusiz-copies", mode.copyOrigins.length > 1);
    const scale = mode.scale;
    const width = playerWidth(frame, playerIndex);
    const height = playerHeight(frame, playerIndex);
    const span = renderedSpriteSpan(width, player.nusiz);
    const l = {
      ...playerBase,
      p0: 0,
      p1: 0,
      cols: width,
      spanUnits: span,
      mode,
      normalCellW: playerBase.cellW,
      rasterOriginX: (startsX[playerIndex] - left) / scale,
      rasterOriginY: player.yOffset - top,
      copyOrigins: mode.copyOrigins.map(origin => origin / scale),
      cellW: playerBase.cellW * scale,
      w: rasterCellBoundaryFromOrigin(playerBase.cellW, span, startsX[playerIndex] - left, playerBase.dpr),
      rows: height,
      h: rasterCellBoundaryFromOrigin(playerBase.cellH, height, player.yOffset - top, playerBase.dpr),
      // The two sprite canvases touch at one seam. Skip the right canvas's
      // outer left edge so that seam is rendered once instead of twice.
      skipOuterLeft: spritesTouch && playerIndex === 1
    };
    const canvas = playerIndex ? el.spriteCanvas1 : el.spriteCanvas;
    const ctx = setCanvasSize(canvas, l.w, l.h, l.dpr);
    if (playerIndex === state.activePlayer) drawReference(ctx, l, playerIndex);
    if (state.onion && state.frames.length > 1) drawOnion(ctx, l, playerIndex);
    if (spriteVisibility[playerIndex]) drawPlayer(ctx, l, playerIndex, 1);
    if (state.showGrid) drawGrid(ctx, l);
    // Grid lines must sit beneath selection and brush feedback. Drawing the
    // feedback last keeps its complete border visible on shared cell edges.
    if (!manualSpriteLock && playerIndex === state.activePlayer) drawSelection(ctx, l);
    if (!manualSpriteLock && pointerInsideCanvas && lastCell.player === playerIndex) {
      drawStampPlacementPreview(ctx, l);
      drawBrushGhost(ctx, l);
    }
    Object.assign(group.style, {
      position: "absolute",
      left: `${compositionOriginX + rasterCellBoundary(base.cellW, startsX[playerIndex] - left, 0, base.dpr)}px`,
      top: `${compositionOriginY + rasterCellBoundary(base.cellH, player.yOffset - top, 0, base.dpr)}px`,
      transform: "none"
    });
    const canvasLabel = el[`spriteCanvasLabel${playerIndex}`];
    if (state.twoSpriteMode && canvasLabel) {
      const groupTop = compositionOriginY + rasterCellBoundary(base.cellH, player.yOffset - top, 0, base.dpr);
      canvasLabel.style.top = `${labelLayout.tops[playerIndex] - groupTop}px`;
    } else if (canvasLabel) {
      canvasLabel.style.top = "";
    }
    if (manualSpriteLock && playerIndex === state.activePlayer) {
      const overlay = el.lockedSpriteFeedback;
      const overlayContext = setCanvasSize(overlay, l.w, l.h, l.dpr);
      overlay.style.left = group.style.left;
      overlay.style.top = group.style.top;
      drawSelection(overlayContext, l);
      if (pointerInsideCanvas && lastCell.player === playerIndex) {
        drawStampPlacementPreview(overlayContext, l);
        drawBrushGhost(overlayContext, l);
      }
    }
    el[`p${playerIndex}ColorsColumn`].style.transform = `translateY(${rasterCellBoundary(base.cellH, player.yOffset - top, 0, base.dpr)}px)`;
    group.style.zIndex = String(10 + playerLayerPriority(playerIndex));
  });
  syncCanvasReadoutDock();
}

function drawBrushGhost(ctx, l) {
  if (!pointerInsideCanvas || isPointerDown || !["pencil", "eraser"].includes(state.tool)) return;
  const erase = state.tool === "eraser" || rightEraseStroke;
  ctx.save();
  ctx.fillStyle = erase ? "rgba(255,90,90,.28)" : "rgba(255,255,255,.35)";
  ctx.strokeStyle = erase ? "rgba(255,110,110,.9)" : "rgba(255,255,255,.9)";
  ctx.lineWidth = 1 / l.dpr;
  const halfDevicePixel = .5 / l.dpr;
  forEachDisplayedCopy(l, origin => {
    brushCells(lastCell.col, lastCell.row, state.brushWidth, state.brushHeight, l.cols, l.rows).forEach(([x, y]) => {
      const rect = fillRasterCell(ctx, l, origin + x, y);
      ctx.strokeRect(
        rect.x + halfDevicePixel,
        rect.y + halfDevicePixel,
        Math.max(0, rect.w - 1 / l.dpr),
        Math.max(0, rect.h - 1 / l.dpr)
      );
    });
  });
  ctx.restore();
}

function drawStampPlacementPreview(ctx, l) {
  if (state.tool !== "stamp" || activeStampIndex === null) return;
  const stamp = state.stamps[activeStampIndex];
  if (!stamp) return;
  const startX = lastCell.col - Math.floor(stamp.w / 2);
  const startY = lastCell.row - Math.floor(stamp.h / 2);
  ctx.save();
  ctx.globalAlpha = .42;
  ctx.fillStyle = colorHex(state.currentColor);
  forEachDisplayedCopy(l, origin => stamp.pixels.forEach((row, y) => row.forEach((value, x) => {
    if (value) fillRasterCell(ctx, l, origin + startX + x, startY + y);
  })));
  ctx.restore();
}

function playerOrigin(l, playerIndex) {
  return playerIndex === 0 ? l.p0 : l.p1;
}

function drawPlayer(ctx, l, playerIndex, alpha) {
  const player = currentFrame().players[playerIndex];
  ctx.save();
  ctx.globalAlpha = alpha;
  forEachDisplayedCopy(l, origin => {
    for (let y = 0; y < l.rows; y++) {
      ctx.fillStyle = colorHex(["STANDARD", "MULTISPRITE"].includes(state.kernel) ? player.solidColor : player.colors[y]);
      for (let x = 0; x < l.cols; x++) {
        if (player.pixels[y]?.[x]) fillRasterCell(ctx, l, origin + x, y);
      }
    }
  });
  ctx.restore();
}

function drawOnion(ctx, l, playerIndex) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  const count = Math.min(state.onionFrames, state.frames.length - 1);
  for (let step = count; step >= 1; step--) {
    const prevIndex = (state.currentFrame - step + state.frames.length) % state.frames.length;
    const frame = state.frames[prevIndex];
    ctx.globalAlpha = (state.onionOpacity / 100) * ((count - step + 1) / count);
    const player = frame.players[playerIndex];
    const current = currentFrame().players[playerIndex];
    const mode = nusizMode(player.nusiz);
    const normalCellW = l.normalCellW || (l.cellW / nusizMode(current.nusiz).scale);
    const dx = (player.xOffset - current.xOffset) * normalCellW;
    const dy = (player.yOffset - current.yOffset) * l.cellH;
    const rows = Math.min(state.height, player.pixels.length);
    mode.copyOrigins.forEach(copyOrigin => {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < state.width; x++) {
          if (!player.pixels[y]?.[x]) continue;
          const left = dx + (copyOrigin + x * mode.scale) * normalCellW;
          const right = dx + (copyOrigin + (x + 1) * mode.scale) * normalCellW;
          const top = dy + y * l.cellH;
          const bottom = dy + (y + 1) * l.cellH;
          ctx.fillRect(left, top, right - left, bottom - top);
        }
      }
    });
  }
  ctx.restore();
}

function currentReference() { return currentPlayer().reference; }

function imageForReference(ref) {
  if (!ref?.dataUrl) return null;
  if (!referenceImages.has(ref.dataUrl)) {
    const image = new Image();
    image.onload = renderAll;
    image.src = ref.dataUrl;
    referenceImages.set(ref.dataUrl, image);
  }
  return referenceImages.get(ref.dataUrl);
}

function referenceRect(ref, image, l) {
  return fittedReferenceRect({
    imageWidth: image.naturalWidth,
    imageHeight: image.naturalHeight,
    columns: 8,
    rows: state.height,
    cellWidth: l.cellW,
    cellHeight: l.cellH,
    fitMode: ref.fitMode,
    scale: ref.scale,
    xOffset: ref.xOffset,
    yOffset: ref.yOffset
  });
}

function drawReference(ctx, l, playerIndex) {
  const ref = currentFrame().players[playerIndex].reference;
  const image = imageForReference(ref);
  if (!image?.complete || !ref.visible) return;
  const rect = referenceRect(ref, image, l);
  ctx.save();
  ctx.globalAlpha = ref.opacity / 100;
  ctx.filter = `brightness(${ref.brightness}%) contrast(${ref.contrast}%)`;
  forEachDisplayedCopy(l, origin => {
    ctx.globalAlpha = ref.opacity / 100;
    ctx.filter = `brightness(${ref.brightness}%) contrast(${ref.contrast}%)`;
    const copyX = rect.x + origin * l.cellW;
    ctx.drawImage(image, copyX, rect.y, rect.w, rect.h);
    if (referenceTransformActive) {
      ctx.globalAlpha = 1; ctx.filter = "none"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.strokeRect(copyX, rect.y, rect.w, rect.h);
      [[copyX, rect.y], [copyX + rect.w, rect.y], [copyX, rect.y + rect.h], [copyX + rect.w, rect.y + rect.h]].forEach(([x,y]) => ctx.fillRect(x - 4, y - 4, 8, 8));
    }
  });
  ctx.restore();
}

function drawGrid(ctx, l) {
  ctx.save();
  const gridStyle = getComputedStyle(document.documentElement);
  ctx.strokeStyle = gridStyle.getPropertyValue("--canvas-grid-line").trim() || "rgba(255,255,255,.15)";
  const requestedLineWidth = Number.parseFloat(gridStyle.getPropertyValue("--canvas-grid-line-width")) || 1;
  const deviceLineWidth = Math.max(1, Math.round(requestedLineWidth * l.dpr));
  ctx.lineWidth = deviceLineWidth / l.dpr;
  const halfLine = deviceLineWidth / (2 * l.dpr);
  const rasterOriginX = Number(l.rasterOriginX) || 0;
  const rasterOriginY = Number(l.rasterOriginY) || 0;
  forEachDisplayedCopy(l, origin => {
    const left = rasterCellBoundaryFromOrigin(l.cellW, origin, rasterOriginX, l.dpr);
    const right = rasterCellBoundaryFromOrigin(l.cellW, origin + l.cols, rasterOriginX, l.dpr);
    for (let x = 1; x < l.cols; x++) {
      const boundary = rasterCellBoundaryFromOrigin(l.cellW, origin + x, rasterOriginX, l.dpr);
      ctx.beginPath();
      ctx.moveTo(boundary + halfLine, 0);
      ctx.lineTo(boundary + halfLine, l.h);
      ctx.stroke();
    }
    for (let y = 1; y < l.rows; y++) {
      const boundary = rasterCellBoundaryFromOrigin(l.cellH, y, rasterOriginY, l.dpr);
      ctx.beginPath();
      ctx.moveTo(left, boundary + halfLine);
      ctx.lineTo(right, boundary + halfLine);
      ctx.stroke();
    }
    ctx.strokeRect(
      left + halfLine,
      halfLine,
      Math.max(0, right - left - (halfLine * 2)),
      Math.max(0, l.h - (halfLine * 2))
    );
  });
  ctx.restore();
}

function drawSelection(ctx, l) {
  if (!selection) return;
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  const mask = selection.mask || fullSelectionMask(selection.w, selection.h);
  forEachDisplayedCopy(l, origin => {
    for (let y = 0; y < selection.h; y++) for (let x = 0; x < selection.w; x++) {
      if (!mask[y]?.[x]) continue;
      fillRasterCell(ctx, l, origin + selection.x + x, selection.y + y);
    }
    ctx.beginPath();
    maskBoundarySegments(mask).forEach(([x1, y1, x2, y2]) => {
      ctx.moveTo(
        rasterCellBoundaryFromOrigin(l.cellW, origin + selection.x + x1, l.rasterOriginX || 0, l.dpr),
        rasterCellBoundaryFromOrigin(l.cellH, selection.y + y1, l.rasterOriginY || 0, l.dpr)
      );
      ctx.lineTo(
        rasterCellBoundaryFromOrigin(l.cellW, origin + selection.x + x2, l.rasterOriginX || 0, l.dpr),
        rasterCellBoundaryFromOrigin(l.cellH, selection.y + y2, l.rasterOriginY || 0, l.dpr)
      );
    });
    ctx.stroke();
  });
  ctx.restore();
}

function renderPreview() {
  const aspect = aspectForKernel();
  const p0 = currentFrame().players[0], p1 = currentFrame().players[1];
  const pixelW = 17;
  const pixelH = (state.kernel === "STANDARD" ? 20 : 10) * state.verticalStretch;
  const previewGeometry = centeredCompositionGeometry(state.width, state.twoSpriteMode
    ? [{ ...p0, width: playerWidth(currentFrame(), 0) }, { ...p1, width: playerWidth(currentFrame(), 1) }]
    : [{ ...p0, width: playerWidth(currentFrame(), 0) }]);
  const p0Start = previewGeometry.starts[0];
  const p1Start = state.twoSpriteMode ? previewGeometry.starts[1] : p0Start;
  const minPlayerX = previewGeometry.minX;
  const p0PreviewX = p0Start - minPlayerX;
  const p1PreviewX = p1Start - minPlayerX;
  const widthPixels = previewGeometry.totalWidth;
  const cssW = Math.max(180, widthPixels * pixelW + 36);
  const minY = Math.min(p0.yOffset, state.twoSpriteMode ? p1.yOffset : p0.yOffset);
  const maxY = Math.max(p0.yOffset + playerHeight(currentFrame(), 0), state.twoSpriteMode ? p1.yOffset + playerHeight(currentFrame(), 1) : p0.yOffset + playerHeight(currentFrame(), 0));
  const cssH = Math.max(220, (maxY - minY) * pixelH + 36);
  const ctx = setCanvasSize(el.previewCanvas, cssW, cssH);
  ctx.fillStyle = colorHex(state.background);
  ctx.fillRect(0, 0, cssW, cssH);
  const ox = 18;
  const oy = 18;
  drawPreviewPlayer(ctx, currentFrame().players[0], ox + p0PreviewX * pixelW, oy + (p0.yOffset - minY) * pixelH, pixelW, pixelH, state.twoSpriteMode || state.activePlayer === 0);
  if (state.twoSpriteMode) drawPreviewPlayer(ctx, currentFrame().players[1], ox + p1PreviewX * pixelW, oy + (p1.yOffset - minY) * pixelH, pixelW, pixelH, true);
  el.previewCaption.textContent = `${aspect.label} / ${state.twoSpriteMode ? `P${state.playerAssignments[0]}+P${state.playerAssignments[1]}` : `P${state.playerAssignments[state.activePlayer]}`} / ${NUSIZ[currentPlayer().nusiz].label}`;
}

function playbackThumbnailFrameBounds(frame, slots) {
  const geometry = centeredCompositionGeometry(state.width, slots.map(slot => ({
    ...frame.players[slot],
    width: playerWidth(frame, slot)
  })));
  // Frame the configured sprite grids, including empty rows and columns. This
  // keeps the preview's coordinate system fixed while pixels are drawn.
  const minY = Math.min(...slots.map(slot => Number(frame.players[slot].yOffset) || 0));
  const maxY = Math.max(...slots.map(slot => (Number(frame.players[slot].yOffset) || 0) + playerHeight(frame, slot)));
  return { minX: geometry.minX, maxX: geometry.maxX, minY, maxY };
}
function playbackThumbnailAnimationBounds(slots) {
  const bounds = state.frames.map(frame => playbackThumbnailFrameBounds(frame, slots));
  const minX = Math.min(...bounds.map(item => item.minX));
  const maxX = Math.max(...bounds.map(item => item.maxX));
  const minY = Math.min(...bounds.map(item => item.minY));
  const maxY = Math.max(...bounds.map(item => item.maxY));
  return { minX, maxX, minY, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

// Preview framing uses the visible bounds of every frame, so transparent
// editor rows do not waste space and playback cannot resize or jump per frame.
function renderPlaybackThumbnail() {
  const canvas = el.playbackThumbnailCanvas;
  if (!canvas || !state) return;
  syncPlaybackThumbnailAutoSize();
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, rect.width);
  const cssH = Math.max(1, rect.height);
  const ctx = setCanvasSize(canvas, cssW, cssH);
  // setCanvasSize gives editable canvases explicit CSS dimensions. This preview
  // lives in a resizable grid row, so let its surface own the display size.
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.fillStyle = colorHex(state.background);
  ctx.fillRect(0, 0, cssW, cssH);

  const frame = currentFrame();
  const slots = state.twoSpriteMode ? [0, 1] : [state.activePlayer];
  const geometry = centeredCompositionGeometry(state.width, slots.map(slot => ({
    ...frame.players[slot],
    width: playerWidth(frame, slot)
  })));
  const bounds = playbackThumbnailAnimationBounds(slots);
  // Resizing this window changes its viewport only. The selected zoom remains
  // the art scale, and the composition stays centered if the viewport clips it.
  const scale = playbackThumbnailZoom;
  const unitH = scale * Math.max(1, state.verticalStretch);
  const unitW = scale * 1.7;
  const artWidth = bounds.width * unitW;
  const artHeight = bounds.height * unitH;
  const originX = (cssW - artWidth) / 2 - bounds.minX * unitW;
  const originY = (cssH - artHeight) / 2 - bounds.minY * unitH;

  slots
    .slice()
    .sort((leftSlot, rightSlot) => playerLayerPriority(leftSlot) - playerLayerPriority(rightSlot) || leftSlot - rightSlot)
    .forEach(slot => {
      const player = frame.players[slot];
      const geometryIndex = slots.indexOf(slot);
      drawThumbPlayer(ctx, player,
        originX + geometry.starts[geometryIndex] * unitW,
        originY + player.yOffset * unitH,
        unitW, unitH, playerHeight(frame, slot), playerWidth(frame, slot));
    });
}

function playbackThumbnailBounds() {
  const band = el.canvasBand?.getBoundingClientRect();
  const viewport = el.canvasStageScroll?.getBoundingClientRect();
  const thumbnail = el.playbackThumbnail?.getBoundingClientRect();
  if (!band || !viewport || !thumbnail) return null;
  return {
    minLeft: viewport.left - band.left,
    minTop: viewport.top - band.top,
    maxLeft: Math.max(viewport.left - band.left, viewport.right - band.left - thumbnail.width),
    maxTop: Math.max(viewport.top - band.top, viewport.bottom - band.top - thumbnail.height)
  };
}

function placePlaybackThumbnail(left, top) {
  const bounds = playbackThumbnailBounds();
  if (!bounds || !el.playbackThumbnail) return;
  const clampedLeft = Math.min(bounds.maxLeft, Math.max(bounds.minLeft, left));
  const clampedTop = Math.min(bounds.maxTop, Math.max(bounds.minTop, top));
  Object.assign(el.playbackThumbnail.style, {
    left: `${clampedLeft}px`,
    top: `${clampedTop}px`,
    right: "auto",
    bottom: "auto"
  });
}

function clampPlaybackThumbnailToCanvas() {
  if (!el.playbackThumbnail || !el.playbackThumbnail.style.left) return;
  placePlaybackThumbnail(Number.parseFloat(el.playbackThumbnail.style.left) || 0, Number.parseFloat(el.playbackThumbnail.style.top) || 0);
}

function playbackThumbnailAnimationSpan() {
  const slots = state.twoSpriteMode ? [0, 1] : [state.activePlayer];
  return playbackThumbnailAnimationBounds(slots);
}

function playbackThumbnailTallestFrameHeight() {
  return playbackThumbnailAnimationSpan().height;
}

function playbackThumbnailWidestFrameWidth() {
  return playbackThumbnailAnimationSpan().width;
}

function playbackThumbnailRequiredHeight(tallestFrameHeight = playbackThumbnailTallestFrameHeight()) {
  const controlHeight = 28;
  const contentPadding = 12;
  const pixels = tallestFrameHeight * playbackThumbnailZoom * Math.max(1, state.verticalStretch);
  return Math.max(52, Math.ceil(pixels + contentPadding + controlHeight));
}

function playbackThumbnailRequiredWidth(widestFrameWidth = playbackThumbnailWidestFrameWidth()) {
  const contentPadding = 12;
  const pixels = widestFrameWidth * playbackThumbnailZoom * 1.7;
  return Math.max(160, Math.ceil(pixels + contentPadding));
}

function syncPlaybackThumbnailAutoSize() {
  if (!el.playbackThumbnail || playbackThumbnailCollapsed) return;
  const tallestFrameHeight = playbackThumbnailTallestFrameHeight();
  const widestFrameWidth = playbackThumbnailWidestFrameWidth();
  const requiredHeight = playbackThumbnailRequiredHeight(tallestFrameHeight);
  const requiredWidth = playbackThumbnailRequiredWidth(widestFrameWidth);
  const viewport = el.canvasStageScroll?.getBoundingClientRect();
  // Never grow the fixed preview past the canvas viewport. The renderer then
  // reduces the sprite scale equally on both axes instead of clipping it.
  const maximumAutoHeight = viewport ? Math.max(72, Math.floor(viewport.height - 24)) : requiredHeight;
  const maximumAutoWidth = viewport ? Math.max(160, Math.floor(viewport.width - 24)) : requiredWidth;
  const fittedHeight = Math.min(requiredHeight, maximumAutoHeight);
  const fittedWidth = Math.min(requiredWidth, maximumAutoWidth);
  if (!playbackThumbnailUserSized) {
    Object.assign(el.playbackThumbnail.style, { width: `${fittedWidth}px`, height: `${fittedHeight}px` });
    playbackThumbnailExpandedHeight = fittedHeight;
    clampPlaybackThumbnailToCanvas();
  } else {
    let resized = false;
    if (tallestFrameHeight > playbackThumbnailTallestHeightAtManualSize && el.playbackThumbnail.offsetHeight < fittedHeight) {
      el.playbackThumbnail.style.height = `${fittedHeight}px`;
      playbackThumbnailExpandedHeight = fittedHeight;
      resized = true;
    }
    if (widestFrameWidth > playbackThumbnailWidestWidthAtManualSize && el.playbackThumbnail.offsetWidth < fittedWidth) {
      el.playbackThumbnail.style.width = `${fittedWidth}px`;
      resized = true;
    }
    if (resized) clampPlaybackThumbnailToCanvas();
  }
}

function syncPlaybackThumbnailControls() {
  if (!el.playbackThumbnail) return;
  el.playbackThumbnail.classList.toggle("collapsed", playbackThumbnailCollapsed);
  el.playbackThumbnailZoom.value = String(playbackThumbnailZoom);
  el.playbackThumbnailZoom.disabled = playbackThumbnailCollapsed;
  const button = el.togglePlaybackThumbnailVisibility;
  button.setAttribute("aria-pressed", String(!playbackThumbnailCollapsed));
  button.title = playbackThumbnailCollapsed ? "Show playback preview" : "Hide playback preview";
  button.setAttribute("aria-label", button.title);
  button.querySelector("use")?.setAttribute("href", playbackThumbnailCollapsed ? "#icon-eye-off" : "#icon-eye");
}

function togglePlaybackThumbnailVisibility() {
  if (!el.playbackThumbnail) return;
  if (!playbackThumbnailCollapsed) {
    playbackThumbnailExpandedHeight = Math.max(72, el.playbackThumbnail.offsetHeight);
    el.playbackThumbnail.style.height = "28px";
  } else {
    el.playbackThumbnail.style.height = `${playbackThumbnailExpandedHeight}px`;
  }
  playbackThumbnailCollapsed = !playbackThumbnailCollapsed;
  syncPlaybackThumbnailControls();
  clampPlaybackThumbnailToCanvas();
  if (!playbackThumbnailCollapsed) renderPlaybackThumbnail();
}

function resizePlaybackThumbnail(width, height) {
  const viewport = el.canvasStageScroll?.getBoundingClientRect();
  if (!viewport || !el.playbackThumbnail) return;
  const minWidth = 160;
  const minHeight = 72;
  const maxWidth = Math.max(minWidth, Math.floor(viewport.width));
  const maxHeight = Math.max(minHeight, Math.floor(viewport.height));
  const nextWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(width)));
  const nextHeight = Math.max(minHeight, Math.min(maxHeight, Math.round(height)));
  Object.assign(el.playbackThumbnail.style, { width: `${nextWidth}px`, height: `${nextHeight}px` });
  if (!playbackThumbnailCollapsed) playbackThumbnailExpandedHeight = nextHeight;
  clampPlaybackThumbnailToCanvas();
  renderPlaybackThumbnail();
}

function beginPlaybackThumbnailResize(event) {
  if (event.button !== 0 || !el.playbackThumbnail) return;
  event.preventDefault();
  event.stopPropagation();
  const rect = el.playbackThumbnail.getBoundingClientRect();
  playbackThumbnailUserSized = true;
  playbackThumbnailTallestHeightAtManualSize = playbackThumbnailTallestFrameHeight();
  playbackThumbnailWidestWidthAtManualSize = playbackThumbnailWidestFrameWidth();
  playbackThumbnailResize = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, width: rect.width, height: rect.height };
  el.playbackThumbnailResizeHandle.setPointerCapture(event.pointerId);
}

function movePlaybackThumbnailResize(event) {
  if (!playbackThumbnailResize || playbackThumbnailResize.pointerId !== event.pointerId) return;
  resizePlaybackThumbnail(playbackThumbnailResize.width + event.clientX - playbackThumbnailResize.startX, playbackThumbnailResize.height + event.clientY - playbackThumbnailResize.startY);
  event.preventDefault();
}

function endPlaybackThumbnailResize(event) {
  if (!playbackThumbnailResize || playbackThumbnailResize.pointerId !== event.pointerId) return;
  if (el.playbackThumbnailResizeHandle?.hasPointerCapture?.(event.pointerId)) el.playbackThumbnailResizeHandle.releasePointerCapture(event.pointerId);
  playbackThumbnailResize = null;
}

function beginPlaybackThumbnailDrag(event) {
  if (event.button !== 0 || !el.playbackThumbnail || !event.target.closest(".playback-thumbnail-surface")) return;
  const thumbnail = el.playbackThumbnail.getBoundingClientRect();
  playbackThumbnailDrag = {
    pointerId: event.pointerId,
    offsetX: event.clientX - thumbnail.left,
    offsetY: event.clientY - thumbnail.top
  };
  el.playbackThumbnail.setPointerCapture(event.pointerId);
  el.playbackThumbnail.classList.add("dragging");
  event.preventDefault();
}

function movePlaybackThumbnailDrag(event) {
  if (!playbackThumbnailDrag || playbackThumbnailDrag.pointerId !== event.pointerId) return;
  const band = el.canvasBand?.getBoundingClientRect();
  if (!band) return;
  placePlaybackThumbnail(event.clientX - band.left - playbackThumbnailDrag.offsetX, event.clientY - band.top - playbackThumbnailDrag.offsetY);
  event.preventDefault();
}

function endPlaybackThumbnailDrag(event) {
  if (!playbackThumbnailDrag || playbackThumbnailDrag.pointerId !== event.pointerId || !el.playbackThumbnail) return;
  if (el.playbackThumbnail.hasPointerCapture?.(event.pointerId)) el.playbackThumbnail.releasePointerCapture(event.pointerId);
  playbackThumbnailDrag = null;
  el.playbackThumbnail.classList.remove("dragging");
}

function drawPreviewPlayer(ctx, player, ox, oy, unitW, ph, visible) {
  if (!visible) return;
  const mode = nusizMode(player.nusiz);
  mode.copyOrigins.forEach(copyOrigin => {
    const rows = Math.max(1, player.height || player.pixels.length);
    const columns = Math.max(1, player.width || 8);
    for (let y = 0; y < rows; y++) {
      ctx.fillStyle = colorHex(usesSolidColor() ? player.solidColor : player.colors[y]);
      for (let x = 0; x < columns; x++) {
        if (player.pixels[y]?.[x]) ctx.fillRect(ox + (copyOrigin + x * mode.scale) * unitW, oy + y * ph, unitW * mode.scale, ph);
      }
    }
  });
}

function cellFromPointer(event, clampToEdges = false) {
  const canvas = event.currentTarget?.dataset?.player !== undefined
    ? event.currentTarget
    : event.target.closest?.("canvas[data-player]") || (clampToEdges ? dragStart?.canvas : null);
  if (!canvas) return null;
  const playerIndex = Number(canvas.dataset.player);
  if (state.twoSpriteMode && !spriteVisibility[playerIndex]) return null;
  const rect = canvas.getBoundingClientRect();
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  const l = layout(playerIndex);
  const player = currentFrame().players[playerIndex];
  const width = playerWidth(currentFrame(), playerIndex);
  const height = playerHeight(currentFrame(), playerIndex);
  const mode = nusizMode(player.nusiz);
  const spanUnits = renderedSpriteSpan(width, player.nusiz);
  const unitWidth = rect.width / spanUnits;
  const cellWidth = unitWidth * mode.scale;
  const cellHeight = rect.height / l.rows;
  let displayX = localX / unitWidth;
  let hit = nusizSourceColumn(displayX, width, player.nusiz);
  if (!hit && clampToEdges) {
    const preferredCopy = Math.max(0, Math.min(mode.copyOrigins.length - 1, dragStart?.copyIndex || 0));
    const origin = mode.copyOrigins[preferredCopy];
    displayX = Math.max(origin, Math.min(origin + width * mode.scale - 1e-7, displayX));
    hit = nusizSourceColumn(displayX, width, player.nusiz);
  }
  let row = Math.floor(localY / cellHeight);
  if (clampToEdges) row = Math.max(0, Math.min(height - 1, row));
  if (!hit || row < 0 || row >= height) return null;
  const copyLocalX = localX - hit.origin * unitWidth;
  return { col: hit.column, row, copyIndex: hit.copyIndex, player: playerIndex, canvas, localX: copyLocalX, localY, cellWidth, cellHeight, unitWidth };
}

function compositionCellFromPointer(event, clampToEdges = false) {
  if (state.twoSpriteMode && !editorPreferences.autoSpriteSelection) {
    const canvas = state.activePlayer ? el.spriteCanvas1 : el.spriteCanvas;
    return cellFromPointer({
      clientX: event.clientX,
      clientY: event.clientY,
      currentTarget: canvas,
      target: canvas
    }, clampToEdges);
  }
  const direct = cellFromPointer(event, clampToEdges);
  if (!state.twoSpriteMode || clampToEdges) return direct;
  const directCanvas = event?.currentTarget?.dataset?.player !== undefined ? event.currentTarget : null;
  const canvases = [directCanvas, ...document.elementsFromPoint(event.clientX, event.clientY)]
    .filter((node, index, all) => node instanceof HTMLCanvasElement && node.dataset.player !== undefined && all.indexOf(node) === index);
  const candidates = canvases.map(canvas => cellFromPointer({
      clientX: event.clientX, clientY: event.clientY,
      currentTarget: canvas, target: canvas
    }))
    .filter(Boolean)
    .sort((a, b) => playerLayerPriority(b.player) - playerLayerPriority(a.player));
  const live = candidates.find(cell => currentFrame().players[cell.player].pixels[cell.row]?.[cell.col]);
  return live || candidates[0] || null;
}

function updateCanvasSelectionCursor(event) {
  const canvas = event?.currentTarget?.dataset?.player !== undefined ? event.currentTarget : event?.target?.closest?.("canvas[data-player]");
  if (!canvas) return;
  if (referenceTransformActive) { canvas.style.cursor = referenceDrag ? "grabbing" : "grab"; return; }
  if (state.tool !== "select") { canvas.style.cursor = "crosshair"; return; }
  if (movingSelection) { canvas.style.cursor = "grabbing"; return; }
  const cell = compositionCellFromPointer(event);
  const modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey;
  canvas.style.cursor = cell && cell.player === state.activePlayer && !modifiers && selectionContains(selection, cell.col, cell.row) ? "grab" : "crosshair";
}

function setActivePlayer(playerIndex, render = true) {
  const nextPlayer = playerIndex ? 1 : 0;
  if (state.activePlayer === nextPlayer) return;
  colorSelection = null;
  selection = null;
  rotationSession = null;
  referenceTransformActive = false;
  state.activePlayer = nextPlayer;
  syncFrameSize();
  if (usesSolidColor()) state.currentColor = currentPlayer().solidColor;
  syncControls();
  syncReadouts();
  if (render) renderAll();
}

function toggleSpriteVisibility(playerIndex) {
  const slot = playerIndex ? 1 : 0;
  spriteVisibility[slot] = !spriteVisibility[slot];
  if (!spriteVisibility[slot] && state.activePlayer === slot && spriteVisibility[1 - slot]) {
    setActivePlayer(1 - slot, false);
  }
  pointerInsideCanvas = false;
  endPointer();
  syncControls();
  renderAll();
}

function beginPointer(event) {
  event.preventDefault();
  const cell = compositionCellFromPointer(event);
  if (!cell) return;
  if (cell.player !== state.activePlayer) setActivePlayer(cell.player, false);
  pointerInsideCanvas = true;
  rightEraseStroke = event.button === 2;
  if (cell.canvas.setPointerCapture && event.pointerId !== undefined) cell.canvas.setPointerCapture(event.pointerId);
  lastCell = cell;
  if (referenceTransformActive && currentReference()) {
    pushHistory();
    const canvasRect = cell.canvas.getBoundingClientRect();
    const l = { ...layout(), p0: 0, p1: 0, cols: 8, w: state.width * cell.cellWidth, h: canvasRect.height, cellW: cell.cellWidth, cellH: cell.cellHeight };
    const image = imageForReference(currentReference());
    const rect = image ? referenceRect(currentReference(), image, l) : { x: 0, y: 0, w: l.w, h: l.h };
    const px = cell.localX, py = event.clientY - canvasRect.top;
    const corners = [[rect.x,rect.y],[rect.x+rect.w,rect.y],[rect.x,rect.y+rect.h],[rect.x+rect.w,rect.y+rect.h]];
    const nearCorner = corners.some(([x,y]) => Math.hypot(px-x,py-y) <= 14);
    const centerX = rect.x + rect.w/2, centerY = rect.y + rect.h/2;
    referenceDrag = { mode: nearCorner ? "scale" : "move", pointerX: event.clientX, pointerY: event.clientY, x: currentReference().xOffset, y: currentReference().yOffset, scale: currentReference().scale, centerX, centerY, distance: Math.max(1, Math.hypot(px-centerX,py-centerY)), canvasRect, copyOffsetX: nusizMode(currentPlayer().nusiz).copyOrigins[cell.copyIndex] * cell.unitWidth, cellWidth: cell.cellWidth, cellHeight: cell.cellHeight };
    cell.canvas.style.cursor = nearCorner ? "nwse-resize" : "grabbing";
    isPointerDown = true;
    return;
  }
  const hasModifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey;
  const shouldMoveSelection = state.tool === "select" && cell.player === state.activePlayer && selection && !hasModifiers && pointInSelection(cell, selection, true);
  if (cell.player !== state.activePlayer) selection = null;
  if (state.tool === "text") {
    el.textToolX.value = cell.col;
    el.textToolY.value = cell.row;
    el.textDialog.showModal();
    return;
  }
  isPointerDown = true;
  if (state.tool === "circle") {
    cell.circlePivot = circlePivotFromPointer(cell.localX, cell.localY, cell.cellWidth, cell.cellHeight, state.width, state.height);
    el.statusMessage.textContent = cell.circlePivot.mode === "intersection" ? "Circle: four-pixel intersection pivot" : "Circle: pixel-center pivot";
  }
  dragStart = cell;
  toggledDuringStroke.clear();
  if (shouldMoveSelection) {
    const live = tightenSelectionToLivePixels(currentPlayer().pixels, selection, state.width, state.height);
    if (!live) {
      isPointerDown = false;
      dragStart = null;
      selection = null;
      el.statusMessage.textContent = "The selection contains no live pixels";
      updateSelectionBar();
      renderCanvasSurfaces();
      return;
    }
    pushHistory();
    selection = live;
    movingSelection = true;
    selectionMoveOrigin = { ...selection, pointerX: cell.col, pointerY: cell.row };
    selectionMoveData = extractSelectionPixels(currentPlayer().pixels, selection);
    dragSnapshot = cloneData(currentPlayer().pixels);
    cell.canvas.style.cursor = "grabbing";
    return;
  }
  if (state.tool === "select") {
    pushHistory();
    selectionBeforeDrag = selection ? cloneData(selection) : null;
    selectionDragMode = event.altKey ? "subtract" : (event.shiftKey || event.ctrlKey || event.metaKey) ? "add" : "replace";
    if (selectionDragMode === "replace") selection = null;
    selection = combineSelections(selectionBeforeDrag, selectionFromRect(rectFromPoints(cell, cell)), selectionDragMode);
    updateSelectionBar();
  }
  if (state.tool !== "select" && state.tool !== "picker") pushHistory();
  dragSnapshot = cloneData(currentPlayer().pixels);
  applyToolAt(cell, true);
  renderCanvasSurfaces();
  renderFrames();
}

function movePointer(event) {
  const clampSelectionDrag = isPointerDown && (state.tool === "select" || movingSelection);
  const cell = clampSelectionDrag
    ? cellFromPointer({
        clientX: event.clientX,
        clientY: event.clientY,
        currentTarget: dragStart.canvas,
        target: dragStart.canvas
      }, true)
    : compositionCellFromPointer(event);
  if (!cell) {
    if (!isPointerDown) pointerInsideCanvas = false;
    return;
  }
  if (isPointerDown && dragStart && cell.player !== dragStart.player) return;
  pointerInsideCanvas = true;
  const previousCell = lastCell;
  lastCell = cell;
  if (!isPointerDown) { updateCanvasSelectionCursor(event); return; }
  if (referenceDrag && currentReference()) {
    if (referenceDrag.mode === "scale") {
      const px = event.clientX - referenceDrag.canvasRect.left - referenceDrag.copyOffsetX, py = event.clientY - referenceDrag.canvasRect.top;
      currentReference().scale = Math.max(10, Math.min(500, Math.round(referenceDrag.scale * Math.hypot(px-referenceDrag.centerX, py-referenceDrag.centerY) / referenceDrag.distance)));
    } else {
      const cellW = referenceDrag.cellWidth;
      const cellH = referenceDrag.cellHeight;
      const fine = value => Math.round(value * 20) / 20;
      currentReference().xOffset = Math.max(-100, Math.min(100, fine(referenceDrag.x + (event.clientX - referenceDrag.pointerX) / cellW)));
      currentReference().yOffset = Math.max(-200, Math.min(200, fine(referenceDrag.y + (event.clientY - referenceDrag.pointerY) / cellH)));
    }
    syncControls(); renderEditor(); return;
  }
  if (movingSelection) {
    const maxX = Math.max(0, state.width - selectionMoveOrigin.w);
    const maxY = Math.max(0, state.height - selectionMoveOrigin.h);
    const nx = Math.max(0, Math.min(maxX, selectionMoveOrigin.x + cell.col - selectionMoveOrigin.pointerX));
    const ny = Math.max(0, Math.min(maxY, selectionMoveOrigin.y + cell.row - selectionMoveOrigin.pointerY));
    currentPlayer().pixels = moveMaskedSelectionPixels(dragSnapshot, selectionMoveOrigin, selectionMoveData, nx, ny);
    selection = tightenSelectionToLivePixels(currentPlayer().pixels, { x: nx, y: ny, w: selectionMoveOrigin.w, h: selectionMoveOrigin.h, mask: cloneData(selectionMoveOrigin.mask || fullMask(selectionMoveOrigin.w, selectionMoveOrigin.h)) }, state.width, state.height);
  } else if (["line", "rect", "oval", "circle", "triangle", "triangle-side", "select"].includes(state.tool)) {
    if (state.tool === "select") {
      const pending = selectionFromRect(rectFromPoints(dragStart, cell));
      selection = combineSelections(selectionBeforeDrag, pending, selectionDragMode);
      updateSelectionBar();
    } else {
      currentPlayer().pixels = cloneData(dragSnapshot);
      drawShape(dragStart, cell);
    }
  } else {
    const strokeTool = rightEraseStroke && state.tool === "pencil" ? "eraser" : state.tool;
    if (["pencil", "eraser"].includes(strokeTool) && previousCell?.player === cell.player) {
      const value = strokeTool === "eraser" ? 0 : 1;
      rasterLineCells(previousCell.col, previousCell.row, cell.col, cell.row).forEach(([x, y]) => setBrushPixel(x, y, value));
    } else {
      applyToolAt(cell, false);
    }
  }
  renderCanvasSurfaces();
  renderFrames();
  updateSelectionBar();
}

function endPointer() {
  const finishRowColorStroke = isPaintingRowColors;
  isPointerDown = false;
  movingSelection = false;
  selectionMoveOrigin = null;
  selectionMoveData = null;
  [el.spriteCanvas, el.spriteCanvas1].forEach(canvas => { if (canvas) canvas.style.cursor = state.tool === "select" ? "crosshair" : ""; });
  dragStart = null;
  dragSnapshot = null;
  isSelectingColors = false;
  colorSelectionAnchor = null;
  isPaintingColorBlock = false;
  isPaintingRowColors = false;
  rowColorStroke = null;
  rightEraseStroke = false;
  selectionBeforeDrag = null;
  referenceDrag = null;
  if (finishRowColorStroke) renderRowColors();
  [el.spriteCanvas, el.spriteCanvas1].forEach(canvas => { if (canvas) canvas.style.cursor = referenceTransformActive ? "grab" : (state.tool === "select" ? "crosshair" : ""); });
}

function applyToolAt(cell, isStart) {
  const tool = rightEraseStroke && state.tool === "pencil" ? "eraser" : state.tool;
  if (tool === "picker") {
    const player = currentFrame().players[cell.player];
    state.currentColor = usesSolidColor() ? player.solidColor : player.colors[cell.row];
    paletteEyedropperArmed = false;
    state.tool = "pencil";
    syncControls();
    renderAll();
    return;
  }
  if (tool === "color") {
    currentFrame().players[cell.player].colors[cell.row] = state.currentColor;
    return;
  }
  if (tool === "fill" && isStart) {
    const result = floodFillPixels(currentPlayer().pixels, cell.col, cell.row, rightEraseStroke ? 0 : 1);
    currentPlayer().pixels = result.pixels;
    return;
  }
  if (tool === "stamp") {
    const key = `stamp:${cell.col},${cell.row}`;
    if (toggledDuringStroke.has(key)) return;
    toggledDuringStroke.add(key);
    placeStamp(cell.col, cell.row);
    return;
  }
  if (tool === "toggle") {
    const key = `${cell.col},${cell.row}`;
    if (toggledDuringStroke.has(key)) return;
    toggledDuringStroke.add(key);
    setPixel(cell.col, cell.row, currentPlayer().pixels[cell.row][cell.col] ? 0 : 1);
    return;
  }
  if (tool === "eraser") setBrushPixel(cell.col, cell.row, 0);
  if (tool === "pencil") setBrushPixel(cell.col, cell.row, 1);
}

function setBrushPixel(x, y, value) {
  brushCells(x, y, state.brushWidth, state.brushHeight, state.width, state.height).forEach(([tx, ty]) => setPixel(tx, ty, value));
}

function setPixel(x, y, value) {
  if (x < 0 || x >= state.width || y < 0 || y >= state.height) return;
  currentPlayer().pixels[y][x] = value ? 1 : 0;
  if (state.mirrorDraw) currentPlayer().pixels[y][state.width - 1 - x] = value ? 1 : 0;
}

function rectFromPoints(a, b) {
  const x = Math.min(a.col, b.col);
  const y = Math.min(a.row, b.row);
  return { x, y, w: Math.abs(a.col - b.col) + 1, h: Math.abs(a.row - b.row) + 1 };
}

function fullMask(w, h, value = true) {
  return fullSelectionMask(w, h, value);
}

function selectionFromRect(rect) {
  return selectionFromRectangle(rect);
}

function selectionToGlobalMask(item) {
  return selectionToMask(item, 8, state.height);
}

function selectionFromGlobalMask(mask) {
  return selectionFromMask(mask);
}

function combineSelections(base, incoming, mode) {
  return combineRasterSelections(base, incoming, mode, 8, state.height);
}

function moveMaskedSelectionPixels(snapshotPixels, origin, data, nx, ny) {
  const out = cloneData(snapshotPixels);
  const mask = origin.mask || fullMask(origin.w, origin.h);
  for (let y = 0; y < origin.h; y++) for (let x = 0; x < origin.w; x++) if (mask[y]?.[x]) {
    const oy = origin.y + y, ox = origin.x + x;
    if (out[oy]) out[oy][ox] = 0;
  }
  for (let y = 0; y < origin.h; y++) for (let x = 0; x < origin.w; x++) if (mask[y]?.[x]) {
    const ty = ny + y, tx = nx + x;
    if (out[ty] && tx >= 0 && tx < (out[ty]?.length || 0)) out[ty][tx] = data[y]?.[x] ? 1 : 0;
  }
  return out;
}

function drawShape(a, b) {
  if (state.tool === "line") drawLine(a.col, a.row, b.col, b.row, 1);
  if (state.tool === "rect") drawRect(rectFromPoints(a, b), state.fillShapes);
  if (state.tool === "oval") drawOval(rectFromPoints(a, b), state.fillShapes);
  if (state.tool === "circle") {
    const base = layout();
    const cellWidth = base.cellW * NUSIZ[currentPlayer().nusiz].scale;
    const pivot = a.circlePivot || { x: a.col, y: a.row };
    const { cells } = visualCircleCells(pivot.x, pivot.y, b.col, b.row, cellWidth, base.cellH, state.fillShapes);
    cells.forEach(([x, y]) => (state.fillShapes ? setPixel : setBrushPixel)(x, y, 1));
  }
  if (state.tool === "triangle") drawTriangle(rectFromPoints(a, b), false, state.fillShapes);
  if (state.tool === "triangle-side") drawTriangle(rectFromPoints(a, b), true, state.fillShapes);
}

function drawLine(x0, y0, x1, y1, value) {
  rasterLineCells(x0, y0, x1, y1).forEach(([x, y]) => setBrushPixel(x, y, value));
}

function drawRect(r, filled) {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      if (filled) setPixel(x, y, 1);
    }
  }
  if (!filled) {
    drawLine(r.x, r.y, r.x + r.w - 1, r.y, 1);
    drawLine(r.x, r.y + r.h - 1, r.x + r.w - 1, r.y + r.h - 1, 1);
    drawLine(r.x, r.y, r.x, r.y + r.h - 1, 1);
    drawLine(r.x + r.w - 1, r.y, r.x + r.w - 1, r.y + r.h - 1, 1);
  }
}

function drawOval(r, filled) {
  const cx = r.x + (r.w - 1) / 2;
  const cy = r.y + (r.h - 1) / 2;
  const rx = Math.max(.5, r.w / 2);
  const ry = Math.max(.5, r.h / 2);
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const n = ((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2);
      if (filled ? n <= 1.08 : n <= 1.18 && n >= .58) (filled ? setPixel : setBrushPixel)(x, y, 1);
    }
  }
}

function drawTriangle(r, sideways, filled) {
  const points = sideways
    ? [[r.x, r.y], [r.x, r.y + r.h - 1], [r.x + r.w - 1, r.y + Math.floor((r.h - 1) / 2)]]
    : [[r.x, r.y + r.h - 1], [r.x + r.w - 1, r.y + r.h - 1], [r.x + Math.floor((r.w - 1) / 2), r.y]];
  if (!filled) {
    drawLine(...points[0], ...points[1], 1);
    drawLine(...points[1], ...points[2], 1);
    drawLine(...points[2], ...points[0], 1);
    return;
  }
  const [a, b, c] = points;
  const area = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (!area) return;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const wa = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / area;
    const wb = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / area;
    const wc = 1 - wa - wb;
    if (wa >= 0 && wb >= 0 && wc >= 0) setPixel(x, y, 1);
  }
}

function pointInSelection(cell, rect) {
  return selectionContains(rect, cell.col, cell.row);
}

function floodFillColorRows(y, playerIndex = state.activePlayer, erase = false) {
  const player = currentFrame().players[playerIndex];
  const result = floodFillScanlines(player.colors, y, erase ? "$00" : state.currentColor);
  if (!result.changed) return;
  player.colors = result.colors;
  renderRowColors();
  renderEditor();
  if (!playbackThumbnailCollapsed) renderPlaybackThumbnail();
  if (el.previewCanvas) renderPreview();
}

function renderRowColors() {
  el.editorZone.classList.toggle("show-grid", state.showGrid);
  const showColumns = state.showColorColumns;
  el.compositionColorColumns.classList.toggle("hidden", !showColumns);
  [0, 1].forEach(playerIndex => {
    const column = el[`p${playerIndex}ColorsColumn`];
    column.classList.toggle("hidden", !showColumns || (!state.twoSpriteMode && playerIndex !== state.activePlayer));
    renderPlayerRowColors(playerIndex, el[`rowColors${playerIndex}`]);
  });
  el.newColorBlock.textContent = colorSelection ? "Create Color Block" : "+ New Color Block";
}

function renderPlayerRowColors(playerIndex, container) {
  container.innerHTML = "";
  const player = currentFrame().players[playerIndex];
  const l = layout(playerIndex);
  const height = playerHeight(currentFrame(), playerIndex);
  container.style.height = `${l.h}px`;
  container.style.display = "grid";
  container.style.gridTemplateRows = `repeat(${height}, minmax(0, 1fr))`;
  for (let y = 0; y < height; y++) {
    const row = document.createElement("div");
    row.className = "color-row";
    row.dataset.row = y;
    row.innerHTML = `<span>${y}</span><div></div>`;
    row.style.height = "auto";
    const previewBlock = activeColorBlockIndex === null ? null : state.colorBlocks[activeColorBlockIndex];
    const previewOffset = colorBlockHoverRow === null ? -1 : y - colorBlockHoverRow;
    const previewCode = previewBlock && previewOffset >= 0 && previewOffset < previewBlock.colors.length ? colorBlockColor(previewBlock, previewOffset) : null;
    row.lastElementChild.style.background = colorHex(previewCode || player.colors[y]);
    if (previewCode) row.classList.add("placement-preview");
    row.title = `Row ${y}: ${player.colors[y]}`;
    row.addEventListener("pointerdown", e => {
      e.preventDefault();
      if (state.activePlayer !== playerIndex) {
        state.activePlayer = playerIndex;
        selection = null;
        syncControls();
      }
      if (paletteEyedropperArmed) {
        state.currentColor = player.colors[y];
        paletteEyedropperArmed = false;
        state.tool = "pencil";
        syncControls();
        renderAll();
      } else if (state.tool === "select" && activeColorBlockIndex === null) {
        colorSelectionAnchor = y;
        colorSelectionBefore = colorSelection?.player === playerIndex ? cloneData(colorSelection) : null;
        colorSelectionMode = e.altKey ? "subtract" : (e.shiftKey || e.ctrlKey || e.metaKey) ? "add" : "replace";
        const mask = colorSelectionMode === "replace" ? Array(height).fill(false) : (colorSelectionBefore?.mask?.slice() || Array(height).fill(false));
        mask[y] = colorSelectionMode === "subtract" ? false : true;
        colorSelection = { player: playerIndex, mask, start: y, end: y };
        isSelectingColors = true;
        renderRowColors();
      } else if (state.tool === "fill" && activeColorBlockIndex === null) {
        pushHistory();
        floodFillColorRows(y, playerIndex, e.button === 2);
      } else if (activeColorBlockIndex !== null) {
        pushHistory();
        isPaintingColorBlock = true;
        applyColorBlock(activeColorBlockIndex, y, false, playerIndex);
      } else {
        pushHistory();
        isPaintingRowColors = true;
        rowColorStroke = { player: playerIndex, lastRow: y };
        paintRowColor(y, playerIndex, row);
      }
    });
    row.addEventListener("pointermove", e => {
      colorBlockHoverRow = y;
      if (isSelectingColors && e.buttons) {
        const mask = colorSelectionMode === "replace" ? Array(height).fill(false) : (colorSelectionBefore?.mask?.slice() || Array(height).fill(false));
        const start = Math.min(colorSelectionAnchor, y), end = Math.max(colorSelectionAnchor, y);
        for (let rowIndex = start; rowIndex <= end; rowIndex++) mask[rowIndex] = colorSelectionMode === "subtract" ? false : true;
        colorSelection = mask.some(Boolean) ? { player: playerIndex, mask, start, end } : null;
        renderRowColors();
      } else if (isPaintingColorBlock && e.buttons && activeColorBlockIndex !== null) {
        applyColorBlock(activeColorBlockIndex, y, false, playerIndex);
      } else if (activeColorBlockIndex !== null && !e.buttons) renderRowColors();
      else if (isPaintingRowColors && e.buttons && activeColorBlockIndex === null && rowColorStroke?.player === playerIndex) {
        paintRowColorRange(rowColorStroke.lastRow, y, playerIndex);
        rowColorStroke.lastRow = y;
      }
    });
    row.addEventListener("pointerleave", () => {
      if (activeColorBlockIndex !== null) { colorBlockHoverRow = null; renderRowColors(); }
    });
    row.addEventListener("contextmenu", e => {
      e.preventDefault();
      if (state.tool === "fill" && activeColorBlockIndex === null) return;
      state.currentColor = player.colors[y];
      syncControls();
    });
    container.appendChild(row);
  }
  renderColorSelectionOverlay(container, playerIndex, l.cellH);
}

function renderColorSelectionOverlay(container, playerIndex, cellH) {
  if (colorSelection?.player !== playerIndex) return;
  const mask = colorSelection.mask || [];
  let start = null;
  for (let y = 0; y <= state.height; y++) {
    if (mask[y] && start === null) start = y;
    if ((!mask[y] || y === state.height) && start !== null) {
      const overlay = document.createElement("div");
      overlay.className = "scanline-selection-overlay";
      overlay.style.top = `${start * cellH}px`;
      overlay.style.height = `${(y - start) * cellH}px`;
      container.appendChild(overlay);
      start = null;
    }
  }
}

function paintRowColor(y, playerIndex = state.activePlayer, rowElement = null) {
  paintRowColorRange(y, y, playerIndex);
}

function scanlineStrokeRows(fromRow, toRow, height) {
  return rasterLineCells(0, fromRow, 0, toRow)
    .map(([, y]) => y)
    .filter(y => y >= 0 && y < height);
}

function paintRowColorRange(fromRow, toRow, playerIndex = state.activePlayer) {
  const color = normalizeCode(state.currentColor, "$48");
  const player = currentFrame().players[playerIndex];
  const height = playerHeight(currentFrame(), playerIndex);
  scanlineStrokeRows(fromRow, toRow, height).forEach(y => {
    player.colors[y] = color;

    // Rows are rebuilt by several independent UI updates (palette, frames, assets).
    // Resolve every live row again instead of retaining a stale pointer target.
    const liveRow = el[`rowColors${playerIndex}`]?.querySelector(`.color-row[data-row="${y}"]`);
    if (!liveRow) return;
    liveRow.lastElementChild.style.background = colorHex(color);
    liveRow.title = `Row ${y}: ${color}`;
  });
  renderEditor();
  if (!playbackThumbnailCollapsed) renderPlaybackThumbnail();
  if (el.previewCanvas) renderPreview();
  renderFrames();
}

function reconcileRenderedRowColors() {
  // Palette hover must never use the transient paint color as a row preview.
  // Reconcile the already rendered scanline swatches from the authoritative frame
  // data without rebuilding them or disturbing an armed Color Block preview.
  if (activeColorBlockIndex !== null) return;
  [0, 1].forEach(playerIndex => {
    const player = currentFrame().players[playerIndex];
    el[`rowColors${playerIndex}`]?.querySelectorAll(".color-row[data-row]").forEach(row => {
      const y = Number(row.dataset.row);
      const color = normalizeCode(player.colors[y], "$48");
      row.lastElementChild.style.background = colorHex(color);
      row.title = `Row ${y}: ${color}`;
    });
  });
}

function renderAtariPaletteGrid(container, selectedCode, selectColor, ariaPrefix) {
  container.innerHTML = "";
  const palette = paletteForRegion(state.region);
  const corner = document.createElement("div");
  corner.className = "palette-axis-label";
  corner.textContent = "$";
  container.appendChild(corner);
  ["0", "2", "4", "6", "8", "A", "C", "E"].forEach(lum => {
    const label = document.createElement("div");
    label.className = "palette-axis-label";
    label.textContent = lum;
    container.appendChild(label);
  });
  const hues = [...new Set(displayCodesForRegion(state.region).map(code => code[1]))];
  for (const hueCode of hues) {
    const hue = parseInt(hueCode, 16);
    const rowLabel = document.createElement("div");
    rowLabel.className = "palette-axis-label";
    rowLabel.textContent = hue.toString(16).toUpperCase();
    container.appendChild(rowLabel);
    for (let lum = 0; lum <= 0xE; lum += 2) {
      const code = `$${hue.toString(16).toUpperCase()}${lum.toString(16).toUpperCase()}`;
      if (!palette[code]) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `persistent-swatch${code === selectedCode ? " active selected" : ""}`;
      btn.style.setProperty("--swatch-color", palette[code]);
      btn.style.background = palette[code];
      btn.title = code;
      btn.setAttribute("aria-label", `${ariaPrefix} ${code}`);
      btn.addEventListener("click", () => selectColor(code));
      container.appendChild(btn);
    }
  }
}

function renderPalette() {
  renderAtariPaletteGrid(el.palette, state.currentColor, code => {
      // A palette click must always close a completed scanline stroke before any
      // palette/project rerender replaces the color-column DOM.
      if (isPaintingRowColors) {
        isPaintingRowColors = false;
        renderRowColors();
      }
      state.currentColor = code;
      if (usesSolidColor()) currentPlayer().solidColor = code;
      paletteEyedropperArmed = false;
      syncControls();
      renderAll();
  }, "Paint color");
}

function positionBgPalette() {
  if (el.bgColorPopover.hidden) return;
  const anchor = el.bgColorPicker.getBoundingClientRect();
  const popover = el.bgColorPopover;
  popover.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - popover.offsetWidth - 8))}px`;
  popover.style.top = `${Math.max(8, Math.min(anchor.bottom + 5, window.innerHeight - popover.offsetHeight - 8))}px`;
}

function renderBgPalette() {
  if (!el.bgPalette) return;
  renderAtariPaletteGrid(el.bgPalette, state.background, code => {
    state.background = code;
    el.bgColorPopover.hidden = true;
    syncControls();
    renderAll();
  }, "Background color");
  positionBgPalette();
}

function resetAnimationWorkspaceTransientState() {
  if (playbackRunning) {
    clearTimeout(playTimer);
    playTimer = null;
    playbackRunning = false;
    syncPlaybackButton();
  }
  selection = null;
  colorSelection = null;
  rotationSession = null;
  referenceTransformActive = false;
  framePointerSession = null;
  suppressFrameClick = false;
  selectedFrames = new Set([state.currentFrame]);
  frameSelectionAnchor = state.currentFrame;
}

function switchAnimation(animationId) {
  if (!animationId || animationId === state.activeAnimationId) {
    el.animationMenu.classList.add("hidden");
    el.animationName.setAttribute("aria-expanded", "false");
    el.toggleAnimationMenu.setAttribute("aria-expanded", "false");
    return;
  }
  syncActiveAnimation(state);
  loadAnimationWorkspace(state, animationId);
  normalizeProject();
  resetAnimationWorkspaceTransientState();
  el.animationMenu.classList.add("hidden");
  el.animationName.setAttribute("aria-expanded", "false");
  el.toggleAnimationMenu.setAttribute("aria-expanded", "false");
  syncControls();
  renderAll();
}

function commitAnimationName() {
  const requested = el.animationName.value;
  const current = state.animations.find(animation => animation.id === state.activeAnimationId);
  const nextName = uniqueAnimationName(state, requested, state.activeAnimationId);
  if (nextName === state.animationName) { el.animationName.value = nextName; return; }
  pushHistory();
  state.animationName = nextName;
  if (current) current.name = nextName;
  syncActiveAnimation(state);
  syncControls();
  renderAll();
}

function blankAnimationRecord() {
  const source = currentFrame();
  const frame = makeFrame(source.height, 0, source.width, source.duration);
  frame.players.forEach((player, slot) => {
    const sourcePlayer = source.players[slot];
    player.nusiz = sourcePlayer.nusiz;
    player.xOffset = sourcePlayer.xOffset;
    player.yOffset = sourcePlayer.yOffset;
    player.solidColor = state.currentColor;
    player.colors = Array(frame.height).fill(state.currentColor);
  });
  return {
    id: nextAnimationId(state),
    name: uniqueAnimationName(state, "Untitled Animation"),
    frames: [frame],
    currentFrame: 0,
    twoSpriteMode: state.twoSpriteMode,
    activePlayer: state.activePlayer,
    playerAssignments: cloneData(state.playerAssignments)
  };
}

function addAnimation() {
  pushHistory();
  const animation = blankAnimationRecord();
  state.animations.push(animation);
  loadAnimationWorkspace(state, animation.id);
  resetAnimationWorkspaceTransientState();
  syncControls();
  renderAll();
  requestAnimationFrame(() => { el.animationName.focus(); el.animationName.select(); });
}

function duplicateAnimation() {
  pushHistory();
  const duplicate = duplicateAnimationRecord(state);
  state.animations.push(duplicate);
  loadAnimationWorkspace(state, duplicate.id);
  resetAnimationWorkspaceTransientState();
  syncControls();
  renderAll();
}

function deleteAnimation() {
  ensureAnimationCollection(state);
  if (state.animations.length <= 1) return;
  const index = state.animations.findIndex(animation => animation.id === state.activeAnimationId);
  if (!confirm(`Delete animation “${state.animationName}”?`)) return;
  pushHistory();
  state.animations.splice(index, 1);
  const replacement = state.animations[Math.min(index, state.animations.length - 1)];
  loadAnimationWorkspace(state, replacement.id);
  resetAnimationWorkspaceTransientState();
  syncControls();
  renderAll();
}

function renderAnimationMenu() {
  ensureAnimationCollection(state);
  el.animationMenu.replaceChildren();
  state.animations.forEach(animation => {
    const button = document.createElement("button");
    button.type = "button";
    button.role = "option";
    button.dataset.animationId = animation.id;
    button.textContent = animation.name;
    button.setAttribute("aria-selected", String(animation.id === state.activeAnimationId));
    button.addEventListener("click", () => switchAnimation(animation.id));
    el.animationMenu.appendChild(button);
  });
  el.deleteAnimation.disabled = state.animations.length <= 1;
}

function selectTimelineFrame(index, modifiers = {}) {
  if (modifiers.shiftKey) {
    const start = Math.min(frameSelectionAnchor, index), end = Math.max(frameSelectionAnchor, index);
    selectedFrames = new Set(Array.from({ length: end - start + 1 }, (_, offset) => start + offset));
  } else if (modifiers.ctrlKey || modifiers.metaKey) {
    if (selectedFrames.has(index) && selectedFrames.size > 1) selectedFrames.delete(index);
    else selectedFrames.add(index);
    frameSelectionAnchor = index;
  } else {
    selectedFrames = new Set([index]);
    frameSelectionAnchor = index;
  }
  state.currentFrame = index;
  rotationSession = null;
  selection = null;
  syncControls();
  renderAll();
}

function renderFrames() {
  el.framesList.innerHTML = "";
  selectedFrames = new Set([...selectedFrames].filter(index => index >= 0 && index < state.frames.length));
  state.frames.forEach((frame, index) => {
    const item = document.createElement("div");
    item.className = `frame-thumb${index === state.currentFrame ? " active" : ""}${selectedFrames.has(index) ? " selected" : ""}`;
    item.dataset.index = index;
    const canvas = document.createElement("canvas");
    canvas.width = 84;
    canvas.height = 64;
    drawFrameThumb(canvas, frame);
    const label = document.createElement("div");
    label.className = "frame-thumb-label";
    label.innerHTML = `<span>${index + 1}</span><span title="Frame repeat: ${frame.duration}" aria-label="Frame repeat: ${frame.duration}">x${frame.duration}</span>`;
    item.append(canvas, label);
    item.addEventListener("click", event => {
      if (suppressFrameClick) return;
      selectTimelineFrame(index, event);
    });
    el.framesList.appendChild(item);
  });
}

function reorderSelectedFrames(targetSlot) {
  const result = reorderSelectedFrameBlock(state.frames, selectedFrames, targetSlot, state.currentFrame);
  if (result.frames.every((frame, index) => frame === state.frames[index])) return;
  pushHistory();
  state.frames = result.frames;
  selectedFrames = new Set(result.selectedIndices);
  state.currentFrame = result.currentIndex;
  frameSelectionAnchor = state.currentFrame;
  renderAll();
}

function updateFrameSelectionClasses() {
  el.framesList.querySelectorAll(".frame-thumb").forEach(item => item.classList.toggle("selected", selectedFrames.has(Number(item.dataset.index))));
}

function timelineContentPoint(event) {
  const rect = el.framesList.getBoundingClientRect();
  return { x: event.clientX - rect.left + el.framesList.scrollLeft, y: event.clientY - rect.top + el.framesList.scrollTop, rect };
}

function timelineAutoScroll(clientX) {
  const rect = el.framesList.getBoundingClientRect();
  if (clientX < rect.left + 34) el.framesList.scrollLeft -= 14;
  else if (clientX > rect.right - 34) el.framesList.scrollLeft += 14;
}

function timelineDropSlot(clientX) {
  const items = [...el.framesList.querySelectorAll(".frame-thumb")];
  const x = clientX + el.framesList.scrollLeft;
  const listLeft = el.framesList.getBoundingClientRect().left;
  for (let slot = 0; slot < items.length; slot++) {
    const rect = items[slot].getBoundingClientRect();
    const midpoint = rect.left - listLeft + el.framesList.scrollLeft + rect.width / 2;
    if (x < midpoint) return slot;
  }
  return items.length;
}

function showTimelineDropIndicator(slot) {
  el.framesList.querySelector(".timeline-drop-indicator")?.remove();
  const items = [...el.framesList.querySelectorAll(".frame-thumb")];
  if (!items.length) return;
  const marker = document.createElement("div");
  marker.className = "timeline-drop-indicator";
  const left = slot <= 0 ? items[0].offsetLeft - 4 : slot >= items.length ? items.at(-1).offsetLeft + items.at(-1).offsetWidth + 4 : items[slot].offsetLeft - 4;
  marker.style.left = `${left}px`;
  el.framesList.appendChild(marker);
}

function beginTimelinePointer(event) {
  if (event.button !== 0) return;
  const item = event.target.closest(".frame-thumb");
  const point = timelineContentPoint(event);
  el.framesList.setPointerCapture(event.pointerId);
  if (item) {
    framePointerSession = { type: "reorder", pointerId: event.pointerId, index: Number(item.dataset.index), startX: event.clientX, startY: event.clientY, active: false, targetSlot: null, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey };
    return;
  }
  event.preventDefault();
  const mode = event.altKey ? "subtract" : (event.shiftKey || event.ctrlKey || event.metaKey) ? "add" : "replace";
  framePointerSession = { type: "marquee", pointerId: event.pointerId, startX: point.x, startY: point.y, mode, before: new Set(selectedFrames), active: false };
}

function moveTimelinePointer(event) {
  if (!framePointerSession || framePointerSession.pointerId !== event.pointerId) return;
  if (framePointerSession.type === "reorder") {
    const distance = Math.hypot(event.clientX - framePointerSession.startX, event.clientY - framePointerSession.startY);
    if (!framePointerSession.active && distance < 5) return;
    event.preventDefault();
    if (!framePointerSession.active) {
      framePointerSession.active = true;
      if (!selectedFrames.has(framePointerSession.index)) {
        selectedFrames = new Set([framePointerSession.index]);
        state.currentFrame = framePointerSession.index;
        updateFrameSelectionClasses();
      }
      el.framesList.classList.add("reordering");
    }
    timelineAutoScroll(event.clientX);
    framePointerSession.targetSlot = timelineDropSlot(event.clientX - el.framesList.getBoundingClientRect().left);
    showTimelineDropIndicator(framePointerSession.targetSlot);
    return;
  }
  const point = timelineContentPoint(event);
  const distance = Math.hypot(point.x - framePointerSession.startX, point.y - framePointerSession.startY);
  if (!framePointerSession.active && distance < 4) return;
  event.preventDefault();
  framePointerSession.active = true;
  timelineAutoScroll(event.clientX);
  let marquee = el.framesList.querySelector(".timeline-marquee");
  if (!marquee) { marquee = document.createElement("div"); marquee.className = "timeline-marquee"; el.framesList.appendChild(marquee); }
  const x = Math.min(framePointerSession.startX, point.x), y = Math.min(framePointerSession.startY, point.y);
  const w = Math.abs(point.x - framePointerSession.startX), h = Math.abs(point.y - framePointerSession.startY);
  Object.assign(marquee.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  const hits = [...el.framesList.querySelectorAll(".frame-thumb")].filter(item => item.offsetLeft < x + w && item.offsetLeft + item.offsetWidth > x && item.offsetTop < y + h && item.offsetTop + item.offsetHeight > y).map(item => Number(item.dataset.index));
  const next = framePointerSession.mode === "replace" ? new Set() : new Set(framePointerSession.before);
  hits.forEach(index => framePointerSession.mode === "subtract" ? next.delete(index) : next.add(index));
  selectedFrames = next;
  updateFrameSelectionClasses();
}

function endTimelinePointer(event) {
  if (!framePointerSession || framePointerSession.pointerId !== event.pointerId) return;
  const session = framePointerSession;
  framePointerSession = null;
  if (el.framesList.hasPointerCapture?.(event.pointerId)) el.framesList.releasePointerCapture(event.pointerId);
  el.framesList.classList.remove("reordering");
  el.framesList.querySelector(".timeline-drop-indicator")?.remove();
  el.framesList.querySelector(".timeline-marquee")?.remove();
  if (session.type === "reorder" && session.active) {
    suppressFrameClick = true;
    setTimeout(() => { suppressFrameClick = false; }, 0);
    reorderSelectedFrames(session.targetSlot ?? state.frames.length);
    return;
  }
  if (session.type === "reorder") {
    // Pointer capture can retarget the synthetic click to the list after a
    // rerender (notably after duplication). Select here so individual frame
    // clicks remain reliable, then suppress the redundant click event.
    suppressFrameClick = true;
    setTimeout(() => { suppressFrameClick = false; }, 0);
    selectTimelineFrame(session.index, session);
    return;
  }
  if (session.type === "marquee") {
    suppressFrameClick = true;
    setTimeout(() => { suppressFrameClick = false; }, 0);
    if (!session.active) selectedFrames.clear();
    if (selectedFrames.size && !selectedFrames.has(state.currentFrame)) state.currentFrame = [...selectedFrames].sort((a, b) => a - b)[0];
    frameSelectionAnchor = state.currentFrame;
    renderAll();
  }
}

function drawFrameThumb(canvas, frame) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = colorHex(state.background);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (state.twoSpriteMode) {
    const widths = frame.players.map((_, slot) => playerWidth(frame, slot));
    const heights = frame.players.map((_, slot) => playerHeight(frame, slot));
    const spans = frame.players.map((player, slot) => renderedSpriteSpan(widths[slot], player.nusiz));
    const horizontalGeometry = centeredCompositionGeometry(state.width, frame.players.map((player, slot) => ({ ...player, width: widths[slot] })));
    const starts = horizontalGeometry.starts;
    const minX = horizontalGeometry.minX;
    const maxX = horizontalGeometry.maxX;
    const minY = Math.min(frame.players[0].yOffset, frame.players[1].yOffset);
    const maxY = Math.max(frame.players[0].yOffset + heights[0], frame.players[1].yOffset + heights[1]);
    const geometry = timelineThumbnailGeometry(canvas.width, canvas.height, Math.max(1, maxX - minX), Math.max(1, maxY - minY), state.verticalStretch, 4, 1);
    [0, 1].sort((a, b) => playerLayerPriority(a) - playerLayerPriority(b) || a - b).forEach(index => {
      const player = frame.players[index];
      drawThumbPlayer(ctx, player,
        geometry.x + (starts[index] - minX) * geometry.cellW,
        geometry.y + (player.yOffset - minY) * geometry.cellH,
        geometry.cellW, geometry.cellH, heights[index], widths[index]);
    });
  } else {
    const player = frame.players[state.activePlayer];
    const rows = playerHeight(frame, state.activePlayer);
    const columns = playerWidth(frame, state.activePlayer);
    const span = renderedSpriteSpan(columns, player.nusiz);
    const geometry = timelineThumbnailGeometry(canvas.width, canvas.height, span, rows, state.verticalStretch, 4, 1);
    drawThumbPlayer(ctx, player, geometry.x, geometry.y, geometry.cellW, geometry.cellH, rows, columns);
  }
}

function drawThumbPlayer(ctx, player, ox, oy, unitW, py, rows = state.height, columns = state.width) {
  const mode = nusizMode(player.nusiz);
  mode.copyOrigins.forEach(copyOrigin => {
    for (let y = 0; y < rows; y++) {
      ctx.fillStyle = colorHex(["STANDARD", "MULTISPRITE"].includes(state.kernel) ? player.solidColor : player.colors[y]);
      for (let x = 0; x < columns; x++) if (player.pixels[y]?.[x]) {
        const left = Math.round(ox + (copyOrigin + x * mode.scale) * unitW);
        const right = Math.round(ox + (copyOrigin + (x + 1) * mode.scale) * unitW);
        const top = Math.round(oy + y * py);
        const bottom = Math.round(oy + (y + 1) * py);
        ctx.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
      }
    }
  });
}

function renderAssets() {
  renderColorBlocks();
  renderStamps();
}

function renderColorBlocks() {
  el.colorBlocks.innerHTML = "";
  state.colorBlocks.forEach((block, index) => {
    const item = document.createElement("div");
    item.className = `stamp-item asset-item${index === activeColorBlockIndex ? " active" : ""}`;
    const preview = document.createElement("div");
    preview.className = "color-block-preview asset-preview";
    block.colors.forEach((code, y) => {
      const row = document.createElement("div");
      row.className = "color-block-preview-row";
      const displayCode = colorBlockColor(block, y);
      row.style.background = colorHex(displayCode);
      row.title = `${y}: ${displayCode}`;
      preview.appendChild(row);
    });
    const remove = document.createElement("button");
    remove.className = "asset-remove";
    remove.textContent = "\u00d7";
    remove.title = "Delete Color Block";
    remove.addEventListener("click", event => { event.stopPropagation(); if (confirm("Delete this color block?")) { pushHistory(); state.colorBlocks.splice(index, 1); activeColorBlockIndex = null; renderColorBlocks(); } });
    const edit = document.createElement("button");
    edit.className = "asset-edit";
    edit.title = "Edit Color Block";
    edit.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>';
    edit.addEventListener("click", event => { event.stopPropagation(); openColorBlockEditor(index); });
    item.append(preview, remove, edit);
    item.addEventListener("click", () => {
      activeColorBlockIndex = index;
      activeStampIndex = null;
      state.tool = "color";
      syncControls();
      renderAssets();
      renderRowColors();
      syncReadouts();
    });
    el.colorBlocks.appendChild(item);
  });
}

function renderStamps() {
  el.stamps.innerHTML = "";
  state.stamps.forEach((stamp, index) => {
    const item = document.createElement("div");
    item.className = `stamp-item asset-item${index === activeStampIndex ? " active" : ""}`;
    const canvas = document.createElement("canvas");
    canvas.className = "stamp-preview asset-preview";
    canvas.width = 84;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const player = currentPlayer();
    const span = renderedSpriteSpan(stamp.w, player.nusiz);
    const geometry = timelineThumbnailGeometry(
      canvas.width,
      canvas.height,
      span,
      stamp.h,
      state.verticalStretch,
      4,
      1
    );
    ctx.fillStyle = colorHex(state.currentColor);
    const mode = nusizMode(player.nusiz);
    mode.copyOrigins.forEach(copyOrigin => stamp.pixels.forEach((row, y) => row.forEach((value, x) => {
      if (!value) return;
      const left = Math.round(geometry.x + (copyOrigin + x * mode.scale) * geometry.cellW);
      const right = Math.round(geometry.x + (copyOrigin + (x + 1) * mode.scale) * geometry.cellW);
      const top = Math.round(geometry.y + y * geometry.cellH);
      const bottom = Math.round(geometry.y + (y + 1) * geometry.cellH);
      ctx.fillRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
    })));
    const remove = document.createElement("button");
    remove.className = "asset-remove";
    remove.textContent = "\u00d7";
    remove.title = "Delete Stamp";
    remove.addEventListener("click", event => { event.stopPropagation(); if (confirm("Delete this stamp?")) { pushHistory(); state.stamps.splice(index, 1); activeStampIndex = null; renderStamps(); } });
    const edit = document.createElement("button");
    edit.className = "asset-edit";
    edit.title = "Edit Stamp";
    edit.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>';
    edit.addEventListener("click", event => { event.stopPropagation(); openStampEditor(index); });
    item.append(canvas, remove, edit);
    item.addEventListener("click", () => {
      activeStampIndex = index;
      activeColorBlockIndex = null;
      state.tool = "stamp";
      syncControls();
      renderAssets();
      renderEditor();
      syncReadouts();
    });
    el.stamps.appendChild(item);
  });
}

function openColorBlockEditor(index) {
  editingColorBlockIndex = index;
  const block = index === null ? null : state.colorBlocks[index];
  const colors = block?.colors?.length ? block.colors : Array.from({ length: 8 }, () => state.currentColor);
  el.colorBlockEditorTitle.textContent = index === null ? "Create New Color Block" : "Edit Color Block";
  colorBlockEditorData = colors.map(code => normalizeCode(code, state.currentColor));
  colorBlockEditorHueOffset = Math.max(0, Math.min(15, Number(block?.hueOffset) || 0));
  colorBlockEditorLightnessOffset = Math.max(0, Math.min(7, Number(block?.lightnessOffset) || 0));
  colorBlockEditorHistory = [];
  colorBlockEditorRedoStack = [];
  colorBlockEditorSelection = null;
  el.colorBlockEditorHeight.value = colors.length;
  el.colorBlockHueOffset.value = colorBlockEditorHueOffset;
  el.colorBlockLightnessOffset.value = colorBlockEditorLightnessOffset;
  el.saveColorBlockCopy.classList.toggle("hidden", index === null);
  renderColorBlockEditor();
  el.colorBlockEditor.show();
  positionColorBlockEditor();
  requestAnimationFrame(() => requestAnimationFrame(positionColorBlockEditor));
}

function positionColorBlockEditor() {
  if (!el.colorBlockEditor?.open || !el.palettePanel) return;
  const gap = 8;
  const paletteRect = el.palettePanel.getBoundingClientRect();
  const editorRect = el.colorBlockEditor.getBoundingClientRect();
  let left = paletteRect.left - editorRect.width - gap;
  let top = paletteRect.top;
  if (left < gap) {
    left = Math.max(gap, Math.min(window.innerWidth - editorRect.width - gap, paletteRect.left));
    const below = paletteRect.bottom + gap;
    top = below + editorRect.height <= window.innerHeight - gap ? below : paletteRect.top - editorRect.height - gap;
  }
  top = Math.max(gap, Math.min(window.innerHeight - editorRect.height - gap, top));
  el.colorBlockEditor.style.setProperty("--editor-left", `${Math.round(left)}px`);
  el.colorBlockEditor.style.setProperty("--editor-top", `${Math.round(top)}px`);
}

function addColorBlockEditorRow(code = state.currentColor) {
  const row = document.createElement("div");
  row.className = "color-block-editor-row";
  const swatch = document.createElement("span");
  const input = document.createElement("input");
  input.className = "code-input";
  input.value = normalizeCode(code, state.currentColor);
  swatch.style.background = colorHex(input.value);
  input.addEventListener("input", () => { input.value = input.value.toUpperCase(); swatch.style.background = colorHex(input.value); });
  const remove = document.createElement("button");
  remove.type = "button"; remove.textContent = "×"; remove.title = "Remove row";
  remove.addEventListener("click", () => { if (el.colorBlockEditorRows.children.length > 1) row.remove(); });
  row.append(swatch, input, remove);
  el.colorBlockEditorRows.appendChild(row);
}

function colorBlockEditorSnapshot() {
  return { colors: cloneData(colorBlockEditorData), hueOffset: colorBlockEditorHueOffset, lightnessOffset: colorBlockEditorLightnessOffset, selection: colorBlockEditorSelection ? { ...colorBlockEditorSelection } : null };
}

function restoreColorBlockEditorSnapshot(snap) {
  colorBlockEditorData = cloneData(snap.colors);
  colorBlockEditorHueOffset = snap.hueOffset;
  colorBlockEditorLightnessOffset = snap.lightnessOffset;
  colorBlockEditorSelection = snap.selection ? { ...snap.selection } : null;
  el.colorBlockEditorHeight.value = colorBlockEditorData.length;
  el.colorBlockHueOffset.value = colorBlockEditorHueOffset;
  el.colorBlockLightnessOffset.value = colorBlockEditorLightnessOffset;
  renderColorBlockEditor();
}

function pushColorBlockEditorHistory() {
  colorBlockEditorHistory.push(colorBlockEditorSnapshot());
  colorBlockEditorRedoStack = [];
}

function undoColorBlockEditor() {
  const snap = colorBlockEditorHistory.pop();
  if (!snap) return;
  colorBlockEditorRedoStack.push(colorBlockEditorSnapshot());
  restoreColorBlockEditorSnapshot(snap);
}

function redoColorBlockEditor() {
  const snap = colorBlockEditorRedoStack.pop();
  if (!snap) return;
  colorBlockEditorHistory.push(colorBlockEditorSnapshot());
  restoreColorBlockEditorSnapshot(snap);
}

function renderColorBlockEditor() {
  el.colorBlockHueOffsetValue.textContent = colorBlockEditorHueOffset;
  el.colorBlockLightnessOffsetValue.textContent = colorBlockEditorLightnessOffset;
  el.colorBlockEditorLines.innerHTML = "";
  const start = colorBlockEditorSelection ? Math.min(colorBlockEditorSelection.start, colorBlockEditorSelection.end) : -1;
  const end = colorBlockEditorSelection ? Math.max(colorBlockEditorSelection.start, colorBlockEditorSelection.end) : -1;
  colorBlockEditorData.forEach((code, index) => {
    const line = document.createElement("div");
    line.className = `color-block-editor-line${index >= start && index <= end ? " selected" : ""}`;
    line.dataset.row = index;
    line.style.background = colorHex(transformAtariColor(code, colorBlockEditorHueOffset, colorBlockEditorLightnessOffset));
    line.title = `${index}: ${code}`;
    el.colorBlockEditorLines.appendChild(line);
  });
}

function resizeColorBlockEditor() {
  const height = Math.max(1, Math.min(255, Number(el.colorBlockEditorHeight.value) || 1));
  if (height === colorBlockEditorData.length) return;
  pushColorBlockEditorHistory();
  colorBlockEditorData = Array.from({ length: height }, (_, index) => colorBlockEditorData[index] || state.currentColor);
  colorBlockEditorSelection = null;
  renderColorBlockEditor();
}

function colorBlockEditorLineFromEvent(event) {
  const line = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".color-block-editor-line");
  return line && el.colorBlockEditorLines.contains(line) ? Number(line.dataset.row) : -1;
}

function paintColorBlockEditorLine(index) {
  if (index < 0 || index >= colorBlockEditorData.length || colorBlockEditorPointer?.visited?.has(index)) return;
  colorBlockEditorPointer?.visited?.add(index);
  colorBlockEditorData[index] = colorBlockEditorPointer?.erase ? "$00" : state.currentColor;
  renderColorBlockEditor();
}

function fillColorBlockEditor(index) {
  const from = colorBlockEditorData[index];
  const to = state.currentColor;
  if (from === to) return;
  for (let y = index; y >= 0 && colorBlockEditorData[y] === from; y--) colorBlockEditorData[y] = to;
  for (let y = index + 1; y < colorBlockEditorData.length && colorBlockEditorData[y] === from; y++) colorBlockEditorData[y] = to;
}

function beginColorBlockEditorPointer(event) {
  const index = colorBlockEditorLineFromEvent(event);
  if (index < 0) return;
  event.preventDefault();
  el.colorBlockEditorLines.setPointerCapture(event.pointerId);
  colorBlockEditorPointer = { pointerId: event.pointerId, mode: state.tool === "select" ? "select" : "paint", start: index, visited: new Set(), erase: event.button === 2 };
  if (colorBlockEditorPointer.mode === "select") colorBlockEditorSelection = { start: index, end: index };
  else if (state.tool === "picker") {
    state.currentColor = colorBlockEditorData[index];
    colorBlockEditorPointer = null;
    syncControls();
    return;
  } else {
    pushColorBlockEditorHistory();
    if (state.tool === "fill") fillColorBlockEditor(index);
    else if (state.tool === "color" && activeColorBlockIndex !== null) {
      const block = state.colorBlocks[activeColorBlockIndex];
      block.colors.forEach((code, offset) => { if (index + offset < colorBlockEditorData.length) colorBlockEditorData[index + offset] = colorBlockColor(block, offset); });
    } else paintColorBlockEditorLine(index);
  }
  renderColorBlockEditor();
}

function moveColorBlockEditorPointer(event) {
  if (!colorBlockEditorPointer || colorBlockEditorPointer.pointerId !== event.pointerId) return;
  const index = colorBlockEditorLineFromEvent(event);
  if (index < 0) return;
  if (colorBlockEditorPointer.mode === "select") {
    colorBlockEditorSelection.end = index;
    renderColorBlockEditor();
  } else if (state.tool !== "fill" && !(state.tool === "color" && activeColorBlockIndex !== null)) paintColorBlockEditorLine(index);
}

function endColorBlockEditorPointer(event) {
  if (!colorBlockEditorPointer || colorBlockEditorPointer.pointerId !== event.pointerId) return;
  colorBlockEditorPointer = null;
}

function saveColorBlockEdit(asCopy = false) {
  if (!colorBlockEditorData.length) return;
  pushHistory();
  const previous = editingColorBlockIndex === null ? {} : state.colorBlocks[editingColorBlockIndex];
  const block = { ...previous, colors: cloneData(colorBlockEditorData), hueOffset: colorBlockEditorHueOffset, lightnessOffset: colorBlockEditorLightnessOffset };
  if (editingColorBlockIndex === null || asCopy) state.colorBlocks.push(block);
  else state.colorBlocks[editingColorBlockIndex] = block;
  el.colorBlockEditor.close();
  renderAll();
}

function openStampEditor(index) {
  editingStampIndex = index;
  const stamp = index === null ? { w: state.width, h: state.height, pixels: Array.from({ length: state.height }, () => Array(state.width).fill(0)) } : state.stamps[index];
  el.stampEditorTitle.textContent = index === null ? "Create New Stamp" : "Edit Stamp";
  stampEditorData = cloneData(stamp.pixels);
  stampEditorHistory = [];
  stampEditorRedoStack = [];
  stampEditorSelection = null;
  el.stampEditorWidth.value = stamp.w;
  el.stampEditorHeight.value = stamp.h;
  el.stampEditorZoom.value = 75;
  el.saveStampCopy.classList.toggle("hidden", index === null);
  el.stampEditor.show();
  requestAnimationFrame(() => { renderStampEditorCanvas(); el.stampEditorCanvas.focus(); });
}

function resizeStampEditorData() {
  const w = Math.max(1, Math.min(8, Number(el.stampEditorWidth.value) || 1));
  const h = Math.max(1, Math.min(255, Number(el.stampEditorHeight.value) || 1));
  if (w === stampEditorData[0]?.length && h === stampEditorData.length) return;
  pushStampEditorHistory();
  while (stampEditorData.length < h) stampEditorData.push(Array(w).fill(0));
  stampEditorData.length = h;
  stampEditorData = stampEditorData.map(row => Array.from({ length: w }, (_, x) => row?.[x] ? 1 : 0));
  stampEditorSelection = null;
  renderStampEditorCanvas();
}

function stampEditorSnapshot() {
  return { data: cloneData(stampEditorData), selection: stampEditorSelection ? cloneData(stampEditorSelection) : null };
}

function restoreStampEditorSnapshot(snap) {
  stampEditorData = cloneData(snap.data);
  stampEditorSelection = snap.selection ? cloneData(snap.selection) : null;
  el.stampEditorWidth.value = stampEditorData[0].length;
  el.stampEditorHeight.value = stampEditorData.length;
  renderStampEditorCanvas();
}

function pushStampEditorHistory() {
  stampEditorHistory.push(stampEditorSnapshot());
  stampEditorRedoStack = [];
}

function undoStampEditor() {
  const snap = stampEditorHistory.pop();
  if (!snap) return;
  stampEditorRedoStack.push(stampEditorSnapshot());
  restoreStampEditorSnapshot(snap);
}

function redoStampEditor() {
  const snap = stampEditorRedoStack.pop();
  if (!snap) return;
  stampEditorHistory.push(stampEditorSnapshot());
  restoreStampEditorSnapshot(snap);
}

function renderStampEditorCanvas() {
  if (!stampEditorData?.length || !el.stampEditor.open) return;
  const canvas = el.stampEditorCanvas;
  const preview = el.stampEditorPreviewCanvas;
  const zoom = stampSliderToZoom(el.stampEditorZoom.value);
  const w = stampEditorData[0].length;
  const h = stampEditorData.length;
  const aspect = aspectForKernel();
  const pixelAspect = (aspect.w / aspect.h) / Math.max(1, state.verticalStretch);
  const containerWidth = Math.max(220, el.stampEditorCanvasContainer.clientWidth - 36);
  const containerHeight = Math.max(220, el.stampEditorCanvasContainer.clientHeight - 36);
  const targetAspect = Math.max(.02, w * pixelAspect / h);
  let cssWidth = containerWidth;
  let cssHeight = cssWidth / targetAspect;
  if (cssHeight > containerHeight) { cssHeight = containerHeight; cssWidth = cssHeight * targetAspect; }
  cssWidth = Math.max(w * 4, Math.round(cssWidth * zoom));
  cssHeight = Math.max(h * 2, Math.round(cssHeight * zoom));
  const ctx = setCanvasSize(canvas, cssWidth, cssHeight);
  const pctx = setCanvasSize(preview, cssWidth, cssHeight);
  stampEditorCellWidth = cssWidth / w;
  stampEditorCellHeight = cssHeight / h;
  canvas.dataset.gridVisible = String(state.showGrid);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  stampEditorData.forEach((row, y) => row.forEach((value, x) => {
    if (value) {
      ctx.fillStyle = colorHex(state.currentColor);
      fillRasterCell(ctx, { cellW: stampEditorCellWidth, cellH: stampEditorCellHeight }, x, y);
    }
  }));
  if (state.showGrid) {
    drawGrid(ctx, {
      cellW: stampEditorCellWidth,
      cellH: stampEditorCellHeight,
      cols: w,
      rows: h,
      w: cssWidth,
      h: cssHeight,
      dpr: window.devicePixelRatio || 1,
      copyOrigins: [0]
    });
  }
  pctx.clearRect(0, 0, cssWidth, cssHeight);
  if (stampEditorSelection) {
    const { x, y, w: sw, h: sh } = stampEditorSelection;
    const mask = stampEditorSelection.mask || fullSelectionMask(sw, sh);
    pctx.fillStyle = "rgba(255,255,255,.12)";
    for (let my = 0; my < sh; my++) for (let mx = 0; mx < sw; mx++) if (mask[my]?.[mx]) {
      fillRasterCell(pctx, { cellW: stampEditorCellWidth, cellH: stampEditorCellHeight }, x + mx, y + my);
    }
    pctx.strokeStyle = "#fff";
    pctx.lineWidth = 2;
    pctx.setLineDash([4, 4]);
    pctx.beginPath();
    maskBoundarySegments(mask).forEach(([x1, y1, x2, y2]) => {
      pctx.moveTo((x + x1) * stampEditorCellWidth, (y + y1) * stampEditorCellHeight);
      pctx.lineTo((x + x2) * stampEditorCellWidth, (y + y2) * stampEditorCellHeight);
    });
    pctx.stroke();
    pctx.setLineDash([]);
  }
  if (!stampEditorPointer && stampEditorHoverCell && stampCellInside(stampEditorHoverCell) && ["pencil", "eraser"].includes(state.tool)) {
    const erase = state.tool === "eraser";
    pctx.fillStyle = erase ? "rgba(255,255,255,.16)" : `${colorHex(state.currentColor)}88`;
    pctx.strokeStyle = "rgba(255,255,255,.82)";
    for (const [x, y] of brushCells(stampEditorHoverCell.x, stampEditorHoverCell.y, state.brushWidth, state.brushHeight, w, h)) {
      const rect = fillRasterCell(pctx, { cellW: stampEditorCellWidth, cellH: stampEditorCellHeight }, x, y);
      pctx.strokeRect(rect.x + .5, rect.y + .5, rect.w - 1, rect.h - 1);
    }
  }
  if (el.stampEditorReadout) el.stampEditorReadout.textContent = `${w} × ${h}`;
}

function stampSliderToZoom(value) {
  const position = Math.max(0, Math.min(100, Number(value) || 0));
  return position <= 75 ? .5 + position / 150 : 1 + (position - 75) * 4 / 25;
}

function stampEditorCell(event) {
  const rect = el.stampEditorCanvas.getBoundingClientRect();
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  return {
    x: Math.floor(localX / stampEditorCellWidth),
    y: Math.floor(localY / stampEditorCellHeight),
    localX,
    localY
  };
}

function stampCellInside(cell) {
  return cell.x >= 0 && cell.y >= 0 && cell.x < stampEditorData[0].length && cell.y < stampEditorData.length;
}

function updateStampEditorCursor(event) {
  if (stampEditorPointer?.mode === "move") { el.stampEditorCanvas.style.cursor = "grabbing"; return; }
  if (state.tool !== "select") { el.stampEditorCanvas.style.cursor = "crosshair"; return; }
  const cell = stampEditorCell(event);
  const modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey;
  el.stampEditorCanvas.style.cursor = stampCellInside(cell) && !modifiers && selectionContains(stampEditorSelection, cell.x, cell.y) ? "grab" : "crosshair";
}

function setStampEditorBrush(cell, erase = false) {
  plotStampEditorPoint(cell.x, cell.y, erase ? 0 : 1);
  renderStampEditorCanvas();
}

function fillStampEditor(cell, value) {
  const target = stampEditorData[cell.y][cell.x];
  if (target === value) return;
  const queue = [cell];
  while (queue.length) {
    const point = queue.pop();
    if (!stampCellInside(point) || stampEditorData[point.y][point.x] !== target) continue;
    stampEditorData[point.y][point.x] = value;
    queue.push({ x: point.x - 1, y: point.y }, { x: point.x + 1, y: point.y }, { x: point.x, y: point.y - 1 }, { x: point.x, y: point.y + 1 });
  }
}

function isStampShapeTool(tool = state.tool) {
  return ["line", "rect", "oval", "circle", "triangle", "triangle-side"].includes(tool);
}

function plotStampEditorPoint(x, y, value) {
  for (const [tx, ty] of brushCells(x, y, state.brushWidth, state.brushHeight, stampEditorData[0].length, stampEditorData.length)) stampEditorData[ty][tx] = value;
  if (state.mirrorDraw) {
    const mirrorX = stampEditorData[0].length - 1 - x;
    for (const [tx, ty] of brushCells(mirrorX, y, state.brushWidth, state.brushHeight, stampEditorData[0].length, stampEditorData.length)) stampEditorData[ty][tx] = value;
  }
}

function drawStampEditorLine(x0, y0, x1, y1, value) {
  rasterLineCells(x0, y0, x1, y1).forEach(([x, y]) => plotStampEditorPoint(x, y, value));
}

function applyStampEditorShape(start, end, erase = false) {
  const value = erase ? 0 : 1;
  let x0 = Math.min(start.x, end.x), x1 = Math.max(start.x, end.x);
  let y0 = Math.min(start.y, end.y), y1 = Math.max(start.y, end.y);
  if (state.tool === "line") { drawStampEditorLine(start.x, start.y, end.x, end.y, value); return; }
  if (state.tool === "circle") {
    const pivot = start.circlePivot || { x: start.x, y: start.y };
    const { cells } = visualCircleCells(pivot.x, pivot.y, end.x, end.y, stampEditorCellWidth, stampEditorCellHeight, state.fillShapes);
    cells.forEach(([x, y]) => plotStampEditorPoint(x, y, value));
    return;
  }
  if (state.tool === "rect") {
    if (state.fillShapes) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) plotStampEditorPoint(x, y, value);
    else {
      drawStampEditorLine(x0, y0, x1, y0, value); drawStampEditorLine(x1, y0, x1, y1, value);
      drawStampEditorLine(x1, y1, x0, y1, value); drawStampEditorLine(x0, y1, x0, y0, value);
    }
    return;
  }
  if (state.tool === "oval") {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const rx = Math.max(.5, (x1 - x0) / 2), ry = Math.max(.5, (y1 - y0) / 2);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const distance = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if ((state.fillShapes && distance <= 1.15) || (!state.fillShapes && distance >= .62 && distance <= 1.42)) plotStampEditorPoint(x, y, value);
    }
    return;
  }
  const vertices = state.tool === "triangle-side" ? [[x0, y0], [x0, y1], [x1, Math.round((y0 + y1) / 2)]] : [[Math.round((x0 + x1) / 2), y0], [x0, y1], [x1, y1]];
  drawStampEditorLine(...vertices[0], ...vertices[1], value);
  drawStampEditorLine(...vertices[1], ...vertices[2], value);
  drawStampEditorLine(...vertices[2], ...vertices[0], value);
  if (state.fillShapes) {
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      if (state.tool === "triangle-side") drawStampEditorLine(x0, y, Math.round(x0 + (x1 - x0) * (1 - Math.abs(t * 2 - 1))), y, value);
      else drawStampEditorLine(Math.round((x0 + x1) / 2 - (x1 - x0) * t / 2), y, Math.round((x0 + x1) / 2 + (x1 - x0) * t / 2), y, value);
    }
  }
}

function beginStampEditorPointer(event) {
  const cell = stampEditorCell(event);
  if (!stampCellInside(cell)) return;
  event.preventDefault();
  el.stampEditorCanvas.setPointerCapture(event.pointerId);
  const erase = event.button === 2 || state.tool === "eraser";
  const hasModifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey;
  const moving = state.tool === "select" && !hasModifiers && selectionContains(stampEditorSelection, cell.x, cell.y);
  if (state.tool === "circle") {
    cell.circlePivot = circlePivotFromPointer(cell.localX, cell.localY, stampEditorCellWidth, stampEditorCellHeight, stampEditorData[0].length, stampEditorData.length);
    el.statusMessage.textContent = cell.circlePivot.mode === "intersection" ? "Circle: four-pixel intersection pivot" : "Circle: pixel-center pivot";
  }
  pushStampEditorHistory();
  stampEditorPointer = { pointerId: event.pointerId, start: cell, last: cell, source: cloneData(stampEditorData), erase, mode: moving ? "move" : state.tool };
  if (moving) {
    stampEditorPointer.selectionSource = cloneData(stampEditorSelection);
    stampEditorPointer.selectionData = extractSelectionPixels(stampEditorData, stampEditorSelection);
    el.stampEditorCanvas.style.cursor = "grabbing";
  } else if (state.tool === "select") {
    stampEditorPointer.selectionBefore = stampEditorSelection ? cloneData(stampEditorSelection) : null;
    stampEditorPointer.selectionMode = event.altKey ? "subtract" : (event.shiftKey || event.ctrlKey || event.metaKey) ? "add" : "replace";
    const incoming = selectionFromRectangle({ x: cell.x, y: cell.y, w: 1, h: 1 });
    stampEditorSelection = combineRasterSelections(stampEditorPointer.selectionBefore, incoming, stampEditorPointer.selectionMode, stampEditorData[0].length, stampEditorData.length);
  }
  else if (state.tool === "fill") { fillStampEditor(cell, stampEditorPointer.erase ? 0 : 1); renderStampEditorCanvas(); }
  else if (isStampShapeTool()) { applyStampEditorShape(cell, cell, stampEditorPointer.erase); renderStampEditorCanvas(); }
  else if (state.tool === "stamp" && activeStampIndex !== null) placeStampInStampEditor(cell);
  else if (!["color", "select"].includes(state.tool)) setStampEditorBrush(cell, stampEditorPointer.erase);
}

function moveStampEditorPointer(event) {
  const cell = stampEditorCell(event);
  if (!stampEditorPointer || stampEditorPointer.pointerId !== event.pointerId) {
    const nextHover = stampCellInside(cell) ? cell : null;
    if (nextHover?.x !== stampEditorHoverCell?.x || nextHover?.y !== stampEditorHoverCell?.y) { stampEditorHoverCell = nextHover; renderStampEditorCanvas(); }
    updateStampEditorCursor(event);
    return;
  }
  if (!stampCellInside(cell) || (cell.x === stampEditorPointer.last.x && cell.y === stampEditorPointer.last.y)) return;
  const previous = stampEditorPointer.last;
  stampEditorPointer.last = cell;
  if (stampEditorPointer.mode === "move") {
    const origin = stampEditorPointer.selectionSource;
    const nx = Math.max(0, Math.min(stampEditorData[0].length - origin.w, origin.x + cell.x - stampEditorPointer.start.x));
    const ny = Math.max(0, Math.min(stampEditorData.length - origin.h, origin.y + cell.y - stampEditorPointer.start.y));
    stampEditorData = moveMaskedSelectionPixels(stampEditorPointer.source, origin, stampEditorPointer.selectionData, nx, ny);
    stampEditorSelection = { ...origin, x: nx, y: ny, mask: cloneData(origin.mask || fullSelectionMask(origin.w, origin.h)) };
    renderStampEditorCanvas();
  } else if (state.tool === "select") {
    const x = Math.min(stampEditorPointer.start.x, cell.x), y = Math.min(stampEditorPointer.start.y, cell.y);
    const incoming = selectionFromRectangle({ x, y, w: Math.abs(cell.x - stampEditorPointer.start.x) + 1, h: Math.abs(cell.y - stampEditorPointer.start.y) + 1 });
    stampEditorSelection = combineRasterSelections(stampEditorPointer.selectionBefore, incoming, stampEditorPointer.selectionMode, stampEditorData[0].length, stampEditorData.length);
    renderStampEditorCanvas();
  } else if (isStampShapeTool()) {
    stampEditorData = cloneData(stampEditorPointer.source);
    applyStampEditorShape(stampEditorPointer.start, cell, stampEditorPointer.erase);
    renderStampEditorCanvas();
  } else if (state.tool === "stamp" && activeStampIndex !== null) placeStampInStampEditor(cell);
  else if (!["fill", "color"].includes(state.tool)) {
    drawStampEditorLine(previous.x, previous.y, cell.x, cell.y, stampEditorPointer.erase ? 0 : 1);
    renderStampEditorCanvas();
  }
}

function endStampEditorPointer(event) {
  if (!stampEditorPointer || stampEditorPointer.pointerId !== event.pointerId) return;
  stampEditorPointer = null;
  updateStampEditorCursor(event);
}

function placeStampInStampEditor(cell) {
  const stamp = state.stamps[activeStampIndex];
  if (!stamp) return;
  const startX = cell.x - Math.floor(stamp.w / 2);
  const startY = cell.y - Math.floor(stamp.h / 2);
  stamp.pixels.forEach((row, sy) => row.forEach((value, sx) => {
    const x = startX + sx, y = startY + sy;
    if (value && y >= 0 && y < stampEditorData.length && x >= 0 && x < stampEditorData[0].length) stampEditorData[y][x] = 1;
  }));
  renderStampEditorCanvas();
}

function moveStampEditorSelection(dx, dy) {
  if (!stampEditorSelection) return;
  const rect = stampEditorSelection;
  const clippedDx = Math.max(-rect.x, Math.min(stampEditorData[0].length - rect.x - rect.w, dx));
  const clippedDy = Math.max(-rect.y, Math.min(stampEditorData.length - rect.y - rect.h, dy));
  if (!clippedDx && !clippedDy) return;
  pushStampEditorHistory();
  const data = extractSelectionPixels(stampEditorData, rect);
  stampEditorData = moveMaskedSelectionPixels(stampEditorData, rect, data, rect.x + clippedDx, rect.y + clippedDy);
  stampEditorSelection = { ...rect, x: rect.x + clippedDx, y: rect.y + clippedDy, mask: cloneData(rect.mask || fullSelectionMask(rect.w, rect.h)) };
  renderStampEditorCanvas();
}

function saveStampEdit(asCopy = false) {
  pushHistory();
  const previous = editingStampIndex === null ? {} : state.stamps[editingStampIndex];
  const stamp = { ...previous, w: stampEditorData[0].length, h: stampEditorData.length, pixels: cloneData(stampEditorData) };
  if (editingStampIndex === null || asCopy) state.stamps.push(stamp);
  else state.stamps[editingStampIndex] = stamp;
  el.stampEditor.close();
  renderAll();
}

function currentGridAppearance() {
  const style = getComputedStyle(document.body);
  return editorPreferences.grids[state.theme] || {
    color: normalizeGridColor(style.getPropertyValue("--canvas-grid-default-color")) || "#FFFFFF",
    intensity: Number.parseFloat(style.getPropertyValue("--canvas-grid-default-intensity")) || 15
  };
}

function positionGridSettings() {
  el.gridSettingsPopover.hidden = !el.gridSettingsDisclosure.open;
  if (!el.gridSettingsDisclosure.open) return;
  const anchor = el.gridSettingsDisclosure.getBoundingClientRect();
  const popover = el.gridSettingsPopover;
  popover.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - popover.offsetWidth - 8))}px`;
  popover.style.top = `${Math.max(8, Math.min(anchor.bottom + 5, window.innerHeight - popover.offsetHeight - 8))}px`;
}

function syncEditorPreferences() {
  const grid = currentGridAppearance();
  document.documentElement.style.setProperty("--canvas-grid-line", gridLineColor(grid));
  document.body.classList.toggle("editor-grid-hidden", !state.showGrid);
  el.gridColorPicker.value = grid.color;
  el.gridIntensity.value = grid.intensity;
  el.gridIntensityValue.value = `${grid.intensity}%`;
  positionGridSettings();
}

function updateGridPreference(change) {
  editorPreferences.grids[state.theme] = { ...currentGridAppearance(), ...change };
  saveEditorPreferences(editorPreferences);
  renderAll();
}

function renderAll() {
  syncEditorPreferences();
  syncFrameSize();
  renderCanvasSurfaces();
  renderProjectPanels();
  syncReadouts();
  if (el.stampEditor?.open) renderStampEditorCanvas();
}

function renderCanvasSurfaces() {
  renderEditor();
  renderRowColors();
  if (!playbackThumbnailCollapsed) renderPlaybackThumbnail();
}

function renderProjectPanels() {
  renderPalette();
  renderBgPalette();
  renderFrames();
  renderAssets();
}

function setStatus(message) {
  if (el.statusMessage) el.statusMessage.textContent = String(message || "");
}

function syncReadouts() {
  updateSelectionBar();
  const frame = currentFrame();
  const selectedWidth = playerWidth(frame, state.activePlayer);
  const selectedHeight = playerHeight(frame, state.activePlayer);
  el.frameLabel.textContent = `Frame ${state.currentFrame + 1}`;
  el.pixelReadout.textContent = `${selectedWidth} x ${selectedHeight}`;
  el.editorZone.classList.toggle("two-sprite-layout", state.twoSpriteMode);
  el.currentColorSwatch.style.background = colorHex(state.currentColor);
  const totalSeconds = state.frames.reduce((sum, item) => sum + Math.max(1, Math.min(60, Number(item.duration) || 3)), 0) / 60;
  el.timelineSummary.textContent = `${state.frames.length} frame${state.frames.length === 1 ? "" : "s"} · ${totalSeconds.toFixed(2)}s`;
  el.statusKernel.textContent = state.kernel;
  el.statusFrame.textContent = `Frame ${state.currentFrame + 1} of ${state.frames.length}`;
  el.statusMessage.textContent = playbackRunning ? "Playing" : `${state.tool[0].toUpperCase() + state.tool.slice(1)} ready`;
}

function syncControls() {
  syncFrameSize();
  el.selectTheme.value = state.theme;
  el.projectName.value = state.projectName;
  if (document.activeElement !== el.animationName) el.animationName.value = state.animationName;
  renderAnimationMenu();
  el.spriteHeight.value = state.height;
  el.spriteWidth.value = state.width;
  el.kernelMode.value = state.kernel;
  el.timelineFrameRepeat.value = currentFrame().duration;
  el.bgColor.value = state.background;
  el.bgColorPicker.style.setProperty("--swatch-color", colorHex(state.background));
  el.currentColor.value = state.currentColor;
  el.twoSpriteMode.checked = state.twoSpriteMode;
  el.autoSpriteSelection.checked = editorPreferences.autoSpriteSelection;
  el.autoSpriteSelectionRow.classList.toggle("hidden", !state.twoSpriteMode);
  el.autoSpriteSelection.disabled = !state.twoSpriteMode;
  populateAssignmentSelect(el.playerAssignment0, 0);
  populateAssignmentSelect(el.playerAssignment1, 1);
  el.spriteNusizLabel.firstChild.textContent = "NUSIZ Mode ";
  el.spriteNusiz.value = currentPlayer().nusiz;
  el.spriteSolidColorRow.classList.toggle("hidden", !usesSolidColor());
  el.spriteSolidColor.value = currentPlayer().solidColor;
  el.spriteOffsetX.value = currentPlayer().xOffset;
  el.spriteOffsetY.value = currentPlayer().yOffset;
  el.showGrid.checked = state.showGrid;
  el.showColorColumns.checked = state.showColorColumns;
  el.onion.checked = state.onion;
  el.onionOpacity.value = state.onionOpacity;
  el.onionFrames.value = state.onionFrames;
  el.onionOpacity.disabled = !state.onion;
  el.onionFrames.disabled = !state.onion;
  el.loopPlayback.classList.toggle("active", state.loopPlayback);
  el.loopPlayback.setAttribute("aria-pressed", String(state.loopPlayback));
  el.mirrorDraw.checked = state.mirrorDraw;
  el.fillShapes.checked = state.fillShapes;
  el.brushWidth.value = state.brushWidth;
  el.brushHeight.value = state.brushHeight;
  syncNudgeButtons();
  el.displayRegion.value = state.region;
  el.zoom.value = zoomToSlider(state.zoom);
  el.bgColor.value = state.background;
  el.bgColorPicker.style.setProperty("--swatch-color", colorHex(state.background));
  const ref = currentReference();
  el.refControls.classList.toggle("visible", !!ref);
  if (ref) {
    el.refOpacity.value = ref.opacity; el.refScale.value = ref.scale;
    el.refX.min = String(Math.min(-8, Math.floor(ref.xOffset)));
    el.refX.max = String(Math.max(8, Math.ceil(ref.xOffset)));
    el.refY.min = String(Math.min(-16, Math.floor(ref.yOffset)));
    el.refY.max = String(Math.max(16, Math.ceil(ref.yOffset)));
    el.refX.value = ref.xOffset; el.refY.value = ref.yOffset;
    el.threshold.value = ref.threshold; el.refFitMode.value = ref.fitMode; el.refDither.checked = ref.dither;
    el.refIgnoreBlack.checked = ref.ignoreBlackBackground;
    el.refBrightness.value = ref.brightness; el.refContrast.value = ref.contrast;
    el.toggleReference.textContent = ref.visible ? "Hide" : "Show";
  }
  document.querySelectorAll(".tool").forEach(btn => btn.classList.toggle("active", btn.dataset.tool === state.tool));
  el.paletteEyedropper.classList.toggle("active", paletteEyedropperArmed);
  el.twoSpriteControls.classList.toggle("hidden", !state.twoSpriteMode);
  el.activeSpriteTabs.classList.toggle("hidden", !state.twoSpriteMode);
  el.selectSpriteA.classList.toggle("active", state.activePlayer === 0);
  el.selectSpriteB.classList.toggle("active", state.activePlayer === 1);
  el.selectSpriteA.setAttribute("aria-pressed", String(state.activePlayer === 0));
  el.selectSpriteB.setAttribute("aria-pressed", String(state.activePlayer === 1));
  [0, 1].forEach(slot => {
    const name = `Sprite ${slot ? "B" : "A"}`;
    const visible = spriteVisibility[slot];
    el[`spriteCanvasLabel${slot}`].classList.toggle("hidden", !state.twoSpriteMode);
    el[`spriteCanvasLabel${slot}`].classList.toggle("sprite-hidden", !visible);
    el[`spriteCanvasLabel${slot}`].classList.toggle("active-sprite", state.activePlayer === slot);
    el[`spriteCanvasAssignment${slot}`].textContent = `P${state.playerAssignments[slot]}`;
    el[`spriteCanvasSelector${slot}`].setAttribute("aria-pressed", String(state.activePlayer === slot));
    const button = el[`toggleSpriteVisibility${slot}`];
    button.title = `${visible ? "Hide" : "Show"} ${name}`;
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(!visible));
    button.querySelector("use")?.setAttribute("href", visible ? "#icon-eye" : "#icon-eye-off");
  });
  el.offsetControls.classList.add("x-visible");
  el.spriteOffsetXRow.classList.remove("hidden");
  el.referenceImportSingle.classList.toggle("hidden", state.twoSpriteMode);
  el.referenceImportDual.classList.toggle("hidden", !state.twoSpriteMode);
  el.playerAssignment0Label.textContent = state.twoSpriteMode ? "Sprite A #" : "Sprite #";
  el.playerAssignment1Row.classList.toggle("hidden", !state.twoSpriteMode);
  el.p0ColorsTitle.textContent = `P${state.playerAssignments[0]}`;
  el.p1ColorsTitle.textContent = `P${state.playerAssignments[1]}`;
  [el.spriteCanvas, el.spriteCanvas1].forEach((canvas, slot) => canvas.setAttribute("aria-label", `P${state.playerAssignments[slot]} ${state.width}-pixel-wide Atari sprite editing canvas`));
  syncPlaybackThumbnailControls();
  syncDesktopMenuState();
}

function syncNudgeButtons() {
  if (!el.nudgePixels || !el.nudgeColors) return;
  document.querySelectorAll("[data-nudge]").forEach(button => {
    const horizontal = button.dataset.nudge === "left" || button.dataset.nudge === "right";
    button.disabled = horizontal ? !el.nudgePixels.checked : !el.nudgePixels.checked && !el.nudgeColors.checked;
  });
}

function zoomToSlider(zoom) {
  return zoom <= 13 ? Math.round((zoom - 1) * 50 / 12) : Math.round(50 + (zoom - 13) * 50 / 29);
}

function sliderToZoom(value) {
  const slider = Number(value);
  return slider <= 50 ? 1 + slider * 12 / 50 : 13 + (slider - 50) * 29 / 50;
}

function populateAssignmentSelect(select, slot) {
  const max = playerLimitForKernel(state.kernel);
  const options = Array.from({ length: max + 1 }, (_, number) => `<option value="${number}"${state.playerAssignments[1 - slot] === number ? " disabled" : ""}>P${number}</option>`).join("");
  select.innerHTML = options;
  select.value = String(state.playerAssignments[slot]);
}

function setPlayerAssignment(slot, number) {
  const max = playerLimitForKernel(state.kernel);
  const other = state.playerAssignments[1 - slot];
  if (!Number.isInteger(number) || number < 0 || number > max || number === other) {
    syncControls();
    return;
  }
  pushHistory();
  state.playerAssignments[slot] = number;
  setActivePlayer(slot);
  syncControls();
}

function updateSelectionBar() {
  if (!selection) {
    el.selectionBar.classList.add("hidden");
    return;
  }
  el.selectionBar.classList.remove("hidden");
  const bottomY = state.height - selection.y - selection.h;
  el.selectionInfo.textContent = `P${state.playerAssignments[state.activePlayer]} ${selection.x},${bottomY} ${selection.w}x${selection.h}`;
}

function copySelection(cut = false) {
  if (!selection) return;
  const player = currentPlayer();
  clipboard = {
    w: selection.w,
    h: selection.h,
    mask: cloneData(selection.mask || fullMask(selection.w, selection.h)),
    pixels: Array.from({ length: selection.h }, (_, y) => Array.from({ length: selection.w }, (_, x) => (selection.mask?.[y]?.[x] ?? true) && player.pixels[selection.y + y]?.[selection.x + x] ? 1 : 0))
  };
  if (cut) {
    pushHistory();
    for (let y = 0; y < selection.h; y++) for (let x = 0; x < selection.w; x++) if (clipboard.mask[y]?.[x]) setPixel(selection.x + x, selection.y + y, 0);
    renderAll();
  }
}

function pasteSelection() {
  if (!clipboard) return;
  pushHistory();
  const x0 = selection ? selection.x : lastCell.col;
  const y0 = selection ? selection.y : lastCell.row;
  clipboard.pixels.forEach((row, y) => row.forEach((v, x) => {
    if (clipboard.mask?.[y]?.[x] && v) setPixel(x0 + x, y0 + y, 1);
  }));
  renderAll();
}

function makeStampFromSelection() {
  if (!selection) return;
  copySelection(false);
  pushHistory();
  state.stamps.push({ w: clipboard.w, h: clipboard.h, pixels: cloneData(clipboard.pixels) });
  activeStampIndex = state.stamps.length - 1;
  renderAssets();
}

function clearSelection() {
  clearSelectionState();
  renderAll();
}

function cropToSelection() {
  if (!selection) return;
  pushHistory();
  const player = currentPlayer();
  player.pixels = cropPixelsToSelection(player.pixels, selection, state.width, state.height);
  selection = tightenSelectionToLivePixels(player.pixels, selection, state.width, state.height);
  el.statusMessage.textContent = `Cropped P${state.playerAssignments[state.activePlayer]} to the selection`;
  renderAll();
}

function clearSelectionState() {
  selection = null;
  colorSelection = null;
  isSelectingColors = false;
  colorSelectionAnchor = null;
  colorSelectionBefore = null;
  movingSelection = false;
  selectionMoveOrigin = null;
  selectionMoveData = null;
  selectionBeforeDrag = null;
  updateSelectionBar();
}

function applyColorBlock(index, requestedStart, recordHistory = true, playerIndex = state.activePlayer) {
  const block = state.colorBlocks[index];
  if (!block) return;
  if (recordHistory) pushHistory();
  const start = Math.max(0, Math.min(state.height - 1, Number(requestedStart) || 0));
  block.colors.forEach((code, i) => {
    const y = start + i;
    if (y < state.height) currentFrame().players[playerIndex].colors[y] = colorBlockColor(block, i);
  });
  renderCanvasSurfaces();
  syncReadouts();
}

function createColorBlockFromSelection() {
  if (!colorSelection) return;
  const playerColors = currentFrame().players[colorSelection.player ?? state.activePlayer].colors;
  const colors = colorSelection.mask ? playerColors.filter((_, row) => colorSelection.mask[row]) : playerColors.slice(Math.max(0, Math.min(colorSelection.start, colorSelection.end)), Math.min(state.height - 1, Math.max(colorSelection.start, colorSelection.end)) + 1);
  if (!colors.length) return;
  pushHistory();
  state.colorBlocks.push({ colors, hueOffset: 0, lightnessOffset: 0 });
  activeColorBlockIndex = state.colorBlocks.length - 1;
  colorSelection = null;
  renderAll();
}

function placeStamp(x0, y0) {
  const stamp = state.stamps[activeStampIndex];
  if (!stamp) return;
  const startX = x0 - Math.floor(stamp.w / 2);
  const startY = y0 - Math.floor(stamp.h / 2);
  stamp.pixels.forEach((row, y) => row.forEach((v, x) => {
    if (v) setPixel(startX + x, startY + y, 1);
  }));
}

function nudge(dx, dy) {
  const movePixels = !!el.nudgePixels.checked;
  const moveColors = !!el.nudgeColors.checked && !!dy;
  if (!movePixels && !moveColors) return;
  const current = currentPlayer();
  const live = selection ? tightenSelectionToLivePixels(current.pixels, selection, state.width, state.height) : null;
  if (selection && !live && !moveColors) {
    selection = null;
    el.statusMessage.textContent = "The selection contains no live pixels";
    renderAll();
    return;
  }
  const frameIndices = selection || colorSelection ? [state.currentFrame] : selectedFrameIndices();
  pushHistory();
  frameIndices.forEach(frameIndex => {
    const frame = state.frames[frameIndex];
    const player = frame.players[state.activePlayer];
    const width = frame.width || 8;
    const height = frame.height || player.pixels.length;
    const pixelsBeforeNudge = player.pixels;
    let colorDeltaY = dy;
    if (movePixels) {
      if (frameIndex === state.currentFrame && live) {
        selection = live;
        const nx = Math.max(0, Math.min(width - live.w, live.x + dx));
        const ny = Math.max(0, Math.min(height - live.h, live.y + dy));
        colorDeltaY = ny - live.y;
        const data = extractSelectionPixels(player.pixels, live);
        player.pixels = moveMaskedSelectionPixels(player.pixels, live, data, nx, ny);
        selection = tightenSelectionToLivePixels(player.pixels, { ...live, x: nx, y: ny }, width, height);
      } else if (!selection) {
        const next = Array.from({ length: height }, () => Array(8).fill(0));
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) next[ny][nx] = player.pixels[y][x];
        }
        player.pixels = next;
      }
    }
    if (moveColors) {
      const source = player.colors.slice(0, height);
      if (frameIndex === state.currentFrame && live && !colorSelection) {
        player.colors = moveSelectedScanlineColors(source, pixelsBeforeNudge, live, colorDeltaY, state.currentColor).colors;
      } else if (frameIndex === state.currentFrame && colorSelection?.player === state.activePlayer && colorSelection.mask?.some(Boolean)) {
        const next = source.slice();
        const movedMask = Array(height).fill(false);
        colorSelection.mask.forEach((selected, row) => { if (selected && row < height) next[row] = state.currentColor; });
        colorSelection.mask.forEach((selected, row) => {
          const target = row + dy;
          if (selected && row < height && target >= 0 && target < height) { next[target] = source[row]; movedMask[target] = true; }
        });
        player.colors = next;
        const rows = movedMask.map((value, row) => value ? row : -1).filter(row => row >= 0);
        colorSelection = rows.length ? { player: state.activePlayer, mask: movedMask, start: rows[0], end: rows.at(-1) } : null;
      } else if (!colorSelection) {
        player.colors = Array.from({ length: height }, (_, y) => source[y - dy] || state.currentColor);
      }
    }
  });
  if (frameIndices.length > 1) el.statusMessage.textContent = `Nudged ${selectedFrameLabel()}`;
  renderAll();
}

function moveSelectionBy(dx, dy) {
  if (!selection) return;
  const live = tightenSelectionToLivePixels(currentPlayer().pixels, selection, state.width, state.height);
  if (!live) {
    selection = null;
    el.statusMessage.textContent = "The selection contains no live pixels";
    renderAll();
    return;
  }
  const nx = Math.max(0, Math.min(state.width - live.w, live.x + dx));
  const ny = Math.max(0, Math.min(state.height - live.h, live.y + dy));
  if (nx === live.x && ny === live.y) { selection = live; renderAll(); return; }
  pushHistory();
  const data = extractSelectionPixels(currentPlayer().pixels, live);
  currentPlayer().pixels = moveMaskedSelectionPixels(currentPlayer().pixels, live, data, nx, ny);
  selection = tightenSelectionToLivePixels(currentPlayer().pixels, { ...live, x: nx, y: ny }, state.width, state.height);
  renderAll();
}

function scaleStepValue() {
  const parsed = Number(el.scaleStep.value);
  const value = el.scaleStep.value.trim() && Number.isFinite(parsed) ? Math.max(1, parsed) : 25;
  el.scaleStep.value = value;
  return value / 100;
}

function scaleArtwork(axis, direction) {
  const delta = scaleStepValue();
  let scaleX = axis === "vertical" ? 1 : direction > 0 ? 1 + delta : 1 - delta;
  let scaleY = axis === "horizontal" ? 1 : direction > 0 ? 1 + delta : 1 - delta;
  if (selection) {
    const live = tightenSelectionToLivePixels(currentPlayer().pixels, selection, state.width, state.height);
    if (!live) {
      selection = null;
      el.statusMessage.textContent = "The selection contains no live pixels";
      renderAll();
      return;
    }
    const result = scaleSelectionInFrame(currentPlayer().pixels, live, scaleX, scaleY, state.width, state.height);
    if (!result.selection || (result.selection.w === live.w && result.selection.h === live.h && scaleX !== 1 && scaleY !== 1)) {
      el.statusMessage.textContent = "Scale is limited by the current frame";
    }
    pushHistory();
    currentPlayer().pixels = result.pixels;
    selection = result.selection;
    rotationSession = null;
    renderAll();
    return;
  }

  const updates = selectedFrameIndices().map(frameIndex => {
    const frame = state.frames[frameIndex];
    const oldWidth = frame.width || 8;
    const oldHeight = frame.height || frame.players[0].pixels.length;
    const oldColors = frame.players.map(player => player.colors.slice(0, oldHeight));
    const result = scaleRasterArtwork(
      frame.players.map(player => player.pixels),
      oldWidth,
      oldHeight,
      scaleX,
      scaleY,
      { maxWidth: 8, maxHeight: 255, indices: state.twoSpriteMode ? [0, 1] : [state.activePlayer] }
    );
    return { frame, oldColors, result, scaleY };
  });
  if (!updates.some(update => update.result.changed)) {
    el.statusMessage.textContent = "Draw pixels before scaling, or use a larger Scale Step";
    return;
  }
  pushHistory();
  updates.forEach(({ frame, oldColors, result }) => {
    if (!result.changed) return;
    frame.players.forEach((player, index) => {
      player.pixels = result.grids[index].map(row => [...row, ...Array(Math.max(0, 8 - row.length)).fill(0)].slice(0, 8));
      const nextColors = Array(result.height).fill(state.currentColor);
      oldColors[index].forEach((color, y) => {
        const targetY = y + result.shiftY;
        if (targetY >= 0 && targetY < result.height) nextColors[targetY] = color;
      });
      const plan = result.plans[index];
      if (plan?.affected && plan.source && plan.target && scaleY !== 1) {
        const scaledColors = resampleValues(oldColors[index].slice(plan.source.y, plan.source.y + plan.source.h), plan.target.h, state.currentColor);
        scaledColors.forEach((color, y) => {
          const targetY = plan.target.y + y;
          if (targetY >= 0 && targetY < result.height) nextColors[targetY] = color;
        });
      }
      player.colors = nextColors;
    });
    frame.width = result.width;
    frame.height = result.height;
  });
  syncFrameSize();
  selection = null;
  rotationSession = null;
  syncControls();
  if (updates.length > 1) el.statusMessage.textContent = `Scaled ${selectedFrameLabel()}`;
  renderAll();
}

function flipH() {
  if (selection) {
    const result = flipSelectionInFrame(currentPlayer().pixels, selection, "horizontal", state.width, state.height);
    if (!result.selection) { selection = null; el.statusMessage.textContent = "The selection contains no live pixels"; renderAll(); return; }
    pushHistory();
    currentPlayer().pixels = result.pixels;
    selection = result.selection;
    renderAll();
    return;
  }
  pushHistory();
  forEachSelectedFrame(frame => {
    const width = frame.width || 8;
    const player = frame.players[state.activePlayer];
    player.pixels = player.pixels.map(row => [...row.slice(0, width).reverse(), ...Array(8 - width).fill(0)]);
  });
  if (selectedFrameIndices().length > 1) el.statusMessage.textContent = `Flipped ${selectedFrameLabel()} horizontally`;
  renderAll();
}

function flipV(withColors = false) {
  if (selection) {
    const result = flipSelectionInFrame(currentPlayer().pixels, selection, "vertical", state.width, state.height);
    if (!result.selection) { selection = null; el.statusMessage.textContent = "The selection contains no live pixels"; renderAll(); return; }
    pushHistory();
    currentPlayer().pixels = result.pixels;
    selection = result.selection;
    renderAll();
    return;
  }
  pushHistory();
  forEachSelectedFrame(frame => {
    const player = frame.players[state.activePlayer];
    player.pixels.reverse();
    if (withColors) player.colors.reverse();
  });
  if (selectedFrameIndices().length > 1) el.statusMessage.textContent = `Flipped ${selectedFrameLabel()} vertically`;
  renderAll();
}

function flipColor() {
  const hasPixelSelection = !!selection;
  const hasColorSelection = colorSelection?.player === state.activePlayer && colorSelection.mask?.some(Boolean);
  if (!hasPixelSelection && !hasColorSelection) {
    pushHistory();
    forEachSelectedFrame(frame => frame.players[state.activePlayer].colors.reverse());
    if (selectedFrameIndices().length > 1) el.statusMessage.textContent = `Flipped colors on ${selectedFrameLabel()}`;
    renderAll();
    return;
  }
  let rows = [];
  if (colorSelection?.player === state.activePlayer && colorSelection.mask?.some(Boolean)) {
    rows = colorSelection.mask.map((value, row) => value ? row : -1).filter(row => row >= 0);
  } else if (selection) {
    const live = tightenSelectionToLivePixels(currentPlayer().pixels, selection, state.width, state.height);
    if (!live) { selection = null; el.statusMessage.textContent = "The selection contains no live pixels"; renderAll(); return; }
    selection = live;
    rows = Array.from({ length: live.h }, (_, index) => live.y + index);
  }
  pushHistory();
  if (rows.length) {
    const values = rows.map(row => currentPlayer().colors[row]).reverse();
    rows.forEach((row, index) => { currentPlayer().colors[row] = values[index]; });
  } else currentPlayer().colors.reverse();
  renderAll();
}

function invert() {
  pushHistory();
  currentPlayer().pixels = currentPlayer().pixels.map(row => row.map(v => v ? 0 : 1));
  renderAll();
}

function rotateSelectedFrameSet(angle, frameIndices) {
  const signature = `frames:${state.activePlayer}:${frameIndices.join(",")}`;
  if (!rotationSession || rotationSession.signature !== signature) {
    const aspect = aspectForKernel();
    const pixelAspect = aspect.w / (aspect.h * state.verticalStretch);
    const entries = frameIndices.map(frameIndex => {
      const frame = state.frames[frameIndex];
      const player = frame.players[state.activePlayer];
      const width = frame.width || 8;
      const height = frame.height || player.pixels.length;
      const live = tightenSelectionToLivePixels(player.pixels, selectionFromRectangle({ x: 0, y: 0, w: width, h: height }), width, height);
      if (!live) return null;
      const source = Array.from({ length: live.h }, (_, y) => Array.from({ length: live.w }, (_, x) => player.pixels[live.y + y]?.[live.x + x] ? 1 : 0));
      return {
        frameIndex,
        width,
        height,
        source: live,
        originalPixels: player.pixels.map(row => row.slice()),
        session: createRotationSession(source, pixelAspect, { expandBounds: true })
      };
    }).filter(Boolean);
    rotationSession = { signature, kind: "frames", entries };
  }
  if (!rotationSession.entries.length) {
    el.statusMessage.textContent = "Draw pixels before rotating";
    return;
  }
  pushHistory(true);
  let clipped = false;
  rotationSession.entries.forEach(entry => {
    const rotated = entry.session.rotate(angle);
    const rotatedWidth = rotated[0]?.length || 0;
    const targetX = Math.round(entry.source.x + (entry.source.w - rotatedWidth) / 2);
    const targetY = Math.round(entry.source.y + (entry.source.h - rotated.length) / 2);
    const composed = compositeSelectionGrid(entry.originalPixels, entry.source, rotated, targetX, targetY, entry.width, entry.height);
    state.frames[entry.frameIndex].players[state.activePlayer].pixels = composed.pixels;
    clipped ||= targetX < 0 || targetY < 0 || targetX + rotatedWidth > entry.width || targetY + rotated.length > entry.height;
  });
  selection = null;
  el.statusMessage.textContent = clipped
    ? `Rotated ${selectedFrameLabel()}; overflow was clipped`
    : `Rotated ${selectedFrameLabel()}`;
  renderAll();
}

function rotate(angle) {
  const frameIndices = selectedFrameIndices();
  if (!selection && frameIndices.length > 1) {
    rotateSelectedFrameSet(angle, frameIndices);
    return;
  }
  const requestedSelection = selection;
  const live = tightenSelectionToLivePixels(
    currentPlayer().pixels,
    requestedSelection || selectionFromRectangle({ x: 0, y: 0, w: state.width, h: state.height }),
    state.width,
    state.height
  );
  if (!live) {
    selection = null;
    rotationSession = null;
    el.statusMessage.textContent = requestedSelection ? "The selection contains no live pixels" : "Draw pixels before rotating";
    renderAll();
    return;
  }
  const sessionKind = requestedSelection ? "selection" : "sprite";
  if (!rotationSession || rotationSession.kind !== sessionKind) {
    const aspect = aspectForKernel();
    const pixelAspect = aspect.w / (aspect.h * state.verticalStretch);
    const source = Array.from({ length: live.h }, (_, y) => Array.from({ length: live.w }, (_, x) => currentPlayer().pixels[live.y + y]?.[live.x + x] ? 1 : 0));
    rotationSession = {
      kind: sessionKind,
      source: live,
      originalPixels: currentPlayer().pixels.map(row => row.slice()),
      session: createRotationSession(source, pixelAspect, { expandBounds: true })
    };
  }
  pushHistory(true);
  const sourceSelection = rotationSession.source;
  const rotated = rotationSession.session.rotate(angle);
  const rotatedWidth = rotated[0]?.length || 0;
  const targetX = Math.round(sourceSelection.x + (sourceSelection.w - rotatedWidth) / 2);
  const targetY = Math.round(sourceSelection.y + (sourceSelection.h - rotated.length) / 2);
  const composed = compositeSelectionGrid(rotationSession.originalPixels, sourceSelection, rotated, targetX, targetY, state.width, state.height);
  currentPlayer().pixels = composed.pixels;
  selection = requestedSelection ? composed.selection : null;
  const clipped = targetX < 0 || targetY < 0 || targetX + rotatedWidth > state.width || targetY + rotated.length > state.height;
  el.statusMessage.textContent = clipped ? "Rotation expanded to the frame edge; overflow was clipped" : "Rotation ready";
  renderAll();
}

function grow() {
  if (selection) {
    const result = morphSelectionInFrame(currentPlayer().pixels, selection, "grow", state.width, state.height);
    if (!result.selection) { selection = null; el.statusMessage.textContent = "The selection contains no live pixels"; renderAll(); return; }
    pushHistory();
    currentPlayer().pixels = result.pixels;
    selection = result.selection;
    renderAll();
    return;
  }
  const updates = selectedFrameIndices().map(frameIndex => {
    const frame = state.frames[frameIndex];
    const width = frame.width || 8;
    const height = frame.height || frame.players[0].pixels.length;
    return {
      frame,
      colors: frame.players.map(player => player.colors.slice(0, height)),
      result: growRasterArtwork(frame.players.map(player => player.pixels), state.activePlayer, width, height, 8, 255)
    };
  });
  if (!updates.some(update => update.result.changed)) {
    el.statusMessage.textContent = "Draw pixels before growing";
    return;
  }
  pushHistory();
  updates.forEach(({ frame, colors, result }) => {
    if (!result.changed) return;
    frame.players.forEach((player, index) => {
      player.pixels = result.grids[index].map(row => [...row, ...Array(Math.max(0, 8 - row.length)).fill(0)].slice(0, 8));
      const nextColors = Array(result.height).fill(state.currentColor);
      colors[index].forEach((color, y) => {
        const targetY = y + result.shiftY;
        if (targetY >= 0 && targetY < result.height) nextColors[targetY] = color;
      });
      player.colors = nextColors;
    });
    frame.width = result.width;
    frame.height = result.height;
  });
  syncFrameSize();
  selection = null;
  rotationSession = null;
  syncControls();
  if (updates.length > 1) el.statusMessage.textContent = `Grew ${selectedFrameLabel()}`;
  renderAll();
}

function shrink() {
  if (selection) {
    const live = tightenSelectionToLivePixels(currentPlayer().pixels, selection, state.width, state.height);
    if (!live) { selection = null; el.statusMessage.textContent = "The selection contains no live pixels"; renderAll(); return; }
    pushHistory();
    const result = morphSelectionInFrame(currentPlayer().pixels, live, "shrink", state.width, state.height);
    currentPlayer().pixels = result.pixels;
    selection = result.selection;
    if (!selection) el.statusMessage.textContent = "Shrink removed the selected pixels";
    renderAll();
    return;
  }
  pushHistory();
  forEachSelectedFrame(frame => {
    const player = frame.players[state.activePlayer];
    const height = frame.height || player.pixels.length;
    const src = player.pixels;
    const out = Array.from({ length: height }, () => Array(8).fill(0));
    for (let y = 0; y < height; y++) for (let x = 0; x < 8; x++) {
      if (!src[y][x]) continue;
      const neighbors = [[1,0],[-1,0],[0,1],[0,-1]].every(([dx, dy]) => src[y + dy]?.[x + dx]);
      out[y][x] = neighbors ? 1 : 0;
    }
    player.pixels = out;
  });
  if (selectedFrameIndices().length > 1) el.statusMessage.textContent = `Shrank ${selectedFrameLabel()}`;
  renderAll();
}

function clearActiveFrame() {
  if (selection) {
    const live = tightenSelectionToLivePixels(currentPlayer().pixels, selection, state.width, state.height);
    if (!live) { selection = null; el.statusMessage.textContent = "The selection contains no live pixels"; renderAll(); return; }
    pushHistory();
    const mask = selectionToMask(live, state.width, state.height);
    for (let y = 0; y < state.height; y++) for (let x = 0; x < state.width; x++) if (mask[y][x]) currentPlayer().pixels[y][x] = 0;
    selection = null;
    renderAll();
    return;
  }
  if (colorSelection) {
    el.statusMessage.textContent = "Clear applies to pixel selections";
    return;
  }
  pushHistory();
  forEachSelectedFrame(frame => {
    const player = frame.players[state.activePlayer];
    const height = frame.height || player.pixels.length;
    player.pixels = Array.from({ length: height }, () => Array(8).fill(0));
    player.colors = Array.from({ length: height }, () => state.currentColor);
  });
  if (selectedFrameIndices().length > 1) el.statusMessage.textContent = `Cleared ${selectedFrameLabel()}`;
  renderAll();
}

function setHeight() {
  const height = Math.max(1, Math.min(255, Number(el.spriteHeight.value) || state.height));
  pushHistory();
  forEachSelectedFrame(frame => {
    const player = frame.players[state.activePlayer];
    resizePlayerBottomAnchored(player, height);
    frame.height = height;
  });
  state.height = playerHeight(currentFrame(), state.activePlayer);
  selection = null;
  syncControls();
  renderAll();
}

function setWidth() {
  const width = Math.max(1, Math.min(8, Number(el.spriteWidth.value) || state.width));
  pushHistory();
  forEachSelectedFrame(frame => { frame.players[state.activePlayer].width = width; frame.width = width; });
  state.width = playerWidth(currentFrame(), state.activePlayer);
  selection = null;
  syncControls();
  renderAll();
}

function applySizeToAll() {
  const source = currentPlayer();
  const height = playerHeight(currentFrame(), state.activePlayer), width = playerWidth(currentFrame(), state.activePlayer);
  const willCrop = state.frames.some(frame => {
    const player = frame.players[state.activePlayer];
    const oldHeight = playerHeight(frame, state.activePlayer);
    const retainedStart = state.twoSpriteMode ? Math.max(0, oldHeight - height) : 0;
    const croppedRows = state.twoSpriteMode ? player.pixels.slice(0, retainedStart) : player.pixels.slice(height);
    const retainedRows = player.pixels.slice(retainedStart, state.twoSpriteMode ? oldHeight : height);
    return (oldHeight > height && croppedRows.some(row => row.some(Boolean)))
      || (playerWidth(frame, state.activePlayer) > width && retainedRows.some(row => row.slice(width).some(Boolean)));
  });
  if (willCrop && !confirm("Applying this size will crop nonempty pixels. Continue?")) return;
  pushHistory();
  state.frames.forEach(frame => {
    const player = frame.players[state.activePlayer];
    player.width = width;
    resizePlayerBottomAnchored(player, height);
    player.nusiz = source.nusiz;
  });
  renderAll();
}

function applyOffsetsToAll() {
  const { xOffset, yOffset } = currentPlayer();
  pushHistory();
  applyOffsetsToAllFrames(state.frames, state.activePlayer, xOffset, yOffset);
  renderAll();
}

function applyRepeatToAll() {
  const duration = currentFrame().duration;
  pushHistory();
  state.frames.forEach(frame => frame.duration = duration);
  renderAll();
}

function insertFrame() {
  const repeat = currentFrame().duration;
  pushHistory();
  state.frames.splice(state.currentFrame + 1, 0, makeFrame(state.height, state.currentFrame + 1, state.width, repeat));
  state.currentFrame++;
  selectedFrames = new Set([state.currentFrame]);
  frameSelectionAnchor = state.currentFrame;
  renderAll();
}

function duplicateFrame() {
  const result = duplicateSelectedFrames(state.frames, selectedFrames, state.currentFrame);
  pushHistory();
  state.frames = result.frames;
  state.currentFrame = result.currentIndex;
  selectedFrames = new Set(result.selectedIndices);
  frameSelectionAnchor = state.currentFrame;
  renderAll();
}

function reverseFrames() {
  if (state.frames.length < 2) return;
  const result = reverseSelectedFrames(state.frames, selectedFrames, state.currentFrame);
  pushHistory();
  state.frames = result.frames;
  state.currentFrame = result.currentIndex;
  selectedFrames = new Set(result.selectedIndices);
  frameSelectionAnchor = state.currentFrame;
  renderAll();
}

function removeFrame() {
  if (state.frames.length <= 1) return;
  pushHistory();
  const remove = selectedFrames.size ? selectedFrames : new Set([state.currentFrame]);
  state.frames = state.frames.filter((_, index) => !remove.has(index));
  if (!state.frames.length) state.frames = [makeFrame(state.height, 0, state.width)];
  state.currentFrame = Math.min(state.currentFrame, state.frames.length - 1);
  selectedFrames = new Set([state.currentFrame]);
  renderAll();
}

function reorderFrame(from, to) {
  if (from === to || from < 0 || to < 0) return;
  pushHistory();
  const [frame] = state.frames.splice(from, 1);
  state.frames.splice(to, 0, frame);
  state.currentFrame = to;
  renderAll();
}

function moveFrame(delta) {
  const effectiveSelection = selectedFrames.size ? selectedFrames : new Set([state.currentFrame]);
  const indices = [...effectiveSelection].sort((a, b) => a - b);
  if (!indices.length || (delta < 0 && indices[0] === 0) || (delta > 0 && indices.at(-1) === state.frames.length - 1)) return;
  pushHistory();
  const active = currentFrame();
  if (delta < 0) for (const index of indices) [state.frames[index - 1], state.frames[index]] = [state.frames[index], state.frames[index - 1]];
  else for (const index of indices.reverse()) [state.frames[index], state.frames[index + 1]] = [state.frames[index + 1], state.frames[index]];
  selectedFrames = new Set([...effectiveSelection].map(index => index + delta));
  state.currentFrame = state.frames.indexOf(active);
  frameSelectionAnchor = state.currentFrame;
  renderAll();
}

function copyToNext() {
  pushHistory();
  const next = (state.currentFrame + 1) % state.frames.length;
  state.frames[next] = cloneData(currentFrame());
  state.currentFrame = next;
  renderAll();
}

function swapPlayers() {
  pushHistory();
  forEachSelectedFrame(frame => frame.players.reverse());
  renderAll();
}

function copyP0ToP1() {
  pushHistory();
  forEachSelectedFrame(frame => { frame.players[1] = cloneData(frame.players[0]); });
  renderAll();
}

function copyColorsP0ToP1() {
  pushHistory();
  forEachSelectedFrame(frame => { frame.players[1].colors = [...frame.players[0].colors]; });
  renderAll();
}

function mirrorP0ToP1() {
  pushHistory();
  forEachSelectedFrame(frame => {
    const source = frame.players[0];
    frame.players[1] = { ...cloneData(source), pixels: source.pixels.map(row => row.slice().reverse()) };
  });
  renderAll();
}

function togglePlayback() {
  if (playbackRunning) {
    clearTimeout(playTimer);
    playTimer = null;
    playbackRunning = false;
    syncPlaybackButton();
    return;
  }
  playbackRunning = true;
  syncPlaybackButton();
  schedulePlaybackStep();
}

function syncPlaybackButton() {
  const icon = playbackRunning ? "stop" : "play";
  const label = playbackRunning ? "STOP" : "PLAY";
  el.playAnim.innerHTML = `<span>${label}</span><svg><use href="#icon-${icon}"></use></svg>`;
  el.playAnim.title = `${label} animation`;
  el.playAnim.setAttribute("aria-label", `${label} animation`);
}

function schedulePlaybackStep() {
  if (!playbackRunning) return;
  const repeat = Math.max(1, Math.min(60, currentFrame().duration || 3));
  playTimer = setTimeout(() => {
    if (!state.loopPlayback && state.currentFrame >= state.frames.length - 1) {
      playbackRunning = false;
      playTimer = null;
      syncPlaybackButton();
      syncControls();
      renderAll();
      return;
    }
    state.currentFrame = (state.currentFrame + 1) % state.frames.length;
    rotationSession = null;
    syncControls();
    renderAll();
    schedulePlaybackStep();
  }, repeat * (1000 / 60));
}

function exportData() {
  state.projectName = el.projectName.value || state.projectName;
  syncActiveAnimation(state);
  const assembly = currentExportFormat === "assembly";
  const result = assembly
    ? generateAssemblyData(state, { scope: currentBbExportScope })
    : generateAnimationCode(state, {
      content: currentBbExportMode,
      scope: currentBbExportScope,
      includeProjectData: currentBbExportWithProjectData,
      includeComments: currentBbExportWithComments,
      positioning: currentBbPositioning
    });
  currentBbExportFilename = result.filename;
  const visibleDiagnostics = result.diagnostics.filter(item => item.severity !== "info");
  el.codeDiagnostics.innerHTML = visibleDiagnostics.map(item => `<div class="diagnostic ${item.severity}"><strong>${item.severity}</strong><span>${item.message}</span></div>`).join("");
  el.codeDiagnostics.hidden = visibleDiagnostics.length === 0;
  const ownership = result.diagnostics.find(item => item.code === "VARIABLE_OWNERSHIP");
  el.bbRamSummary.textContent = assembly ? "Assembly Data exports art and per-row color tables only." : ownership?.message || `${result.ramBytes || 0} variable${result.ramBytes === 1 ? "" : "s"} used.`;
  const scopeLabel = currentBbExportScope === "all" ? "All Animations" : "Current Animation";
  const contentLabel = assembly ? "Assembly Data" : currentBbExportMode === "demo" ? "Compilable Demo" : currentBbExportMode === "module" ? "Animation Module" : "Tables Only";
  openCodeDialog(`Export ${contentLabel} — ${scopeLabel}`, result.output, false);
}

function syncExportOptions() {
  const assembly = currentExportFormat === "assembly";
  const tablesOnly = currentBbExportMode === "tables";
  el.bbExportMode.disabled = assembly;
  el.bbExportOptions.disabled = assembly;
  el.bbExportPositioning.disabled = assembly || tablesOnly;
  el.bbExportMode.classList.toggle("is-disabled", assembly);
  el.bbExportOptions.classList.toggle("is-disabled", assembly);
  el.bbExportPositioning.classList.toggle("is-disabled", assembly || tablesOnly);
  el.codeText.setAttribute("aria-label", assembly ? "Assembly data" : "bB scene data");
  el.downloadBas.textContent = assembly ? "Download .asm" : "Download .bas";
}

function openCodeDialog(title, text, importMode) {
  el.codeDialogTitle.textContent = title;
  el.codeText.value = text;
  el.codeDialog.classList.toggle("bb-import-dialog", importMode);
  el.importFromText.style.display = importMode ? "inline-block" : "none";
  el.exportFormat.style.display = importMode ? "none" : "grid";
  el.bbExportMode.style.display = importMode ? "none" : "grid";
  el.bbExportScope.style.display = importMode ? "none" : "grid";
  el.bbExportOptions.style.display = importMode ? "none" : "grid";
  el.bbExportPositioning.style.display = importMode ? "none" : "grid";
  el.bbRamSummary.style.display = importMode ? "none" : "block";
  el.downloadBas.style.display = importMode ? "none" : "inline-flex";
  if (importMode) { el.codeDiagnostics.innerHTML = ""; el.codeDiagnostics.hidden = true; }
  else syncExportOptions();
  if (!el.codeDialog.open) el.codeDialog.showModal();
}
function importDataText(text) {
  const assembly = parseAssemblyData(text);
  const parsed = assembly.detected ? assembly : parseBB(text);
  const showImportError = message => {
    const diagnostic = document.createElement("div");
    diagnostic.className = "diagnostic error";
    const label = document.createElement("strong");
    label.textContent = "Import";
    const detail = document.createElement("span");
    detail.textContent = message;
    diagnostic.append(label, detail);
    el.codeDiagnostics.replaceChildren(diagnostic);
    return false;
  };
  if (parsed.error) return showImportError(parsed.error);
  if (parsed.generated && parsed.project) {
    let candidate;
    try { candidate = migrateProject(parsed.project); } catch (error) { return showImportError(`Could not import generated YAJA ${assembly.detected ? "Assembly" : "bB"} data: ${error.message}`); }
    pushHistory();
    state = { ...defaultState(), ...candidate, currentFrame: 0, activePlayer: candidate.activePlayer === 1 ? 1 : 0 };
    resetSpriteVisibility();
    normalizeProject();
    resetAnimationWorkspaceTransientState();
    syncControls();
    renderAll();
    return true;
  }
  if (!parsed.players.length) {
    return showImportError("No YAJA Assembly data or bB player sprite data found. Paste a YAJA export, Assembly tables, or one or two player#: blocks.");
  }
  pushHistory();
  state.kernel = parsed.inferredKernel || state.kernel;
  state.playerAssignments = normalizePlayerAssignments(state.playerAssignments, state.kernel);
  const height = Math.max(...parsed.players.map(p => p.rows.length));
  state.width = 8;
  state.height = height;
  currentFrame().width = 8;
  currentFrame().height = height;
  currentFrame().players.forEach(player => resizePlayer(player, height));
  const distinct = [...new Set(parsed.players.map(player => player.index).filter(Number.isInteger))];
  if (distinct.length) state.playerAssignments = normalizePlayerAssignments([distinct[0], distinct[1] ?? state.playerAssignments[1]], state.kernel);
  state.twoSpriteMode = distinct.length > 1;
  parsed.players.slice(0, 2).forEach((p, slot) => {
    const idx = p.index === null ? state.activePlayer : Math.max(0, distinct.indexOf(p.index));
    state.activePlayer = idx;
    const player = currentFrame().players[idx];
    resizePlayer(player, height);
    player.pixels = Array.from({ length: height }, () => Array(8).fill(0));
    player.colors = Array(height).fill(state.currentColor);
    player.nusiz = NUSIZ[p.nusiz] ? p.nusiz : "normal";
    p.rows.forEach((row, y) => player.pixels[y] = row);
    (p.colors || []).forEach((code, y) => {
      if (y < height) player.colors[y] = normalizeCode(code, state.currentColor);
    });
    if (p.solidColor) {
      player.solidColor = normalizeCode(p.solidColor, state.currentColor);
      if (!(p.colors || []).length) player.colors = Array(height).fill(player.solidColor);
    }
  });
  resetSpriteVisibility();
  syncControls();
  renderAll();
  return true;
}

function parseBB(text) {
  return parseBatariBasicSpriteData(text);
}

function serializedProject() {
  state.projectName = el.projectName.value || state.projectName;
  captureRegionColors(state, state.region);
  const project = snapshot();
  delete project.__selection;
  return JSON.stringify(project, null, 2);
}

function projectNameFromFilename(filename, fallback = "Untitled Project") {
  let base = String(filename || "").trim().replace(/\.json$/i, "");
  const generatedName = /_yaja2600animator$/i.test(base);
  base = base.replace(/_yaja2600animator$/i, "");
  if (generatedName) base = base.replace(/_+/g, " ");
  return base.trim() || fallback;
}

function normalizeJsonSaveName(rawName, fallbackProjectName) {
  const fallback = `${String(fallbackProjectName || "Untitled Project").trim() || "Untitled Project"}.json`;
  const entered = String(rawName || "").trim() || fallback;
  const filename = /\.json$/i.test(entered) ? entered : `${entered}.json`;
  return {
    filename,
    projectName: projectNameFromFilename(filename, fallbackProjectName)
  };
}

async function saveProject(forceSaveAs = false) {
  if (saveInProgress) return;
  saveInProgress = true;
  if (el.saveProject) {
    el.saveProject.disabled = true;
    el.saveProject.setAttribute("aria-busy", "true");
  }
  const filename = normalizeJsonSaveName(`${state.projectName || "Untitled Project"}.json`, state.projectName).filename;
  try {
    if (window.YaJaDesktop?.isDesktop) {
      const content = serializedProject();
      const bridge = window.YaJaDesktop;
      const options = {
        title: forceSaveAs ? "Save Animator Project As" : "Save Animator Project",
        suggestedName: filename,
        filters: [{ name: "YAJA Animator Projects", extensions: ["json"] }],
        content
      };
      const result = forceSaveAs || !desktopCurrentProjectPath
        ? await bridge.saveProjectAs(options)
        : await bridge.saveProject({ ...options, filePath: desktopCurrentProjectPath });
      if (!result?.canceled) {
        desktopCurrentProjectPath = result.filePath || desktopCurrentProjectPath;
        if (result.fileName) {
          state.projectName = projectNameFromFilename(result.fileName, state.projectName);
          el.projectName.value = state.projectName;
        }
        setStatus(`Saved ${result.fileName || filename}`);
      }
      return;
    }

    if ("showSaveFilePicker" in window) {
      const handle = !forceSaveAs && currentProjectFileHandle
        ? currentProjectFileHandle
        : await window.showSaveFilePicker(addProjectPickerStart({
          id: PROJECT_PICKER_ID,
          suggestedName: filename,
          types: [{
            description: "YAJA Animator Project",
            accept: { "application/json": [".json"] }
          }]
        }));
      const chosenName = projectNameFromFilename(handle.name, state.projectName);
      state.projectName = chosenName;
      el.projectName.value = chosenName;
      bindCurrentProjectFileHandle(handle);
      const writable = await handle.createWritable();
      await writable.write(serializedProject());
      await writable.close();
      setStatus(`Saved ${handle.name}`);
      return;
    }

    await downloadBlob(new Blob([serializedProject()], { type: "application/json" }), filename);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error("Could not save project.", error);
      alert(`Could not save project: ${error.message}`);
    }
  } finally {
    saveInProgress = false;
    if (el.saveProject) {
      el.saveProject.disabled = false;
      el.saveProject.removeAttribute("aria-busy");
    }
  }
}

function loadProjectContent(content) {
  try {
    const candidate = migrateProject(JSON.parse(content));
    state = candidate;
    resetSpriteVisibility();
    referenceImages.clear();
    rotationSession = null;
    normalizeProject();
    resetAnimationWorkspaceTransientState();
    syncControls();
    renderAll();
    return true;
  } catch (err) {
    alert(`Could not load project: ${err.message}`);
    return false;
  }
}

function loadProjectFile(file) {
  const reader = new FileReader();
  reader.onload = () => loadProjectContent(reader.result);
  reader.readAsText(file);
}

async function openProject() {
  if (window.YaJaDesktop?.isDesktop && typeof window.YaJaDesktop.openProject === "function") {
    const result = await window.YaJaDesktop.openProject({
      title: "Open Animator Project",
      filters: [{ name: "YAJA Animator Projects", extensions: ["json"] }]
    });
    if (!result?.canceled && loadProjectContent(result.content)) {
      desktopCurrentProjectPath = result.filePath || null;
    }
    return;
  }

  if ("showOpenFilePicker" in window) {
    try {
      const handles = await window.showOpenFilePicker(addProjectPickerStart({
        id: PROJECT_PICKER_ID,
        multiple: false,
        types: [{
          description: "YAJA Animator Project",
          accept: { "application/json": [".json"] }
        }]
      }));
      if (!Array.isArray(handles) || !handles[0]) return;
      const file = await handles[0].getFile();
      if (loadProjectContent(await file.text())) {
        bindCurrentProjectFileHandle(handles[0]);
      }
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("Open picker failed, falling back to file input.", error);
    }
  }
  el.projectFile.click();
}

function renderPngFrame(frame) {
  const cellW = 17;
  const cellH = 10;
  const slots = state.twoSpriteMode ? [0, 1] : [state.activePlayer];
  const players = slots.map(slot => frame.players[slot]);
  const widths = slots.map(slot => playerWidth(frame, slot));
  const heights = slots.map(slot => playerHeight(frame, slot));
  const horizontalGeometry = centeredCompositionGeometry(state.width, players.map((player, index) => ({ ...player, width: widths[index] })));
  const starts = horizontalGeometry.starts;
  const minX = horizontalGeometry.minX;
  const maxX = horizontalGeometry.maxX;
  const minY = Math.min(...players.map(player => player.yOffset));
  const maxY = Math.max(...players.map((player, index) => player.yOffset + heights[index]));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, (maxX - minX) * cellW);
  canvas.height = Math.max(1, (maxY - minY) * cellH);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = colorHex(state.background);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  slots.map((slot, index) => ({ slot, index }))
    .sort((a, b) => playerLayerPriority(a.slot) - playerLayerPriority(b.slot) || a.slot - b.slot)
    .forEach(({ slot, index }) => {
    const player = frame.players[slot];
    drawSheetPlayer(ctx, player, (starts[index] - minX) * cellW, (player.yOffset - minY) * cellH, cellW, cellH, heights[index], widths[index]);
  });
  return canvas;
}

function canvasPngBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not create PNG data.")), "image/png"));
}

async function exportPngFrames(frameIndices) {
  const validIndices = frameIndices.filter(index => state.frames[index]);
  if (!validIndices.length) return;
  const baseName = safeName(state.projectName);
  const digits = Math.max(3, String(state.frames.length).length);
  const entries = [];
  for (const index of validIndices) {
    const blob = await canvasPngBlob(renderPngFrame(state.frames[index]));
    entries.push({ name: `${baseName}_Frame_${String(index + 1).padStart(digits, "0")}.png`, data: blob });
  }
  if (entries.length === 1) {
    downloadBlob(entries[0].data, entries[0].name);
    return;
  }
  const scope = validIndices.length === state.frames.length ? "All_Frames" : "Selected_Frames";
  downloadBlob(await buildStoredZip(entries), `${baseName}_${scope}.zip`);
}

function selectedFrameIndices() {
  const valid = [...selectedFrames].filter(index => index >= 0 && index < state.frames.length).sort((a, b) => a - b);
  return valid.length ? valid : [state.currentFrame];
}

function openExportPngDialog() {
  el.exportPngSelected.checked = true;
  updateExportPngSummary();
  el.exportPngDialog.showModal();
}

function updateExportPngSummary() {
  const indices = el.exportPngAll.checked ? state.frames.map((_, index) => index) : selectedFrameIndices();
  const scope = el.exportPngAll.checked ? "animation" : "selection";
  el.exportPngSummary.textContent = indices.length === 1
    ? `The ${scope} will download as one individual PNG frame.`
    : `${indices.length} ${scope} frames will download as individual PNG files inside one ZIP.`;
}

async function confirmExportPng() {
  const indices = el.exportPngAll.checked
    ? state.frames.map((_, index) => index)
    : selectedFrameIndices();
  el.exportPngDialog.close();
  try { await exportPngFrames(indices); }
  catch (error) { alert(`Could not export PNG frames: ${error.message}`); }
}

function drawSheetPlayer(ctx, player, ox, oy, cellW, cellH, rows = player.pixels.length, columns = state.width) {
  const mode = nusizMode(player.nusiz);
  mode.copyOrigins.forEach(copyOrigin => {
    for (let y = 0; y < rows; y++) {
      ctx.fillStyle = colorHex(usesSolidColor() ? player.solidColor : player.colors[y]);
      for (let x = 0; x < Math.min(columns, player.pixels[y].length); x++) if (player.pixels[y][x]) {
        ctx.fillRect(ox + (copyOrigin + x * mode.scale) * cellW, oy + y * cellH, cellW * mode.scale, cellH);
      }
    }
  });
}

function blobBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("Could not read export data."));
    reader.readAsDataURL(blob);
  });
}

function exportFilters(filename) {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "json") return [{ name: "JSON Project", extensions: ["json"] }];
  if (extension === "bas") return [{ name: "batari Basic", extensions: ["bas"] }];
  if (extension === "png") return [{ name: "PNG Image", extensions: ["png"] }];
  if (extension === "zip") return [{ name: "ZIP Archive", extensions: ["zip"] }];
  return [{ name: "All Files", extensions: ["*"] }];
}

async function downloadBlob(blob, filename) {
  if (window.YaJaDesktop?.isDesktop && typeof window.YaJaDesktop.saveFileAs === "function") {
    await window.YaJaDesktop.saveFileAs({
      title: `Save ${filename}`,
      suggestedName: filename,
      filters: exportFilters(filename),
      contentBase64: await blobBase64(blob)
    });
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function setupDesktopMenuBridge() {
  if (!window.YaJaDesktop?.isDesktop || typeof window.YaJaDesktop.onMenuCommand !== "function") return;
  const click = id => document.getElementById(id)?.click();
  window.YaJaDesktop.onMenuCommand(command => {
    switch (command) {
      case "new": click("newProject"); break;
      case "open": openProject(); break;
      case "save": saveProject(false); break;
      case "save-as": saveProject(true); break;
      case "import-bb": click("importCode"); break;
      case "export-bb": click("exportCode"); break;
      case "export-png": click("exportSheet"); break;
      case "import-reference": click(state.twoSpriteMode && state.activePlayer === 1 ? "loadReferenceB" : state.twoSpriteMode ? "loadReferenceA" : "loadReference"); break;
      case "undo": undo(); break;
      case "redo": redo(); break;
      case "cut": click("cutSelection"); break;
      case "copy": click("copySelection"); break;
      case "paste": click("pasteSelection"); break;
      case "clear-selection": click("clearSelection"); break;
      case "play-toggle": click("playAnim"); break;
      case "loop-toggle": click("loopPlayback"); break;
      case "add-frame": click("insertFrame"); break;
      case "duplicate-frame": click("duplicateFrame"); break;
      case "delete-frame": click("removeFrame"); break;
      case "move-frame-left": click("moveFrameLeft"); break;
      case "move-frame-right": click("moveFrameRight"); break;
      case "reverse-frames": click("reverseFrames"); break;
      case "two-sprite-toggle": click("twoSpriteMode"); break;
      case "grid-toggle": click("showGrid"); break;
      case "colors-toggle": click("showColorColumns"); break;
      case "onion-toggle": click("onion"); break;
    }
  });
}

function syncDesktopMenuState() {
  if (!window.YaJaDesktop?.isDesktop || typeof window.YaJaDesktop.updateMenuState !== "function") return;
  const menuState = {
    twoSpriteMode: state.twoSpriteMode,
    showGrid: state.showGrid,
    showColorColumns: state.showColorColumns,
    onion: state.onion
  };
  const signature = JSON.stringify(menuState);
  if (signature === lastDesktopMenuState) return;
  lastDesktopMenuState = signature;
  window.YaJaDesktop.updateMenuState(menuState);
}

function safeName(name) {
  return String(name || "sprite").replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "sprite";
}

function readFileDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }

async function loadReference(file) {
  pushHistory();
  currentPlayer().reference = normalizeReference({ dataUrl: await readFileDataUrl(file), name: file.name, visible: true, opacity: 100, fitMode: "fit", scale: 100, threshold: 64 });
  syncControls(); renderAll();
}

function sampleReference() {
  const ref = currentReference();
  const image = imageForReference(ref);
  if (!image?.complete) return null;
  const display = layout();
  const sampleHeight = 20;
  const sampleScale = {
    x: Math.max(1, Math.round(sampleHeight * display.cellW / display.cellH)),
    y: sampleHeight
  };
  const canvas = document.createElement("canvas");
  canvas.width = 8 * sampleScale.x;
  canvas.height = state.height * sampleScale.y;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = `brightness(${ref.brightness}%) contrast(${ref.contrast}%)`;
  const rect = referenceRect(ref, image, { cellW: sampleScale.x, cellH: sampleScale.y });
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
  const sourceScale = Math.min(1, 128 / Math.max(image.naturalWidth, image.naturalHeight));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = Math.max(1, Math.round(image.naturalWidth * sourceScale));
  sourceCanvas.height = Math.max(1, Math.round(image.naturalHeight * sourceScale));
  const sourceContext = sourceCanvas.getContext("2d");
  sourceContext.imageSmoothingEnabled = false;
  sourceContext.filter = ctx.filter;
  sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);
  const sourceData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
  const background = estimateUniformBorderColor(sourceData, sourceCanvas.width, sourceCanvas.height);
  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, sampleScale, background };
}

function extractShape() {
  const sample = sampleReference();
  if (!sample) return;
  pushHistory();
  const ref = currentReference();
  const threshold = ref.threshold;
  const player = currentPlayer();
  const cells = referenceCellGrid(sample.data, 8, state.height, sample.sampleScale, threshold, sample.background, { ignoreBlackBackground: ref.ignoreBlackBackground });
  const luminance = cells.map(row => row.map(cell => sample.background ? cell.foregroundCoverage * 255 : cell.averageLuminance));
  const paintThreshold = sample.background ? 128 : threshold;
  if (ref.dither) for (let y = 0; y < state.height; y++) for (let x = 0; x < 8; x++) { const old = luminance[y][x], next = old >= paintThreshold ? 255 : 0, error = old - next; luminance[y][x] = next; [[1,0,7/16],[-1,1,3/16],[0,1,5/16],[1,1,1/16]].forEach(([dx,dy,f]) => { if (luminance[y+dy]?.[x+dx] !== undefined) luminance[y+dy][x+dx] += error*f; }); }
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < 8; x++) {
      player.pixels[y][x] = ref.dither
        ? (luminance[y][x] >= 128 ? 1 : 0)
        : (sample.background ? (referenceCellIsForeground(cells[y][x]) ? 1 : 0) : (luminance[y][x] >= threshold ? 1 : 0));
    }
  }
  renderAll();
}

function applyReferenceTransformAll() {
  const ref = currentReference(); if (!ref) return;
  pushHistory();
  state.frames.forEach(frame => { const target = frame.players[state.activePlayer].reference; if (target) Object.assign(target, { fitMode: ref.fitMode, scale: ref.scale, xOffset: ref.xOffset, yOffset: ref.yOffset }); });
  renderAll();
}

function resetReferenceDefaults() {
  const ref = currentReference();
  if (!ref) return;
  pushHistory();
  Object.assign(ref, {
    visible: true,
    opacity: 100,
    fitMode: "fit",
    scale: 100,
    xOffset: 0,
    yOffset: 0,
    threshold: 64,
    dither: false,
    ignoreBlackBackground: true,
    brightness: 100,
    contrast: 100
  });
  referenceTransformActive = false;
  el.referenceTransform.classList.remove("active");
  syncControls();
  renderAll();
}

function naturalSortFiles(files) { return [...files].sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })); }

async function confirmSequenceLoad() {
  const files = pendingSequenceFiles; if (!files.length) return;
  const start = state.currentFrame, create = el.sequenceCreateFrames.checked;
  pushHistory();
  const firstTransform = currentReference() ? { fitMode: currentReference().fitMode, scale: currentReference().scale, xOffset: currentReference().xOffset, yOffset: currentReference().yOffset } : null;
  let loaded = 0;
  for (let i = 0; i < files.length; i++) {
    const index = start + i;
    if (index >= state.frames.length) {
      if (!create) break;
      const source = currentFrame(); const frame = makeFrame(source.height, index, source.width || 8, source.duration);
      frame.players.forEach((player, slot) => Object.assign(player, { nusiz: source.players[slot].nusiz, xOffset: source.players[slot].xOffset, yOffset: source.players[slot].yOffset }));
      state.frames.push(frame);
    }
    const ref = normalizeReference({ dataUrl: await readFileDataUrl(files[i]), name: files[i].name, visible: true, opacity: 100, fitMode: "fit", scale: 100, threshold: 64 });
    if (el.sequenceApplyTransform.checked && firstTransform) Object.assign(ref, firstTransform);
    state.frames[index].players[state.activePlayer].reference = ref; loaded++;
  }
  pendingSequenceFiles = []; el.sequenceDialog.close(); syncControls(); renderAll();
  if (loaded < files.length) alert(`${loaded} images loaded; ${files.length - loaded} skipped because blank-frame creation was disabled.`);
}

function updateReferenceImportDialog() {
  const sequence = el.importFrameSequence.checked;
  el.sequenceOptions.classList.toggle("hidden", !sequence);
  el.chooseReferenceImages.textContent = sequence ? "Choose Images" : "Choose Image";
  el.sequenceSummary.textContent = sequence
    ? `Images will be naturally sorted beginning at frame ${state.currentFrame + 1} for P${state.playerAssignments[state.activePlayer]}.`
    : `The chosen image will be attached to frame ${state.currentFrame + 1} for P${state.playerAssignments[state.activePlayer]}.`;
}

function openReferenceImportDialog() {
  el.importCurrentFrame.checked = true;
  updateReferenceImportDialog();
  el.sequenceDialog.showModal();
}

function openReferenceImportDialogFor(playerIndex) {
  setActivePlayer(playerIndex);
  openReferenceImportDialog();
}

function autoColor() {
  const sample = sampleReference();
  if (!sample) return;
  pushHistory();
  const player = currentPlayer();
  const reference = currentReference();
  const threshold = reference.threshold;
  const cells = referenceCellGrid(sample.data, 8, state.height, sample.sampleScale, threshold, sample.background, { ignoreBlackBackground: reference.ignoreBlackBackground });
  for (let y = 0; y < state.height; y++) {
    const average = averageReferenceGridRow(cells[y]);
    if (average) player.colors[y] = nearestAtariColor(average.r, average.g, average.b);
  }
  renderAll();
}

function nearestAtariColor(r, g, b) {
  const palette = state.region === "PAL" ? ATARI_PAL : ATARI_NTSC;
  return nearestPaletteColor(r, g, b, palette);
}

function placeText() {
  pushHistory();
  const text = el.textToolText.value.toUpperCase();
  let x = Number(el.textToolX.value) || 0;
  let y = Number(el.textToolY.value) || 0;
  const vertical = el.textDirection.value === "vertical";
  for (const ch of text) {
    const glyph = FONT_3X5[ch] || FONT_3X5[" "];
    glyph.forEach((row, gy) => row.split("").forEach((bit, gx) => {
      if (bit === "1") setPixel(x + gx, y + gy, 1);
    }));
    if (vertical) y += 6;
    else x += 4;
  }
  el.textDialog.close();
  renderAll();
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) {
    setStatus(`Fullscreen unavailable: ${error.message}`);
  }
}

function syncFullscreenButton() {
  const active = Boolean(document.fullscreenElement);
  el.fullscreenButton.classList.toggle("active", active);
  el.fullscreenButton.setAttribute("aria-pressed", String(active));
  el.fullscreenButton.title = active ? "Exit Fullscreen" : "Toggle Fullscreen";
  el.fullscreenButton.setAttribute("aria-label", el.fullscreenButton.title);
}

function bindEvents() {
  el.fullscreenButton.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", syncFullscreenButton);
  bindValue(el.selectTheme, value => {
    state.theme = applyTheme(normalizeThemeId(value));
  }, true);
  [el.spriteCanvas, el.spriteCanvas1].forEach(canvas => {
    canvas.addEventListener("pointerdown", beginPointer);
    canvas.addEventListener("pointermove", event => { pointerInsideCanvas = true; movePointer(event); if (!isPointerDown) renderEditor(); });
    canvas.addEventListener("pointerleave", () => { pointerInsideCanvas = false; canvas.style.cursor = state.tool === "select" ? "crosshair" : ""; renderEditor(); });
    canvas.addEventListener("contextmenu", event => event.preventDefault());
  });
  document.addEventListener("pointermove", event => {
    if (!isPointerDown || !(state.tool === "select" || movingSelection)) return;
    if (event.target.closest?.("canvas[data-player]")) return;
    movePointer(event);
  }, true);
  el.spriteStage.addEventListener("pointerdown", event => {
    if (event.composedPath().some(node => node.classList?.contains("player-canvas-group"))) return;
    clearSelectionState();
    renderAll();
  });
  el.editorZone.querySelector(".canvas-band").addEventListener("pointerdown", event => {
    if (event.composedPath().some(node => node.classList?.contains("player-canvas-group") || node.classList?.contains("selection-bar"))) return;
    clearSelectionState();
    renderAll();
  });
  // Capture phase makes stroke cleanup reliable even when a palette swatch or
  // another control receives the terminating pointer event.
  document.addEventListener("pointerup", endPointer, true);
  document.addEventListener("pointercancel", endPointer, true);
  window.addEventListener("pointerup", endPointer);
  el.toolGrid.addEventListener("click", e => {
    const btn = e.target.closest("[data-tool]");
    if (!btn) return;
    if (btn.dataset.tool !== "select") clearSelectionState();
    activeColorBlockIndex = null;
    if (btn.dataset.tool !== "stamp") activeStampIndex = null;
    colorBlockHoverRow = null;
    state.tool = btn.dataset.tool;
    syncControls();
    renderAll();
  });
  bindValue(el.projectName, v => state.projectName = v);
  el.animationName.addEventListener("change", commitAnimationName);
  el.animationName.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); commitAnimationName(); el.animationName.blur(); }
    if (event.key === "ArrowDown" && el.animationMenu.classList.contains("hidden")) {
      event.preventDefault();
      el.toggleAnimationMenu.click();
      el.animationMenu.querySelector("button")?.focus();
    }
  });
  el.toggleAnimationMenu.addEventListener("click", () => {
    const willOpen = el.animationMenu.classList.contains("hidden");
    el.animationMenu.classList.toggle("hidden", !willOpen);
    el.animationName.setAttribute("aria-expanded", String(willOpen));
    el.toggleAnimationMenu.setAttribute("aria-expanded", String(willOpen));
  });
  el.newAnimation.addEventListener("click", addAnimation);
  el.duplicateAnimation.addEventListener("click", duplicateAnimation);
  el.deleteAnimation.addEventListener("click", deleteAnimation);
  document.addEventListener("pointerdown", event => {
    if (event.target.closest(".animation-library-control")) return;
    el.animationMenu.classList.add("hidden");
    el.animationName.setAttribute("aria-expanded", "false");
    el.toggleAnimationMenu.setAttribute("aria-expanded", "false");
  });
  bindValue(el.currentColor, v => { state.currentColor = normalizeCode(v, state.currentColor); if (usesSolidColor()) currentPlayer().solidColor = state.currentColor; }, true);
  bindValue(el.bgColor, v => {
    state.background = normalizeCode(v, state.background);
    el.bgColorPicker.style.setProperty("--swatch-color", colorHex(state.background));
  }, true);
  el.bgColorPicker.addEventListener("click", () => {
    el.bgColorPopover.hidden = !el.bgColorPopover.hidden;
    positionBgPalette();
  });
  bindValue(el.kernelMode, v => { state.kernel = v; state.verticalStretch = ["STANDARD", "MULTISPRITE"].includes(v) ? 2 : 1; state.playerAssignments = normalizePlayerAssignments(state.playerAssignments, v); syncControls(); }, true);
  bindValue(el.timelineFrameRepeat, v => {
    const repeat = Math.max(1, Math.min(60, Number(v) || 3));
    currentFrame().duration = repeat;
    renderFrames();
  });
  el.applyRepeatAll.addEventListener("click", applyRepeatToAll);
  bindValue(el.playerAssignment0, v => setPlayerAssignment(0, Number(v)), true);
  bindValue(el.playerAssignment1, v => setPlayerAssignment(1, Number(v)), true);
  el.spriteNusiz.addEventListener("change", () => {
    const v = el.spriteNusiz.value;
    if (!NUSIZ[v]) return;
    pushHistory();
    forEachSelectedFrame(frame => { frame.players[state.activePlayer].nusiz = v; });
    rotationSession = null;
    renderAll();
  });
  bindValue(el.spriteSolidColor, v => {
    const color = normalizeCode(v, currentPlayer().solidColor);
    forEachSelectedFrame(frame => { frame.players[state.activePlayer].solidColor = color; });
    state.currentColor = color;
  }, true);
  bindValue(el.spriteOffsetX, v => {
    const value = Number(v) || 0;
    forEachSelectedFrame(frame => { frame.players[state.activePlayer].xOffset = value; });
  }, true);
  bindValue(el.spriteOffsetY, v => {
    const value = Number(v) || 0;
    forEachSelectedFrame(frame => { frame.players[state.activePlayer].yOffset = value; });
  }, true);
  el.applySizeAll.addEventListener("click", applySizeToAll);
  el.applyOffsetsAll.addEventListener("click", applyOffsetsToAll);
  bindValue(el.zoom, v => state.zoom = sliderToZoom(v), true);
  bindValue(el.onionOpacity, v => state.onionOpacity = Number(v), true);
  bindValue(el.onionFrames, v => state.onionFrames = Math.max(1, Math.min(10, Number(v) || 1)), true);
  bindCheck(el.twoSpriteMode, v => {
    if (v && !state.twoSpriteMode) {
      pushHistory();
      state.frames.forEach(frame => {
        const source = frame.players[0];
        const target = frame.players[1];
        target.width = playerWidth(frame, 0);
        target.height = playerHeight(frame, 0);
        target.nusiz = source.nusiz;
        target.xOffset = 0;
        target.yOffset = source.yOffset;
        target.reference = null;
        target.pixels = Array.from({ length: target.height }, () => Array(8).fill(0));
        target.colors = Array.from({ length: target.height }, () => state.currentColor);
        target.solidColor = state.currentColor;
      });
    }
    state.twoSpriteMode = v;
    if (!v) {
      state.activePlayer = 0;
      if (usesSolidColor()) state.currentColor = currentPlayer().solidColor;
    }
    el.twoSpriteControls.classList.toggle("hidden", !v);
    el.playerAssignment0Label.textContent = v ? "Sprite A #" : "Sprite #";
    el.playerAssignment1Row.classList.toggle("hidden", !v);
    syncControls();
  }, true);
  el.selectSpriteA.addEventListener("click", () => setActivePlayer(0));
  el.selectSpriteB.addEventListener("click", () => setActivePlayer(1));
  el.spriteCanvasSelector0.addEventListener("click", () => setActivePlayer(0));
  el.spriteCanvasSelector1.addEventListener("click", () => setActivePlayer(1));
  el.toggleSpriteVisibility0.addEventListener("click", event => { event.stopPropagation(); toggleSpriteVisibility(0); });
  el.toggleSpriteVisibility1.addEventListener("click", event => { event.stopPropagation(); toggleSpriteVisibility(1); });
  el.autoSpriteSelection.addEventListener("change", () => {
    endPointer();
    pointerInsideCanvas = false;
    editorPreferences.autoSpriteSelection = el.autoSpriteSelection.checked;
    saveEditorPreferences(editorPreferences);
    renderAll();
  });
  el.gridSettingsDisclosure.addEventListener("toggle", positionGridSettings);
  document.addEventListener("pointerdown", event => {
    if (el.gridSettingsDisclosure.open && !el.gridSettingsDisclosure.contains(event.target) && !el.gridSettingsPopover.contains(event.target)) {
      el.gridSettingsDisclosure.open = false;
    }
  });
  el.gridColorPicker.addEventListener("input", () => updateGridPreference({ color: el.gridColorPicker.value.toUpperCase() }));
  el.bgColorPopover.addEventListener("pointerdown", event => event.stopPropagation());
  window.addEventListener("resize", positionBgPalette);
  document.addEventListener("pointerdown", event => {
    if (el.bgColorPopover.hidden || el.bgColorPopover.contains(event.target) || event.target.closest?.("#bgColorPicker")) return;
    el.bgColorPopover.hidden = true;
  });
  el.gridIntensity.addEventListener("input", () => updateGridPreference({ intensity: Number(el.gridIntensity.value) }));
  el.resetGridSettings.addEventListener("click", () => {
    delete editorPreferences.grids[state.theme];
    saveEditorPreferences(editorPreferences);
    renderAll();
  });
  bindCheck(el.showGrid, v => state.showGrid = v, true);
  bindCheck(el.showColorColumns, v => state.showColorColumns = v, true);
  bindCheck(el.onion, v => {
    state.onion = v;
    el.onionOpacity.disabled = !v;
    el.onionFrames.disabled = !v;
  }, true);
  el.loopPlayback.addEventListener("click", () => {
    state.loopPlayback = !state.loopPlayback;
    el.loopPlayback.classList.toggle("active", state.loopPlayback);
    el.loopPlayback.setAttribute("aria-pressed", String(state.loopPlayback));
  });
  bindCheck(el.mirrorDraw, v => state.mirrorDraw = v);
  bindCheck(el.fillShapes, v => state.fillShapes = v);
  bindValue(el.brushWidth, v => state.brushWidth = Math.max(1, Math.min(8, Number(v) || 1)), true);
  bindValue(el.brushHeight, v => state.brushHeight = Math.max(1, Math.min(32, Number(v) || 1)), true);
  el.displayRegion.addEventListener("change", () => switchProjectRegion(el.displayRegion.value));
  bindValue(el.refOpacity, v => { if (currentReference()) currentReference().opacity = Number(v); }, true);
  bindValue(el.refScale, v => { if (currentReference()) currentReference().scale = Number(v); }, true);
  bindValue(el.refX, v => { if (currentReference()) currentReference().xOffset = Number(v); }, true);
  bindValue(el.refY, v => { if (currentReference()) currentReference().yOffset = Number(v); }, true);
  bindValue(el.threshold, v => { if (currentReference()) currentReference().threshold = Number(v); });
  bindValue(el.refFitMode, v => { if (currentReference()) currentReference().fitMode = v; }, true);
  bindCheck(el.refDither, v => { if (currentReference()) currentReference().dither = v; });
  bindCheck(el.refIgnoreBlack, v => { if (currentReference()) currentReference().ignoreBlackBackground = v; });
  bindValue(el.refBrightness, v => { if (currentReference()) currentReference().brightness = Number(v); }, true);
  bindValue(el.refContrast, v => { if (currentReference()) currentReference().contrast = Number(v); }, true);
  el.spriteHeight.addEventListener("change", setHeight);
  el.spriteHeight.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); setHeight(); el.spriteHeight.blur(); } });
  el.spriteWidth.addEventListener("change", setWidth);
  el.spriteWidth.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); setWidth(); el.spriteWidth.blur(); } });
  el.undo.addEventListener("click", undo);
  el.redo.addEventListener("click", redo);
  document.querySelectorAll("[data-nudge]").forEach(btn => btn.addEventListener("click", () => {
    const d = btn.dataset.nudge;
    nudge(d === "left" ? -1 : d === "right" ? 1 : 0, d === "up" ? -1 : d === "down" ? 1 : 0);
  }));
  el.nudgePixels.addEventListener("change", syncNudgeButtons);
  el.nudgeColors.addEventListener("change", syncNudgeButtons);
  [el.stretchHDown, el.stretchHUp, el.stretchVDown, el.stretchVUp, el.scaleUniformDown, el.scaleUniformUp].forEach(button => button.addEventListener("click", () => {
    const axis = button.id.startsWith("stretchH") ? "horizontal" : button.id.startsWith("stretchV") ? "vertical" : "uniform";
    scaleArtwork(axis, button.id.endsWith("Up") ? 1 : -1);
  }));
  el.flipH.addEventListener("click", flipH);
  el.flipV.addEventListener("click", () => flipV(false));
  el.flipColor.addEventListener("click", flipColor);
  el.rotateL.addEventListener("click", () => rotate(-Math.abs(Number(el.rotateAngle.value) || 45)));
  el.rotateR.addEventListener("click", () => rotate(Math.abs(Number(el.rotateAngle.value) || 45)));
  el.grow.addEventListener("click", grow);
  el.shrink.addEventListener("click", shrink);
  el.clearFrame.addEventListener("click", clearActiveFrame);
  el.insertFrame.addEventListener("click", insertFrame);
  el.duplicateFrame.addEventListener("click", duplicateFrame);
  el.removeFrame.addEventListener("click", removeFrame);
  el.moveFrameLeft.addEventListener("click", () => moveFrame(-1));
  el.moveFrameRight.addEventListener("click", () => moveFrame(1));
  el.reverseFrames.addEventListener("click", reverseFrames);
  el.framesList.addEventListener("pointerdown", beginTimelinePointer);
  el.framesList.addEventListener("pointermove", moveTimelinePointer);
  el.framesList.addEventListener("pointerup", endTimelinePointer);
  el.framesList.addEventListener("pointercancel", endTimelinePointer);
  el.playAnim.addEventListener("click", togglePlayback);
  el.playbackThumbnailZoom.addEventListener("input", () => {
    playbackThumbnailZoom = Math.max(1, Math.min(16, Number(el.playbackThumbnailZoom.value) || 6));
    syncPlaybackThumbnailControls();
    if (!playbackThumbnailCollapsed) renderPlaybackThumbnail();
  });
  el.togglePlaybackThumbnailVisibility.addEventListener("click", event => {
    event.stopPropagation();
    togglePlaybackThumbnailVisibility();
  });
  el.playbackThumbnail.addEventListener("pointerdown", beginPlaybackThumbnailDrag);
  el.playbackThumbnail.addEventListener("pointermove", movePlaybackThumbnailDrag);
  el.playbackThumbnail.addEventListener("pointerup", endPlaybackThumbnailDrag);
  el.playbackThumbnail.addEventListener("pointercancel", endPlaybackThumbnailDrag);
  el.playbackThumbnailResizeHandle.addEventListener("pointerdown", beginPlaybackThumbnailResize);
  el.playbackThumbnailResizeHandle.addEventListener("pointermove", movePlaybackThumbnailResize);
  el.playbackThumbnailResizeHandle.addEventListener("pointerup", endPlaybackThumbnailResize);
  el.playbackThumbnailResizeHandle.addEventListener("pointercancel", endPlaybackThumbnailResize);
  el.copySelection.addEventListener("click", () => copySelection(false));
  el.cutSelection.addEventListener("click", () => copySelection(true));
  el.pasteSelection.addEventListener("click", pasteSelection);
  el.stampFromSelection.addEventListener("click", makeStampFromSelection);
  el.cropSelection.addEventListener("click", cropToSelection);
  el.clearSelection.addEventListener("click", clearSelection);
  el.paletteEyedropper.addEventListener("click", () => {
    paletteEyedropperArmed = true;
    activeColorBlockIndex = null;
    activeStampIndex = null;
    state.tool = "picker";
    syncControls();
    renderAll();
  });
  el.palette.addEventListener("pointerover", event => {
    if (event.target.closest(".persistent-swatch")) reconcileRenderedRowColors();
  });
  el.colorBlockEditorHeight.addEventListener("change", resizeColorBlockEditor);
  el.colorBlockHueOffset.addEventListener("input", () => { colorBlockEditorHueOffset = Math.max(0, Math.min(15, Number(el.colorBlockHueOffset.value) || 0)); renderColorBlockEditor(); });
  el.colorBlockLightnessOffset.addEventListener("input", () => { colorBlockEditorLightnessOffset = Math.max(0, Math.min(7, Number(el.colorBlockLightnessOffset.value) || 0)); renderColorBlockEditor(); });
  [el.colorBlockHueOffset, el.colorBlockLightnessOffset].forEach(control => {
    control.addEventListener("pointerdown", pushColorBlockEditorHistory);
  });
  el.colorBlockEditorLines.addEventListener("pointerdown", beginColorBlockEditorPointer);
  el.colorBlockEditorLines.addEventListener("pointermove", moveColorBlockEditorPointer);
  el.colorBlockEditorLines.addEventListener("pointerup", endColorBlockEditorPointer);
  el.colorBlockEditorLines.addEventListener("pointercancel", endColorBlockEditorPointer);
  el.colorBlockEditorLines.addEventListener("contextmenu", event => event.preventDefault());
  el.saveColorBlockEdit.addEventListener("click", () => saveColorBlockEdit(false));
  el.saveColorBlockCopy.addEventListener("click", () => saveColorBlockEdit(true));
  el.newColorBlock.addEventListener("click", () => colorSelection ? createColorBlockFromSelection() : openColorBlockEditor(null));
  el.newStamp.addEventListener("click", () => openStampEditor(null));
  el.stampEditorWidth.addEventListener("change", resizeStampEditorData);
  el.stampEditorHeight.addEventListener("change", resizeStampEditorData);
  el.stampEditorZoom.addEventListener("input", renderStampEditorCanvas);
  el.stampEditorCanvas.addEventListener("pointerdown", beginStampEditorPointer);
  el.stampEditorCanvas.addEventListener("pointermove", moveStampEditorPointer);
  el.stampEditorCanvas.addEventListener("pointerup", endStampEditorPointer);
  el.stampEditorCanvas.addEventListener("pointercancel", endStampEditorPointer);
  el.stampEditorCanvas.addEventListener("pointerleave", () => { if (!stampEditorPointer) { stampEditorHoverCell = null; el.stampEditorCanvas.style.cursor = state.tool === "select" ? "crosshair" : ""; renderStampEditorCanvas(); } });
  el.stampEditorCanvas.addEventListener("contextmenu", event => event.preventDefault());
  el.stampEditorCanvasContainer.addEventListener("pointerdown", event => {
    if (event.target !== el.stampEditorCanvasContainer) return;
    stampEditorSelection = null;
    renderStampEditorCanvas();
  });
  el.saveStampEdit.addEventListener("click", () => saveStampEdit(false));
  el.saveStampCopy.addEventListener("click", () => saveStampEdit(true));
  el.swapPlayers.addEventListener("click", swapPlayers);
  el.copyP0P1.addEventListener("click", copyP0ToP1);
  el.copyColorsP0P1.addEventListener("click", copyColorsP0ToP1);
  el.mirrorP0P1.addEventListener("click", mirrorP0ToP1);
  el.exportCode.addEventListener("click", exportData);
  el.importCode.addEventListener("click", () => openCodeDialog("Import Data", "", true));
  el.importFromText.addEventListener("click", () => {
    if (importDataText(el.codeText.value)) el.codeDialog.close();
  });
  el.copyCode.addEventListener("click", () => navigator.clipboard?.writeText(el.codeText.value));
  [el.exportFormatBb, el.exportFormatAssembly].forEach(control => control.addEventListener("change", () => {
    if (!control.checked) return;
    currentExportFormat = control.value;
    syncExportOptions();
    exportData();
  }));
  [el.exportBbTables, el.exportBbModule, el.exportBbDemo].forEach(control => control.addEventListener("change", () => {
    if (!control.checked) return;
    currentBbExportMode = control.value;
    syncExportOptions();
    exportData();
  }));
  [el.exportBbCurrent, el.exportBbAll].forEach(control => control.addEventListener("change", () => { if (!control.checked) return; currentBbExportScope = control.value; exportData(); }));
  el.exportWithProjectData.addEventListener("change", () => { currentBbExportWithProjectData = el.exportWithProjectData.checked; exportData(); });
  el.exportWithComments.addEventListener("change", () => { currentBbExportWithComments = el.exportWithComments.checked; exportData(); });
  [el.exportPositionSprite, el.exportPositionAnchor].forEach(control => control.addEventListener("change", () => {
    if (!control.checked) return;
    currentBbPositioning = control.value;
    exportData();
  }));
  el.downloadBas.addEventListener("click", () => downloadBlob(new Blob([el.codeText.value], { type: "text/plain" }), currentBbExportFilename || (currentExportFormat === "assembly" ? assemblyExportFilename(state.animationName, currentBbExportScope) : animationExportFilename(state.animationName, currentBbExportMode))));
  el.exportSheet.addEventListener("click", openExportPngDialog);
  [el.exportPngSelected, el.exportPngAll].forEach(control => control.addEventListener("change", updateExportPngSummary));
  el.confirmExportPng.addEventListener("click", confirmExportPng);
  el.saveProject.addEventListener("click", async event => {
    await saveProject(true);
    if (window.YaJaDesktop?.isDesktop && event.detail > 0) el.saveProject.blur();
  });
  el.loadProject.addEventListener("click", openProject);
  el.projectFile.addEventListener("change", e => {
    if (!e.target.files[0]) return;
    bindCurrentProjectFileHandle(null);
    loadProjectFile(e.target.files[0]);
    e.target.value = "";
  });
  el.newProject.addEventListener("click", () => {
    if (!confirm("Start a new project?")) return;
    state = defaultState();
    resetSpriteVisibility();
    desktopCurrentProjectPath = null;
    bindCurrentProjectFileHandle(null);
    history = [];
    redoStack = [];
    referenceImages.clear();
    rotationSession = null;
    selectedFrames = new Set([0]);
    frameSelectionAnchor = 0;
    syncControls();
    renderAll();
  });
  el.loadReference.addEventListener("click", openReferenceImportDialog);
  el.loadReferenceA.addEventListener("click", () => openReferenceImportDialogFor(0));
  el.loadReferenceB.addEventListener("click", () => openReferenceImportDialogFor(1));
  [el.importCurrentFrame, el.importFrameSequence].forEach(input => input.addEventListener("change", updateReferenceImportDialog));
  el.chooseReferenceImages.addEventListener("click", () => {
    el.refFile.multiple = el.importFrameSequence.checked;
    el.refFile.click();
  });
  el.refFile.addEventListener("change", async event => {
    const files = naturalSortFiles(event.target.files);
    event.target.value = "";
    if (!files.length) return;
    if (el.importFrameSequence.checked) {
      pendingSequenceFiles = files;
      await confirmSequenceLoad();
    } else {
      el.sequenceDialog.close();
      await loadReference(files[0]);
    }
  });
  el.timelineHeading.addEventListener("click", event => {
    if (event.target.closest(".animation-library-control")) return;
    selectedFrames.clear();
    renderFrames();
  });
  el.framesActions.addEventListener("click", event => {
    if (event.target !== el.framesActions) return;
    selectedFrames.clear();
    renderFrames();
  });
  el.extractShape.addEventListener("click", extractShape);
  el.autoColor.addEventListener("click", autoColor);
  el.removeReference.addEventListener("click", () => {
    if (!currentReference()) return; pushHistory(); currentPlayer().reference = null; referenceTransformActive = false;
    syncControls();
    renderAll();
  });
  el.toggleReference.addEventListener("click", () => { if (!currentReference()) return; pushHistory(); currentReference().visible = !currentReference().visible; syncControls(); renderAll(); });
  el.referenceTransform.addEventListener("click", () => { referenceTransformActive = !referenceTransformActive; el.referenceTransform.classList.toggle("active", referenceTransformActive); renderEditor(); });
  el.resetReferenceDefaults.addEventListener("click", resetReferenceDefaults);
  el.applyReferenceTransformAll.addEventListener("click", applyReferenceTransformAll);
  el.placeText.addEventListener("click", placeText);
  window.addEventListener("resize", () => { renderAll(); clampPlaybackThumbnailToCanvas(); positionColorBlockEditor(); });
  el.palettePanel.closest(".right-panel")?.addEventListener("scroll", positionColorBlockEditor, { passive: true });
  window.addEventListener("keydown", handleKeys);
}

function bindValue(node, setter, redraw = false) {
  node.addEventListener("input", () => {
    setter(node.value);
    if (redraw) renderAll();
  });
  node.addEventListener("change", () => {
    setter(node.value);
    if (redraw) renderAll();
  });
}

function bindCheck(node, setter, redraw = false) {
  node.addEventListener("change", () => {
    setter(node.checked);
    if (redraw) renderAll();
  });
}

function undo() {
  if (el.stampEditor?.open) { undoStampEditor(); return; }
  if (el.colorBlockEditor?.open) { undoColorBlockEditor(); return; }
  const snap = history.pop();
  if (!snap) return;
  redoStack.push(snapshot());
  restore(snap);
}

function redo() {
  if (el.stampEditor?.open) { redoStampEditor(); return; }
  if (el.colorBlockEditor?.open) { redoColorBlockEditor(); return; }
  const snap = redoStack.pop();
  if (!snap) return;
  history.push(snapshot());
  restore(snap);
}

function isTextEntryTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target.matches("textarea, [contenteditable='true']")) return true;
  if (!target.matches("input")) return false;
  return !["button", "checkbox", "color", "file", "radio", "range", "reset", "submit"].includes((target.type || "text").toLowerCase());
}

function handleKeys(e) {
  const commandKey = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  const redoKey = commandKey && ((e.shiftKey && (key === "z" || key === "r")) || key === "y");
  if (e.key === "Escape" && el.gridSettingsDisclosure.open) {
    e.preventDefault();
    el.gridSettingsDisclosure.open = false;
    el.gridSettingsDisclosure.querySelector("summary")?.focus();
    return;
  }
  if (commandKey && key === "z" && el.stampEditor?.open) { e.preventDefault(); e.shiftKey ? redoStampEditor() : undoStampEditor(); return; }
  if (redoKey && el.stampEditor?.open) { e.preventDefault(); redoStampEditor(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && el.stampEditor?.open) { e.preventDefault(); redoStampEditor(); return; }
  if (commandKey && key === "z" && el.colorBlockEditor?.open) { e.preventDefault(); e.shiftKey ? redoColorBlockEditor() : undoColorBlockEditor(); return; }
  if (redoKey && el.colorBlockEditor?.open) { e.preventDefault(); redoColorBlockEditor(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && el.colorBlockEditor?.open) { e.preventDefault(); redoColorBlockEditor(); return; }
  if (el.stampEditor?.open && stampEditorSelection && e.key.startsWith("Arrow")) {
    e.preventDefault();
    moveStampEditorSelection(e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0, e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0);
    return;
  }
  if (el.stampEditor?.open && stampEditorSelection && e.key === "Delete") {
    e.preventDefault();
    pushStampEditorHistory();
    const rect = stampEditorSelection;
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) if (rect.mask?.[y]?.[x] ?? true) stampEditorData[rect.y + y][rect.x + x] = 0;
    renderStampEditorCanvas();
    return;
  }
  if (e.key === "Escape" && el.stampEditor?.open) {
    if (stampEditorSelection) { stampEditorSelection = null; renderStampEditorCanvas(); }
    else el.stampEditor.close();
    return;
  }
  if (e.key === "Escape" && el.colorBlockEditor?.open) { el.colorBlockEditor.close(); return; }
  if (isTextEntryTarget(e.target)) return;
  if (commandKey && key === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (redoKey) { e.preventDefault(); redo(); return; }
  if (commandKey && key === "c" && selection) { e.preventDefault(); copySelection(false); return; }
  if (commandKey && key === "x" && selection) { e.preventDefault(); copySelection(true); return; }
  if (commandKey && key === "v" && clipboard) { e.preventDefault(); pasteSelection(); return; }
  if (e.code === "Space" && !el.stampEditor?.open && !el.colorBlockEditor?.open) {
    e.preventDefault();
    togglePlayback();
    return;
  }
  if (state.tool === "select" && selection && e.key.startsWith("Arrow")) {
    e.preventDefault();
    nudge(e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0, e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0);
    return;
  }
  if (e.key === "ArrowLeft" && !e.ctrlKey) { state.currentFrame = Math.max(0, state.currentFrame - 1); rotationSession = null; syncControls(); renderAll(); }
  if (e.key === "ArrowRight" && !e.ctrlKey) { state.currentFrame = Math.min(state.frames.length - 1, state.currentFrame + 1); rotationSession = null; syncControls(); renderAll(); }
  if (e.key === "Delete" && selection) copySelection(true);
  if (e.key === "Escape" && (activeStampIndex !== null || activeColorBlockIndex !== null)) {
    activeStampIndex = null; activeColorBlockIndex = null; colorBlockHoverRow = null; state.tool = "pencil"; syncControls(); renderAll();
  }
  if (e.key === "Escape" && state.tool === "select" && (selection || colorSelection)) {
    e.preventDefault();
    clearSelectionState();
    syncControls();
    renderAll();
    return;
  }
  if (e.key === "Escape" && paletteEyedropperArmed) {
    paletteEyedropperArmed = false; state.tool = "pencil"; syncControls(); renderAll();
  }
}

function cacheElements() {
  [
    "selectTheme", "projectName", "animationName", "toggleAnimationMenu", "animationMenu", "newAnimation", "duplicateAnimation", "deleteAnimation", "newProject", "saveProject", "loadProject", "projectFile", "exportCode", "importCode", "exportSheet", "fullscreenButton",
    "toolGrid", "spriteWidth", "spriteHeight", "kernelMode", "bgColor", "twoSpriteMode", "twoSpriteControls", "activeSpriteTabs", "selectSpriteA", "selectSpriteB", "autoSpriteSelection", "autoSpriteSelectionRow", "offsetControls", "spriteOffsetXRow", "spriteOffsetYRow", "timelineFrameRepeat", "applyRepeatAll",
    "playerAssignment0", "playerAssignment0Row", "playerAssignment0Label", "playerAssignment1", "playerAssignment1Row", "spriteNusizLabel", "spriteNusiz", "spriteSolidColorRow", "spriteSolidColor", "spriteOffsetX", "spriteOffsetY", "applySizeAll", "applyOffsetsAll", "swapPlayers", "copyP0P1", "copyColorsP0P1", "mirrorP0P1", "fillShapes", "mirrorDraw", "brushWidth", "brushHeight", "undo", "redo",
    "nudgePixels", "nudgeColors", "scaleStep", "stretchHDown", "stretchHUp", "stretchVDown", "stretchVUp", "scaleUniformDown", "scaleUniformUp", "flipH", "flipV", "flipColor", "rotateL", "rotateR", "rotateAngle", "grow", "shrink", "clearFrame",
    "frameLabel", "pixelReadout", "canvasReadout", "showGrid", "gridSettingsDisclosure", "gridSettingsPopover", "gridColorPicker", "gridIntensity", "gridIntensityValue", "resetGridSettings", "bgColorPicker", "bgColorPopover", "bgPalette", "showColorColumns", "onion", "onionOpacity", "onionFrames", "zoom", "playAnim", "loopPlayback", "timelineSummary", "timelineHeading", "framesActions", "editorZone",
    "canvasBand", "canvasStageScroll", "spriteStage", "lockedSpriteFeedback", "compositionBackdrop", "compositionColorColumns", "playerCanvasGroup0", "playerCanvasGroup1", "spriteCanvas", "spriteCanvas1", "spriteCanvasLabel0", "spriteCanvasLabel1", "spriteCanvasSelector0", "spriteCanvasSelector1", "spriteCanvasAssignment0", "spriteCanvasAssignment1", "toggleSpriteVisibility0", "toggleSpriteVisibility1", "previewCanvas", "previewCaption", "playbackThumbnail", "playbackThumbnailCanvas", "playbackThumbnailZoom", "togglePlaybackThumbnailVisibility", "playbackThumbnailResizeHandle", "rowColors0", "rowColors1", "p0ColorsColumn", "p1ColorsColumn", "p0ColorsTitle", "p1ColorsTitle", "selectionBar", "selectionInfo", "copySelection",
    "cutSelection", "pasteSelection", "stampFromSelection", "cropSelection", "clearSelection", "insertFrame", "duplicateFrame",
    "removeFrame", "moveFrameLeft", "moveFrameRight", "reverseFrames", "framesList", "currentColorSwatch", "currentColor",
    "palettePanel", "palette", "displayRegion", "paletteEyedropper", "colorBlocks", "stamps", "newColorBlock", "newStamp", "colorBlockEditor", "colorBlockEditorTitle", "colorBlockEditorHeight", "colorBlockEditorLines", "colorBlockHueOffset", "colorBlockHueOffsetValue", "colorBlockLightnessOffset", "colorBlockLightnessOffsetValue", "saveColorBlockEdit", "saveColorBlockCopy", "stampEditor", "stampEditorTitle", "stampEditorWidth", "stampEditorHeight", "stampEditorZoom", "stampEditorReadout", "stampEditorCanvasContainer", "stampEditorCanvas", "stampEditorPreviewCanvas", "saveStampEdit", "saveStampCopy",
    "refFile", "loadReference", "loadReferenceA", "loadReferenceB", "referenceImportSingle", "referenceImportDual", "refControls", "refOpacity", "refScale", "refX", "refY", "threshold", "refDither", "refIgnoreBlack", "refFitMode", "refBrightness", "refContrast", "referenceTransform", "resetReferenceDefaults", "applyReferenceTransformAll", "toggleReference", "extractShape",
    "autoColor", "removeReference", "sequenceDialog", "sequenceSummary", "sequenceCreateFrames", "sequenceApplyTransform", "sequenceOptions", "importCurrentFrame", "importFrameSequence", "chooseReferenceImages", "exportPngDialog", "exportPngSummary", "exportPngSelected", "exportPngAll", "confirmExportPng", "codeDialog", "codeDialogTitle", "exportFormat", "bbExportMode", "bbExportScope", "bbExportOptions", "bbExportPositioning", "bbRamSummary", "exportFormatBb", "exportFormatAssembly", "exportBbTables", "exportBbModule", "exportBbDemo", "exportBbCurrent", "exportBbAll", "codeText", "copyCode", "downloadBas",
    "importFromText", "codeDiagnostics", "bbProjectDataOption", "bbCommentsOption", "exportWithProjectData", "exportWithComments", "exportPositionSprite", "exportPositionAnchor", "textDialog", "textToolText", "textToolY", "textToolX", "textDirection", "placeText",
    "statusKernel", "statusFrame", "statusMessage"
  ].forEach(id => el[id] = document.getElementById(id === "fullscreenButton" ? "btn-fullscreen" : id));
}

function init() {
  cacheElements();
  document.querySelectorAll("button[title]").forEach(button => {
    if (!button.hasAttribute("aria-label")) button.setAttribute("aria-label", button.title);
  });
  [el.spriteCanvas, el.spriteCanvas1].forEach((canvas, player) => {
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-label", `Player ${player} 8-pixel Atari sprite editing canvas`);
  });
  if (el.previewCanvas) {
    el.previewCanvas.setAttribute("role", "img");
    el.previewCanvas.setAttribute("aria-label", "TIA sprite preview");
  }
  state = defaultState();
  normalizeProject();
  bindEvents();
  setupDesktopMenuBridge();
  syncControls();
  renderAll();
}

init();
