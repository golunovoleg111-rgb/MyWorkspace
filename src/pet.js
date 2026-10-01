const PET_KEY = 'myworkspace.pet.v1';

const BREEDS = {
  dog: [
    ['spitz', 'Померанский шпиц'],
    ['corgi', 'Вельш-корги'],
    ['shiba', 'Сиба-ину'],
    ['labrador', 'Лабрадор']
  ],
  cat: [
    ['british', 'Британский кот'],
    ['maine', 'Мейн-кун'],
    ['siamese', 'Сиамский кот'],
    ['domestic', 'Домашний кот']
  ]
};

const PERSONALITY_LABELS = {
  helper: 'Заботливый помощник', curious: 'Любопытный исследователь',
  calm: 'Спокойный наблюдатель', playful: 'Игривый непоседа'
};
const MARKINGS = new Set(['muzzle', 'blaze', 'mask', 'socks', 'solid']);

const DEFAULT_PET = {
  enabled: true, species: 'dog', breed: 'spitz', name: '',
  coat: '#d49a60', accent: '#fff1d4', eyes: '#3d2b1f',
  marking: 'muzzle', personality: 'helper'
};

const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
const safeName = (value = '') => String(value).trim().replace(/\s+/g, ' ').slice(0, 20);
const loadPet = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(PET_KEY));
    if (!saved || !BREEDS[saved.species]?.some(([value]) => value === saved.breed)) return null;
    return {
      ...DEFAULT_PET, ...saved, name: safeName(saved.name),
      coat: safeColor(saved.coat, DEFAULT_PET.coat), accent: safeColor(saved.accent, DEFAULT_PET.accent),
      eyes: safeColor(saved.eyes, DEFAULT_PET.eyes),
      marking: MARKINGS.has(saved.marking) ? saved.marking : DEFAULT_PET.marking,
      personality: saved.personality in PERSONALITY_LABELS ? saved.personality : DEFAULT_PET.personality
    };
  } catch { return null; }
};

function dogEars(breed, coat, accent) {
  if (breed === 'labrador') return `<path d="M48 43c-20 4-25 23-14 39 7 8 16 2 18-11l4-24z" fill="${coat}"/><path d="M112 43c20 4 25 23 14 39-7 8-16 2-18-11l-4-24z" fill="${coat}"/>`;
  const large = breed === 'corgi';
  const left = large ? 'M48 52 30 8 67 35Z' : 'M50 48 39 15 67 37Z';
  const right = large ? 'M112 52 130 8 93 35Z' : 'M110 48 121 15 93 37Z';
  return `<path d="${left}" fill="${coat}"/><path d="${right}" fill="${coat}"/><path d="M49 39 41 21 60 36Z" fill="${accent}" opacity=".72"/><path d="M111 39 119 21 100 36Z" fill="${accent}" opacity=".72"/>`;
}

function catEars(breed, coat, accent) {
  if (breed === 'british') return `<path d="M49 48c-13-13-13-26 1-29 9 0 16 13 17 25z" fill="${coat}"/><path d="M111 48c13-13 13-26-1-29-9 0-16 13-17 25z" fill="${coat}"/>`;
  const tall = breed === 'maine';
  const tip = tall ? 5 : 15;
  return `<path d="M51 49 35 ${tip} 70 38Z" fill="${coat}"/><path d="M109 49 125 ${tip} 90 38Z" fill="${coat}"/><path d="M50 38 41 ${tip + 13} 62 36Z" fill="${accent}" opacity=".68"/><path d="M110 38 119 ${tip + 13} 98 36Z" fill="${accent}" opacity=".68"/>${tall ? '<path d="m35 6-5-6m8 7 2-7m84 6 5-6m-8 7-2-7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' : ''}`;
}

function faceMarking(marking, accent, species) {
  if (marking === 'solid' || marking === 'socks') return '';
  if (marking === 'blaze') return `<path d="M72 42c4-6 12-6 16 0l-4 31h-8z" fill="${accent}" opacity=".9"/>`;
  if (marking === 'mask') return `<ellipse cx="61" cy="65" rx="16" ry="12" fill="${accent}" opacity=".74"/><ellipse cx="99" cy="65" rx="16" ry="12" fill="${accent}" opacity=".74"/>`;
  return species === 'dog'
    ? `<ellipse cx="80" cy="82" rx="29" ry="24" fill="${accent}"/>`
    : `<path d="M50 74c10 0 17 5 30 19 13-14 20-19 30-19-2 25-13 35-30 35S52 99 50 74Z" fill="${accent}"/>`;
}

function petSvg(config, mode = 'preview') {
  const species = config.species === 'cat' ? 'cat' : 'dog';
  const breeds = BREEDS[species];
  const breed = breeds.some(([value]) => value === config.breed) ? config.breed : breeds[0][0];
  const coat = safeColor(config.coat, DEFAULT_PET.coat);
  const accent = safeColor(config.accent, DEFAULT_PET.accent);
  const eyes = safeColor(config.eyes, DEFAULT_PET.eyes);
  const pawFill = config.marking === 'socks' ? accent : coat;
  const spitzMane = species === 'dog' && breed === 'spitz' ? `<circle cx="80" cy="61" r="48" fill="${accent}" opacity=".92"/>` : '';
  const siameseMask = species === 'cat' && breed === 'siamese' ? `<ellipse cx="80" cy="67" rx="34" ry="30" fill="${accent}" opacity=".92"/>` : '';
  const tail = species === 'dog'
    ? `<path class="pet-tail" d="M119 105c35 0 36-31 16-36-12-3-16 10-8 17" fill="none" stroke="${coat}" stroke-width="16" stroke-linecap="round"/>`
    : `<path class="pet-tail" d="M121 111c37 6 39-37 14-43-11-3-16 8-8 16" fill="none" stroke="${coat}" stroke-width="14" stroke-linecap="round"/>`;
  const ears = species === 'dog' ? dogEars(breed, coat, accent) : catEars(breed, coat, accent);
  const muzzle = faceMarking(config.marking, accent, species);
  const bodyRx = species === 'dog' && breed === 'corgi' ? 45 : 38;
  const bodyRy = species === 'dog' && breed === 'corgi' ? 28 : 38;
  const headRy = species === 'cat' ? 38 : 40;
  return `<svg class="pet-svg pet-svg-${species} pet-breed-${breed} pet-mode-${mode}" viewBox="0 0 160 160" role="img" aria-label="${species === 'dog' ? 'Собачка' : 'Котик'}">
    ${tail}<ellipse cx="80" cy="116" rx="${bodyRx}" ry="${bodyRy}" fill="${coat}"/>${spitzMane}
    <ellipse cx="58" cy="139" rx="17" ry="10" fill="${pawFill}"/><ellipse cx="102" cy="139" rx="17" ry="10" fill="${pawFill}"/>
    ${ears}<ellipse cx="80" cy="66" rx="43" ry="${headRy}" fill="${coat}"/>${siameseMask}${muzzle}
    <g class="pet-eyes"><ellipse cx="61" cy="65" rx="10" ry="12" fill="#fff"/><ellipse cx="99" cy="65" rx="10" ry="12" fill="#fff"/><g class="pet-pupils"><circle cx="62" cy="67" r="6" fill="${eyes}"/><circle cx="100" cy="67" r="6" fill="${eyes}"/><circle cx="64" cy="64" r="2" fill="#fff"/><circle cx="102" cy="64" r="2" fill="#fff"/></g></g>
    <path d="M74 82q6-5 12 0-1 8-6 8t-6-8" fill="#263246"/><path d="M80 90c-3 7-10 8-14 3m14-3c3 7 10 8 14 3" fill="none" stroke="#263246" stroke-width="2.5" stroke-linecap="round"/>
    ${species === 'cat' ? '<path d="M51 87 25 83m27 10-26 5m83-11 26-4m-27 10 26 5" stroke="#536176" stroke-width="2" stroke-linecap="round" opacity=".72"/>' : ''}
    <path d="M49 104q31 13 62 0" fill="none" stroke="#1d2b42" stroke-width="5" stroke-linecap="round"/><circle cx="80" cy="111" r="6" fill="#3b82f6"/><circle cx="80" cy="111" r="2" fill="#dbeafe"/>
  </svg>`;
}

function breedLabel(config) {
  return BREEDS[config.species]?.find(([value]) => value === config.breed)?.[1] || '';
}

export function initPetCompanion({ toast }) {
  const root = document.querySelector('#petCompanion');
  const character = document.querySelector('#petCharacter');
  const runtimeArt = document.querySelector('#petRuntimeArt');
  const previewArt = document.querySelector('#petPreviewArt');
  const modal = document.querySelector('#petEditorModal');
  const profileModal = document.querySelector('#profileModal');
  if (!root || !character || !runtimeArt || !previewArt || !modal) return;

  let pet = loadPet();
  let currentView = document.querySelector('.view.is-active')?.id.replace('view-', '') || 'home';
  let petX = Math.max(window.innerWidth > 760 ? 280 : 12, window.innerWidth * .64);
  let walkTimer;
  let walkEndTimer;
  let messageTimer;
  let lookFrame;
  let returnToProfile = false;
  let lastAnalyticsSection = 'section-base';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const speciesInputs = [...document.querySelectorAll('[name="petSpecies"]')];
  const fields = {
    name: document.querySelector('#petName'), breed: document.querySelector('#petBreed'),
    coat: document.querySelector('#petCoat'), accent: document.querySelector('#petAccent'),
    eyes: document.querySelector('#petEyes'), marking: document.querySelector('#petMarking'),
    personality: document.querySelector('#petPersonality'), enabled: document.querySelector('#petEnabled')
  };

  function formSpecies() { return speciesInputs.find((input) => input.checked)?.value || 'dog'; }
  function formConfig() {
    return {
      enabled: fields.enabled.checked, species: formSpecies(), breed: fields.breed.value,
      name: safeName(fields.name.value), coat: safeColor(fields.coat.value, DEFAULT_PET.coat),
      accent: safeColor(fields.accent.value, DEFAULT_PET.accent), eyes: safeColor(fields.eyes.value, DEFAULT_PET.eyes),
      marking: fields.marking.value, personality: fields.personality.value
    };
  }

  function renderBreedOptions(species, selected) {
    fields.breed.innerHTML = BREEDS[species].map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('');
  }

  function renderPreview() {
    const config = formConfig();
    previewArt.innerHTML = petSvg(config, 'preview');
    document.querySelector('#petPreviewName').textContent = config.name || 'Ваш питомец';
    document.querySelector('#petPreviewBreed').textContent = breedLabel(config);
    document.querySelector('#petPreviewStatus').textContent = (PERSONALITY_LABELS[config.personality] || PERSONALITY_LABELS.helper).toUpperCase();
  }

  function updateProfilePetAction() {
    document.querySelector('#profilePetAction').textContent = pet ? `Настроить питомца · ${pet.name || 'без имени'}` : 'Создать своего питомца';
  }

  function applyPetPosition(target, duration = 700) {
    const min = window.innerWidth > 760 ? 272 : 8;
    const max = Math.max(min, window.innerWidth - (window.innerWidth > 760 ? 150 : 104));
    const next = Math.min(Math.max(target, min), max);
    character.style.setProperty('--pet-facing', next >= petX ? '1' : '-1');
    petX = next;
    root.style.setProperty('--pet-duration', reduceMotion ? '0ms' : `${duration}ms`);
    root.style.setProperty('--pet-x', `${petX}px`);
  }

  function scheduleWalk(delay) {
    window.clearTimeout(walkTimer);
    if (!pet?.enabled || currentView === 'analytics' || reduceMotion) return;
    const pauses = { calm: 9000, helper: 7000, curious: 5200, playful: 3900 };
    walkTimer = window.setTimeout(() => {
      const min = window.innerWidth > 760 ? 290 : 12;
      const max = Math.max(min, window.innerWidth - (window.innerWidth > 760 ? 170 : 110));
      const target = min + Math.random() * (max - min);
      const speed = pet.personality === 'playful' ? 115 : pet.personality === 'calm' ? 58 : 82;
      const duration = Math.max(900, Math.min(6200, Math.abs(target - petX) / speed * 1000));
      root.classList.add('is-walking');
      applyPetPosition(target, duration);
      window.clearTimeout(walkEndTimer);
      walkEndTimer = window.setTimeout(() => { root.classList.remove('is-walking'); scheduleWalk(); }, duration);
    }, delay ?? pauses[pet.personality] ?? pauses.helper);
  }

  function hideMessage() {
    window.clearTimeout(messageTimer);
    document.querySelector('#petMessage').classList.add('is-hidden');
  }

  function showMessage(text, duration = 6500) {
    if (!pet?.enabled) return;
    document.querySelector('#petMessageName').textContent = pet.name || (pet.species === 'cat' ? 'Котик' : 'Собачка');
    document.querySelector('#petMessageText').textContent = text;
    document.querySelector('#petMessage').classList.remove('is-hidden');
    window.clearTimeout(messageTimer);
    if (duration) messageTimer = window.setTimeout(hideMessage, duration);
  }

  function analyticsTip() {
    const missing = {
      'section-base': [
        ['#reportTitle', 'Начните с названия изделия — так досье сразу получит понятный заголовок.'],
        ['#projectGoal', 'Сформулируйте задачу проекта одним предложением: что создаём и для кого.']
      ],
      'section-market': [
        ['#competitorLegalName', 'Добавьте ИП или юридическое лицо конкурента — это сделает сравнение проверяемым.'],
        ['#competitorFulfillment', 'Укажите FBO или FBS: схема поставок помогает объяснить скорость продаж и остатки.'],
        ['#competitorTopSizes', 'Зафиксируйте самые востребованные размеры — они пригодятся для первого заказа.']
      ],
      'section-media': [['#imageUpload', 'Фотография полезнее всего вместе с короткой подписью: что именно на ней нужно заметить.']],
      'section-product': [['#fittingNotes', 'Запишите сначала посадку и комфорт, а затем конкретные доработки изделия.']],
      'section-launch': [['#launchColors', 'Для первого запуска лучше отдельно отметить основные цвета и тестовые цвета.']],
      'section-final': [['#reportConclusion', 'В итоговом решении ответьте на три вопроса: запускаем ли, почему и что делаем дальше.']]
    };
    const entries = missing[lastAnalyticsSection] || missing['section-base'];
    const next = entries.find(([selector]) => {
      const field = document.querySelector(selector);
      return field && 'value' in field && !field.value.trim();
    });
    return next?.[1] || 'Раздел заполнен хорошо. Проверьте, подтверждает ли каждый вывод фотография, цифра или наблюдение.';
  }

  function contextualTip() {
    if (currentView === 'analytics') return analyticsTip();
    const tips = {
      home: 'Я рядом. Нажмите на меня, если хотите небольшую подсказку по текущему разделу.',
      files: 'Давайте документам понятные названия — потом их будет гораздо легче найти.',
      store: 'Для корректного сравнения загружайте полные периоды одинаковой длины.',
      products: 'Связывайте карточку товара с последним анализом, чтобы видеть историю решений.',
      history: 'История полезнее, когда в каждом анализе зафиксировано принятое решение.',
      stock: 'Сначала смотрите на нулевые остатки, затем на дефицит размеров и только потом на избыток.',
      calendar: 'Добавляйте дату следующего действия сразу после принятия решения.',
      finance: 'Проверяйте не только прибыль, но и минимальную безопасную цену.',
      knowledge: 'Короткий чек-лист обычно полезнее длинной инструкции без структуры.',
      fbs: 'Таблица хранения отвечает за факт, а таблица перемещений — за план.'
    };
    return tips[currentView] || tips.home;
  }

  function setView(name) {
    currentView = name;
    root.classList.toggle('is-observing', name === 'analytics');
    window.clearTimeout(walkTimer);
    window.clearTimeout(walkEndTimer);
    root.classList.remove('is-walking');
    if (!pet?.enabled) return;
    if (name === 'analytics') {
      applyPetPosition(window.innerWidth - (window.innerWidth > 760 ? 170 : 108), 750);
      window.setTimeout(() => showMessage('Я посижу рядом и помогу не пропустить важные детали.', 5200), 850);
    } else {
      hideMessage();
      scheduleWalk(1300);
    }
  }

  function renderRuntime() {
    updateProfilePetAction();
    if (!pet?.enabled) {
      root.classList.add('is-hidden');
      window.clearTimeout(walkTimer);
      return;
    }
    root.classList.remove('is-hidden');
    runtimeArt.innerHTML = petSvg(pet, 'runtime');
    document.querySelector('#petNameTag').textContent = pet.name || (pet.species === 'cat' ? 'Котик' : 'Собачка');
    character.setAttribute('aria-label', `${pet.name || 'Питомец'}, ${breedLabel(pet)}. Нажмите для подсказки`);
    root.style.setProperty('--pet-x', `${petX}px`);
    setView(currentView);
  }

  function openEditor() {
    returnToProfile = !profileModal.classList.contains('is-hidden');
    profileModal.classList.add('is-hidden');
    const config = pet || DEFAULT_PET;
    speciesInputs.forEach((input) => { input.checked = input.value === config.species; });
    renderBreedOptions(config.species, config.breed);
    fields.name.value = config.name || '';
    fields.coat.value = safeColor(config.coat, DEFAULT_PET.coat);
    fields.accent.value = safeColor(config.accent, DEFAULT_PET.accent);
    fields.eyes.value = safeColor(config.eyes, DEFAULT_PET.eyes);
    fields.marking.value = config.marking;
    fields.personality.value = config.personality;
    fields.enabled.checked = config.enabled !== false;
    renderPreview();
    modal.classList.remove('is-hidden');
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => fields.name.focus(), 60);
  }

  function closeEditor() {
    modal.classList.add('is-hidden');
    if (returnToProfile) profileModal.classList.remove('is-hidden');
    else document.body.style.overflow = '';
    returnToProfile = false;
  }

  speciesInputs.forEach((input) => input.addEventListener('change', () => {
    const species = formSpecies();
    renderBreedOptions(species, BREEDS[species][0][0]);
    if (species === 'cat' && fields.name.value === 'Тедди') fields.name.value = '';
    renderPreview();
  }));
  Object.values(fields).forEach((field) => field.addEventListener('input', renderPreview));
  document.querySelector('#openPetEditor').addEventListener('click', openEditor);
  document.querySelector('#closePetEditor').addEventListener('click', closeEditor);
  document.querySelector('#cancelPetEditor').addEventListener('click', closeEditor);
  document.querySelector('#petEditorForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const config = formConfig();
    if (!config.name) { fields.name.focus(); return; }
    pet = config;
    try { localStorage.setItem(PET_KEY, JSON.stringify(pet)); }
    catch { toast('Не удалось сохранить питомца в этом браузере'); return; }
    renderRuntime();
    closeEditor();
    toast(`${pet.name} теперь живёт в MyWorkspace`);
  });
  document.querySelector('#closePetMessage').addEventListener('click', (event) => { event.stopPropagation(); hideMessage(); });
  character.addEventListener('click', () => {
    root.classList.remove('is-happy');
    void root.offsetWidth;
    root.classList.add('is-happy');
    window.setTimeout(() => root.classList.remove('is-happy'), 800);
    showMessage(contextualTip());
  });
  document.addEventListener('myworkspace:view-change', (event) => setView(event.detail.name));
  document.querySelectorAll('[data-jump]').forEach((button) => button.addEventListener('click', () => {
    lastAnalyticsSection = button.dataset.jump;
    if (pet?.enabled && currentView === 'analytics') window.setTimeout(() => showMessage(analyticsTip(), 6000), 850);
  }));
  document.querySelectorAll('.dossier-section').forEach((section) => section.addEventListener('focusin', () => { lastAnalyticsSection = section.id; }));
  document.addEventListener('pointermove', (event) => {
    if (!pet?.enabled || lookFrame) return;
    lookFrame = requestAnimationFrame(() => {
      lookFrame = null;
      const rect = character.getBoundingClientRect();
      const dx = Math.max(-3, Math.min(3, (event.clientX - (rect.left + rect.width / 2)) / 55));
      const dy = Math.max(-2, Math.min(2, (event.clientY - (rect.top + rect.height / 2)) / 55));
      character.style.setProperty('--pet-look-x', `${dx}px`);
      character.style.setProperty('--pet-look-y', `${dy}px`);
      character.style.setProperty('--pet-facing', event.clientX >= rect.left + rect.width / 2 ? '1' : '-1');
    });
  }, { passive: true });
  document.addEventListener('pointerdown', (event) => {
    if (!pet?.enabled || character.contains(event.target)) return;
    character.style.setProperty('--pet-facing', event.clientX >= character.getBoundingClientRect().left ? '1' : '-1');
    root.classList.add('is-curious');
    window.setTimeout(() => root.classList.remove('is-curious'), 520);
  }, { passive: true });
  window.addEventListener('resize', () => applyPetPosition(petX, 250));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.classList.contains('is-hidden')) closeEditor(); });

  updateProfilePetAction();
  renderRuntime();
}
