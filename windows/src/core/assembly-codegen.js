import { animationNamespace, createAnimationIR, normalizeAnimationBase, validateAnimationIR } from "./codegen.js";

const ASSEMBLY_MANIFEST_VERSION = 1;
const frameNumber = index => String(index).padStart(2, "0");
const asmNamespace = name => String(name || "UntitledAnimation").replace(/^_+/, "") || "UntitledAnimation";
const bits = row => row.map(value => value ? "1" : "0").join("");
const projectAnimationView = (project, animation) => ({ ...project, animationName: animation.name, frames: animation.frames, currentFrame: animation.currentFrame, twoSpriteMode: animation.twoSpriteMode, activePlayer: animation.activePlayer, playerAssignments: animation.playerAssignments });

function sourceAnimations(project, scope) {
  return scope === "all" && Array.isArray(project.animations) && project.animations.length
    ? project.animations
    : [{ id: project.activeAnimationId || "animation-1", name: project.animationName, frames: project.frames, currentFrame: project.currentFrame, twoSpriteMode: project.twoSpriteMode, activePlayer: project.activePlayer, playerAssignments: project.playerAssignments }];
}

function uniqueAnimationIrs(project, animations) {
  const collection = asmNamespace(animationNamespace(project.projectName || "Untitled Project"));
  const used = new Set();
  return animations.map(animation => {
    const base = `${collection}_${normalizeAnimationBase(animation.name)}`;
    let name = base, suffix = 2;
    while (used.has(name.toLowerCase())) name = `${base}${suffix++}`;
    used.add(name.toLowerCase());
    return createAnimationIR(projectAnimationView(project, animation), { content: "tables", namespace: `__${name}` });
  });
}

function emitAnimationData(ir) {
  const base = asmNamespace(ir.namespace), lines = [`; ${ir.animationName}`];
  ir.frames.forEach(frame => frame.players.forEach(player => {
    const prefix = `${base}_Frame${frameNumber(frame.index)}_P${player.player}`;
    lines.push(`${prefix}_Gfx:`);
    [...player.pixels].reverse().forEach(row => lines.push(`  .byte %${bits(row)}`));
    lines.push("");
    const colors = ir.kernel === "STANDARD" || ir.kernel === "MULTISPRITE" ? Array(player.height).fill(player.solidColor) : player.colors;
    colors.forEach((color, row) => lines.push(`${prefix}_Color_${frameNumber(row)} equ ${color}`));
    lines.push(`${prefix}_Color:`);
    for (let row = player.height - 1; row >= 0; row--) lines.push(`  .byte ${prefix}_Color_${frameNumber(row)}`);
    lines.push("");
  }));
  return lines;
}

function manifestFor(project, scope, animations, irs) {
  return {
    formatVersion: ASSEMBLY_MANIFEST_VERSION,
    projectName: String(project.projectName || "Untitled Project"),
    kernel: irs[0]?.kernel || "PXE",
    region: project.region === "PAL" ? "PAL" : "NTSC",
    background: irs[0]?.background || "$00",
    compositionModel: project.compositionModel === "tia-right-copies" ? "tia-right-copies" : "adjacent",
    activeAnimationId: scope === "all" ? project.activeAnimationId || animations[0]?.id : animations[0]?.id || "animation-1",
    animations: irs.map((ir, index) => {
      const source = animations[index] || {};
      return {
        id: String(source.id || ir.animationId || `animation-${index + 1}`), name: ir.animationName, namespace: asmNamespace(ir.namespace), twoSpriteMode: ir.twoSpriteMode,
        activePlayer: ir.activeSlots[0] || 0, playerAssignments: ir.assignments,
        frames: ir.frames.map((frame, frameIndex) => ({
          name: String(source.frames?.[frameIndex]?.name || `Frame ${frameIndex + 1}`), width: frame.width, height: frame.height, duration: frame.duration,
          players: frame.players.map(player => ({ slot: player.slot, player: player.player, width: player.width, height: player.height, solidColor: player.solidColor, nusiz: player.nusiz, xOffset: player.xOffset, yOffset: player.yOffset }))
        }))
      };
    })
  };
}

export function assemblyExportFilename(name, scope = "current") { return `${normalizeAnimationBase(name)}${scope === "all" ? "_AllAnimations" : ""}_Data.asm`; }

export function generateAssemblyData(project, options = {}) {
  const scope = options.scope === "all" ? "all" : "current";
  const animations = sourceAnimations(project, scope);
  const irs = scope === "all" ? uniqueAnimationIrs(project, animations) : [createAnimationIR(project, { content: "tables" })];
  const diagnostics = irs.flatMap((ir, index) => validateAnimationIR(ir).filter(item => item.code !== "VARIABLE_OWNERSHIP").map(item => scope === "all" ? { ...item, animationIndex: index, message: `${ir.animationName}: ${item.message}` } : item));
  let output = "";
  if (!diagnostics.some(item => item.severity === "error")) {
    const manifest = manifestFor(project, scope, animations, irs);
    const lines = [
      "; Atari 2600 sprite art and color data exported by YAJA 2600 Animator.",
      "; This file is DASM data only. Include it from a 6502 scanline kernel that loads the tables.",
      "; Graphics and color tables are bottom-up for common Atari 2600 kernels.",
      `;@YAJA ASSEMBLY_MANIFEST ${JSON.stringify(manifest)}`,
      "; This YAJA comment manifest is ignored by DASM and enables faithful YAJA re-import.",
      ""
    ];
    irs.forEach((ir, index) => { if (index) lines.push(""); lines.push(...emitAnimationData(ir)); });
    output = lines.join("\n").trimEnd();
  }
  return { ir: scope === "all" ? { kind: "collection", animations: irs } : irs[0], diagnostics, output, filename: assemblyExportFilename(scope === "all" ? project.projectName : irs[0].animationName, scope) };
}
