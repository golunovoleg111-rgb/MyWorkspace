import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { buildPet } from './pet-3d.js';

const PET_KEY = 'myworkspace.pet.v1';
const LIFE_KEY = 'myworkspace.pet.life.v1';
const HOME_KEY = 'myworkspace.rest.v1';
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));
const todayKey = () => new Date().toISOString().slice(0, 10);
const DEFAULT_PET = { enabled: true, species: 'dog', breed: 'spitz', name: 'Тедди', coat: '#d49a60', accent: '#fff1d4', eyes: '#3d2b1f', marking: 'muzzle', eyeStyle: 'bright', accessory: 'blue', personality: 'helper' };
const SHOP = [
  { id: 'plant', icon: '♧', name: 'Монстера', copy: 'Живое растение у окна', price: 18 },
  { id: 'lamp', icon: '◉', name: 'Лампа-сфера', copy: 'Мягкий вечерний свет', price: 24 },
  { id: 'tunnel', icon: '⌒', name: 'Игровой тоннель', copy: 'Для пробежек и пряток', price: 32 },
  { id: 'radio', icon: '♫', name: 'Радио', copy: 'Спокойная атмосфера дома', price: 28 },
  { id: 'cushion', icon: '◇', name: 'Мягкая подушка', copy: 'Дополнительное место отдыха', price: 20 },
  { id: 'stars', icon: '✦', name: 'Звёздный проектор', copy: 'Сияющие частицы ночью', price: 40 }
];

function read(key, fallback) {
  try { return { ...fallback, ...(JSON.parse(localStorage.getItem(key)) || {}) }; }
  catch { return { ...fallback }; }
}

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .05, ...options });
}

function rounded(size, radius, mat, position, rotation = [0, 0, 0]) {
  const geometry = new RoundedBoxGeometry(size[0], size[1], size[2], 5, radius);
  const item = new THREE.Mesh(geometry, mat);
  item.position.set(...position);
  item.rotation.set(...rotation);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function markInteractive(object, action, label) {
  object.userData.restAction = action;
  object.userData.restLabel = label;
  object.traverse((child) => {
    if (child.isMesh) {
      child.userData.restAction = action;
      child.userData.restLabel = label;
    }
  });
  return object;
}

class LivingScene {
  constructor(container, pet, onEvent) {
    this.container = container;
    this.petConfig = pet;
    this.onEvent = onEvent;
    this.active = false;
    this.clock = new THREE.Clock();
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.interactables = [];
    this.destination = null;
    this.state = 'idle';
    this.stateUntil = 0;
    this.ballVelocity = null;
    this.hovered = null;
    this.theme = 'day';
    this.frame = this.frame.bind(this);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#182b46');
    this.scene.fog = new THREE.FogExp2('#1c304a', .035);
    this.camera = new THREE.PerspectiveCamera(42, 1, .1, 80);
    this.camera.position.set(8.7, 5.8, 9.7);
    this.camera.lookAt(0, 1.35, -.6);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.55));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.tabIndex = 0;
    container.replaceChildren(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .055;
    this.controls.enablePan = false;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 15;
    this.controls.minPolarAngle = .76;
    this.controls.maxPolarAngle = 1.32;
    this.controls.minAzimuthAngle = -.72;
    this.controls.maxAzimuthAngle = .72;
    this.controls.target.set(0, 1.25, -.7);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .34, .58, .86);
    this.composer.addPass(this.bloom);
    this.buildRoom();
    this.bind();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  buildRoom() {
    const cream = material('#dfe3e7', { roughness: .78 });
    const oak = material('#a8784f', { roughness: .68 });
    const navy = material('#203a60', { roughness: .48 });
    const blue = material('#5687cf', { roughness: .42 });
    const brass = material('#d0a45b', { roughness: .27, metalness: .65 });
    const dark = material('#16243a', { roughness: .66 });

    this.floorUniforms = { uTime: { value: 0 }, uA: { value: new THREE.Color('#8f684a') }, uB: { value: new THREE.Color('#4f382d') } };
    const floorMat = new THREE.ShaderMaterial({
      uniforms: this.floorUniforms,
      vertexShader: 'varying vec2 vUv; varying vec3 vPos; void main(){vUv=uv;vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform float uTime;uniform vec3 uA;uniform vec3 uB;varying vec2 vUv;varying vec3 vPos;float line(float x){return smoothstep(.485,.5,abs(fract(x)-.5));}void main(){float boards=line(vUv.y*18.0)*.12;float seams=line(vUv.x*5.0+step(.5,fract(vUv.y*18.0))*.5)*.045;float grain=sin(vUv.y*220.0+sin(vUv.x*32.0))*0.018;float glow=.04*sin(uTime*.4+vUv.x*5.0);vec3 c=mix(uA,uB,vUv.y*.7)+grain+glow-boards-seams;gl_FragColor=vec4(c,1.0);}'
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(15, 11, 1, 1), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.scene.add(rounded([15, 5.8, .18], .08, cream, [0, 2.9, -5.35]));
    this.scene.add(rounded([.18, 5.8, 11], .08, cream, [-7.45, 2.9, 0]));

    this.windowUniforms = { uTime: { value: 0 }, uTop: { value: new THREE.Color('#70b9eb') }, uBottom: { value: new THREE.Color('#f1cfaa') }, uStars: { value: 0 } };
    const windowMat = new THREE.ShaderMaterial({
      uniforms: this.windowUniforms, transparent: false,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform float uTime;uniform vec3 uTop;uniform vec3 uBottom;uniform float uStars;varying vec2 vUv;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){vec3 c=mix(uBottom,uTop,smoothstep(0.0,1.0,vUv.y));float sun=smoothstep(.12,0.0,distance(vUv,vec2(.72,.72)));c+=vec3(1.0,.72,.35)*sun*.72;vec2 cell=floor(vUv*vec2(70.0,42.0));float star=step(.988,hash(cell))*smoothstep(.5,1.0,vUv.y)*(0.65+0.35*sin(uTime*2.0+hash(cell)*9.0))*uStars;c+=star*vec3(.7,.88,1.0);float skyline=step(vUv.y,.12+hash(floor(vUv*vec2(22.0,1.0)))*.22);c=mix(c,vec3(.06,.1,.17),skyline*.85);gl_FragColor=vec4(c,1.0);}'
    });
    const window = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 3), windowMat);
    window.position.set(1.7, 3.35, -5.22);
    this.scene.add(markInteractive(window, 'window', 'Посмотреть в окно'));
    this.interactables.push(window);
    [-2.62, 2.62].forEach((x) => this.scene.add(rounded([.17, 3.3, .16], .04, dark, [1.7 + x, 3.35, -5.08])));
    [-1.56, 1.56].forEach((y) => this.scene.add(rounded([5.42, .17, .16], .04, dark, [1.7, 3.35 + y, -5.08])));
    this.scene.add(rounded([.12, 3.05, .14], .03, dark, [1.7, 3.35, -5.02]));

    const rug = new THREE.Mesh(new THREE.CircleGeometry(3.35, 72), material('#294d79', { roughness: .92 }));
    rug.rotation.x = -Math.PI / 2;
    rug.scale.set(1.35, .72, 1);
    rug.position.set(.15, .026, .25);
    rug.receiveShadow = true;
    this.scene.add(rug);
    const rugRing = new THREE.Mesh(new THREE.RingGeometry(2.75, 2.95, 72), material('#7ca6d7', { roughness: .9 }));
    rugRing.rotation.x = -Math.PI / 2;
    rugRing.scale.copy(rug.scale);
    rugRing.position.set(.15, .031, .25);
    this.scene.add(rugRing);

    const sofa = new THREE.Group();
    sofa.add(rounded([4.2, .58, 1.45], .22, navy, [0, .42, 0]));
    sofa.add(rounded([4.0, 1.45, .38], .16, navy, [0, 1.16, -.57], [-.11, 0, 0]));
    sofa.add(rounded([.45, .87, 1.55], .16, blue, [-2.03, .76, 0]));
    sofa.add(rounded([.45, .87, 1.55], .16, blue, [2.03, .76, 0]));
    sofa.add(rounded([1.2, .28, 1.05], .18, material('#d5ad70'), [-1.1, .83, -.03]));
    sofa.add(rounded([1.2, .28, 1.05], .18, material('#7a99be'), [.55, .83, -.03]));
    sofa.position.set(-3.55, 0, -3.46);
    this.scene.add(sofa);

    const bed = new THREE.Group();
    bed.add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.35, .34, 48), navy));
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.08, .28, 48), material('#a9c4e6', { roughness: .94 }));
    cushion.position.y = .27;
    bed.add(cushion);
    bed.position.set(4.8, .2, -3.45);
    this.scene.add(markInteractive(bed, 'sleep', 'Отдохнуть на лежанке'));
    this.interactables.push(...bed.children);
    this.extraCushion = rounded([.9, .22, .68], .16, material('#d9aa70', { roughness: .9 }), [3.15, .2, -4.15], [0, .22, -.05]);
    this.scene.add(this.extraCushion);
    this.shopObjects = { cushion: this.extraCushion };

    const bowl = new THREE.Group();
    const bowlMesh = new THREE.Mesh(new THREE.CylinderGeometry(.48, .6, .26, 42, 1, false), brass);
    const food = new THREE.Mesh(new THREE.CylinderGeometry(.39, .39, .04, 36), material('#7d4c29', { roughness: .92 }));
    food.position.y = .15;
    bowl.add(bowlMesh, food);
    bowl.position.set(4.45, .16, 2.55);
    this.scene.add(markInteractive(bowl, 'feed', 'Миска с угощением'));
    this.interactables.push(...bowl.children);
    this.bowlFood = food;

    this.ball = new THREE.Mesh(new THREE.SphereGeometry(.32, 32, 22), material('#e95d75', { roughness: .32 }));
    this.ball.position.set(1.75, .35, 2.4);
    this.ball.castShadow = true;
    this.scene.add(markInteractive(this.ball, 'ball', 'Бросить мяч'));
    this.interactables.push(this.ball);

    this.lamp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 2.65, 24), brass);
    pole.position.y = 1.35;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.42, .52, .13, 36), brass);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(.38, .65, .68, 42, 1, true), material('#e7d9c2', { side: THREE.DoubleSide }));
    shade.position.y = 2.75;
    this.lamp.add(pole, base, shade);
    this.lamp.position.set(-5.9, .08, -2.7);
    this.scene.add(markInteractive(this.lamp, 'lamp', 'Переключить свет'));
    this.interactables.push(...this.lamp.children);
    this.lampLight = new THREE.PointLight('#ffd6a0', 0, 8, 2);
    this.lampLight.position.set(-5.9, 3, -2.25);
    this.scene.add(this.lampLight);

    const shelf = rounded([2.5, .18, .62], .05, oak, [-5.95, 2.65, -4.9]);
    this.scene.add(shelf);
    for (let i = 0; i < 7; i += 1) {
      const book = rounded([.2 + (i % 2) * .05, .62 + (i % 3) * .1, .34], .025, material(['#d56e72', '#668dcc', '#d5aa58'][i % 3]), [-6.78 + i * .26, 3.05 + (i % 3) * .04, -4.72]);
      this.scene.add(book);
    }

    this.plant = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.42, .55, .72, 32), material('#ad6848'));
    pot.position.y = .38;
    this.plant.add(pot);
    for (let i = 0; i < 9; i += 1) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(.36, 22, 14), material(i % 2 ? '#3c8c68' : '#55a879'));
      const a = (i / 9) * Math.PI * 2;
      leaf.scale.set(.58, 1.22, .22);
      leaf.position.set(Math.cos(a) * .38, 1.02 + (i % 3) * .24, Math.sin(a) * .3);
      leaf.rotation.z = Math.cos(a) * .55;
      this.plant.add(leaf);
    }
    this.plant.position.set(6.25, 0, -4.28);
    this.scene.add(this.plant);

    this.tunnel = new THREE.Mesh(new THREE.TorusGeometry(.82, .19, 24, 64, Math.PI), material('#8d6fc3'));
    this.tunnel.rotation.z = Math.PI / 2;
    this.tunnel.rotation.y = Math.PI / 2;
    this.tunnel.position.set(-5.3, .83, 2.8);
    this.scene.add(this.tunnel);
    this.radio = rounded([1.15, .72, .5], .12, dark, [-5.9, 3.12, -4.62]);
    this.scene.add(this.radio);
    this.starProjector = new THREE.PointLight('#6ea8ff', 0, 12, 2);
    this.starProjector.position.set(0, 4.7, 0);
    this.scene.add(this.starProjector);

    this.pet = buildPet(this.petConfig);
    this.pet.scale.setScalar(.72);
    this.pet.position.set(-.4, .03, .72);
    this.pet.rotation.y = .35;
    this.scene.add(this.pet);
    this.nodes = this.pet.userData.nodes;
    this.petBase = {
      bodyY: this.nodes.body.position.y,
      headY: this.nodes.head.position.y,
      headZ: this.nodes.head.position.z,
      legsY: this.nodes.legs.map((leg) => leg.position.y)
    };

    this.hemi = new THREE.HemisphereLight('#cfe4ff', '#513b30', 2.25);
    this.key = new THREE.DirectionalLight('#fff5e5', 3.5);
    this.key.position.set(4.5, 8, 5);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1536, 1536);
    this.key.shadow.camera.left = -9; this.key.shadow.camera.right = 9; this.key.shadow.camera.top = 8; this.key.shadow.camera.bottom = -8;
    this.rim = new THREE.DirectionalLight('#6ea7ff', 1.7);
    this.rim.position.set(-6, 4, -3);
    this.scene.add(this.hemi, this.key, this.rim);

    this.particles = this.makeParticles();
    this.scene.add(this.particles);
    this.applyInventory([]);
  }

  makeParticles() {
    const positions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i += 1) {
      positions[i * 3] = (Math.random() - .5) * 14;
      positions[i * 3 + 1] = .4 + Math.random() * 5;
      positions[i * 3 + 2] = (Math.random() - .5) * 9;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: '#d7eaff', size: .035, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false });
    return new THREE.Points(geometry, mat);
  }

  bind() {
    this.renderer.domElement.addEventListener('pointermove', (event) => this.onPointer(event, false));
    this.renderer.domElement.addEventListener('pointerdown', (event) => this.onPointer(event, true));
  }

  onPointer(event, activate) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.interactables, true)[0]?.object || null;
    if (this.hovered !== hit) {
      this.hovered = hit;
      this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    }
    if (activate && hit?.userData.restAction) this.action(hit.userData.restAction);
  }

  setActive(active) {
    this.active = Boolean(active);
    this.renderer.setAnimationLoop(this.active ? this.frame : null);
    if (this.active) this.resize();
  }

  setTheme(theme) {
    this.theme = theme;
    const themes = {
      day: { bg: '#182b46', fog: '#1c304a', top: '#70b9eb', bottom: '#f1cfaa', floorA: '#8f684a', floorB: '#4f382d', key: '#fff5e5', stars: 0, lamp: 0, bloom: .34 },
      evening: { bg: '#35243c', fog: '#4a2f43', top: '#55456e', bottom: '#e48b64', floorA: '#7e503c', floorB: '#38272a', key: '#ffd2a1', stars: .18, lamp: 14, bloom: .48 },
      night: { bg: '#081326', fog: '#0b1b35', top: '#07182f', bottom: '#263f6f', floorA: '#3f3a48', floorB: '#171c2b', key: '#8dbdff', stars: 1, lamp: 8, bloom: .72 }
    };
    const value = themes[theme] || themes.day;
    this.scene.background.set(value.bg);
    this.scene.fog.color.set(value.fog);
    this.windowUniforms.uTop.value.set(value.top);
    this.windowUniforms.uBottom.value.set(value.bottom);
    this.windowUniforms.uStars.value = value.stars;
    this.floorUniforms.uA.value.set(value.floorA);
    this.floorUniforms.uB.value.set(value.floorB);
    this.key.color.set(value.key);
    this.lampLight.intensity = this.inventory?.has('lamp') ? value.lamp : 0;
    this.starProjector.intensity = theme === 'night' ? 3 : 0;
    this.bloom.strength = value.bloom;
  }

  applyInventory(items) {
    const owned = new Set(items);
    this.inventory = owned;
    this.plant.visible = owned.has('plant');
    this.lamp.visible = owned.has('lamp');
    this.tunnel.visible = owned.has('tunnel');
    this.radio.visible = owned.has('radio');
    this.shopObjects.cushion.visible = owned.has('cushion');
    if (!owned.has('lamp')) this.lampLight.intensity = 0;
    this.particles.material.opacity = owned.has('stars') || this.theme === 'night' ? .52 : .2;
  }

  action(type) {
    if (type === 'ball') return this.throwBall();
    if (type === 'feed') return this.moveTo(new THREE.Vector3(3.55, 0, 2.35), 'К миске', () => this.perform('eat', 3.3, 'feed'));
    if (type === 'sleep') return this.moveTo(new THREE.Vector3(3.95, 0, -3.1), 'Идёт к лежанке', () => this.perform('sleep', 5, 'sleep'));
    if (type === 'paw') return this.moveTo(new THREE.Vector3(.2, 0, 1.35), 'Подходит ближе', () => this.perform('paw', 2.5, 'paw'));
    if (type === 'call') return this.moveTo(new THREE.Vector3(.2, 0, 1.2), 'Бежит к вам', () => this.perform('happy', 2.2, 'call'));
    if (type === 'window') return this.moveTo(new THREE.Vector3(1.5, 0, -3.65), 'Смотрит в окно', () => this.perform('observe', 4, 'explore'));
    if (type === 'lamp') {
      this.lampLight.intensity = this.lampLight.intensity > 1 ? 0 : 14;
      this.onEvent('lamp', 'Свет в комнате изменился');
    }
  }

  moveTo(target, label, onArrive) {
    if (this.state === 'sleep') this.state = 'idle';
    this.destination = { target, onArrive, phase: 'turn' };
    this.state = 'turn';
    this.onEvent('state', label);
  }

  throwBall() {
    this.ball.position.set(-1.8, 1.1, 2.6);
    this.ballVelocity = new THREE.Vector3(4.8 + Math.random() * 1.2, 5.4, -3.2 - Math.random() * 1.4);
    this.state = 'alert';
    this.onEvent('state', 'Следит за мячом');
  }

  perform(state, seconds, event) {
    this.state = state;
    this.destination = null;
    this.stateUntil = performance.now() / 1000 + seconds;
    this.onEvent(event, state === 'eat' ? 'С удовольствием ест' : state === 'sleep' ? 'Устроился поудобнее' : state === 'paw' ? 'Даёт лапу' : state === 'observe' ? 'Наблюдает за городом' : 'Рад вашему вниманию');
  }

  updateMovement(delta) {
    if (!this.destination) return;
    const dx = this.destination.target.x - this.pet.position.x;
    const dz = this.destination.target.z - this.pet.position.z;
    const distance = Math.hypot(dx, dz);
    const desired = Math.atan2(dx, dz);
    let diff = Math.atan2(Math.sin(desired - this.pet.rotation.y), Math.cos(desired - this.pet.rotation.y));
    if (this.destination.phase === 'turn') {
      this.pet.rotation.y += diff * Math.min(1, delta * 7.2);
      if (Math.abs(diff) < .08) { this.destination.phase = 'walk'; this.state = 'walk'; }
      return;
    }
    if (distance < .12) {
      const callback = this.destination.onArrive;
      this.destination = null;
      this.state = 'idle';
      callback?.();
      return;
    }
    const speed = this.petConfig.personality === 'calm' ? 1.45 : this.petConfig.personality === 'playful' ? 2.25 : 1.8;
    this.pet.position.x += dx / distance * Math.min(distance, speed * delta);
    this.pet.position.z += dz / distance * Math.min(distance, speed * delta);
  }

  updateBall(delta) {
    if (!this.ballVelocity) return;
    this.ballVelocity.y -= 11 * delta;
    this.ball.position.addScaledVector(this.ballVelocity, delta);
    this.ball.rotation.x += this.ballVelocity.z * delta * 2;
    this.ball.rotation.z -= this.ballVelocity.x * delta * 2;
    if (this.ball.position.y < .32) {
      this.ball.position.y = .32;
      this.ballVelocity.y *= -.48;
      this.ballVelocity.x *= .8;
      this.ballVelocity.z *= .8;
      if (Math.abs(this.ballVelocity.y) < .55) {
        this.ballVelocity = null;
        const target = this.ball.position.clone(); target.y = 0;
        this.moveTo(target, 'Догоняет мяч', () => {
          this.perform('play', 2.6, 'play');
          this.ball.position.set(this.pet.position.x + .45, .34, this.pet.position.z + .2);
        });
      }
    }
  }

  animatePet(time) {
    const walking = this.state === 'walk';
    const sleeping = this.state === 'sleep';
    const eating = this.state === 'eat';
    const step = Math.sin(time * 10.5);
    const breath = Math.sin(time * 2.1) * .018;
    this.nodes.root.position.y = walking ? Math.abs(step) * .075 : sleeping ? -.14 : 0;
    this.nodes.body.position.y = this.petBase.bodyY + (sleeping ? -.38 : breath);
    this.nodes.body.rotation.z = sleeping ? -.18 : walking ? step * .045 : Math.sin(time * .65) * .008;
    this.nodes.head.position.y = this.petBase.headY + (sleeping ? -.64 : eating ? -.22 + Math.sin(time * 7) * .05 : 0);
    this.nodes.head.position.z = this.petBase.headZ + (sleeping ? .26 : eating ? .18 : 0);
    this.nodes.head.rotation.x = eating ? .35 + Math.sin(time * 7) * .1 : sleeping ? -.18 : 0;
    this.nodes.head.rotation.z = sleeping ? -.28 : this.state === 'happy' ? Math.sin(time * 8) * .08 : 0;
    this.nodes.legs.forEach((leg, index) => {
      const gait = [1, -1, -1, 1][index] || 1;
      leg.rotation.x = walking ? step * gait * .5 : sleeping ? -.68 : 0;
      leg.rotation.z = this.state === 'paw' && index === 1 ? -.9 : sleeping ? leg.userData.side * .22 : 0;
      leg.position.y = this.petBase.legsY[index] + (sleeping ? -.2 : 0);
    });
    if (this.nodes.tail) this.nodes.tail.rotation.z = Math.sin(time * (this.state === 'happy' || this.state === 'play' ? 12 : walking ? 7 : 3.2)) * (this.state === 'happy' || this.state === 'play' ? .42 : .18);
    const blinkPhase = time % 4.5;
    const blink = sleeping ? .07 : blinkPhase > 4.27 ? Math.max(.07, Math.abs((blinkPhase - 4.38) / .11)) : 1;
    this.nodes.eyes.forEach((eye) => { eye.scale.y = blink; });
    if (this.state === 'play') this.nodes.root.rotation.z = Math.sin(time * 8) * .08;
    else this.nodes.root.rotation.z *= .85;
  }

  frame() {
    const delta = Math.min(.04, this.clock.getDelta());
    const time = performance.now() / 1000;
    this.floorUniforms.uTime.value = time;
    this.windowUniforms.uTime.value = time;
    this.particles.rotation.y += delta * .018;
    this.updateBall(delta);
    this.updateMovement(delta);
    if (this.stateUntil && time > this.stateUntil) {
      this.stateUntil = 0;
      this.state = 'idle';
      this.onEvent('state', 'Исследует комнату');
    }
    this.animatePet(time);
    this.controls.update();
    this.composer.render();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
  }
}

export function initRestZone({ toast }) {
  const root = document.querySelector('#view-rest');
  const container = document.querySelector('#restCanvas');
  if (!root || !container) return;
  const pet = read(PET_KEY, DEFAULT_PET);
  const life = read(LIFE_KEY, { mood: 82, energy: 76, hunger: 72 });
  const saved = read(HOME_KEY, { coins: 48, inventory: [], theme: 'day', completed: {}, day: todayKey(), journal: 'Первый день в новом доме.' });
  if (saved.day !== todayKey()) { saved.day = todayKey(); saved.completed = {}; }
  saved.inventory = Array.isArray(saved.inventory) ? saved.inventory : [];
  let scene;

  const save = () => {
    try {
      localStorage.setItem(HOME_KEY, JSON.stringify(saved));
      localStorage.setItem(LIFE_KEY, JSON.stringify({ ...life, lastSeen: Date.now() }));
    } catch { /* Current session remains interactive. */ }
  };

  function updateNeeds() {
    [['Mood', 'mood'], ['Energy', 'energy'], ['Hunger', 'hunger']].forEach(([name, key]) => {
      const value = Math.round(clamp(life[key]));
      document.querySelector(`#rest${name}Value`).textContent = `${value}%`;
      document.querySelector(`#rest${name}Bar`).style.width = `${value}%`;
    });
    document.querySelector('#restCoins').textContent = saved.coins;
  }

  const dailies = [
    { id: 'play', icon: '●', title: 'Поиграть вместе', copy: 'Бросьте питомцу мяч', reward: 8 },
    { id: 'feed', icon: '◒', title: 'Время угощения', copy: 'Подойдите к миске', reward: 6 },
    { id: 'explore', icon: '↗', title: 'Посмотреть вокруг', copy: 'Исследуйте окно или интерьер', reward: 7 }
  ];

  function renderDailies() {
    const holder = document.querySelector('#restDailies');
    holder.innerHTML = dailies.map((item) => `<div class="rest-daily${saved.completed[item.id] ? ' is-done' : ''}"><span>${saved.completed[item.id] ? '✓' : item.icon}</span><div><strong>${item.title}</strong><small>${saved.completed[item.id] ? 'Выполнено сегодня' : item.copy}</small></div><b>${saved.completed[item.id] ? 'ГОТОВО' : `+${item.reward} ✦`}</b></div>`).join('');
    const count = dailies.filter((item) => saved.completed[item.id]).length;
    document.querySelector('#restDailyProgress').textContent = `${count} / ${dailies.length}`;
  }

  function complete(id, message) {
    const item = dailies.find((daily) => daily.id === id);
    if (item && !saved.completed[id]) {
      saved.completed[id] = true;
      saved.coins += item.reward;
      toast(`Задание выполнено · +${item.reward} наград`);
    }
    if (message) {
      saved.journal = message;
      document.querySelector('#restJournal').textContent = message;
    }
    renderDailies(); updateNeeds(); save();
  }

  function handleSceneEvent(type, message) {
    document.querySelector('#restPetState').textContent = message || 'Исследует комнату';
    if (type === 'feed') { life.hunger = clamp(life.hunger + 22); life.mood = clamp(life.mood + 4); complete('feed', `${pet.name || 'Питомец'} с удовольствием поел и вернулся исследовать дом.`); }
    if (type === 'play') { life.mood = clamp(life.mood + 15); life.energy = clamp(life.energy - 5); complete('play', `Мяч пойман. Кажется, ${pet.name || 'питомец'} готов повторить это ещё раз.`); }
    if (type === 'explore') complete('explore', 'Вы вместе остановились у окна и немного посмотрели на город.');
    if (type === 'paw') { life.mood = clamp(life.mood + 7); saved.coins += 2; saved.journal = `${pet.name || 'Питомец'} дал лапу. Маленькая победа дня.`; updateNeeds(); save(); }
    if (type === 'sleep') { life.energy = clamp(life.energy + 18); updateNeeds(); save(); }
  }

  function renderShop() {
    document.querySelector('#restShop').innerHTML = SHOP.map((item) => {
      const owned = saved.inventory.includes(item.id);
      return `<article class="rest-shop-item"><div class="rest-shop-preview">${item.icon}</div><div class="rest-shop-copy"><strong>${item.name}</strong><small>${item.copy}</small><button type="button" data-rest-buy="${item.id}"${owned ? ' disabled' : ''}>${owned ? 'В доме' : `${item.price} ✦`}</button></div></article>`;
    }).join('');
    document.querySelectorAll('[data-rest-buy]').forEach((button) => button.addEventListener('click', () => {
      const item = SHOP.find((entry) => entry.id === button.dataset.restBuy);
      if (!item || saved.inventory.includes(item.id)) return;
      if (saved.coins < item.price) { toast('Пока не хватает наград — выполните задания'); return; }
      saved.coins -= item.price;
      saved.inventory.push(item.id);
      scene?.applyInventory(saved.inventory);
      scene?.setTheme(saved.theme);
      save(); updateNeeds(); renderShop();
      toast(`${item.name} появился в комнате`);
    }));
  }

  function activate() {
    if (!scene) {
      scene = new LivingScene(container, pet, handleSceneEvent);
      scene.applyInventory(saved.inventory);
      scene.setTheme(saved.theme);
      window.setTimeout(() => document.querySelector('#restLoading').classList.add('is-hidden'), 850);
    }
    scene.setActive(true);
  }

  document.querySelector('#restPetName').textContent = pet.name || (pet.species === 'cat' ? 'Котик' : 'Собачка');
  document.querySelector('#restPetMood').textContent = life.mood > 82 ? 'В ОТЛИЧНОМ НАСТРОЕНИИ' : 'РАД ВАС ВИДЕТЬ';
  document.querySelector('#restJournal').textContent = saved.journal;
  updateNeeds(); renderDailies(); renderShop();

  document.querySelectorAll('[data-rest-action]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-rest-action]').forEach((item) => item.classList.remove('is-active'));
    button.classList.add('is-active');
    window.setTimeout(() => button.classList.remove('is-active'), 650);
    scene?.action(button.dataset.restAction);
    document.querySelector('#restSceneHint').classList.add('is-hidden');
  }));
  document.querySelectorAll('[data-rest-tab]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-rest-tab]').forEach((item) => item.classList.toggle('is-active', item === button));
    document.querySelectorAll('[data-rest-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.restPanel === button.dataset.restTab));
  }));
  document.querySelectorAll('[data-rest-theme]').forEach((button) => button.addEventListener('click', () => {
    saved.theme = button.dataset.restTheme;
    document.querySelectorAll('[data-rest-theme]').forEach((item) => item.classList.toggle('is-active', item === button));
    scene?.setTheme(saved.theme);
    scene?.applyInventory(saved.inventory);
    save();
  }));
  document.addEventListener('myworkspace:view-change', (event) => {
    if (event.detail.name === 'rest') activate();
    else scene?.setActive(false);
  });
  if (root.classList.contains('is-active')) activate();
}
