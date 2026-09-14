export const ATARI_PIXEL_ASPECT = 1.7;

export const NUSIZ_MODES = Object.freeze({
  normal: Object.freeze({ label: "Normal", scale: 1, code: "$00", copyOrigins: Object.freeze([0]), group: "size" }),
  doubleClose: Object.freeze({ label: "Double Close", scale: 1, code: "$01", copyOrigins: Object.freeze([0, 16]), group: "copies" }),
  doubleMedium: Object.freeze({ label: "Double Medium", scale: 1, code: "$02", copyOrigins: Object.freeze([0, 32]), group: "copies" }),
  tripleClose: Object.freeze({ label: "Triple Close", scale: 1, code: "$03", copyOrigins: Object.freeze([0, 16, 32]), group: "copies" }),
  doubleWide: Object.freeze({ label: "Double Wide", scale: 1, code: "$04", copyOrigins: Object.freeze([0, 64]), group: "copies" }),
  double: Object.freeze({ label: "Double Width", scale: 2, code: "$05", copyOrigins: Object.freeze([0]), group: "size" }),
  tripleMedium: Object.freeze({ label: "Triple Medium", scale: 1, code: "$06", copyOrigins: Object.freeze([0, 32, 64]), group: "copies" }),
  quad: Object.freeze({ label: "Quad Width", scale: 4, code: "$07", copyOrigins: Object.freeze([0]), group: "size" })
});

export function nusizMode(value) {
  return NUSIZ_MODES[value] || NUSIZ_MODES.normal;
}

export function nusizModeKeyFromCode(value) {
  const numeric = typeof value === "number"
    ? value
    : /^\$[0-9a-f]+$/i.test(String(value || ""))
      ? Number.parseInt(String(value).slice(1), 16)
      : Number.parseInt(value, 10);
  const code = `$${((Number.isFinite(numeric) ? numeric : 0) & 7).toString(16).padStart(2, "0").toUpperCase()}`;
  return Object.keys(NUSIZ_MODES).find(key => NUSIZ_MODES[key].code === code) || "normal";
}

export function renderedSpriteWidth(width, nusiz) {
  const columns = Math.max(1, Math.min(8, Number.parseInt(width, 10) || 8));
  const mode = nusizMode(nusiz);
  return mode.copyOrigins[mode.copyOrigins.length - 1] + columns * mode.scale;
}

export const renderedSpriteSpan = renderedSpriteWidth;

export function nusizSourceColumn(displayX, width, nusiz) {
  const columns = Math.max(1, Math.min(8, Number.parseInt(width, 10) || 8));
  const mode = nusizMode(nusiz);
  const x = Number(displayX);
  for (let copyIndex = mode.copyOrigins.length - 1; copyIndex >= 0; copyIndex--) {
    const origin = mode.copyOrigins[copyIndex];
    const local = x - origin;
    if (local >= 0 && local < columns * mode.scale) {
      return { column: Math.min(columns - 1, Math.floor(local / mode.scale)), copyIndex, origin };
    }
  }
  return null;
}

// Anchor each player's primary sprite in an adjacent baseline. NUSIZ copies
// and width expansion extend to the right without moving later primaries.
export function centeredCompositionGeometry(width, players) {
  const baseWidths = players.map(player => Math.max(1, Math.min(8, Number.parseInt(player.width, 10) || width || 8)));
  const renderedWidths = players.map((player, index) => renderedSpriteWidth(baseWidths[index], player.nusiz));
  let baseline = 0;
  const starts = players.map((player, index) => {
    const value = baseline + Math.trunc(Number(player.xOffset) || 0);
    baseline += baseWidths[index];
    return value;
  });
  const minX = Math.min(...starts);
  const maxX = Math.max(...starts.map((start, index) => start + renderedWidths[index]));
  const totalWidth = Math.max(1, maxX - minX);
  const centerOffset = Math.floor(-totalWidth / 2) - minX;
  const centeredX = starts.map(start => start + centerOffset);
  return { totalWidth, baseWidths, renderedWidths, starts, minX, maxX, centeredX };
}

export function canvasCellSize(zoom, verticalStretch = 1, minimumHeight = 1) {
  const scale = Math.max(1, Number(zoom) || 1);
  const stretch = Math.max(1, Number(verticalStretch) || 1);
  const cellH = Math.max(minimumHeight, scale * stretch);
  return { cellW: scale * ATARI_PIXEL_ASPECT, cellH };
}

// Fit a sprite into a timeline preview without changing the visual pixel ratio
// used by the editor canvas. The returned cells may be fractional because the
// preview is intentionally letterboxed instead of stretched to fill its box.
export function timelineThumbnailGeometry(viewportWidth, viewportHeight, columns, rows, verticalStretch = 1, padding = 4, horizontalScale = 1) {
  const width = Math.max(1, Number(viewportWidth) || 1);
  const height = Math.max(1, Number(viewportHeight) || 1);
  const cols = Math.max(1, Number.parseInt(columns, 10) || 1);
  const lineCount = Math.max(1, Number.parseInt(rows, 10) || 1);
  const stretch = Math.max(1, Number(verticalStretch) || 1);
  const widthScale = Math.max(1, Number(horizontalScale) || 1);
  const inset = Math.max(0, Math.min(Number(padding) || 0, width / 2, height / 2));
  const availableWidth = Math.max(1, width - inset * 2);
  const availableHeight = Math.max(1, height - inset * 2);
  const scale = Math.min(availableWidth / (cols * ATARI_PIXEL_ASPECT * widthScale), availableHeight / (lineCount * stretch));
  const cellW = scale * ATARI_PIXEL_ASPECT * widthScale;
  const cellH = scale * stretch;
  const surfaceWidth = cols * cellW;
  const surfaceHeight = lineCount * cellH;
  return {
    x: (width - surfaceWidth) / 2,
    y: (height - surfaceHeight) / 2,
    cellW,
    cellH,
    surfaceWidth,
    surfaceHeight
  };
}

// Snap the complete surface to its backing store first, then derive its CSS
// cell dimensions. This prevents fractional browser scaling from creating a
// midpoint seam between the left and right halves of an eight-pixel sprite.
export function rasterSurfaceGeometry(cellW, cellH, columns, rows, pixelRatio = 1) {
  const ratio = Math.max(1, Number(pixelRatio) || 1);
  const cols = Math.max(1, Number.parseInt(columns, 10) || 1);
  const lineCount = Math.max(1, Number.parseInt(rows, 10) || 1);
  const deviceWidth = Math.max(1, Math.round(cellW * cols * ratio));
  const deviceHeight = Math.max(1, Math.round(cellH * lineCount * ratio));
  const width = deviceWidth / ratio;
  const height = deviceHeight / ratio;
  return {
    pixelRatio: ratio,
    deviceWidth,
    deviceHeight,
    width,
    height,
    cellW: width / cols,
    cellH: height / lineCount
  };
}

// Snap the cell itself so independently sized sprite canvases share the same
// backing-store coordinate lattice when their Atari positions overlap.
export function sharedRasterCellGeometry(cellW, cellH, pixelRatio = 1) {
  const ratio = Math.max(1, Number(pixelRatio) || 1);
  const deviceCellWidth = Math.max(1, Math.round((Number(cellW) || 1) * ratio));
  const deviceCellHeight = Math.max(1, Math.round((Number(cellH) || 1) * ratio));
  return {
    pixelRatio: ratio,
    deviceCellWidth,
    deviceCellHeight,
    cellW: deviceCellWidth / ratio,
    cellH: deviceCellHeight / ratio
  };
}

// Preserve continuous CSS dimensions while giving tiny cells enough backing
// pixels for crisp shared boundaries.
export function smoothRasterCellGeometry(cellW, cellH, pixelRatio = 1) {
  const width = Math.max(1, Number(cellW) || 1);
  const height = Math.max(1, Number(cellH) || 1);
  const displayRatio = Math.max(1, Number(pixelRatio) || 1);
  const precisionRatio = Math.max(displayRatio, Math.min(4, 8 / Math.min(width, height)));
  return {
    pixelRatio: precisionRatio,
    displayPixelRatio: displayRatio,
    deviceCellWidth: width * precisionRatio,
    deviceCellHeight: height * precisionRatio,
    cellW: width,
    cellH: height
  };
}

export function centeredCompositionMargins({ viewportWidth, viewportHeight, compositionWidth, compositionHeight, paddingLeft = 0, paddingTop = 0, compositionOriginX = 0, compositionOriginY = 0 }) {
  return {
    left: Math.max(0, (viewportWidth - compositionWidth) / 2 - paddingLeft - compositionOriginX),
    top: Math.max(0, (viewportHeight - compositionHeight) / 2 - paddingTop - compositionOriginY)
  };
}

// Round in backing-store pixels, then convert back to CSS coordinates. All
// cell fills, grid lines, and feedback outlines consequently share one edge.
export function rasterCellBoundary(cellSize, index, offset = 0, pixelRatio = 1) {
  const ratio = Math.max(1, Number(pixelRatio) || 1);
  return Math.round((offset + index * cellSize) * ratio) / ratio;
}

export function rasterCellBoundaryFromOrigin(cellSize, index, origin = 0, pixelRatio = 1) {
  return rasterCellBoundary(cellSize, origin + index, 0, pixelRatio)
    - rasterCellBoundary(cellSize, origin, 0, pixelRatio);
}

export function rasterCellRect(cellW, cellH, x, y, offsetX = 0, offsetY = 0, pixelRatio = 1) {
  const ratio = Math.max(1, Number(pixelRatio) || 1);
  const left = rasterCellBoundary(cellW, x, offsetX, ratio);
  const right = rasterCellBoundary(cellW, x + 1, offsetX, ratio);
  const top = rasterCellBoundary(cellH, y, offsetY, ratio);
  const bottom = rasterCellBoundary(cellH, y + 1, offsetY, ratio);
  return { x: left, y: top, w: Math.max(1 / ratio, right - left), h: Math.max(1 / ratio, bottom - top) };
}
