import { normalizeAtariCode } from "./codegen.js";

const blankPlayer = height => ({ pixels: Array.from({ length: height }, () => Array(8).fill(0)), colors: Array(height).fill("$0E"), solidColor: "$0E", nusiz: "normal", xOffset: 0, yOffset: 0, reference: null });
const keyFor = (namespace, frame, player) => `${namespace}_Frame${String(frame).padStart(2, "0")}_P${player}`;

function assemblyError(message) { return { detected: true, players: [], error: message }; }

function tableMap(text) {
  const lines = String(text || "").split(/\r?\n/);
  const graphics = new Map(), colorValues = new Map(), colorTables = new Map();
  for (let index = 0; index < lines.length; index++) {
    const graphicsLabel = lines[index].match(/^\s*([A-Za-z_][A-Za-z0-9_]*)_Frame(\d+)_P(\d+)_Gfx:\s*$/);
    if (graphicsLabel) {
      const base = keyFor(graphicsLabel[1], Number(graphicsLabel[2]), Number(graphicsLabel[3]));
      const rows = [];
      while (++index < lines.length) {
        const row = lines[index].match(/^\s*\.byte\s+%([01]{8})\s*$/i);
        if (!row) { index--; break; }
        rows.push(row[1].split("").map(Number));
      }
      if (!rows.length) throw new Error(`${base} has no graphics rows.`);
      graphics.set(base, rows.reverse());
      continue;
    }
    const colorConstant = lines[index].match(/^\s*([A-Za-z_][A-Za-z0-9_]*_Frame\d+_P\d+)_Color_(\d+)\s+equ\s+(\$[0-9A-Fa-f]{1,2})\s*$/i);
    if (colorConstant) {
      const values = colorValues.get(colorConstant[1]) || new Map();
      values.set(Number(colorConstant[2]), normalizeAtariCode(colorConstant[3]));
      colorValues.set(colorConstant[1], values);
      continue;
    }
    const colorLabel = lines[index].match(/^\s*([A-Za-z_][A-Za-z0-9_]*_Frame\d+_P\d+)_Color:\s*$/);
    if (colorLabel) {
      const rows = [];
      while (++index < lines.length) {
        const row = lines[index].match(/^\s*\.byte\s+([A-Za-z_][A-Za-z0-9_]*_Color_\d+)\s*$/);
        if (!row) { index--; break; }
        rows.push(row[1]);
      }
      colorTables.set(colorLabel[1], rows);
    }
  }
  return { graphics, colorValues, colorTables };
}

function colorsFor(base, height, tables) {
  const values = tables.colorValues.get(base);
  const lookup = tables.colorTables.get(base);
  if (!values || !lookup || lookup.length !== height) throw new Error(`${base} has incomplete color data.`);
  const colors = Array.from({ length: height }, (_, row) => values.get(row));
  if (colors.some(color => !color)) throw new Error(`${base} has an invalid color constant.`);
  const expected = Array.from({ length: height }, (_, row) => `${base}_Color_${String(height - row - 1).padStart(2, "0")}`);
  if (lookup.some((label, row) => label !== expected[row])) throw new Error(`${base} color lookup must be bottom-up.`);
  return colors;
}

function playerFor(meta, tables) {
  const base = keyFor(meta.namespace, meta.frame, meta.player);
  const pixels = tables.graphics.get(base);
  if (!pixels) throw new Error(`Missing graphics table ${base}_Gfx.`);
  if (pixels.length !== meta.height) throw new Error(`${base} has ${pixels.length} rows; expected ${meta.height}.`);
  return { pixels, colors: colorsFor(base, meta.height, tables), solidColor: normalizeAtariCode(meta.solidColor || "$0E"), nusiz: meta.nusiz || "normal", width: meta.width, height: meta.height, xOffset: Number(meta.xOffset) || 0, yOffset: Number(meta.yOffset) || 0, reference: null };
}

function projectFromManifest(manifest, tables) {
  if (manifest.formatVersion !== 1 || !Array.isArray(manifest.animations) || !manifest.animations.length) throw new Error("Unsupported or incomplete YAJA Assembly manifest.");
  const animations = manifest.animations.map((animation, animationIndex) => ({
    id: String(animation.id || `animation-${animationIndex + 1}`), name: String(animation.name || `Untitled Animation ${animationIndex + 1}`),
    currentFrame: 0, twoSpriteMode: !!animation.twoSpriteMode, activePlayer: animation.activePlayer === 1 ? 1 : 0, playerAssignments: Array.isArray(animation.playerAssignments) ? animation.playerAssignments : [0, 1],
    frames: (animation.frames || []).map((frame, frameIndex) => {
      const height = Math.max(1, Number(frame.height) || 16);
      const players = [blankPlayer(height), blankPlayer(height)];
      (frame.players || []).forEach(player => {
        if (player.slot !== 0 && player.slot !== 1) throw new Error(`Animation ${animationIndex + 1}, frame ${frameIndex + 1} has an invalid sprite slot.`);
        players[player.slot] = playerFor({ ...player, namespace: animation.namespace, frame: frameIndex }, tables);
      });
      return { name: String(frame.name || `Frame ${frameIndex + 1}`), width: Math.max(1, Math.min(8, Number(frame.width) || 8)), height, duration: Math.max(1, Number(frame.duration) || 3), players };
    })
  }));
  if (animations.some(animation => !animation.frames.length)) throw new Error("YAJA Assembly manifest contains an animation without frames.");
  return { app: "YAJA 2600 Animator", schemaVersion: 14, version: "1.5.0", projectName: String(manifest.projectName || "Untitled Project"), kernel: manifest.kernel || "PXE", region: manifest.region === "PAL" ? "PAL" : "NTSC", background: normalizeAtariCode(manifest.background || "$00"), compositionModel: manifest.compositionModel === "tia-right-copies" ? "tia-right-copies" : "adjacent", activeAnimationId: animations.some(animation => animation.id === manifest.activeAnimationId) ? manifest.activeAnimationId : animations[0].id, animations };
}

function legacyProject(tables) {
  const groups = new Map();
  for (const [base, pixels] of tables.graphics) {
    const match = base.match(/^(.+)_Frame(\d+)_P(\d+)$/);
    if (!match) continue;
    const [, namespace, frameText, playerText] = match;
    const frames = groups.get(namespace) || new Map();
    const entries = frames.get(Number(frameText)) || [];
    entries.push({ base, player: Number(playerText), pixels });
    frames.set(Number(frameText), entries);
    groups.set(namespace, frames);
  }
  if (!groups.size) throw new Error("No YAJA Assembly graphics tables found.");
  const animations = [...groups].map(([namespace, frames], animationIndex) => {
    const indices = [...frames.keys()].sort((a, b) => a - b);
    if (indices.some((value, index) => value !== index)) throw new Error(`${namespace} has non-contiguous frame labels.`);
    const assignments = [...new Set(indices.flatMap(index => frames.get(index).map(entry => entry.player)))].slice(0, 2);
    return {
      id: `legacy-${animationIndex + 1}`, name: namespace.replace(/_/g, " "), currentFrame: 0, twoSpriteMode: assignments.length > 1, activePlayer: 0, playerAssignments: [assignments[0] ?? 0, assignments[1] ?? 1],
      frames: indices.map(index => {
        const entries = frames.get(index), height = Math.max(...entries.map(entry => entry.pixels.length)), players = [blankPlayer(height), blankPlayer(height)];
        entries.slice(0, 2).forEach((entry, slot) => {
          const colors = colorsFor(entry.base, entry.pixels.length, tables);
          players[slot] = { pixels: entry.pixels, colors, solidColor: colors[0], nusiz: "normal", width: 8, height: entry.pixels.length, xOffset: 0, yOffset: 0, reference: null };
        });
        return { name: `Frame ${index + 1}`, width: 8, height, duration: 3, players };
      })
    };
  });
  return { app: "YAJA 2600 Animator", schemaVersion: 14, version: "1.5.0", projectName: "Imported Assembly Data", kernel: "PXE", region: "NTSC", background: "$00", compositionModel: "adjacent", activeAnimationId: animations[0].id, animations };
}

// Common hand-written DASM sources often use a simple label followed by .byte,
// BYTE, .db, dc.b, or fcb values. These helpers intentionally accept only
// labelled sprite/color tables, never arbitrary program instructions.
function sourceWithoutComment(line) {
  return String(line || "").replace(/;.*/, "").replace(/\/\/.*/, "").trim();
}

function assemblyByte(token) {
  const value = String(token || "").trim().replace(/^#/, "");
  let parsed = null;
  if (/^%[01]{1,8}$/.test(value)) parsed = parseInt(value.slice(1), 2);
  else if (/^\$[0-9a-f]{1,2}$/i.test(value)) parsed = parseInt(value.slice(1), 16);
  else if (/^0x[0-9a-f]{1,2}$/i.test(value)) parsed = parseInt(value.slice(2), 16);
  else if (/^0b[01]{1,8}$/i.test(value)) parsed = parseInt(value.slice(2), 2);
  else if (/^\d{1,3}$/.test(value)) parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 255 ? parsed : null;
}

function dataBytes(line) {
  const match = sourceWithoutComment(line).match(/^\s*(?:\.?byte|\.?db|dc\.b|fcb)\b\s*(.+)$/i);
  if (!match) return null;
  const tokens = match[1].split(",").map(token => token.trim()).filter(Boolean);
  if (!tokens.length) return [];
  const values = tokens.map(assemblyByte);
  return values.every(value => value !== null) ? values : null;
}

function playerIndexFromLabel(label) {
  const normalized = String(label || "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  const match = normalized.match(/(?:player|sprite|p|colup)([01])(?:gfx|graphic|graphics|image|bitmap|shape|data|color|colors|colup)?$/);
  return match ? Number(match[1]) : null;
}

function isColorTable(label) {
  return /(?:color|colup)/i.test(label);
}

function isSpriteTable(label) {
  if (isColorTable(label)) return false;
  return /(?:gfx|graphic|image|bitmap|shape)/i.test(label) || /(?:sprite|player|character|char)[A-Za-z0-9_\-]*(?:data)?$/i.test(label);
}

function genericTables(text) {
  const lines = String(text || "").split(/\r?\n/);
  const tables = [];
  let current = null;
  const isBareLabel = (line, index) => /^[A-Za-z_][A-Za-z0-9_]*\s*$/.test(sourceWithoutComment(line)) && dataBytes(lines[index + 1] || "") !== null;
  for (let index = 0; index < lines.length; index++) {
    const source = sourceWithoutComment(lines[index]);
    const labelMatch = source.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    const bareLabel = !labelMatch && isBareLabel(lines[index], index) ? source : null;
    if (labelMatch || bareLabel) {
      const label = labelMatch ? labelMatch[1] : bareLabel;
      current = { label, values: [] };
      tables.push(current);
      const inline = labelMatch ? dataBytes(labelMatch[2]) : null;
      if (inline?.length) current.values.push(...inline);
      continue;
    }
    const bytes = dataBytes(source);
    if (bytes !== null && current) {
      current.values.push(...bytes);
      continue;
    }
    if (source) current = null;
  }
  return tables;
}

function genericSpriteImport(text) {
  const tables = genericTables(text);
  const graphics = tables.filter(table => isSpriteTable(table.label));
  if (!graphics.length) return { detected: false, players: [] };
  if (graphics.every(table => !table.values.length)) return { detected: true, players: [], error: "Assembly sprite table has no readable byte rows." };
  const colors = tables.filter(table => isColorTable(table.label) && table.values.length);
  const byIndex = new Map();
  graphics.forEach(table => {
    if (!table.values.length || byIndex.size >= 2 && playerIndexFromLabel(table.label) === null) return;
    const index = playerIndexFromLabel(table.label);
    const slot = index ?? (byIndex.has(0) ? 1 : 0);
    if (!byIndex.has(slot)) byIndex.set(slot, table);
  });
  const players = [...byIndex.entries()].sort(([a], [b]) => a - b).map(([index, table]) => {
    const rawColors = colors.find(candidate => playerIndexFromLabel(candidate.label) === index) || (index === 0 ? colors.find(candidate => playerIndexFromLabel(candidate.label) === null) : null);
    const height = table.values.length;
    const colorValues = rawColors?.values.map(value => normalizeAtariCode(`$${value.toString(16).padStart(2, "0")}`)) || [];
    const rowColors = colorValues.length === 1 ? Array(height).fill(colorValues[0]) : Array.from({ length: height }, (_, row) => colorValues[row] || colorValues[colorValues.length - 1] || "$0E");
    const reverse = /(?:bottom[_-]?up|reverse)/i.test(table.label);
    const rows = table.values.map(value => Array.from({ length: 8 }, (_, bit) => (value & (0x80 >> bit)) ? 1 : 0));
    return { index, rows: reverse ? rows.reverse() : rows, colors: reverse ? rowColors.reverse() : rowColors, solidColor: rowColors[0] || "$0E", nusiz: "normal" };
  });
  return players.length ? { detected: true, players } : { detected: true, players: [], error: "No readable Assembly sprite byte tables found." };
}

export function parseAssemblyData(text) {
  const source = String(text || "");
  const manifestLine = source.match(/^;@YAJA ASSEMBLY_MANIFEST\s+(.+)$/m);
  const yajaLabelPresent = /_Frame\d+_P\d+_Gfx:\s*$/m.test(source);
  if (manifestLine || yajaLabelPresent) {
    try {
      const tables = tableMap(source);
      const project = manifestLine ? projectFromManifest(JSON.parse(manifestLine[1]), tables) : legacyProject(tables);
      return { detected: true, generated: true, project, players: [], legacy: !manifestLine };
    } catch (error) {
      return assemblyError(error.message);
    }
  }
  const generic = genericSpriteImport(source);
  if (!generic.detected) return { detected: false };
  if (generic.error) return assemblyError(generic.error);
  return { detected: true, generated: false, players: generic.players, legacy: true };
}
