import { normalizeAtariCode, YAJA_BB_FORMAT_VERSION, YAJA_COORDINATE_SYSTEM } from "./codegen.js";

function parseJsonMarker(line, prefix) {
  if (!line.startsWith(prefix)) return null;
  try { return JSON.parse(line.slice(prefix.length).trim()); }
  catch (error) { throw new Error(`${prefix.trim()} contains invalid JSON: ${error.message}`); }
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

function parseGenerated(text) {
  const lines = String(text).split(/\r?\n/);
  const projectLine = lines.find(line => line.startsWith(";@YAJA PROJECT "));
  if (!projectLine) return null;
  const meta = parseJsonMarker(projectLine, ";@YAJA PROJECT ");
  if (meta.formatVersion !== YAJA_BB_FORMAT_VERSION) throw new Error(`YAJA bB format ${meta.formatVersion} is not supported; this version reads format ${YAJA_BB_FORMAT_VERSION}.`);
  if (meta.coordinateSystem && (meta.coordinateSystem.screenYAxis !== YAJA_COORDINATE_SYSTEM.screenYAxis || meta.coordinateSystem.spriteAnchor !== YAJA_COORDINATE_SYSTEM.spriteAnchor)) {
    throw new Error("YAJA bB coordinates must use downward-positive screen Y with a bottom-left sprite anchor.");
  }
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
      if (block.rows.length !== fm.height) throw new Error(`Frame ${index}, P${pm.player} contains ${block.rows.length} rows; metadata requires ${fm.height}.`);
      const scanlineKernel = meta.kernel === "DPC+" || meta.kernel === "PXE";
      if (scanlineKernel && block.colors.length !== fm.height) throw new Error(`Frame ${index}, P${pm.player} color data contains ${block.colors.length} rows; metadata requires ${fm.height}.`);
      slots[pm.slot] = { pixels: block.rows, colors: scanlineKernel ? block.colors : Array(fm.height).fill(normalizeAtariCode(pm.solidColor)), solidColor: normalizeAtariCode(pm.solidColor), nusiz: pm.nusiz, xOffset: pm.xOffset, yOffset: pm.yOffset, reference: null };
    });
    const blank = () => ({ pixels: Array.from({ length: fm.height }, () => Array(8).fill(0)), colors: Array(fm.height).fill("$0E"), solidColor: "$0E", nusiz: "normal", xOffset: 0, yOffset: 0, reference: null });
    frames[index] = { name: `Frame ${index}`, width: fm.width, height: fm.height, duration: fm.duration, players: slots.map(slot => slot || blank()) };
    i = end;
  }
  if (!frames.length || frames.some(frame => !frame)) throw new Error("Generated YAJA bB data has missing or non-contiguous frames.");
  return { generated: true, players: [], project: { app: "YAJA 2600 Animator", schemaVersion: 9, version: "0.075", projectName: meta.projectName, animationName: meta.animationName, kernel: meta.kernel, region: meta.region, background: meta.background, playerAssignments: meta.assignments, twoSpriteMode: meta.twoSpriteMode, compositionModel: meta.compositionModel || "adjacent", activePlayer: meta.activeSlots?.[0] ?? 0, frames } };
}

export function parseBatariBasicSpriteData(text) {
  try {
    const generated = parseGenerated(text);
    if (generated) return generated;
    const players = parseBlocks(text);
    const distinct = [...new Set(players.map(player => player.index).filter(Number.isInteger))];
    if (distinct.length > 2) return { players: [], error: `This import contains ${distinct.length} distinct sprites (${distinct.map(number => `P${number}`).join(", ")}). YAJA Animator supports at most two sprites per project.` };
    const kernelMatch = String(text).match(/set\s+kernel\s+(PXE|DPC\+|multisprite)/i);
    const inferredKernel = kernelMatch ? (kernelMatch[1].toLowerCase() === "multisprite" ? "MULTISPRITE" : kernelMatch[1].toUpperCase()) : "STANDARD";
    return { players, generated: false, inferredKernel, warning: "Legacy bB import is partial: timing and composition metadata were not available." };
  } catch (error) { return { players: [], error: error.message }; }
}
