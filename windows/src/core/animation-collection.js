function clone(value) {
  return structuredClone(value);
}

export function animationRecordFromWorkspace(project, id = project.activeAnimationId || "animation-1") {
  return {
    id: String(id),
    name: String(project.animationName || "Untitled Animation"),
    frames: clone(project.frames || []),
    currentFrame: Math.max(0, Number.parseInt(project.currentFrame, 10) || 0),
    twoSpriteMode: !!project.twoSpriteMode,
    activePlayer: project.activePlayer === 1 ? 1 : 0,
    playerAssignments: clone(project.playerAssignments || [0, 1])
  };
}

export function ensureAnimationCollection(project) {
  if (!Array.isArray(project.animations) || !project.animations.length) {
    project.animations = [animationRecordFromWorkspace(project, "animation-1")];
  }
  const usedIds = new Set();
  project.animations.forEach((animation, index) => {
    let id = String(animation?.id || `animation-${index + 1}`);
    if (usedIds.has(id)) {
      let suffix = index + 1;
      while (usedIds.has(`animation-${suffix}`)) suffix++;
      id = `animation-${suffix}`;
    }
    usedIds.add(id);
    animation.id = id;
    animation.name = String(animation.name || `Untitled Animation${index ? ` ${index + 1}` : ""}`);
    animation.frames = Array.isArray(animation.frames) ? animation.frames : [];
    animation.currentFrame = Math.max(0, Number.parseInt(animation.currentFrame, 10) || 0);
    animation.twoSpriteMode = !!animation.twoSpriteMode;
    animation.activePlayer = animation.activePlayer === 1 ? 1 : 0;
    animation.playerAssignments = Array.isArray(animation.playerAssignments) ? animation.playerAssignments : [0, 1];
  });
  if (!project.animations.some(animation => animation.id === project.activeAnimationId)) {
    project.activeAnimationId = project.animations[0].id;
  }
  return project.animations;
}

export function syncActiveAnimation(project) {
  ensureAnimationCollection(project);
  const index = project.animations.findIndex(animation => animation.id === project.activeAnimationId);
  const record = animationRecordFromWorkspace(project, project.activeAnimationId);
  project.animations[index] = record;
  return record;
}

export function loadAnimationWorkspace(project, animationId) {
  ensureAnimationCollection(project);
  const animation = project.animations.find(item => item.id === animationId) || project.animations[0];
  project.activeAnimationId = animation.id;
  project.animationName = animation.name;
  project.frames = clone(animation.frames);
  project.currentFrame = Math.max(0, Math.min(animation.currentFrame || 0, project.frames.length - 1));
  project.twoSpriteMode = !!animation.twoSpriteMode;
  project.activePlayer = animation.activePlayer === 1 ? 1 : 0;
  project.playerAssignments = clone(animation.playerAssignments || [0, 1]);
  return animation;
}

export function nextAnimationId(project) {
  ensureAnimationCollection(project);
  const used = new Set(project.animations.map(animation => animation.id));
  let index = 1;
  while (used.has(`animation-${index}`)) index++;
  return `animation-${index}`;
}

export function uniqueAnimationName(project, requested, excludeId = null) {
  ensureAnimationCollection(project);
  const names = new Set(project.animations.filter(animation => animation.id !== excludeId).map(animation => animation.name.trim().toLocaleLowerCase()));
  const raw = String(requested || "Untitled Animation").trim() || "Untitled Animation";
  if (!names.has(raw.toLocaleLowerCase())) return raw;
  const match = raw.match(/^(.*?)(?:\s+(\d+))?$/);
  const root = (match?.[1] || raw).trim() || "Untitled Animation";
  let suffix = match?.[2] ? Math.max(2, Number(match[2]) + 1) : 2;
  while (names.has(`${root} ${suffix}`.toLocaleLowerCase())) suffix++;
  return `${root} ${suffix}`;
}

export function duplicateAnimationRecord(project, animationId = project.activeAnimationId) {
  syncActiveAnimation(project);
  const source = project.animations.find(animation => animation.id === animationId) || project.animations[0];
  const duplicate = clone(source);
  duplicate.id = nextAnimationId(project);
  duplicate.name = uniqueAnimationName(project, source.name);
  duplicate.currentFrame = Math.max(0, Math.min(source.currentFrame || 0, duplicate.frames.length - 1));
  return duplicate;
}
