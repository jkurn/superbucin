import * as THREE from 'three';

// Cute round pet models — soft spheres, big heads, tiny bodies
// Matching the Hago Sheep Fight aesthetic

const COLORS = {
  // Pig palette
  pigPink: 0xffb0c8,
  pigLightPink: 0xffd0e0,
  pigDarkPink: 0xe8809a,
  pigSnout: 0xffc0d0,
  pigNostril: 0xd07090,
  // Boar palette
  boarBrown: 0x9b6b4a,
  boarDark: 0x7a5035,
  boarLight: 0xb88860,
  boarTusk: 0xfffde8,
  // Chicken palette
  chickYellow: 0xffe066,
  chickLight: 0xfff0a0,
  chickOrange: 0xffa030,
  chickBeak: 0xff8800,
  chickComb: 0xe83030,
  // Hen palette
  henBrown: 0xd4944a,
  henLight: 0xe8b070,
  henWing: 0xc08040,
  // Rooster palette
  roosterBody: 0xffe880,
  roosterComb: 0xd42020,
  roosterTail: 0x2a7a3a,
  roosterTailAlt: 0x3060c0,
  // Common
  eyeWhite: 0xffffff,
  eyeBlack: 0x222222,
  cheekPink: 0xffaaaa,
};

function makeMat(color) {
  return new THREE.MeshToonMaterial({ color });
}

function sphere(radius, color) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 12),
    makeMat(color)
  );
}

function ellipsoid(rx, ry, rz, color) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    makeMat(color)
  );
  mesh.scale.set(rx, ry, rz);
  return mesh;
}

function makeEyes(parent, offsetX, y, z, size = 0.12) {
  [-offsetX, offsetX].forEach((x) => {
    const white = sphere(size, COLORS.eyeWhite);
    white.position.set(x, y, z);
    parent.add(white);
    const pupil = sphere(size * 0.55, COLORS.eyeBlack);
    pupil.position.set(x, y, z + size * 0.6);
    parent.add(pupil);
  });
}

function makeCheeks(parent, offsetX, y, z, size = 0.08) {
  [-offsetX, offsetX].forEach((x) => {
    const cheek = ellipsoid(size, size * 0.6, size * 0.3, COLORS.cheekPink);
    cheek.position.set(x, y, z);
    parent.add(cheek);
  });
}

// ==================== PIG SIDE ====================

// TIER 1: Piglet — tiny, round baby
export function createPiglet() {
  const g = new THREE.Group();
  // Body
  const body = ellipsoid(0.35, 0.3, 0.3, COLORS.pigPink);
  body.position.y = 0.3;
  g.add(body);
  // Head (big relative to body)
  const head = sphere(0.32, COLORS.pigPink);
  head.position.set(0, 0.65, 0.05);
  g.add(head);
  // Snout
  const snout = ellipsoid(0.12, 0.08, 0.08, COLORS.pigSnout);
  snout.position.set(0, 0.58, 0.3);
  g.add(snout);
  // Nostrils
  [-0.04, 0.04].forEach((x) => {
    const n = sphere(0.025, COLORS.pigNostril);
    n.position.set(x, 0.58, 0.37);
    g.add(n);
  });
  // Eyes
  makeEyes(g, 0.12, 0.7, 0.26, 0.06);
  // Cheeks
  makeCheeks(g, 0.18, 0.6, 0.24, 0.06);
  // Ears
  [-0.2, 0.2].forEach((x) => {
    const ear = ellipsoid(0.08, 0.1, 0.04, COLORS.pigDarkPink);
    ear.position.set(x, 0.9, 0);
    ear.rotation.z = x > 0 ? -0.4 : 0.4;
    g.add(ear);
  });
  // Tiny feet
  [[-0.12, 0.05, 0.1], [0.12, 0.05, 0.1], [-0.12, 0.05, -0.08], [0.12, 0.05, -0.08]].forEach(([x, y, z]) => {
    const foot = ellipsoid(0.06, 0.05, 0.06, COLORS.pigDarkPink);
    foot.position.set(x, y, z);
    g.add(foot);
  });
  // Curly tail
  const tail = new THREE.Mesh(
    new THREE.TorusGeometry(0.05, 0.015, 8, 12, Math.PI * 1.2),
    makeMat(COLORS.pigDarkPink)
  );
  tail.position.set(0, 0.35, -0.28);
  tail.rotation.y = Math.PI;
  g.add(tail);
  return g;
}

// TIER 2: Pig — medium, rounder
export function createPig() {
  const g = new THREE.Group();
  const body = ellipsoid(0.42, 0.38, 0.38, COLORS.pigPink);
  body.position.y = 0.38;
  g.add(body);
  const head = sphere(0.38, COLORS.pigPink);
  head.position.set(0, 0.8, 0.08);
  g.add(head);
  const snout = ellipsoid(0.15, 0.1, 0.1, COLORS.pigSnout);
  snout.position.set(0, 0.72, 0.38);
  g.add(snout);
  [-0.05, 0.05].forEach((x) => {
    const n = sphere(0.03, COLORS.pigNostril);
    n.position.set(x, 0.72, 0.47);
    g.add(n);
  });
  makeEyes(g, 0.14, 0.86, 0.32, 0.08);
  makeCheeks(g, 0.22, 0.74, 0.3, 0.07);
  [-0.24, 0.24].forEach((x) => {
    const ear = ellipsoid(0.1, 0.13, 0.05, COLORS.pigDarkPink);
    ear.position.set(x, 1.1, 0);
    ear.rotation.z = x > 0 ? -0.35 : 0.35;
    g.add(ear);
  });
  [[-0.15, 0.05, 0.12], [0.15, 0.05, 0.12], [-0.15, 0.05, -0.1], [0.15, 0.05, -0.1]].forEach(([x, y, z]) => {
    const foot = ellipsoid(0.07, 0.06, 0.07, COLORS.pigDarkPink);
    foot.position.set(x, y, z);
    g.add(foot);
  });
  const tail = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.018, 8, 12, Math.PI * 1.3),
    makeMat(COLORS.pigDarkPink)
  );
  tail.position.set(0, 0.42, -0.36);
  tail.rotation.y = Math.PI;
  g.add(tail);
  return g;
}

// TIER 3: Boar — tough, brown, small tusks
export function createBoar() {
  const g = new THREE.Group();
  const body = ellipsoid(0.5, 0.42, 0.44, COLORS.boarBrown);
  body.position.y = 0.42;
  g.add(body);
  const head = sphere(0.4, COLORS.boarBrown);
  head.position.set(0, 0.88, 0.1);
  g.add(head);
  // Mohawk mane
  for (let i = 0; i < 5; i++) {
    const spike = ellipsoid(0.04, 0.1, 0.04, COLORS.boarDark);
    spike.position.set(0, 1.28, -0.12 + i * 0.07);
    g.add(spike);
  }
  const snout = ellipsoid(0.16, 0.12, 0.12, COLORS.boarLight);
  snout.position.set(0, 0.78, 0.42);
  g.add(snout);
  // Tusks
  [-0.08, 0.08].forEach((x) => {
    const tusk = ellipsoid(0.03, 0.08, 0.03, COLORS.boarTusk);
    tusk.position.set(x, 0.68, 0.46);
    tusk.rotation.z = x > 0 ? 0.2 : -0.2;
    g.add(tusk);
  });
  makeEyes(g, 0.15, 0.94, 0.36, 0.08);
  // Angry brows
  [-0.15, 0.15].forEach((x) => {
    const brow = ellipsoid(0.08, 0.025, 0.03, COLORS.boarDark);
    brow.position.set(x, 1.02, 0.38);
    brow.rotation.z = x > 0 ? -0.35 : 0.35;
    g.add(brow);
  });
  [-0.26, 0.26].forEach((x) => {
    const ear = ellipsoid(0.1, 0.1, 0.05, COLORS.boarDark);
    ear.position.set(x, 1.16, 0);
    ear.rotation.z = x > 0 ? -0.5 : 0.5;
    g.add(ear);
  });
  [[-0.2, 0.05, 0.14], [0.2, 0.05, 0.14], [-0.2, 0.05, -0.12], [0.2, 0.05, -0.12]].forEach(([x, y, z]) => {
    const foot = ellipsoid(0.08, 0.06, 0.08, COLORS.boarDark);
    foot.position.set(x, y, z);
    g.add(foot);
  });
  return g;
}

// TIER 4: Big Boar — massive, fierce, big tusks + armor feel
export function createBigBoar() {
  const g = new THREE.Group();
  const body = ellipsoid(0.6, 0.5, 0.52, COLORS.boarBrown);
  body.position.y = 0.5;
  g.add(body);
  // Back armor ridge
  for (let i = 0; i < 3; i++) {
    const plate = ellipsoid(0.5, 0.06, 0.14, COLORS.boarDark);
    plate.position.set(0, 0.95, -0.15 + i * 0.18);
    g.add(plate);
  }
  const head = sphere(0.46, COLORS.boarBrown);
  head.position.set(0, 1.0, 0.12);
  g.add(head);
  // Big mohawk
  for (let i = 0; i < 7; i++) {
    const spike = ellipsoid(0.05, 0.14, 0.05, COLORS.boarDark);
    spike.position.set(0, 1.46, -0.18 + i * 0.07);
    g.add(spike);
  }
  const snout = ellipsoid(0.2, 0.14, 0.14, COLORS.boarLight);
  snout.position.set(0, 0.9, 0.52);
  g.add(snout);
  // Big tusks
  [-0.1, 0.1].forEach((x) => {
    const tusk = ellipsoid(0.04, 0.14, 0.04, COLORS.boarTusk);
    tusk.position.set(x, 0.76, 0.54);
    tusk.rotation.z = x > 0 ? 0.15 : -0.15;
    g.add(tusk);
  });
  makeEyes(g, 0.17, 1.08, 0.44, 0.09);
  [-0.17, 0.17].forEach((x) => {
    const brow = ellipsoid(0.1, 0.03, 0.04, COLORS.boarDark);
    brow.position.set(x, 1.16, 0.46);
    brow.rotation.z = x > 0 ? -0.4 : 0.4;
    g.add(brow);
  });
  [-0.3, 0.3].forEach((x) => {
    const ear = ellipsoid(0.12, 0.12, 0.06, COLORS.boarDark);
    ear.position.set(x, 1.3, 0.05);
    ear.rotation.z = x > 0 ? -0.5 : 0.5;
    g.add(ear);
  });
  [[-0.24, 0.06, 0.16], [0.24, 0.06, 0.16], [-0.24, 0.06, -0.14], [0.24, 0.06, -0.14]].forEach(([x, y, z]) => {
    const foot = ellipsoid(0.1, 0.07, 0.1, COLORS.boarDark);
    foot.position.set(x, y, z);
    g.add(foot);
  });
  return g;
}

// ==================== CHICKEN SIDE ====================

// TIER 1: Chick — tiny yellow ball
export function createChick() {
  const g = new THREE.Group();
  const body = sphere(0.28, COLORS.chickYellow);
  body.position.y = 0.3;
  g.add(body);
  const head = sphere(0.26, COLORS.chickYellow);
  head.position.set(0, 0.6, 0.04);
  g.add(head);
  // Beak
  const beak = ellipsoid(0.06, 0.035, 0.06, COLORS.chickBeak);
  beak.position.set(0, 0.54, 0.28);
  g.add(beak);
  makeEyes(g, 0.1, 0.65, 0.22, 0.055);
  makeCheeks(g, 0.14, 0.56, 0.2, 0.05);
  // Tiny wings
  [-0.26, 0.26].forEach((x) => {
    const wing = ellipsoid(0.05, 0.12, 0.1, COLORS.chickOrange);
    wing.position.set(x, 0.32, 0);
    wing.rotation.z = x > 0 ? -0.3 : 0.3;
    g.add(wing);
  });
  // Feet
  [-0.1, 0.1].forEach((x) => {
    const foot = ellipsoid(0.06, 0.03, 0.08, COLORS.chickOrange);
    foot.position.set(x, 0.03, 0.04);
    g.add(foot);
  });
  return g;
}

// TIER 2: Hen — brown, rounder, small comb
export function createHen() {
  const g = new THREE.Group();
  const body = ellipsoid(0.38, 0.34, 0.35, COLORS.henBrown);
  body.position.y = 0.34;
  g.add(body);
  const head = sphere(0.32, COLORS.henBrown);
  head.position.set(0, 0.72, 0.06);
  g.add(head);
  // Small comb
  const comb = ellipsoid(0.04, 0.08, 0.06, COLORS.chickComb);
  comb.position.set(0, 1.02, 0.06);
  g.add(comb);
  // Wattle
  const wattle = ellipsoid(0.04, 0.05, 0.03, COLORS.chickComb);
  wattle.position.set(0, 0.6, 0.34);
  g.add(wattle);
  const beak = ellipsoid(0.07, 0.04, 0.07, COLORS.chickBeak);
  beak.position.set(0, 0.66, 0.34);
  g.add(beak);
  makeEyes(g, 0.12, 0.78, 0.28, 0.065);
  makeCheeks(g, 0.18, 0.68, 0.26, 0.06);
  [-0.34, 0.34].forEach((x) => {
    const wing = ellipsoid(0.06, 0.18, 0.15, COLORS.henWing);
    wing.position.set(x, 0.36, 0);
    wing.rotation.z = x > 0 ? -0.2 : 0.2;
    g.add(wing);
  });
  // Tail
  const tail = ellipsoid(0.06, 0.14, 0.08, COLORS.henWing);
  tail.position.set(0, 0.46, -0.32);
  tail.rotation.x = -0.3;
  g.add(tail);
  [-0.12, 0.12].forEach((x) => {
    const foot = ellipsoid(0.07, 0.03, 0.09, COLORS.chickOrange);
    foot.position.set(x, 0.03, 0.04);
    g.add(foot);
  });
  return g;
}

// TIER 3: Chicken — white, full comb, larger
export function createChicken() {
  const g = new THREE.Group();
  const body = ellipsoid(0.44, 0.4, 0.4, COLORS.chickLight);
  body.position.y = 0.4;
  g.add(body);
  const head = sphere(0.36, COLORS.chickLight);
  head.position.set(0, 0.84, 0.08);
  g.add(head);
  // Comb (3 bumps)
  [-0.04, 0, 0.04].forEach((z) => {
    const c = ellipsoid(0.04, 0.08, 0.04, COLORS.chickComb);
    c.position.set(0, 1.18, z + 0.06);
    g.add(c);
  });
  const wattle = ellipsoid(0.05, 0.08, 0.04, COLORS.chickComb);
  wattle.position.set(0, 0.68, 0.42);
  g.add(wattle);
  const beak = ellipsoid(0.08, 0.05, 0.08, COLORS.chickBeak);
  beak.position.set(0, 0.78, 0.42);
  g.add(beak);
  makeEyes(g, 0.14, 0.9, 0.34, 0.075);
  makeCheeks(g, 0.2, 0.8, 0.3, 0.065);
  [-0.4, 0.4].forEach((x) => {
    const wing = ellipsoid(0.07, 0.22, 0.18, COLORS.chickOrange);
    wing.position.set(x, 0.42, 0);
    wing.rotation.z = x > 0 ? -0.15 : 0.15;
    g.add(wing);
  });
  // Tail fan
  [-0.06, 0, 0.06].forEach((x) => {
    const f = ellipsoid(0.04, 0.16, 0.06, COLORS.chickOrange);
    f.position.set(x, 0.54, -0.38);
    f.rotation.x = -0.4;
    f.rotation.z = x * 3;
    g.add(f);
  });
  [-0.14, 0.14].forEach((x) => {
    const foot = ellipsoid(0.08, 0.04, 0.1, COLORS.chickOrange);
    foot.position.set(x, 0.03, 0.04);
    g.add(foot);
  });
  return g;
}

// TIER 4: Rooster — big, proud crest, long tail
export function createRooster() {
  const g = new THREE.Group();
  const body = ellipsoid(0.52, 0.46, 0.46, COLORS.roosterBody);
  body.position.y = 0.46;
  g.add(body);
  // Chest puff
  const chest = ellipsoid(0.3, 0.2, 0.15, COLORS.chickOrange);
  chest.position.set(0, 0.46, 0.36);
  g.add(chest);
  const head = sphere(0.4, COLORS.roosterBody);
  head.position.set(0, 0.96, 0.1);
  g.add(head);
  // Big comb (5 bumps)
  [-0.06, -0.03, 0, 0.03, 0.06].forEach((z, i) => {
    const h = 0.08 + (i === 2 ? 0.04 : 0);
    const c = ellipsoid(0.04, h, 0.04, COLORS.roosterComb);
    c.position.set(0, 1.36 + (i === 2 ? 0.02 : 0), z + 0.08);
    g.add(c);
  });
  const wattle = ellipsoid(0.06, 0.1, 0.04, COLORS.roosterComb);
  wattle.position.set(0, 0.78, 0.48);
  g.add(wattle);
  const beak = ellipsoid(0.09, 0.05, 0.09, COLORS.chickBeak);
  beak.position.set(0, 0.9, 0.48);
  g.add(beak);
  makeEyes(g, 0.16, 1.02, 0.4, 0.085);
  // Angry brows
  [-0.16, 0.16].forEach((x) => {
    const brow = ellipsoid(0.08, 0.025, 0.03, COLORS.roosterComb);
    brow.position.set(x, 1.1, 0.42);
    brow.rotation.z = x > 0 ? -0.35 : 0.35;
    g.add(brow);
  });
  [-0.46, 0.46].forEach((x) => {
    const wing = ellipsoid(0.08, 0.26, 0.2, COLORS.chickOrange);
    wing.position.set(x, 0.48, 0);
    wing.rotation.z = x > 0 ? -0.12 : 0.12;
    g.add(wing);
  });
  // Long dramatic tail
  const tailColors = [COLORS.roosterTail, COLORS.chickOrange, COLORS.roosterTailAlt, COLORS.chickOrange, COLORS.roosterTail];
  [-0.08, -0.04, 0, 0.04, 0.08].forEach((x, i) => {
    const f = ellipsoid(0.035, 0.25, 0.05, tailColors[i]);
    f.position.set(x, 0.6, -0.44);
    f.rotation.x = -0.5 - Math.abs(x) * 2;
    f.rotation.z = x * 2;
    g.add(f);
  });
  [-0.18, 0.18].forEach((x) => {
    const foot = ellipsoid(0.09, 0.04, 0.11, COLORS.chickOrange);
    foot.position.set(x, 0.03, 0.06);
    g.add(foot);
  });
  return g;
}

// Factory
const creators = {
  pig: [createPiglet, createPig, createBoar, createBigBoar],
  chicken: [createChick, createHen, createChicken, createRooster],
  chick: [createChick, createHen, createChicken, createRooster],
};

export function createUnitModel(side, tier) {
  const fn = creators[side]?.[tier - 1];
  if (!fn) return new THREE.Group();
  const model = fn();
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return model;
}
