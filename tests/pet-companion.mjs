import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, pet, pet3d, css, rest, restCss] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/pet.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/pet-3d.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/rest-zone.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/rest-zone.css', import.meta.url), 'utf8')
]);

for (const id of ['petHub', 'petChatForm', 'petStatGrid', 'petRoom', 'petMemoryList']) {
  assert.match(html, new RegExp(`id="${id}"`), `missing ${id}`);
}

for (const breed of ['spitz', 'samoyed', 'dachshund', 'poodle', 'beagle', 'british', 'scottish', 'sphynx', 'ragdoll', 'bengal']) {
  assert.match(pet, new RegExp(`'${breed}'`), `missing ${breed}`);
  assert.match(pet3d, new RegExp(`${breed}:`), `missing 3D shape for ${breed}`);
}

for (const feature of ['LIFE_KEY', 'startBreathing', 'applyCare', 'petReply', 'renderMemories']) {
  assert.match(pet, new RegExp(feature), `missing ${feature}`);
}

assert.match(pet3d, /setDirection\(direction/);
assert.match(pet3d, /\[1, -1, -1, 1\]/);
assert.match(pet3d, /group\.position\.set\(x, \.02, \.52\)/);
assert.match(pet3d, /\? this\.direction \* 1\.18/);
assert.match(pet3d, /const turning = this\.mode === 'turn'/);
assert.match(pet, /setRuntimeMode\('turn'\)/);
assert.doesNotMatch(pet3d, /nodes\.eyes\.forEach\(\(eye\) => \{ eye\.position\.y -=/);
assert.match(css, /\.pet-room\.is-plant-hidden/);
assert.match(css, /\.pet-runtime-art[^\n]*transform: none/);
for (const id of ['view-rest', 'restCanvas', 'restDailies', 'restShop', 'restGameHud', 'restDialog', 'restXpBar']) assert.match(html, new RegExp(`id="${id}"`));
for (const feature of ['ShaderMaterial', 'UnrealBloomPass', 'Raycaster', 'updateMovement', 'throwBall', 'startGame', 'spawnFirefly', 'makeSparkBurst', 'petReply', 'addXp']) assert.match(rest, new RegExp(feature));
assert.match(restCss, /\.rest-stage/);
assert.match(restCss, /\.rest-game-hud/);
assert.match(restCss, /\.rest-dialog/);

console.log('Pet companion checks passed: 16 breeds, turn-before-walk, shaders, 3D living space, training game, dialog and progression.');
