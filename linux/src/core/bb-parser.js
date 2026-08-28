import { normalizeAtariCode, YAJA_BB_COLLECTION_FORMAT_VERSION, YAJA_BB_FORMAT_VERSION, YAJA_COORDINATE_SYSTEM } from "./codegen.js";
import { nusizModeKeyFromCode } from "./display-geometry.js";

function parseJsonMarker(line, prefix) {
  if (!line.startsWith(prefix)) return null;
  try { return JSON.parse(line.slice(prefix.length).trim()); }
  catch (error) { throw new Error(`${prefix.trim()} contains invalid JSON: ${error.message}`); }
}

export function unfoldYajaMetadataLines(text) {
  const unfolded = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    if (line.startsWith(";@YAJA+ ")) {
      const previous = unfolded[unfolded.length - 1];
      if (!previous?.startsWith(";@YAJA ")) throw new Error("YAJA project-data continuation is missing its opening comment line.");
      unfolded[unfolded.length - 1] = previous + line.slice(";@YAJA+ ".length);
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
}

function parseBlocks(text) {
  const players = [];
  const playerRegex = /player(\d+)?\s*:\s*([\s\S]*?)end/gi;
  let match;
  while ((match = playerRegex.exec(String(text || "")))) {
    const index = match[1] === undefined ? null : Number(match[1]);
    const rows = [...match[2].matchAll(/%([01]{1,8})/g)].map(bits => bits[1].padEnd(8, "0").slice(0, 8).split("").map(Number));
    if (rows.length) players.push({ index, rows, colors: [] });
  }
  const colorRegex = /player(\d+)?color\s*:\s*([\s\S]*?)end/gi;
  while ((match = colorRegex.exec(String(text || "")))) {
    const index = match[1] === undefined ? null : Number(match[1]);
    const colors = [...match[2].matchAll(/\$[0-9A-Fa-f]{2}/g)].map(code => normalizeAtariCode(code[0]));
    const target = players.find(player => player.index === index && !player.colors.length) || players.find(player => player.index === index);
    if (target) target.colors = colors;
  }
  return players;
}

function firstGeneratedFrameSection(text) {
  const source = String(text || "");
  const frameLabel = /^\s*__[A-Za-z_][A-Za-z0-9_]*_Frame\d+\s*$/gm;
  const first = frameLabel.exec(source);
  if (!first) return source;
  const start = first.index;
  const next = frameLabel.exec(source);
  return source.slice(start, next?.index ?? source.length);
}

function firstCoherentPlayerSet(text) {
  const source = firstGeneratedFrameSection(text);
  const blocks = parseBlocks(source);
  const players = [];
  const seen = new Set();
  for (const block of blocks) {
    const key = Number.isInteger(block.index) ? `P${block.index}` : "player";
    if (seen.has(key)) continue;
    seen.add(key);
    const playerNumber = Number.isInteger(block.index) ? block.index : 0;
    const escapedNumber = String(playerNumber).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const constantMatch = source.match(new RegExp(`\\bconst\\s+[A-Za-z_][A-Za-z0-9_]*Frame\\d+P${escapedNumber}Color\\s*=\\s*(\\$[0-9A-Fa-f]{2})`, "i"));
    const registerMatch = source.match(new RegExp(`\\b_?COLUP${escapedNumber}\\s*=\\s*(\\$[0-9A-Fa-f]{2})`, "i"));
    const solidColor = constantMatch?.[1] || registerMatch?.[1];
    const nusizPatterns = playerNumber === 1
      ? [`_NUSIZ1`, `NUSIZ1`]
      : [`NUSIZ${escapedNumber}`];
    let nusiz = "normal";
    for (const symbol of nusizPatterns) {
      const nusizMatch = source.match(new RegExp(`\\b${symbol}\\s*=\\s*(\\$[0-9A-Fa-f]{1,2}|\\d+)`, "i"));
      if (nusizMatch) { nusiz = nusizModeKeyFromCode(nusizMatch[1]); break; }
    }
    players.push({
      ...block,
      solidColor: solidColor ? normalizeAtariCode(solidColor) : null,
      nusiz
    });
    if (players.length === 2) break;
  }
  return players;
}

function validateCoordinateSystem(meta) {
  if (meta.coordinateSystem && (meta.coordinateSystem.screenYAxis !== YAJA_COORDINATE_SYSTEM.screenYAxis || meta.coordinateSystem.spriteAnchor !== YAJA_COORDINATE_SYSTEM.spriteAnchor)) {
    throw new Error("YAJA bB coordinates must use downward-positive screen Y with a bottom-left sprite anchor.");
  }
}

function parseGeneratedFrames(lines, meta) {
  const frames = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith(";@YAJA FRAME_BEGIN ")) continue;
    const marker = lines[i].match(/^;@YAJA FRAME_BEGIN\s+(\d+)\s+(.+)$/);
    if (!marker) throw new Error(`Malformed YAJA frame marker on line ${i + 1}.`);
    const index = Number(marker[1]);
    let fm;
    try { fm = JSON.parse(marker[2]); } catch (error) { throw new Error(`Frame ${index} metadata is invalid JSON: ${error.message}`); }
    const end = lines.findIndex((line, n) => n > i && line === `;@YAJA FRAME_END ${index}`);
    if (end < 0) throw new Error(`Frame ${index} is missing its YAJA frame-end marker.`);
    const blocks = parseBlocks(lines.slice(i + 1, end).join("\n"));
    if (blocks.length !== fm.players.length) throw new Error(`Frame ${index} metadata describes ${fm.players.length} sprite(s), but ${blocks.length} sprite block(s) were found.`);
    const slots = [null, null];
    fm.players.forEach((pm, blockIndex) => {
      const block = blocks[blockIndex];
      if (block.index !== pm.player) throw new Error(`Frame ${index} expected P${pm.player}, but its sprite block is P${block.index}.`);
      const playerHeight = Math.max(1, Number(pm.height) || fm.height);
      const playerWidth = Math.max(1, Math.min(8, Number(pm.width) || fm.width));
      if (block.rows.length !== playerHeight) throw new Error(`Frame ${index}, P${pm.player} contains ${block.rows.length} rows; metadata requires ${playerHeight}.`);
      const scanlineKernel = meta.kernel === "DPC+" || meta.kernel === "PXE";
      if (scanlineKernel && block.colors.length !== playerHeight) throw new Error(`Frame ${index}, P${pm.player} color data contains ${block.colors.length} rows; metadata requires ${playerHeight}.`);
      slots[pm.slot] = { pixels: block.rows, colors: scanlineKernel ? block.colors : Array(playerHeight).fill(normalizeAtariCode(pm.solidColor)), solidColor: normalizeAtariCode(pm.solidColor), nusiz: pm.nusiz, width: playerWidth, height: playerHeight, xOffset: pm.xOffset, yOffset: pm.yOffset, reference: null };
    });
    const blank = () => ({ pixels: Array.from({ length: fm.height }, () => Array(8).fill(0)), colors: Array(fm.height).fill("$0E"), solidColor: "$0E", nusiz: "normal", xOffset: 0, yOffset: 0, reference: null });
    frames[index] = { name: `Frame ${index}`, width: fm.width, height: fm.height, duration: fm.duration, players: slots.map(slot => slot || blank()) };
    i = end;
  }
  if (!frames.length || frames.some(frame => !frame)) throw new Error("Generated YAJA bB data has missing or non-contiguous frames.");
  return frames;
}

function parseGeneratedCollection(lines) {
  const collectionLine = lines.find(line => line.startsWith(";@YAJA COLLECTION "));
  if (!collectionLine) return null;
  const collection = parseJsonMarker(collectionLine, ";@YAJA COLLECTION ");
  if (collection.formatVersion !== YAJA_BB_COLLECTION_FORMAT_VERSION) throw new Error(`YAJA collection format ${collection.formatVersion} is not supported; this version reads format ${YAJA_BB_COLLECTION_FORMAT_VERSION}.`);
  const animations = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith(";@YAJA ANIMATION_BEGIN ")) continue;
    const marker = lines[i].match(/^;@YAJA ANIMATION_BEGIN\s+(\d+)\s+(.+)$/);
    if (!marker) throw new Error(`Malformed YAJA animation marker on line ${i + 1}.`);
    const index = Number(marker[1]);
    let animationMeta;
    try { animationMeta = JSON.parse(marker[2]); } catch (error) { throw new Error(`Animation ${index} metadata is invalid JSON: ${error.message}`); }
    const end = lines.findIndex((line, n) => n > i && line === `;@YAJA ANIMATION_END ${index}`);
    if (end < 0) throw new Error(`Animation ${index} is missing its YAJA animation-end marker.`);
    const animationLines = lines.slice(i + 1, end);
    const nestedProjectLine = animationLines.find(line => line.startsWith(";@YAJA PROJECT "));
    const nested = nestedProjectLine ? parseJsonMarker(nestedProjectLine, ";@YAJA PROJECT ") : {};
    const meta = {
      ...nested,
      kernel: collection.kernel,
      region: collection.region,
      background: collection.background,
      animationName: animationMeta.name,
      assignments: animationMeta.assignments,
      activeSlots: animationMeta.activeSlots,
      twoSpriteMode: animationMeta.twoSpriteMode,
      compositionModel: collection.compositionModel || "adjacent"
    };
    validateCoordinateSystem(meta);
    animations[index] = {
      id: String(animationMeta.id || `animation-${index + 1}`),
      name: String(animationMeta.name || `Untitled Animation${index ? ` ${index + 1}` : ""}`),
      frames: parseGeneratedFrames(animationLines, meta),
      currentFrame: 0,
      twoSpriteMode: !!animationMeta.twoSpriteMode,
      activePlayer: animationMeta.activeSlots?.[0] === 1 ? 1 : 0,
      playerAssignments: animationMeta.assignments || [0, 1]
    };
    i = end;
  }
  if (!animations.length || animations.some(animation => !animation)) throw new Error("Generated YAJA collection has missing or non-contiguous animations.");
  const activeAnimationId = animations.some(animation => animation.id === collection.activeAnimationId) ? collection.activeAnimationId : animations[0].id;
  return {
    generated: true,
    players: [],
    project: {
      app: "YAJA 2600 Animator",
      schemaVersion: 13,
      version: "1.3.4",
      projectName: collection.projectName,
      kernel: collection.kernel,
      region: collection.region,
      background: collection.background,
      compositionModel: collection.compositionModel || "adjacent",
      activeAnimationId,
      animations
    }
  };
}

function parseGenerated(text) {
  const lines = unfoldYajaMetadataLines(text);
  const collection = parseGeneratedCollection(lines);
  if (collection) return collection;
  const projectLine = lines.find(line => line.startsWith(";@YAJA PROJECT "));
  if (!projectLine) return null;
  const meta = parseJsonMarker(projectLine, ";@YAJA PROJECT ");
  if (meta.formatVersion !== YAJA_BB_FORMAT_VERSION) throw new Error(`YAJA bB format ${meta.formatVersion} is not supported; this version reads format ${YAJA_BB_FORMAT_VERSION}.`);
  validateCoordinateSystem(meta);
  const frames = parseGeneratedFrames(lines, meta);
  return { generated: true, players: [], project: { app: "YAJA 2600 Animator", schemaVersion: 13, version: "1.3.4", projectName: meta.projectName, animationName: meta.animationName, kernel: meta.kernel, region: meta.region, background: meta.background, playerAssignments: meta.assignments, twoSpriteMode: meta.twoSpriteMode, compositionModel: meta.compositionModel || "adjacent", activePlayer: meta.activeSlots?.[0] ?? 0, frames } };
}

export function parseBatariBasicSpriteData(text) {
  try {
    const generated = parseGenerated(text);
    if (generated) return generated;
    if (/^;@YAJA\s+(?:PROJECT|COLLECTION|ANIMATION_BEGIN|ANIMATION_END|FRAME_BEGIN|FRAME_END)\b/m.test(String(text || ""))) {
      throw new Error("YAJA project data is incomplete or missing its PROJECT/COLLECTION marker. Keep every ;@YAJA line from the export together.");
    }
    const players = firstCoherentPlayerSet(text);
    const kernelMatch = String(text).match(/set\s+kernel\s+(PXE|DPC\+|multisprite)/i);
    const inferredKernel = kernelMatch ? (kernelMatch[1].toLowerCase() === "multisprite" ? "MULTISPRITE" : kernelMatch[1].toUpperCase()) : "STANDARD";
    return { players, generated: false, inferredKernel };
  } catch (error) { return { players: [], error: error.message }; }
}
