export const ATARI_PIXEL_ASPECT = 1.7;

export const NUSIZ_MODES = Object.freeze({
  normal: Object.freeze({ label: "Normal", scale: 1, code: "$00" }),
  double: Object.freeze({ label: "Double", scale: 2, code: "$05" }),
  quad: Object.freeze({ label: "Quad", scale: 4, code: "$07" })
});

export function nusizMode(value) {
  return NUSIZ_MODES[value] || NUSIZ_MODES.normal;
}

export function renderedSpriteWidth(width, nusiz) {
  const columns = Math.max(1, Math.min(8, Number.parseInt(width, 10) || 8));
  return columns * nusizMode(nusiz).scale;
}

// Match the editor: center the adjacent, unshifted NUSIZ composition first,
// then apply each frame's explicit X offset from that stable baseline.
export function centeredCompositionGeometry(width, players) {
  const renderedWidths = players.map(player => renderedSpriteWidth(width, player.nusiz));
  const totalWidth = Math.max(1, renderedWidths.reduce((sum, value) => sum + value, 0));
  let baseline = 0;
  const centeredX = players.map((player, index) => {
    const value = Math.floor(-totalWidth / 2) + baseline + Math.trunc(Number(player.xOffset) || 0);
    baseline += renderedWidths[index];
    return value;
  });
  return { totalWidth, renderedWidths, centeredX };
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

// Round in backing-store pixels, then convert back to CSS coordinates. All
// cell fills, grid lines, and feedback outlines consequently share one edge.
export function rasterCellBoundary(cellSize, index, offset = 0, pixelRatio = 1) {
  const ratio = Math.max(1, Number(pixelRatio) || 1);
  return Math.round((offset + index * cellSize) * ratio) / ratio;
}

export function rasterCellRect(cellW, cellH, x, y, offsetX = 0, offsetY = 0, pixelRatio = 1) {
  const ratio = Math.max(1, Number(pixelRatio) || 1);
  const left = rasterCellBoundary(cellW, x, offsetX, ratio);
  const right = rasterCellBoundary(cellW, x + 1, offsetX, ratio);
  const top = rasterCellBoundary(cellH, y, offsetY, ratio);
  const bottom = rasterCellBoundary(cellH, y + 1, offsetY, ratio);
  return { x: left, y: top, w: Math.max(1 / ratio, right - left), h: Math.max(1 / ratio, bottom - top) };
}
