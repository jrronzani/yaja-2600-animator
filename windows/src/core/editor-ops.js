export function extractSelectionPixels(pixels, rect) {
  return Array.from({ length: rect.h }, (_, y) => Array.from({ length: rect.w }, (_, x) => pixels[rect.y + y]?.[rect.x + x] ? 1 : 0));
}

export function placeSelectionPixels(basePixels, oldRect, data, nx, ny) {
  const height = basePixels.length;
  const width = basePixels[0]?.length || 8;
  const out = basePixels.map(row => row.slice());
  for (let y = 0; y < oldRect.h; y++) for (let x = 0; x < oldRect.w; x++) {
    if (out[oldRect.y + y]) out[oldRect.y + y][oldRect.x + x] = 0;
  }
  data.forEach((row, y) => row.forEach((value, x) => {
    const ty = ny + y, tx = nx + x;
    if (value && ty >= 0 && ty < height && tx >= 0 && tx < width) out[ty][tx] = 1;
  }));
  return out;
}

export function moveSelection(pixels, rect, dx, dy) {
  const height = pixels.length;
  const width = pixels[0]?.length || 8;
  const x = Math.max(0, Math.min(width - rect.w, rect.x + dx));
  const y = Math.max(0, Math.min(height - rect.h, rect.y + dy));
  const data = extractSelectionPixels(pixels, rect);
  return { pixels: placeSelectionPixels(pixels, rect, data, x, y), selection: { ...rect, x, y } };
}

export function brushCells(x, y, brushWidth, brushHeight, width = 8, height = 255) {
  const ox = Math.floor(brushWidth / 2);
  const oy = Math.floor(brushHeight / 2);
  const cells = [];
  for (let by = 0; by < brushHeight; by++) for (let bx = 0; bx < brushWidth; bx++) {
    const tx = x - ox + bx, ty = y - oy + by;
    if (tx >= 0 && tx < width && ty >= 0 && ty < height) cells.push([tx, ty]);
  }
  return cells;
}

// Returns every logical raster cell crossed by a pointer segment. Keeping this
// independent of browser event frequency makes fast strokes continuous on both
// the main canvas and the Stamp Editor.
export function rasterLineCells(x0, y0, x1, y1) {
  let x = Math.round(Number(x0) || 0);
  let y = Math.round(Number(y0) || 0);
  const endX = Math.round(Number(x1) || 0);
  const endY = Math.round(Number(y1) || 0);
  const dx = Math.abs(endX - x);
  const sx = x < endX ? 1 : -1;
  const dy = -Math.abs(endY - y);
  const sy = y < endY ? 1 : -1;
  const cells = [];
  let error = dx + dy;
  while (true) {
    cells.push([x, y]);
    if (x === endX && y === endY) return cells;
    const twiceError = 2 * error;
    if (twiceError >= dy) { error += dy; x += sx; }
    if (twiceError <= dx) { error += dx; y += sy; }
  }
}

// Painter-parity circle geometry: the pointer-down cell is the visual center,
// while the drag vector determines a radius in rendered (not logical) pixels.
// Converting that radius back through each cell axis keeps the result circular
// after Atari pixel aspect, kernel vertical stretch, and NUSIZ are applied.
export function visualCircleGeometry(x0, y0, x1, y1, cellWidth = 1, cellHeight = 1) {
  const cw = Math.max(.0001, Math.abs(Number(cellWidth) || 1));
  const ch = Math.max(.0001, Math.abs(Number(cellHeight) || 1));
  const visualRadius = Math.hypot((Number(x1) - Number(x0)) * cw, (Number(y1) - Number(y0)) * ch);
  return {
    cx: Number(x0) || 0,
    cy: Number(y0) || 0,
    visualRadius,
    rx: visualRadius / cw,
    ry: visualRadius / ch,
    cellWidth: cw,
    cellHeight: ch
  };
}

export function circlePivotFromPointer(localX, localY, cellWidth, cellHeight, width, height, snapRatio = .18) {
  const cw = Math.max(.0001, Math.abs(Number(cellWidth) || 1));
  const ch = Math.max(.0001, Math.abs(Number(cellHeight) || 1));
  const columns = Math.max(1, Math.floor(Number(width) || 1));
  const rows = Math.max(1, Math.floor(Number(height) || 1));
  const gridX = Number(localX) / cw;
  const gridY = Number(localY) / ch;
  const lineX = Math.round(gridX);
  const lineY = Math.round(gridY);
  const threshold = Math.max(.05, Math.min(.3, Number(snapRatio) || .18));
  const atInternalIntersection = lineX > 0 && lineX < columns && lineY > 0 && lineY < rows
    && Math.abs(gridX - lineX) <= threshold && Math.abs(gridY - lineY) <= threshold;
  if (atInternalIntersection) return { x: lineX - .5, y: lineY - .5, mode: "intersection" };
  return {
    x: Math.max(0, Math.min(columns - 1, Math.floor(gridX))),
    y: Math.max(0, Math.min(rows - 1, Math.floor(gridY))),
    mode: "cell"
  };
}

export function visualCircleCells(x0, y0, x1, y1, cellWidth = 1, cellHeight = 1, filled = false) {
  const geometry = visualCircleGeometry(x0, y0, x1, y1, cellWidth, cellHeight);
  const { cx, cy, rx, ry } = geometry;
  if (geometry.visualRadius < .0001) return { geometry, cells: [[Math.round(cx), Math.round(cy)]] };

  const centerX = Math.round(cx * 2) / 2;
  const centerY = Math.round(cy * 2) / 2;
  const cells = new Map();
  const add = (x, y) => cells.set(`${x},${y}`, [x, y]);
  const addMirrors = (positiveX, positiveY) => {
    const negativeX = Math.round(2 * centerX - positiveX);
    const negativeY = Math.round(2 * centerY - positiveY);
    add(positiveX, positiveY);
    add(negativeX, positiveY);
    add(positiveX, negativeY);
    add(negativeX, negativeY);
  };
  if (filled) {
    for (let y = Math.ceil(centerY); y <= Math.ceil(centerY + ry); y++) {
      for (let x = Math.ceil(centerX); x <= Math.ceil(centerX + rx); x++) {
        if (((x - centerX) ** 2) / (rx ** 2) + ((y - centerY) ** 2) / (ry ** 2) <= 1) addMirrors(x, y);
      }
    }
  } else {
    // Rasterize one quadrant and reflect every result. Math.round() resolves
    // negative half-cell ties toward zero, so sampling all four quadrants
    // independently can put an extra cell on the positive side at small odd/
    // even diameters. Quantizing unsigned offsets before mirroring makes every
    // outline exactly symmetric while preserving the rendered-pixel aspect.
    const steps = Math.max(8, Math.ceil(Math.max(rx, ry) * 8));
    for (let index = 0; index <= steps; index++) {
      const angle = index / steps * Math.PI / 2;
      const x = Math.floor(centerX + Math.abs(rx * Math.cos(angle)) + .5);
      const y = Math.floor(centerY + Math.abs(ry * Math.sin(angle)) + .5);
      addMirrors(x, y);
    }
  }
  return { geometry, cells: [...cells.values()] };
}

export function fullSelectionMask(width, height, value = true) {
  return Array.from({ length: Math.max(0, height) }, () => Array(Math.max(0, width)).fill(value));
}

export function selectionFromRectangle(rect) {
  return { ...rect, mask: fullSelectionMask(rect.w, rect.h) };
}

export function selectionToMask(selection, width, height) {
  const out = fullSelectionMask(width, height, false);
  if (!selection) return out;
  for (let y = 0; y < selection.h; y++) for (let x = 0; x < selection.w; x++) {
    const tx = selection.x + x, ty = selection.y + y;
    if ((selection.mask?.[y]?.[x] ?? true) && ty >= 0 && ty < height && tx >= 0 && tx < width) out[ty][tx] = true;
  }
  return out;
}

export function selectionFromMask(mask) {
  const cells = [];
  mask.forEach((row, y) => row.forEach((value, x) => value && cells.push([x, y])));
  if (!cells.length) return null;
  const xs = cells.map(([x]) => x), ys = cells.map(([, y]) => y);
  const x = Math.min(...xs), y = Math.min(...ys);
  const w = Math.max(...xs) - x + 1, h = Math.max(...ys) - y + 1;
  return { x, y, w, h, mask: Array.from({ length: h }, (_, my) => Array.from({ length: w }, (_, mx) => !!mask[y + my]?.[x + mx])) };
}

export function combineRasterSelections(base, incoming, mode, width, height) {
  if (mode === "replace" || !base) return incoming;
  const mask = selectionToMask(base, width, height);
  const next = selectionToMask(incoming, width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (next[y][x]) mask[y][x] = mode === "subtract" ? false : true;
  }
  return selectionFromMask(mask);
}

export function selectionContains(selection, x, y) {
  if (!selection) return false;
  const lx = x - selection.x, ly = y - selection.y;
  return lx >= 0 && ly >= 0 && lx < selection.w && ly < selection.h && (selection.mask?.[ly]?.[lx] ?? true);
}

export function tightenSelectionToLivePixels(pixels, selection, frameWidth = pixels?.[0]?.length || 8, frameHeight = pixels?.length || 0) {
  if (!selection) return null;
  const selected = selectionToMask(selection, frameWidth, frameHeight);
  for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) {
    selected[y][x] = !!selected[y][x] && !!pixels?.[y]?.[x];
  }
  return selectionFromMask(selected);
}

export function compositeSelectionGrid(pixels, selection, grid, targetX, targetY, frameWidth = pixels?.[0]?.length || 8, frameHeight = pixels?.length || 0) {
  const live = tightenSelectionToLivePixels(pixels, selection, frameWidth, frameHeight);
  if (!live) return { pixels: pixels.map(row => row.slice()), selection: null, changed: false };
  const out = pixels.map(row => row.slice());
  const sourceMask = selectionToMask(live, frameWidth, frameHeight);
  for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) {
    if (sourceMask[y][x]) out[y][x] = 0;
  }
  const placedMask = fullSelectionMask(frameWidth, frameHeight, false);
  for (let y = 0; y < (grid?.length || 0); y++) for (let x = 0; x < (grid?.[y]?.length || 0); x++) {
    const tx = targetX + x, ty = targetY + y;
    if (!grid[y][x] || tx < 0 || tx >= frameWidth || ty < 0 || ty >= frameHeight) continue;
    out[ty][tx] = 1;
    placedMask[ty][tx] = true;
  }
  const nextSelection = selectionFromMask(placedMask);
  const changed = out.some((row, y) => row.some((value, x) => value !== (pixels[y]?.[x] || 0)));
  return { pixels: out, selection: nextSelection, changed };
}

export function flipSelectionInFrame(pixels, selection, axis, frameWidth = pixels?.[0]?.length || 8, frameHeight = pixels?.length || 0) {
  const live = tightenSelectionToLivePixels(pixels, selection, frameWidth, frameHeight);
  if (!live) return { pixels: pixels.map(row => row.slice()), selection: null, changed: false };
  const data = Array.from({ length: live.h }, (_, y) => Array.from({ length: live.w }, (_, x) => pixels[live.y + y]?.[live.x + x] ? 1 : 0));
  const flipped = axis === "vertical" ? data.slice().reverse() : data.map(row => row.slice().reverse());
  return compositeSelectionGrid(pixels, live, flipped, live.x, live.y, frameWidth, frameHeight);
}

export function morphSelectionInFrame(pixels, selection, mode, frameWidth = pixels?.[0]?.length || 8, frameHeight = pixels?.length || 0) {
  const live = tightenSelectionToLivePixels(pixels, selection, frameWidth, frameHeight);
  if (!live) return { pixels: pixels.map(row => row.slice()), selection: null, changed: false };
  const sourceMask = selectionToMask(live, frameWidth, frameHeight);
  const resultMask = fullSelectionMask(frameWidth, frameHeight, false);
  if (mode === "grow") {
    for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) if (sourceMask[y][x]) {
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < frameWidth && ny >= 0 && ny < frameHeight) resultMask[ny][nx] = true;
      });
    }
  } else {
    for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) if (sourceMask[y][x]) {
      resultMask[y][x] = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => !!sourceMask[y + dy]?.[x + dx]);
    }
  }
  const out = pixels.map(row => row.slice());
  for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) {
    if (sourceMask[y][x]) out[y][x] = 0;
    if (resultMask[y][x]) out[y][x] = 1;
  }
  return { pixels: out, selection: selectionFromMask(resultMask), changed: true };
}

// Returns merged grid-edge segments so irregular and disconnected masks receive
// Painter-style outlines without a generic bounding rectangle.
export function maskBoundarySegments(mask) {
  const height = mask?.length || 0;
  const width = Math.max(0, ...((mask || []).map(row => row?.length || 0)));
  const inside = (x, y) => x >= 0 && x < width && y >= 0 && y < height && !!mask[y]?.[x];
  const segments = [];
  for (let y = 0; y <= height; y++) {
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const edge = x < width && inside(x, y - 1) !== inside(x, y);
      if (edge && start < 0) start = x;
      if (!edge && start >= 0) { segments.push([start, y, x, y]); start = -1; }
    }
  }
  for (let x = 0; x <= width; x++) {
    let start = -1;
    for (let y = 0; y <= height; y++) {
      const edge = y < height && inside(x - 1, y) !== inside(x, y);
      if (edge && start < 0) start = y;
      if (!edge && start >= 0) { segments.push([x, start, x, y]); start = -1; }
    }
  }
  return segments;
}

export function resampleNearest(grid, targetWidth, targetHeight, fallback = 0) {
  const sourceHeight = grid?.length || 0;
  const sourceWidth = grid?.[0]?.length || 0;
  const width = Math.max(1, Math.trunc(targetWidth));
  const height = Math.max(1, Math.trunc(targetHeight));
  if (!sourceWidth || !sourceHeight) return Array.from({ length: height }, () => Array(width).fill(fallback));
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
    const sy = Math.min(sourceHeight - 1, Math.floor((y + .5) * sourceHeight / height));
    const sx = Math.min(sourceWidth - 1, Math.floor((x + .5) * sourceWidth / width));
    return grid[sy]?.[sx] ?? fallback;
  }));
}

export function resampleValues(values, targetLength, fallback) {
  const source = Array.isArray(values) ? values : [];
  const length = Math.max(1, Math.trunc(targetLength));
  if (!source.length) return Array(length).fill(fallback);
  return Array.from({ length }, (_, index) => source[Math.min(source.length - 1, Math.floor((index + .5) * source.length / length))] ?? fallback);
}

export function rasterBounds(grid, frameWidth, frameHeight) {
  let minX = frameWidth, minY = frameHeight, maxX = -1, maxY = -1;
  for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) if (grid?.[y]?.[x]) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return maxX < minX ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function distributeExpansion(negativeNeed, positiveNeed, available) {
  const total = negativeNeed + positiveNeed;
  if (!total || !available) return { growth: 0, shift: 0 };
  const growth = Math.min(total, available);
  const shift = Math.min(negativeNeed, Math.round(growth * negativeNeed / total));
  return { growth, shift };
}

function balancedScaledStart(start, sourceSize, targetSize, frameSize, tieSeed = 0) {
  if (targetSize <= sourceSize) return Math.round(start + sourceSize / 2 - targetSize / 2);
  const extra = targetSize - sourceSize;
  let towardNegative = Math.floor(extra / 2);
  if (extra % 2) {
    const negativeSpace = start;
    const positiveSpace = frameSize - start - sourceSize;
    if (negativeSpace > positiveSpace || (negativeSpace === positiveSpace && (start + sourceSize + targetSize + tieSeed) % 2 === 0)) towardNegative++;
  }
  return start - towardNegative;
}

export function scaleRasterArtwork(grids, frameWidth, frameHeight, scaleX, scaleY, options = {}) {
  const maxWidth = Math.max(frameWidth, Math.trunc(options.maxWidth ?? 8));
  const maxHeight = Math.max(frameHeight, Math.trunc(options.maxHeight ?? 255));
  const affected = new Set(options.indices ?? grids.map((_, index) => index));
  const plans = grids.map((grid, index) => {
    const source = rasterBounds(grid, frameWidth, frameHeight);
    if (!source || !affected.has(index)) return { source, target: source, data: null, affected: false };
    const targetWidth = Math.max(1, Math.round(source.w * scaleX));
    const targetHeight = Math.max(1, Math.round(source.h * scaleY));
    const data = Array.from({ length: source.h }, (_, y) => Array.from({ length: source.w }, (_, x) => grid[source.y + y]?.[source.x + x] ? 1 : 0));
    const target = {
      x: balancedScaledStart(source.x, source.w, targetWidth, frameWidth, index),
      y: balancedScaledStart(source.y, source.h, targetHeight, frameHeight, index + 1),
      w: targetWidth,
      h: targetHeight
    };
    return { source, target, data: resampleNearest(data, targetWidth, targetHeight, 0), affected: true };
  });
  const activeTargets = plans.filter(plan => plan.affected && plan.target).map(plan => plan.target);
  if (!activeTargets.length) return { grids: grids.map(grid => grid.map(row => row.slice(0, frameWidth))), width: frameWidth, height: frameHeight, shiftX: 0, shiftY: 0, plans, changed: false };
  const minX = Math.min(...activeTargets.map(target => target.x));
  const minY = Math.min(...activeTargets.map(target => target.y));
  const maxX = Math.max(...activeTargets.map(target => target.x + target.w));
  const maxY = Math.max(...activeTargets.map(target => target.y + target.h));
  const horizontal = distributeExpansion(Math.max(0, -minX), Math.max(0, maxX - frameWidth), maxWidth - frameWidth);
  const vertical = distributeExpansion(Math.max(0, -minY), Math.max(0, maxY - frameHeight), maxHeight - frameHeight);
  const width = frameWidth + horizontal.growth;
  const height = frameHeight + vertical.growth;
  const output = grids.map((grid, index) => {
    const out = Array.from({ length: height }, () => Array(width).fill(0));
    const plan = plans[index];
    if (plan.affected && plan.target) {
      for (let y = 0; y < plan.target.h; y++) for (let x = 0; x < plan.target.w; x++) {
        const tx = plan.target.x + horizontal.shift + x, ty = plan.target.y + vertical.shift + y;
        if (tx >= 0 && tx < width && ty >= 0 && ty < height && plan.data[y]?.[x]) out[ty][tx] = 1;
      }
    } else {
      for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) if (grid?.[y]?.[x]) {
        const tx = x + horizontal.shift, ty = y + vertical.shift;
        if (tx < width && ty < height) out[ty][tx] = 1;
      }
    }
    return out;
  });
  const changed = width !== frameWidth || height !== frameHeight || output.some((grid, index) => grid.some((row, y) => row.some((value, x) => value !== (grids[index]?.[y]?.[x] || 0))));
  plans.forEach(plan => { if (plan.target) { plan.target = { ...plan.target, x: plan.target.x + horizontal.shift, y: plan.target.y + vertical.shift }; } });
  return { grids: output, width, height, shiftX: horizontal.shift, shiftY: vertical.shift, plans, changed };
}

export function growRasterArtwork(grids, activeIndex, frameWidth, frameHeight, maxWidth = 8, maxHeight = 255) {
  const source = rasterBounds(grids[activeIndex], frameWidth, frameHeight);
  if (!source) return { grids: grids.map(grid => grid.map(row => row.slice(0, frameWidth))), width: frameWidth, height: frameHeight, shiftX: 0, shiftY: 0, changed: false };
  const horizontal = distributeExpansion(source.x === 0 ? 1 : 0, source.x + source.w === frameWidth ? 1 : 0, Math.max(0, maxWidth - frameWidth));
  const vertical = distributeExpansion(source.y === 0 ? 1 : 0, source.y + source.h === frameHeight ? 1 : 0, Math.max(0, maxHeight - frameHeight));
  const width = frameWidth + horizontal.growth, height = frameHeight + vertical.growth;
  const output = grids.map(grid => {
    const out = Array.from({ length: height }, () => Array(width).fill(0));
    for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) if (grid?.[y]?.[x]) out[y + vertical.shift][x + horizontal.shift] = 1;
    return out;
  });
  const active = output[activeIndex], original = active.map(row => row.slice());
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (original[y]?.[x]) {
    [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
      const nx=x+dx, ny=y+dy;
      if (nx>=0 && nx<width && ny>=0 && ny<height) active[ny][nx]=1;
    });
  }
  return { grids: output, width, height, shiftX: horizontal.shift, shiftY: vertical.shift, changed: true };
}

export function scaleSelectionInFrame(pixels, selection, scaleX, scaleY, frameWidth, frameHeight) {
  selection = tightenSelectionToLivePixels(pixels, selection, frameWidth, frameHeight);
  if (!selection) return { pixels: pixels.map(row => row.slice()), selection: null, changed: false };
  const mask = selection.mask || fullSelectionMask(selection.w, selection.h);
  const data = Array.from({ length: selection.h }, (_, y) => Array.from({ length: selection.w }, (_, x) => mask[y]?.[x] && pixels[selection.y + y]?.[selection.x + x] ? 1 : 0));
  const targetWidth = Math.max(1, Math.round(selection.w * scaleX));
  const targetHeight = Math.max(1, Math.round(selection.h * scaleY));
  const scaledMask = resampleNearest(mask, targetWidth, targetHeight, false).map(row => row.map(Boolean));
  const scaledData = resampleNearest(data, targetWidth, targetHeight, 0);
  const centeredX = balancedScaledStart(selection.x, selection.w, targetWidth, frameWidth, 0);
  const centeredY = balancedScaledStart(selection.y, selection.h, targetHeight, frameHeight, 1);
  const globalMask = fullSelectionMask(frameWidth, frameHeight, false);
  const out = pixels.map(row => row.slice());
  for (let y = 0; y < selection.h; y++) for (let x = 0; x < selection.w; x++) {
    if (mask[y]?.[x] && out[selection.y + y]) out[selection.y + y][selection.x + x] = 0;
  }
  for (let y = 0; y < targetHeight; y++) for (let x = 0; x < targetWidth; x++) {
    const tx = centeredX + x, ty = centeredY + y;
    if (!scaledMask[y]?.[x] || tx < 0 || tx >= frameWidth || ty < 0 || ty >= frameHeight) continue;
    if (scaledData[y]?.[x]) {
      globalMask[ty][tx] = true;
      out[ty][tx] = 1;
    }
  }
  return { pixels: out, selection: selectionFromMask(globalMask), changed: true };
}

export function applyOffsetsToAllFrames(frames, playerIndex, xOffset, yOffset) {
  const slot = playerIndex === 1 ? 1 : 0;
  const nextX = Math.trunc(Number(xOffset) || 0);
  const nextY = Math.trunc(Number(yOffset) || 0);
  frames.forEach(frame => {
    if (frame?.players?.[slot]) Object.assign(frame.players[slot], { xOffset: nextX, yOffset: nextY });
  });
  return frames;
}

function validFrameIndices(indices, frameCount) {
  return [...new Set(indices || [])]
    .map(Number)
    .filter(index => Number.isInteger(index) && index >= 0 && index < frameCount)
    .sort((a, b) => a - b);
}

export function duplicateSelectedFrames(frames, selectedIndices, currentIndex) {
  const indices = validFrameIndices(selectedIndices, frames.length);
  const sourceIndices = indices.length ? indices : [Math.max(0, Math.min(frames.length - 1, currentIndex || 0))];
  const insertion = sourceIndices.at(-1) + 1;
  const duplicates = sourceIndices.map(index => structuredClone(frames[index]));
  const nextFrames = frames.slice();
  nextFrames.splice(insertion, 0, ...duplicates);
  const nextSelectedIndices = duplicates.map((_, offset) => insertion + offset);
  const activeOffset = Math.max(0, sourceIndices.indexOf(currentIndex));
  return { frames: nextFrames, selectedIndices: nextSelectedIndices, currentIndex: insertion + activeOffset };
}

export function reorderSelectedFrameBlock(frames, selectedIndices, targetSlot, currentIndex) {
  const indices = validFrameIndices(selectedIndices, frames.length);
  if (!indices.length) return { frames: frames.slice(), selectedIndices: [], currentIndex };
  const slot = Math.max(0, Math.min(frames.length, Math.trunc(Number(targetSlot) || 0)));
  const moving = indices.map(index => frames[index]);
  const activeFrame = frames[currentIndex];
  const remaining = frames.filter((_, index) => !indices.includes(index));
  const removedBeforeSlot = indices.filter(index => index < slot).length;
  const insertion = Math.max(0, Math.min(remaining.length, slot - removedBeforeSlot));
  remaining.splice(insertion, 0, ...moving);
  const nextSelectedIndices = moving.map((_, offset) => insertion + offset);
  return { frames: remaining, selectedIndices: nextSelectedIndices, currentIndex: Math.max(0, remaining.indexOf(activeFrame)) };
}

export function reverseSelectedFrames(frames, selectedIndices, currentIndex) {
  const indices = validFrameIndices(selectedIndices, frames.length);
  const targets = indices.length >= 2 ? indices : frames.map((_, index) => index);
  const nextFrames = frames.slice();
  const reversed = targets.map(index => structuredClone(frames[index])).reverse();
  targets.forEach((index, offset) => { nextFrames[index] = reversed[offset]; });
  return {
    frames: nextFrames,
    selectedIndices: indices,
    currentIndex: Math.max(0, Math.min(frames.length - 1, currentIndex))
  };
}
