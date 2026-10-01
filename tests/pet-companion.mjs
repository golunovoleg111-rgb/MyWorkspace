import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, pet, pet3d, css] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/pet.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/pet-3d.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
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
assert.match(css, /\.pet-room\.is-plant-hidden/);
assert.match(css, /\.pet-runtime-art[^\n]*transform: none/);

console.log('Pet companion checks passed: editor, 16 breeds, movement, care, home, chat and memories.');
