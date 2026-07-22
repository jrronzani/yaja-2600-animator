function clonePixels(pixels) {
  const width = Math.max(1, ...pixels.map(row => row?.length || 0));
  return pixels.map(row => Array.from({ length: width }, (_, x) => row?.[x] ? 1 : 0));
}

function setPixel(output, x, y) {
  if (y >= 0 && y < output.length && x >= 0 && x < (output[0]?.length || 0)) output[y][x] = 1;
}

function rasterConnectedLine(output, from, to) {
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    setPixel(output, x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const doubled = error * 2;
    if (doubled >= dy) { error += dy; x0 += sx; }
    if (doubled <= dx) { error += dx; y0 += sy; }
  }
}

function rotateQuarterTurn(pixels, turns) {
  const source = clonePixels(pixels);
  const normalizedTurns = ((turns % 4) + 4) % 4;
  if (normalizedTurns === 0) return source;
  if (normalizedTurns === 2) return source.slice().reverse().map(row => row.slice().reverse());
  const height = source.length;
  const width = source[0]?.length || 0;
  if (normalizedTurns === 1) {
    return Array.from({ length: width }, (_, y) => Array.from({ length: height }, (_, x) => source[height - 1 - x]?.[y] ? 1 : 0));
  }
  return Array.from({ length: width }, (_, y) => Array.from({ length: height }, (_, x) => source[x]?.[width - 1 - y] ? 1 : 0));
}

function centerCrop(grid, width, height) {
  const sourceHeight = grid.length;
  const sourceWidth = grid[0]?.length || 0;
  const offsetX = Math.floor((sourceWidth - width) / 2);
  const offsetY = Math.floor((sourceHeight - height) / 2);
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => grid[y + offsetY]?.[x + offsetX] ? 1 : 0));
}

function resampleNearest(grid, targetWidth, targetHeight) {
  const sourceHeight = grid.length;
  const sourceWidth = grid[0]?.length || 0;
  const width = Math.max(1, Math.trunc(targetWidth));
  const height = Math.max(1, Math.trunc(targetHeight));
  if (!sourceWidth || !sourceHeight) return Array.from({ length: height }, () => Array(width).fill(0));
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
    const sy = Math.min(sourceHeight - 1, Math.floor((y + .5) * sourceHeight / height));
    const sx = Math.min(sourceWidth - 1, Math.floor((x + .5) * sourceWidth / width));
    return grid[sy]?.[sx] ? 1 : 0;
  }));
}

function rotateRaster(pixels, angleDegrees, pixelAspect = 1, expandBounds = false) {
  const height = pixels.length;
  const width = pixels[0]?.length || 8;
  if (!height) return [];
  const normalized = ((Number(angleDegrees) || 0) % 360 + 360) % 360;
  if (normalized === 0) return clonePixels(pixels);
  // Exact quarter turns are a discrete pixel operation, not a resampling
  // operation. Keeping them lossless preserves hollow outlines, single-pixel
  // gaps, diagonals, and disconnected details. Pixel-aspect correction remains
  // active for every non-quarter-turn angle.
  const quarterTurns = Math.round(normalized / 90);
  if (Math.abs(normalized - quarterTurns * 90) < 1e-9) {
    const exact = rotateQuarterTurn(pixels, quarterTurns);
    if (!expandBounds) return centerCrop(exact, width, height);
    if (quarterTurns % 2 === 0) return exact;
    const aspect = Math.max(0.1, Number(pixelAspect) || 1);
    // Preserve topology first, then adapt the matrix to the dimensions of the
    // same physical object after a quarter turn. A minimum of three cells on
    // an axis keeps a representable one-cell hollow center from collapsing.
    const targetWidth = Math.max(exact[0]?.length >= 3 ? 3 : 1, Math.round(height / aspect));
    const targetHeight = Math.max(exact.length >= 3 ? 3 : 1, Math.round(width * aspect));
    return resampleNearest(exact, targetWidth, targetHeight);
  }
  const angle = (normalized * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const aspect = Math.max(0.1, Number(pixelAspect) || 1);
  // Rotate the physical pixel rectangle, including half-cell extents, so a
  // diagonal result receives the wider/taller raster it actually occupies.
  // The epsilon prevents exact quarter turns from gaining a phantom cell due
  // to floating-point noise.
  const physicalWidth = width * aspect;
  const physicalHeight = height;
  const outputWidth = expandBounds
    ? Math.max(1, Math.ceil((Math.abs(physicalWidth * cos) + Math.abs(physicalHeight * sin)) / aspect - 1e-9))
    : width;
  const outputHeight = expandBounds
    ? Math.max(1, Math.ceil(Math.abs(physicalWidth * sin) + Math.abs(physicalHeight * cos) - 1e-9))
    : height;
  const outputCx = (outputWidth - 1) / 2;
  const outputCy = (outputHeight - 1) / 2;
  const output = Array.from({ length: outputHeight }, () => Array(outputWidth).fill(0));
  const forwardPoint = (x, y) => {
    const sx = (x - cx) * aspect;
    const sy = y - cy;
    return {
      x: Math.round(outputCx + (sx * cos - sy * sin) / aspect),
      y: Math.round(outputCy + sx * sin + sy * cos)
    };
  };

  // Reverse sampling preserves filled regions and deterministic native-size cropping.
  for (let y = 0; y < outputHeight; y++) for (let x = 0; x < outputWidth; x++) {
    const dx = (x - outputCx) * aspect;
    const dy = y - outputCy;
    const sourceX = Math.round(cx + (dx * cos + dy * sin) / aspect);
    const sourceY = Math.round(cy - dx * sin + dy * cos);
    if (sourceX >= 0 && sourceX < width && sourceY >= 0 && sourceY < height) output[y][x] = pixels[sourceY]?.[sourceX] ? 1 : 0;
  }

  // Forward-map every occupied source cell so a thin feature cannot fall between
  // destination cell centers. Join originally adjacent cells after transforming
  // their centers to preserve horizontal, vertical, and diagonal connectivity.
  const neighborDirections = [[1, 0], [0, 1], [1, 1], [-1, 1]];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!pixels[y]?.[x]) continue;
    const from = forwardPoint(x, y);
    setPixel(output, from.x, from.y);
    for (const [dx, dy] of neighborDirections) {
      if (!pixels[y + dy]?.[x + dx]) continue;
      rasterConnectedLine(output, from, forwardPoint(x + dx, y + dy));
    }
  }
  return output;
}

export function rotateSprite(pixels, angleDegrees, pixelAspect = 1) {
  return rotateRaster(pixels, angleDegrees, pixelAspect, false);
}

export function rotateSpriteExpanded(pixels, angleDegrees, pixelAspect = 1) {
  return rotateRaster(pixels, angleDegrees, pixelAspect, true);
}

export function createRotationSession(pixels, pixelAspect = 1, options = {}) {
  const source = clonePixels(pixels);
  let angle = 0;
  const expandBounds = options.expandBounds === true;
  return {
    source,
    get angle() { return angle; },
    rotate(delta) {
      angle = (angle + Number(delta || 0)) % 360;
      return rotateRaster(source, angle, pixelAspect, expandBounds);
    }
  };
}
