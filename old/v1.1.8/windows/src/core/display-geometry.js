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

// Round shared cell edges rather than each cell's size independently so
// adjacent filled pixels meet at exactly the same device-pixel boundary.
export function rasterCellRect(cellW, cellH, x, y, offsetX = 0, offsetY = 0) {
  const left = Math.round(offsetX + x * cellW);
  const right = Math.round(offsetX + (x + 1) * cellW);
  const top = Math.round(offsetY + y * cellH);
  const bottom = Math.round(offsetY + (y + 1) * cellH);
  return { x: left, y: top, w: Math.max(1, right - left), h: Math.max(1, bottom - top) };
}
