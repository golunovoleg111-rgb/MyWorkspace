import * as THREE from 'three';

const TAU = Math.PI * 2;
const yAxis = new THREE.Vector3(0, 1, 0);

const BREED_SHAPES = {
  dog: {
    spitz: { body: [0.82, 0.88, 1.02], head: 1.04, legs: 0.92, muzzle: 0.84, ears: 'pointed', mane: true, fluffyTail: true },
    corgi: { body: [1.02, 0.72, 1.34], head: 1.02, legs: 0.64, muzzle: 0.88, ears: 'large', mane: false, fluffyTail: false },
    shiba: { body: [0.9, 0.82, 1.08], head: 0.98, legs: 0.88, muzzle: 0.94, ears: 'pointed', mane: false, fluffyTail: true },
    labrador: { body: [1.0, 0.92, 1.28], head: 0.96, legs: 1.02, muzzle: 1.08, ears: 'floppy', mane: false, fluffyTail: false },
    samoyed: { body: [0.94, 1, 1.16], head: 1.06, legs: .98, muzzle: .9, ears: 'pointed', mane: true, fluffyTail: true },
    dachshund: { body: [.82, .66, 1.58], head: .9, legs: .54, muzzle: 1.08, ears: 'floppy', mane: false, fluffyTail: false },
    poodle: { body: [.84, .92, 1.12], head: .96, legs: 1.08, muzzle: .92, ears: 'floppy', mane: false, fluffyTail: true, curls: true },
    beagle: { body: [.9, .82, 1.28], head: .94, legs: .9, muzzle: 1.04, ears: 'floppy', mane: false, fluffyTail: false, patches: true }
  },
  cat: {
    british: { body: [0.88, 0.9, 1.08], head: 1.08, legs: 0.84, muzzle: 0.92, ears: 'round', mane: false, fluffyTail: true },
    maine: { body: [1, 1, 1.3], head: 1.02, legs: 1.08, muzzle: 1, ears: 'tufted', mane: true, fluffyTail: true },
    siamese: { body: [0.76, 1.02, 1.24], head: 0.9, legs: 1.14, muzzle: 0.82, ears: 'large', mane: false, fluffyTail: false },
    domestic: { body: [0.86, 0.94, 1.16], head: 0.98, legs: 1, muzzle: 0.94, ears: 'pointed', mane: false, fluffyTail: false },
    scottish: { body: [.9, .86, 1.08], head: 1.1, legs: .84, muzzle: .9, ears: 'folded', mane: false, fluffyTail: true },
    sphynx: { body: [.72, 1, 1.18], head: .88, legs: 1.14, muzzle: .78, ears: 'large', mane: false, fluffyTail: false },
    ragdoll: { body: [.96, .98, 1.24], head: 1.04, legs: .96, muzzle: .94, ears: 'pointed', mane: true, fluffyTail: true },
    bengal: { body: [.78, .92, 1.34], head: .9, legs: 1.12, muzzle: .86, ears: 'pointed', mane: false, fluffyTail: false, spots: true }
  }
};

const ACCESSORY_COLORS = {
  blue: '#3478f6', rose: '#eb6682', mint: '#27aa8b', navy: '#202f4f'
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const hex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0.02,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1
  });
}

function mesh(geometry, mat, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, mat);
  item.position.set(...position);
  item.scale.set(...scale);
  item.rotation.set(...rotation);
  item.castShadow = false;
  item.receiveShadow = false;
  return item;
}

function sphere(radius, mat, position, scale = [1, 1, 1], detail = 28) {
  return mesh(new THREE.SphereGeometry(radius, detail, Math.max(12, Math.round(detail * .66))), mat, position, scale);
}

function capsule(radius, length, mat, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
  return mesh(new THREE.CapsuleGeometry(radius, length, 6, 16), mat, position, scale, rotation);
}

function cone(radius, height, mat, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
  return mesh(new THREE.ConeGeometry(radius, height, 20, 2), mat, position, scale, rotation);
}

function segmentBetween(start, end, radius, mat) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const item = mesh(new THREE.CapsuleGeometry(radius, Math.max(.01, direction.length() - radius * 2), 5, 12), mat);
  item.position.copy(a.add(b).multiplyScalar(.5));
  item.quaternion.setFromUnitVectors(yAxis, direction.normalize());
  return item;
}

function createEye(x, config, eyeWhite, irisMat, blackMat, nodes) {
  const group = new THREE.Group();
  group.position.set(x, .02, .52);
  const eyeStyle = config.eyeStyle || 'bright';
  const eyeScale = eyeStyle === 'almond' ? [1.08, .72, .6] : eyeStyle === 'round' ? [.92, 1.04, .62] : [1, 1, .62];
  const white = sphere(.145, eyeWhite, [0, 0, 0], eyeScale, 22);
  const iris = sphere(eyeStyle === 'bright' ? .09 : .078, irisMat, [0, -.004, .105], [1, 1, .42], 20);
  const pupil = sphere(eyeStyle === 'almond' ? .045 : .05, blackMat, [0, -.004, .15], eyeStyle === 'almond' ? [.7, 1.2, .35] : [1, 1, .35], 16);
  const shine = sphere(.021, new THREE.MeshBasicMaterial({ color: '#ffffff' }), [-.026, .032, .179], [1, 1, .22], 12);
  group.add(white, iris, pupil, shine);
  nodes.eyes.push(group);
  nodes.pupils.push(iris, pupil, shine);
  return group;
}

function createPointedEar(side, type, coatMat, innerMat, nodes) {
  const group = new THREE.Group();
  const large = type === 'large';
  const tufted = type === 'tufted';
  const folded = type === 'folded';
  const short = type === 'round' || folded;
  group.position.set(side * (large ? .43 : .38), short ? 2.2 : 2.27, .08);
  group.rotation.z = side * (folded ? .48 : large ? -.2 : -.13);
  const outer = short
    ? sphere(.25, coatMat, [0, 0, 0], [folded ? 1 : .82, folded ? .58 : .85, .55], 22)
    : cone(large ? .3 : .25, large ? .72 : .62, coatMat, [0, .04, 0], [1, 1, .72], [0, 0, 0]);
  const inner = short
    ? sphere(.15, innerMat, [0, .005, .13], [.8, .8, .28], 16)
    : cone(large ? .18 : .145, large ? .48 : .4, innerMat, [0, .02, .16], [1, 1, .34], [0, 0, 0]);
  group.add(outer, inner);
  if (tufted) {
    group.add(cone(.075, .24, coatMat, [side * .015, .38, -.01], [.7, 1, .7], [0, 0, side * -.2]));
  }
  nodes.ears.push(group);
  return group;
}

function createFloppyEar(side, coatMat, innerMat, nodes) {
  const group = new THREE.Group();
  group.position.set(side * .48, 2.03, .03);
  group.rotation.z = side * -.22;
  group.add(capsule(.15, .34, coatMat, [side * .05, -.13, 0], [1, 1, .62], [0, 0, side * -.12]));
  group.add(capsule(.085, .25, innerMat, [side * .04, -.14, .1], [.9, 1, .35], [0, 0, side * -.12]));
  nodes.ears.push(group);
  return group;
}

function createTail(config, shape, coatMat, accentMat, nodes) {
  const group = new THREE.Group();
  group.position.set(.34, 1.02, -.62);
  const cat = config.species === 'cat';
  const fluffy = shape.fluffyTail;
  const points = cat
    ? [[0, 0, 0], [.08, .08, -.28], [.16, .32, -.48], [.12, .6, -.42], [.02, .78, -.2]]
    : fluffy
      ? [[0, 0, 0], [.12, .12, -.24], [.22, .38, -.3], [.12, .58, -.08], [-.04, .5, .12]]
      : [[0, 0, 0], [.08, .08, -.28], [.12, .2, -.54], [.08, .34, -.72]];
  for (let i = 0; i < points.length - 1; i += 1) {
    const radius = (cat ? .105 : .12) * (fluffy ? 1.34 : 1) * (1 - i * .08);
    group.add(segmentBetween(points[i], points[i + 1], radius, i === points.length - 2 && config.breed === 'siamese' ? accentMat : coatMat));
  }
  nodes.tail = group;
  return group;
}

export function buildPet(config) {
  const species = config.species === 'cat' ? 'cat' : 'dog';
  const shape = BREED_SHAPES[species][config.breed] || Object.values(BREED_SHAPES[species])[0];
  const coat = hex(config.coat, '#d49a60');
  const accent = hex(config.accent, '#fff1d4');
  const eyes = hex(config.eyes, '#3d2b1f');
  const coatMat = material(coat, { roughness: species === 'cat' ? .76 : .7 });
  const accentMat = material(accent, { roughness: .78 });
  const innerMat = material(new THREE.Color(accent).lerp(new THREE.Color('#ef9fae'), .32), { roughness: .82 });
  const eyeWhite = material('#fffdf8', { roughness: .38 });
  const irisMat = material(eyes, { roughness: .28 });
  const blackMat = material('#18212d', { roughness: .45 });
  const root = new THREE.Group();
  const model = new THREE.Group();
  root.add(model);
  const nodes = { root, model, body: null, head: null, tail: null, legs: [], ears: [], eyes: [], pupils: [] };

  const body = new THREE.Group();
  body.position.set(0, .88, -.22);
  const torso = sphere(.72, coatMat, [0, 0, 0], shape.body, 32);
  body.add(torso);
  if (config.marking === 'patches' || shape.patches) {
    body.add(sphere(.3, accentMat, [-.34, .14, .62], [1.05, .86, .2], 22));
    body.add(sphere(.24, accentMat, [.28, -.22, .65], [.9, .7, .18], 20));
  }
  if (config.marking === 'tabby' || shape.spots) {
    const stripeMat = material(accent, { roughness: .82 });
    [-.3, 0, .3].forEach((x, index) => {
      body.add(capsule(.035, .34, stripeMat, [x, .28 - Math.abs(x) * .25, .68], [1, 1, .36], [0, 0, index === 1 ? 0 : x * .55]));
    });
    if (shape.spots) {
      [[-.32, -.05], [.05, .16], [.34, -.12]].forEach(([x, y]) => body.add(sphere(.08, stripeMat, [x, y, .7], [1.25, .72, .2], 16)));
    }
  }
  if (shape.curls) {
    const curlGroup = new THREE.Group();
    for (let row = -1; row <= 1; row += 1) {
      for (let col = -2; col <= 2; col += 1) {
        curlGroup.add(sphere(.115, coatMat, [col * .22, row * .22, .67], [1, 1, .45], 16));
      }
    }
    body.add(curlGroup);
  }
  nodes.body = body;
  model.add(body);

  if (shape.mane) {
    const mane = new THREE.Group();
    mane.position.set(0, 1.42, .02);
    const count = species === 'dog' ? 10 : 9;
    for (let i = 0; i < count; i += 1) {
      const angle = i / count * TAU;
      const radius = species === 'dog' ? .47 : .44;
      mane.add(sphere(species === 'dog' ? .235 : .2, accentMat,
        [Math.cos(angle) * radius, Math.sin(angle) * radius * .72, -.08],
        [1, .94, .72], 18));
    }
    model.add(mane);
    nodes.mane = mane;
  }

  const pawMat = config.marking === 'socks' || config.breed === 'siamese' ? accentMat : coatMat;
  const legX = shape.body[0] * .38;
  const legDepth = Math.min(.46, shape.body[2] * .28);
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([side, depth], index) => {
    const leg = new THREE.Group();
    leg.position.set(side * legX, .66, depth * legDepth - .16);
    const legLength = .43 * shape.legs;
    leg.add(capsule(.12, legLength, coatMat, [0, -legLength * .48, 0], [.96, 1, .9]));
    leg.add(sphere(.18, pawMat, [0, -legLength - .05, .09], [1.12, .65, 1.32], 20));
    leg.userData.side = side;
    leg.userData.depth = depth;
    leg.userData.index = index;
    nodes.legs.push(leg);
    model.add(leg);
  });

  const head = new THREE.Group();
  head.position.set(0, 1.78, .38);
  head.scale.setScalar(shape.head);
  head.add(sphere(.6, coatMat, [0, 0, 0], species === 'cat' ? [1.02, .92, .94] : [1, 1, .96], 30));
  nodes.head = head;
  model.add(head);

  const earType = shape.ears;
  if (earType === 'floppy') {
    head.add(createFloppyEar(-1, coatMat, innerMat, nodes), createFloppyEar(1, coatMat, innerMat, nodes));
  } else {
    head.add(createPointedEar(-1, earType, coatMat, innerMat, nodes), createPointedEar(1, earType, coatMat, innerMat, nodes));
  }
  nodes.ears.forEach((ear) => { ear.position.y -= 1.78; ear.position.z -= .38; });

  if (config.marking === 'mask' || config.breed === 'siamese') {
    head.add(sphere(.235, accentMat, [-.22, .02, .49], [1.12, .72, .28], 20));
    head.add(sphere(.235, accentMat, [.22, .02, .49], [1.12, .72, .28], 20));
  }
  if (config.marking === 'blaze') {
    head.add(sphere(.18, accentMat, [0, .22, .49], [.5, 1.38, .25], 20));
  }
  if (config.marking === 'tabby') {
    [-.13, 0, .13].forEach((x) => head.add(capsule(.018, .22, accentMat, [x, .31, .52], [1, 1, .28], [0, 0, x * 1.7])));
  }
  if (config.marking === 'patches') {
    head.add(sphere(.24, accentMat, [-.3, .12, .48], [1.05, .9, .25], 20));
  }

  const muzzleMat = config.marking === 'solid' ? coatMat : accentMat;
  const muzzleScale = shape.muzzle;
  head.add(sphere(.255, muzzleMat, [-.14, -.2, .5], [muzzleScale, .78, .7], 22));
  head.add(sphere(.255, muzzleMat, [.14, -.2, .5], [muzzleScale, .78, .7], 22));
  const nose = sphere(species === 'cat' ? .105 : .12, blackMat, [0, -.13, .7], [1.08, .72, .68], 18);
  head.add(nose);
  const smileLeft = mesh(new THREE.TorusGeometry(.135, .018, 8, 18, Math.PI * .72), blackMat, [-.105, -.31, .65], [1, .8, 1], [0, 0, -.15]);
  const smileRight = mesh(new THREE.TorusGeometry(.135, .018, 8, 18, Math.PI * .72), blackMat, [.105, -.31, .65], [1, .8, 1], [0, Math.PI, .15]);
  head.add(smileLeft, smileRight);

  head.add(createEye(-.22, config, eyeWhite, irisMat, blackMat, nodes));
  head.add(createEye(.22, config, eyeWhite, irisMat, blackMat, nodes));

  if (species === 'cat') {
    const whiskerMat = new THREE.MeshBasicMaterial({ color: '#475569', transparent: true, opacity: .72 });
    [-1, 1].forEach((side) => {
      [-.08, .02, .12].forEach((offset, index) => {
        const start = [side * .2, -.23 + offset, .67];
        const end = [side * (.66 + index * .03), -.22 + offset * .55, .72];
        head.add(segmentBetween(start, end, .009, whiskerMat));
      });
    });
  }

  model.add(createTail(config, shape, coatMat, accentMat, nodes));

  const accessory = config.accessory || 'blue';
  if (accessory !== 'none') {
    const accessoryMat = material(ACCESSORY_COLORS[accessory] || ACCESSORY_COLORS.blue, { roughness: .48 });
    const collar = mesh(new THREE.TorusGeometry(.43, .045, 12, 40), accessoryMat, [0, 1.31, .21], [1, .88, 1], [Math.PI / 2, 0, 0]);
    const tagMat = material('#f2c96d', { roughness: .3, metalness: .45 });
    const tag = sphere(.09, tagMat, [0, 1.2, .63], [1, 1.06, .38], 20);
    model.add(collar, tag);
    nodes.tag = tag;
  }

  root.userData.nodes = nodes;
  root.userData.materials = [coatMat, accentMat, innerMat, eyeWhite, irisMat, blackMat];
  root.scale.setScalar(.92);
  return root;
}

class Pet3DView {
  constructor(container, { preview = false } = {}) {
    this.container = container;
    this.preview = preview;
    this.mode = preview ? 'studio' : 'idle';
    this.active = false;
    this.hidden = document.hidden;
    this.lookTarget = new THREE.Vector2();
    this.look = new THREE.Vector2();
    this.orbitTarget = preview ? -.16 : 0;
    this.orbit = this.orbitTarget;
    this.direction = 1;
    this.yaw = this.orbitTarget;
    this.reaction = null;
    this.lastTime = 0;
    this.frame = this.frame.bind(this);
    this.onVisibility = this.onVisibility.bind(this);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1.8, 1.8, 1.8, -1.2, .1, 20);
    this.camera.position.set(0, 1.45, 5);
    this.camera.lookAt(0, 1.08, 0);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preview ? 1.75 : 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.className = `pet-3d-canvas ${preview ? 'is-preview' : 'is-runtime'}`;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.replaceChildren(this.renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xf2f7ff, 0x18263e, preview ? 2.3 : 2.6);
    const key = new THREE.DirectionalLight(0xffffff, preview ? 3.1 : 3.35);
    key.position.set(-3, 5, 5);
    const rim = new THREE.DirectionalLight(0x78a8ff, 1.7);
    rim.position.set(4, 2, -3);
    this.scene.add(hemi, key, rim);

    const shadowMat = new THREE.MeshBasicMaterial({ color: preview ? 0x020812 : 0x334155, transparent: true, opacity: preview ? .34 : .16, depthWrite: false });
    this.shadow = mesh(new THREE.CircleGeometry(.8, 40), shadowMat, [0, .015, -.32], [1.18, .42, 1], [-Math.PI / 2, 0, 0]);
    this.scene.add(this.shadow);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (preview) this.bindStudioControls();
    this.resize();
  }

  bindStudioControls() {
    const canvas = this.renderer.domElement;
    let dragging = false;
    let lastX = 0;
    canvas.addEventListener('pointerdown', (event) => {
      dragging = true;
      lastX = event.clientX;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('is-dragging');
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      this.orbitTarget = clamp(this.orbitTarget + (event.clientX - lastX) * .012, -.82, .82);
      lastX = event.clientX;
    });
    const finish = () => { dragging = false; canvas.classList.remove('is-dragging'); };
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
  }

  onVisibility() {
    this.hidden = document.hidden;
    this.updateLoop();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || (this.preview ? 220 : 98)));
    const height = Math.max(1, Math.round(rect.height || (this.preview ? 220 : 98)));
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    const vertical = this.preview ? 3.2 : 3.35;
    this.camera.left = -vertical * aspect / 2;
    this.camera.right = vertical * aspect / 2;
    this.camera.top = vertical * .61;
    this.camera.bottom = -vertical * .39;
    this.camera.updateProjectionMatrix();
    this.renderOnce();
  }

  setConfig(config) {
    if (this.pet) {
      this.scene.remove(this.pet);
      this.pet.traverse((item) => {
        item.geometry?.dispose?.();
        if (Array.isArray(item.material)) item.material.forEach((mat) => mat.dispose?.());
        else item.material?.dispose?.();
      });
    }
    this.config = { ...config };
    this.pet = buildPet(this.config);
    this.scene.add(this.pet);
    this.renderOnce();
  }

  setMode(mode) {
    this.mode = mode || 'idle';
  }

  setDirection(direction = 1) {
    this.direction = direction >= 0 ? 1 : -1;
  }

  setLook(x, y) {
    this.lookTarget.set(clamp(x, -1, 1), clamp(y, -1, 1));
  }

  react(type = 'happy', duration = 800) {
    this.reaction = { type, start: performance.now() / 1000, duration: duration / 1000 };
  }

  setActive(active) {
    this.active = Boolean(active);
    this.updateLoop();
  }

  updateLoop() {
    const shouldRun = this.active && !this.hidden;
    this.renderer.setAnimationLoop(shouldRun ? this.frame : null);
    if (!shouldRun) this.renderOnce();
  }

  renderOnce() {
    if (!this.renderer || !this.scene) return;
    this.renderer.render(this.scene, this.camera);
  }

  frame(timeMs) {
    const time = timeMs / 1000;
    const delta = Math.min(.05, this.lastTime ? time - this.lastTime : .016);
    this.lastTime = time;
    if (this.pet) this.animate(time, delta);
    this.renderer.render(this.scene, this.camera);
  }

  animate(time, delta) {
    const nodes = this.pet.userData.nodes;
    const walking = this.mode === 'walk';
    const turning = this.mode === 'turn';
    const observing = this.mode === 'observe';
    const studio = this.mode === 'studio';
    const resting = this.mode === 'sleep';
    const atHome = this.mode === 'house';
    this.look.lerp(this.lookTarget, 1 - Math.pow(.002, delta));
    this.orbit += (this.orbitTarget - this.orbit) * (1 - Math.pow(.003, delta));
    const yawTarget = studio || atHome
      ? this.orbit + this.look.x * .08
      : walking || turning
        ? this.direction * 1.18
        : this.look.x * .08;
    this.yaw += (yawTarget - this.yaw) * (1 - Math.pow(walking ? .0007 : .006, delta));

    const breath = Math.sin(time * 2.2) * .018;
    const step = Math.sin(time * 9.4);
    const hop = walking ? Math.abs(Math.sin(time * 9.4)) * .065 : 0;
    nodes.root.position.y = hop;
    nodes.root.rotation.y = this.yaw;
    nodes.root.rotation.z *= Math.pow(.002, delta);
    nodes.body.position.y += ((resting ? .43 : observing ? .7 : .88) - nodes.body.position.y) * (1 - Math.pow(.004, delta));
    nodes.head.position.y += ((resting ? .82 : observing ? 1.64 : 1.78) - nodes.head.position.y) * (1 - Math.pow(.004, delta));
    nodes.head.position.z += ((resting ? .7 : .38) - nodes.head.position.z) * (1 - Math.pow(.004, delta));
    nodes.body.scale.set(1 - breath * .22, 1 + breath, 1 - breath * .22);
    nodes.body.rotation.z = resting ? -.28 : walking ? step * .035 : turning ? Math.sin(time * 5) * .018 : Math.sin(time * .85) * .008;
    nodes.head.rotation.y = walking ? 0 : this.look.x * .24;
    nodes.head.rotation.x = resting ? -.18 : -this.look.y * .13 + (observing ? -.035 : 0);
    nodes.head.rotation.z = resting ? -.32 : observing ? -.055 + Math.sin(time * .9) * .018 : Math.sin(time * .7) * .012;

    nodes.legs.forEach((leg, index) => {
      const gait = [1, -1, -1, 1][index] || 1;
      leg.rotation.x = walking ? step * gait * .48 : resting ? -.72 : 0;
      leg.rotation.z = observing ? (leg.userData.side > 0 ? -.14 : .14) : resting ? leg.userData.side * .24 : 0;
      leg.position.y += ((resting ? .35 : observing ? .48 : .66) - leg.position.y) * (1 - Math.pow(.004, delta));
    });
    if (nodes.tail) {
      nodes.tail.rotation.z = Math.sin(time * (walking ? 6.2 : 3.1)) * (walking ? .24 : .16) + (observing ? .16 : 0);
      nodes.tail.rotation.y = Math.sin(time * 2.1) * .08;
    }
    nodes.ears.forEach((ear, index) => {
      ear.rotation.x = Math.sin(time * 1.7 + index * .8) * .025;
    });

    const blinkPhase = time % 4.6;
    const blink = resting ? .08 : blinkPhase > 4.34 ? Math.max(.08, Math.abs((blinkPhase - 4.47) / .13)) : 1;
    nodes.eyes.forEach((eye) => { eye.scale.y = blink; });
    nodes.pupils.forEach((pupil) => {
      const baseX = pupil.userData.baseX ?? pupil.position.x;
      const baseY = pupil.userData.baseY ?? pupil.position.y;
      pupil.userData.baseX = baseX;
      pupil.userData.baseY = baseY;
      pupil.position.x += (baseX + this.look.x * .022 - pupil.position.x) * .14;
      pupil.position.y += (baseY - this.look.y * .018 - pupil.position.y) * .14;
    });

    if (this.reaction) {
      const progress = (time - this.reaction.start) / this.reaction.duration;
      if (progress >= 1) this.reaction = null;
      else if (this.reaction.type === 'happy') {
        nodes.root.position.y += Math.sin(progress * Math.PI) * .42;
        nodes.root.rotation.z = Math.sin(progress * TAU) * .09;
        if (nodes.tail) nodes.tail.rotation.z += Math.sin(progress * TAU * 3) * .3;
      } else if (this.reaction.type === 'play') {
        nodes.root.position.y += Math.sin(progress * Math.PI) * .5;
        nodes.root.rotation.y += Math.sin(progress * Math.PI) * TAU;
        if (nodes.tail) nodes.tail.rotation.z += Math.sin(progress * TAU * 4) * .42;
      } else if (this.reaction.type === 'feed') {
        nodes.head.rotation.x += Math.sin(progress * TAU * 3) * .16;
        nodes.body.scale.multiplyScalar(1 + Math.sin(progress * Math.PI) * .035);
      } else if (this.reaction.type === 'pet') {
        nodes.head.rotation.z += Math.sin(progress * Math.PI) * .16;
        if (nodes.tail) nodes.tail.rotation.z += Math.sin(progress * TAU * 5) * .34;
      } else {
        nodes.head.rotation.z += Math.sin(progress * Math.PI) * .18;
      }
    }

    this.shadow.scale.x = 1.18 - nodes.root.position.y * .28;
    this.shadow.scale.y = .42 - nodes.root.position.y * .08;
    this.shadow.material.opacity = (this.preview ? .34 : .16) - nodes.root.position.y * .08;
  }

  destroy() {
    this.setActive(false);
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.dispose();
  }
}

export function createPet3DView(container, options) {
  try {
    return new Pet3DView(container, options);
  } catch (error) {
    console.warn('3D pet is unavailable', error);
    container.innerHTML = '<span class="pet-3d-fallback" aria-hidden="true">🐾</span>';
    return {
      setConfig() {}, setMode() {}, setDirection() {}, setLook() {}, react() {}, setActive() {}, destroy() {}
    };
  }
}
