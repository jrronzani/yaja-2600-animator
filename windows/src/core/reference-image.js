export function averageVisibleRowColor(data, width, y, threshold, alphaThreshold = 50) {
  let r = 0, g = 0, b = 0, count = 0;
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (data[i + 3] < alphaThreshold) continue;
    const bright = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (bright < threshold) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
  }
  return count ? { r: r / count, g: g / count, b: b / count, count } : null;
}

function colorDistance(r, g, b, background) {
  return Math.hypot(r - background.r, g - background.g, b - background.b);
}

function sampleDimensions(sampleScale) {
  if (sampleScale && typeof sampleScale === "object") {
    return {
      x: Math.max(1, Math.round(Number(sampleScale.x) || 1)),
      y: Math.max(1, Math.round(Number(sampleScale.y) || 1))
    };
  }
  const size = Math.max(1, Math.round(Number(sampleScale) || 1));
  return { x: size, y: size };
}

export function fittedReferenceRect({ imageWidth, imageHeight, columns = 8, rows, cellWidth, cellHeight, fitMode = "fit", scale = 100, xOffset = 0, yOffset = 0 }) {
  const boxW = columns * cellWidth;
  const boxH = rows * cellHeight;
  let drawW = boxW;
  let drawH = boxH;
  if (fitMode !== "stretch" && imageWidth > 0 && imageHeight > 0) {
    const ratio = fitMode === "crop"
      ? Math.max(boxW / imageWidth, boxH / imageHeight)
      : Math.min(boxW / imageWidth, boxH / imageHeight);
    drawW = imageWidth * ratio;
    drawH = imageHeight * ratio;
  }
  const scaleFactor = scale / 100;
  drawW *= scaleFactor;
  drawH *= scaleFactor;
  return {
    x: (boxW - drawW) / 2 + xOffset * cellWidth,
    y: (boxH - drawH) / 2 + yOffset * cellHeight,
    w: drawW,
    h: drawH
  };
}

export function estimateUniformBorderColor(data, width, height, tolerance = 32, minimumShare = 0.6) {
  const samples = [];
  const add = (x, y) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] >= 8) samples.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let x = 0; x < width; x++) { add(x, 0); if (height > 1) add(x, height - 1); }
  for (let y = 1; y < height - 1; y++) { add(0, y); if (width > 1) add(width - 1, y); }
  if (!samples.length) return null;
  const median = channel => {
    const values = samples.map(sample => sample[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  const background = { r: median(0), g: median(1), b: median(2) };
  const matching = samples.filter(sample => colorDistance(sample[0], sample[1], sample[2], background) <= tolerance).length;
  return matching / samples.length >= minimumShare ? background : null;
}

export function analyzeReferenceCell(data, sampleWidth, cellX, cellY, sampleScale, threshold, background = null, alphaThreshold = 8) {
  const sample = sampleDimensions(sampleScale);
  let qualifyingWeight = 0, qualifyingLuminance = 0;
  let areaLuminance = 0;
  let r = 0, g = 0, b = 0;
  const sampleCount = sample.x * sample.y;
  for (let sy = 0; sy < sample.y; sy++) {
    for (let sx = 0; sx < sample.x; sx++) {
      const x = cellX * sample.x + sx;
      const y = cellY * sample.y + sy;
      const i = (y * sampleWidth + x) * 4;
      const alpha = data[i + 3];
      if (alpha < alphaThreshold) continue;
      const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
      areaLuminance += luminance * (alpha / 255);
      const qualifies = background
        ? colorDistance(data[i], data[i + 1], data[i + 2], background) >= threshold
        : luminance >= threshold;
      if (!qualifies) continue;
      const weight = alpha / 255;
      qualifyingWeight += weight;
      qualifyingLuminance += luminance * weight;
      r += data[i] * weight; g += data[i + 1] * weight; b += data[i + 2] * weight;
    }
  }
  return qualifyingWeight ? {
    coverage: qualifyingWeight / sampleCount,
    foregroundCoverage: qualifyingWeight / sampleCount,
    averageLuminance: areaLuminance / sampleCount,
    luminance: qualifyingLuminance / qualifyingWeight,
    r: r / qualifyingWeight,
    g: g / qualifyingWeight,
    b: b / qualifyingWeight,
    weight: qualifyingWeight
  } : { coverage: 0, foregroundCoverage: 0, averageLuminance: areaLuminance / sampleCount, luminance: 0, r: 0, g: 0, b: 0, weight: 0 };
}

export function referenceCellGrid(data, columns, rows, sampleScale, threshold, background = null) {
  const sample = sampleDimensions(sampleScale);
  const sampleWidth = columns * sample.x;
  return Array.from({ length: rows }, (_, y) => Array.from({ length: columns }, (_, x) =>
    analyzeReferenceCell(data, sampleWidth, x, y, sample, threshold, background)
  ));
}

export function referenceCellIsForeground(cell, minimumCoverage = 0.4) {
  return Number(cell?.foregroundCoverage) >= minimumCoverage;
}

export function averageReferenceGridRow(cells) {
  let r = 0, g = 0, b = 0, weight = 0;
  cells.forEach(cell => {
    if (!cell.weight) return;
    r += cell.r * cell.weight; g += cell.g * cell.weight; b += cell.b * cell.weight;
    weight += cell.weight;
  });
  return weight ? { r: r / weight, g: g / weight, b: b / weight, count: weight } : null;
}

function rgbToLab(r, g, b) {
  const linear = value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const lr = linear(r), lg = linear(g), lb = linear(b);
  const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175;
  const z = (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) / 1.08883;
  const pivot = value => value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const fx = pivot(x), fy = pivot(y), fz = pivot(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function nearestPaletteColor(r, g, b, palette, fallback = "$0E") {
  let best = fallback;
  let distance = Infinity;
  const target = rgbToLab(r, g, b);
  Object.entries(palette).forEach(([code, hex]) => {
    const cr = Number.parseInt(hex.slice(1, 3), 16);
    const cg = Number.parseInt(hex.slice(3, 5), 16);
    const cb = Number.parseInt(hex.slice(5, 7), 16);
    const lab = rgbToLab(cr, cg, cb);
    const candidate = (target[0] - lab[0]) ** 2 + (target[1] - lab[1]) ** 2 + (target[2] - lab[2]) ** 2;
    if (candidate < distance) { distance = candidate; best = code; }
  });
  return best;
}
