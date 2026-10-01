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
const EYE_STYLES = new Set(['bright', 'round', 'almond']);
const ACCESSORIES = new Set(['blue', 'rose', 'mint', 'navy', 'none']);

const DEFAULT_PET = {
  enabled: true, species: 'dog', breed: 'spitz', name: '',
  coat: '#d49a60', accent: '#fff1d4', eyes: '#3d2b1f',
  marking: 'muzzle', eyeStyle: 'bright', accessory: 'blue', personality: 'helper'
};

const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
const safeName = (value = '') => String(value).trim().replace(/\s+/g, ' ').slice(0, 20);

function normalizePet(saved) {
  if (!saved || !BREEDS[saved.species]?.some(([value]) => value === saved.breed)) return null;
  return {
    ...DEFAULT_PET,
    ...saved,
    name: safeName(saved.name),
    coat: safeColor(saved.coat, DEFAULT_PET.coat),
    accent: safeColor(saved.accent, DEFAULT_PET.accent),
    eyes: safeColor(saved.eyes, DEFAULT_PET.eyes),
    marking: MARKINGS.has(saved.marking) ? saved.marking : DEFAULT_PET.marking,
    eyeStyle: EYE_STYLES.has(saved.eyeStyle) ? saved.eyeStyle : DEFAULT_PET.eyeStyle,
    accessory: ACCESSORIES.has(saved.accessory) ? saved.accessory : DEFAULT_PET.accessory,
    personality: saved.personality in PERSONALITY_LABELS ? saved.personality : DEFAULT_PET.personality
  };
}

function loadPet() {
  try { return normalizePet(JSON.parse(localStorage.getItem(PET_KEY))); }
  catch { return null; }
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
  if (!root || !character || !runtimeArt || !previewArt || !modal || !profileModal) return;

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
  const emptyView = { setConfig() {}, setMode() {}, setLook() {}, react() {}, setActive() {}, resize() {} };
  let runtime3D = emptyView;
  let preview3D = emptyView;
  let threeReady;

  const speciesInputs = [...document.querySelectorAll('[name="petSpecies"]')];
  const fields = {
    name: document.querySelector('#petName'), breed: document.querySelector('#petBreed'),
    coat: document.querySelector('#petCoat'), accent: document.querySelector('#petAccent'),
    eyes: document.querySelector('#petEyes'), marking: document.querySelector('#petMarking'),
    eyeStyle: document.querySelector('#petEyeStyle'), accessory: document.querySelector('#petAccessory'),
    personality: document.querySelector('#petPersonality'), enabled: document.querySelector('#petEnabled')
  };

  function ensure3D() {
    if (threeReady) return threeReady;
    runtimeArt.innerHTML = '<span class="pet-3d-loading" aria-hidden="true"></span>';
    previewArt.innerHTML = '<span class="pet-3d-loading" aria-hidden="true"></span>';
    threeReady = import('./pet-3d.js').then(({ createPet3DView }) => {
      runtime3D = createPet3DView(runtimeArt, { preview: false });
      preview3D = createPet3DView(previewArt, { preview: true });
      if (pet?.enabled) {
        runtime3D.setConfig(pet);
        runtime3D.setMode(currentView === 'analytics' ? 'observe' : 'idle');
        runtime3D.setActive(!reduceMotion);
      }
      if (!modal.classList.contains('is-hidden')) {
        preview3D.setConfig(formConfig());
        preview3D.setMode('studio');
        preview3D.setActive(!reduceMotion);
        preview3D.resize();
      }
    }).catch((error) => {
      console.warn('Не удалось загрузить 3D-питомца', error);
      runtimeArt.innerHTML = '<span class="pet-3d-fallback" aria-hidden="true">🐾</span>';
      previewArt.innerHTML = '<span class="pet-3d-fallback" aria-hidden="true">🐾</span>';
    });
    return threeReady;
  }

  function formSpecies() {
    return speciesInputs.find((input) => input.checked)?.value || 'dog';
  }

  function formConfig() {
    return normalizePet({
      enabled: fields.enabled.checked,
      species: formSpecies(),
      breed: fields.breed.value,
      name: safeName(fields.name.value),
      coat: safeColor(fields.coat.value, DEFAULT_PET.coat),
      accent: safeColor(fields.accent.value, DEFAULT_PET.accent),
      eyes: safeColor(fields.eyes.value, DEFAULT_PET.eyes),
      marking: fields.marking.value,
      eyeStyle: fields.eyeStyle.value,
      accessory: fields.accessory.value,
      personality: fields.personality.value
    }) || { ...DEFAULT_PET, species: formSpecies(), breed: BREEDS[formSpecies()][0][0] };
  }

  function renderBreedOptions(species, selected) {
    fields.breed.innerHTML = BREEDS[species]
      .map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`)
      .join('');
  }

  function renderPreview() {
    const config = formConfig();
    preview3D.setConfig(config);
    preview3D.setMode('studio');
    document.querySelector('#petPreviewName').textContent = config.name || 'Ваш питомец';
    document.querySelector('#petPreviewBreed').textContent = breedLabel(config);
    document.querySelector('#petPreviewStatus').textContent = (PERSONALITY_LABELS[config.personality] || PERSONALITY_LABELS.helper).toUpperCase();
  }

  function updateProfilePetAction() {
    document.querySelector('#profilePetAction').textContent = pet
      ? `Настроить питомца · ${pet.name || 'без имени'}`
      : 'Создать своего 3D-питомца';
  }

  function applyPetPosition(target, duration = 700) {
    const min = window.innerWidth > 760 ? 272 : 8;
    const max = Math.max(min, window.innerWidth - (window.innerWidth > 760 ? 156 : 104));
    const next = Math.min(Math.max(target, min), max);
    character.style.setProperty('--pet-facing', next >= petX ? '1' : '-1');
    petX = next;
    root.style.setProperty('--pet-duration', reduceMotion ? '0ms' : `${duration}ms`);
    root.style.setProperty('--pet-x', `${petX}px`);
  }

  function setRuntimeMode(mode) {
    runtime3D.setMode(mode);
    root.classList.toggle('is-walking', mode === 'walk');
    root.classList.toggle('is-observing', mode === 'observe');
  }

  function scheduleWalk(delay) {
    window.clearTimeout(walkTimer);
    if (!pet?.enabled || currentView === 'analytics' || reduceMotion) return;
    const pauses = { calm: 9000, helper: 7000, curious: 5200, playful: 3900 };
    walkTimer = window.setTimeout(() => {
      const min = window.innerWidth > 760 ? 290 : 12;
      const max = Math.max(min, window.innerWidth - (window.innerWidth > 760 ? 174 : 110));
      const target = min + Math.random() * (max - min);
      const speed = pet.personality === 'playful' ? 115 : pet.personality === 'calm' ? 58 : 82;
      const duration = Math.max(900, Math.min(6200, Math.abs(target - petX) / speed * 1000));
      setRuntimeMode('walk');
      applyPetPosition(target, duration);
      window.clearTimeout(walkEndTimer);
      walkEndTimer = window.setTimeout(() => {
        setRuntimeMode('idle');
        scheduleWalk();
      }, duration);
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
    window.clearTimeout(walkTimer);
    window.clearTimeout(walkEndTimer);
    if (!pet?.enabled) return;
    if (name === 'analytics') {
      setRuntimeMode('observe');
      applyPetPosition(window.innerWidth - (window.innerWidth > 760 ? 174 : 108), 750);
      window.setTimeout(() => showMessage('Я посижу рядом и помогу не пропустить важные детали.', 5200), 850);
    } else {
      setRuntimeMode('idle');
      hideMessage();
      scheduleWalk(1300);
    }
  }

  function renderRuntime() {
    updateProfilePetAction();
    if (!pet?.enabled) {
      root.classList.add('is-hidden');
      runtime3D.setActive(false);
      window.clearTimeout(walkTimer);
      return;
    }
    root.classList.remove('is-hidden');
    ensure3D();
    runtime3D.setConfig(pet);
    runtime3D.setActive(!reduceMotion);
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
    fields.eyeStyle.value = config.eyeStyle || DEFAULT_PET.eyeStyle;
    fields.accessory.value = config.accessory || DEFAULT_PET.accessory;
    fields.personality.value = config.personality;
    fields.enabled.checked = config.enabled !== false;
    modal.classList.remove('is-hidden');
    document.body.style.overflow = 'hidden';
    ensure3D().then(() => {
      preview3D.setActive(!reduceMotion);
      window.requestAnimationFrame(() => {
        preview3D.resize();
        renderPreview();
      });
    });
    window.setTimeout(() => fields.name.focus(), 60);
  }

  function closeEditor() {
    modal.classList.add('is-hidden');
    preview3D.setActive(false);
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
    toast(`${pet.name} теперь живёт в MyWorkspace в 3D`);
  });
  document.querySelector('#closePetMessage').addEventListener('click', (event) => {
    event.stopPropagation();
    hideMessage();
  });
  character.addEventListener('click', () => {
    root.classList.remove('is-happy');
    void root.offsetWidth;
    root.classList.add('is-happy');
    runtime3D.react('happy', 820);
    window.setTimeout(() => root.classList.remove('is-happy'), 820);
    showMessage(contextualTip());
  });
  document.addEventListener('myworkspace:view-change', (event) => setView(event.detail.name));
  document.querySelectorAll('[data-jump]').forEach((button) => button.addEventListener('click', () => {
    lastAnalyticsSection = button.dataset.jump;
    if (pet?.enabled && currentView === 'analytics') window.setTimeout(() => showMessage(analyticsTip(), 6000), 850);
  }));
  document.querySelectorAll('.dossier-section').forEach((section) => section.addEventListener('focusin', () => {
    lastAnalyticsSection = section.id;
  }));
  document.addEventListener('pointermove', (event) => {
    if (!pet?.enabled || lookFrame) return;
    lookFrame = requestAnimationFrame(() => {
      lookFrame = null;
      const rect = character.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (event.clientX - (rect.left + rect.width / 2)) / 180));
      const dy = Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height / 2)) / 140));
      runtime3D.setLook(dx, dy);
      character.style.setProperty('--pet-facing', event.clientX >= rect.left + rect.width / 2 ? '1' : '-1');
    });
  }, { passive: true });
  document.addEventListener('pointerdown', (event) => {
    if (!pet?.enabled || character.contains(event.target)) return;
    character.style.setProperty('--pet-facing', event.clientX >= character.getBoundingClientRect().left ? '1' : '-1');
    root.classList.add('is-curious');
    runtime3D.react('curious', 560);
    window.setTimeout(() => root.classList.remove('is-curious'), 560);
  }, { passive: true });
  window.addEventListener('resize', () => applyPetPosition(petX, 250));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('is-hidden')) closeEditor();
  });

  updateProfilePetAction();
  renderRuntime();
}
