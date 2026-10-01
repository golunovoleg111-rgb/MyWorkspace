const PET_KEY = 'myworkspace.pet.v1';
const LIFE_KEY = 'myworkspace.pet.life.v1';

const BREEDS = {
  dog: [
    ['spitz', 'Померанский шпиц'], ['corgi', 'Вельш-корги'],
    ['shiba', 'Сиба-ину'], ['labrador', 'Лабрадор'],
    ['samoyed', 'Самоед'], ['dachshund', 'Такса'],
    ['poodle', 'Пудель'], ['beagle', 'Бигль']
  ],
  cat: [
    ['british', 'Британский кот'], ['maine', 'Мейн-кун'],
    ['siamese', 'Сиамский кот'], ['domestic', 'Домашний кот'],
    ['scottish', 'Шотландская вислоухая'], ['sphynx', 'Сфинкс'],
    ['ragdoll', 'Рэгдолл'], ['bengal', 'Бенгальский кот']
  ]
};

const PERSONALITY_LABELS = {
  helper: 'Заботливый помощник', curious: 'Любопытный исследователь',
  calm: 'Спокойный наблюдатель', playful: 'Игривый непоседа'
};
const MARKINGS = new Set(['muzzle', 'blaze', 'mask', 'socks', 'solid', 'tabby', 'patches']);
const EYE_STYLES = new Set(['bright', 'round', 'almond']);
const ACCESSORIES = new Set(['blue', 'rose', 'mint', 'navy', 'none']);

const DEFAULT_PET = {
  enabled: true, species: 'dog', breed: 'spitz', name: '',
  coat: '#d49a60', accent: '#fff1d4', eyes: '#3d2b1f',
  marking: 'muzzle', eyeStyle: 'bright', accessory: 'blue', personality: 'helper'
};

const DEFAULT_LIFE = {
  mood: 82, energy: 76, hunger: 72, xp: 0, interactions: 0,
  lastSeen: Date.now(), theme: 'morning',
  furniture: { bed: true, bowl: true, toy: true, plant: false, shelf: false },
  messages: [], memories: []
};

const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
const safeName = (value = '') => String(value).trim().replace(/\s+/g, ' ').slice(0, 20);
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));

function normalizePet(saved) {
  if (!saved || !BREEDS[saved.species]?.some(([value]) => value === saved.breed)) return null;
  return {
    ...DEFAULT_PET, ...saved,
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

function loadLife() {
  try {
    const saved = JSON.parse(localStorage.getItem(LIFE_KEY)) || {};
    const awayHours = Math.max(0, (Date.now() - (Number(saved.lastSeen) || Date.now())) / 3600000);
    return {
      ...DEFAULT_LIFE, ...saved,
      mood: clamp(saved.mood ?? DEFAULT_LIFE.mood),
      energy: clamp((saved.energy ?? DEFAULT_LIFE.energy) + Math.min(18, awayHours * 2)),
      hunger: clamp((saved.hunger ?? DEFAULT_LIFE.hunger) - Math.min(16, awayHours * 1.2), 35, 100),
      xp: Math.max(0, Number(saved.xp) || 0),
      interactions: Math.max(0, Number(saved.interactions) || 0),
      lastSeen: Date.now(),
      theme: ['morning', 'evening', 'forest'].includes(saved.theme) ? saved.theme : 'morning',
      furniture: { ...DEFAULT_LIFE.furniture, ...(saved.furniture || {}) },
      messages: Array.isArray(saved.messages) ? saved.messages.slice(-30) : [],
      memories: Array.isArray(saved.memories) ? saved.memories.slice(-40) : []
    };
  } catch { return { ...DEFAULT_LIFE, furniture: { ...DEFAULT_LIFE.furniture } }; }
}

function breedLabel(config) {
  return BREEDS[config.species]?.find(([value]) => value === config.breed)?.[1] || '';
}

function plural(value, one, few, many) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function initPetCompanion({ toast }) {
  const root = document.querySelector('#petCompanion');
  const character = document.querySelector('#petCharacter');
  const runtimeArt = document.querySelector('#petRuntimeArt');
  const previewArt = document.querySelector('#petPreviewArt');
  const modal = document.querySelector('#petEditorModal');
  const profileModal = document.querySelector('#profileModal');
  const hub = document.querySelector('#petHub');
  const hubArt = document.querySelector('#petHubArt');
  const roomArt = document.querySelector('#petRoomArt');
  if (!root || !character || !runtimeArt || !previewArt || !modal || !profileModal || !hub) return;

  let pet = loadPet();
  let life = loadLife();
  let currentView = document.querySelector('.view.is-active')?.id.replace('view-', '') || 'home';
  let activeHubTab = 'talk';
  let petX = Math.max(window.innerWidth > 760 ? 280 : 12, window.innerWidth * .64);
  let walkTimer;
  let walkEndTimer;
  let messageTimer;
  let lookFrame;
  let breatheTimer;
  let breatheRemaining = 0;
  let returnToProfile = false;
  let lastAnalyticsSection = 'section-base';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const emptyView = { setConfig() {}, setMode() {}, setDirection() {}, setLook() {}, react() {}, setActive() {}, resize() {} };
  let runtime3D = emptyView;
  let preview3D = emptyView;
  let hub3D = emptyView;
  let room3D = emptyView;
  let threeReady;

  const speciesInputs = [...document.querySelectorAll('[name="petSpecies"]')];
  const fields = {
    name: document.querySelector('#petName'), breed: document.querySelector('#petBreed'),
    coat: document.querySelector('#petCoat'), accent: document.querySelector('#petAccent'),
    eyes: document.querySelector('#petEyes'), marking: document.querySelector('#petMarking'),
    eyeStyle: document.querySelector('#petEyeStyle'), accessory: document.querySelector('#petAccessory'),
    personality: document.querySelector('#petPersonality'), enabled: document.querySelector('#petEnabled')
  };

  function saveLife() {
    life.lastSeen = Date.now();
    try { localStorage.setItem(LIFE_KEY, JSON.stringify(life)); }
    catch { /* The pet remains usable for the current session. */ }
  }

  function friendshipLevel() {
    return Math.min(8, 1 + Math.floor(life.xp / 32));
  }

  function petDisplayName() {
    return pet?.name || (pet?.species === 'cat' ? 'Котик' : 'Собачка');
  }

  function ensure3D() {
    if (threeReady) return threeReady;
    [runtimeArt, previewArt, hubArt, roomArt].forEach((node) => {
      if (node) node.innerHTML = '<span class="pet-3d-loading" aria-hidden="true"></span>';
    });
    threeReady = import('./pet-3d.js').then(({ createPet3DView }) => {
      runtime3D = createPet3DView(runtimeArt, { preview: false });
      preview3D = createPet3DView(previewArt, { preview: true });
      hub3D = createPet3DView(hubArt, { preview: true });
      room3D = createPet3DView(roomArt, { preview: true });
      if (pet?.enabled) {
        [runtime3D, hub3D, room3D].forEach((view) => view.setConfig(pet));
        runtime3D.setMode(currentView === 'analytics' ? 'observe' : 'idle');
        runtime3D.setActive(hub.classList.contains('is-hidden') && !reduceMotion);
        hub3D.setMode('studio');
        room3D.setMode('house');
        syncHubModels();
      }
      if (!modal.classList.contains('is-hidden')) {
        preview3D.setConfig(formConfig());
        preview3D.setMode('studio');
        preview3D.setActive(!reduceMotion);
        preview3D.resize();
      }
    }).catch((error) => {
      console.warn('Не удалось загрузить 3D-питомца', error);
      [runtimeArt, previewArt, hubArt, roomArt].forEach((node) => {
        if (node) node.innerHTML = '<span class="pet-3d-fallback" aria-hidden="true">🐾</span>';
      });
    });
    return threeReady;
  }

  function syncHubModels() {
    const isOpen = !hub.classList.contains('is-hidden');
    hub3D.setActive(isOpen && activeHubTab === 'talk' && !reduceMotion);
    room3D.setActive(isOpen && activeHubTab === 'home' && !reduceMotion);
    if (isOpen && activeHubTab === 'talk') hub3D.resize();
    if (isOpen && activeHubTab === 'home') room3D.resize();
  }

  function formSpecies() {
    return speciesInputs.find((input) => input.checked)?.value || 'dog';
  }

  function formConfig() {
    return normalizePet({
      enabled: fields.enabled.checked, species: formSpecies(), breed: fields.breed.value,
      name: safeName(fields.name.value), coat: safeColor(fields.coat.value, DEFAULT_PET.coat),
      accent: safeColor(fields.accent.value, DEFAULT_PET.accent),
      eyes: safeColor(fields.eyes.value, DEFAULT_PET.eyes), marking: fields.marking.value,
      eyeStyle: fields.eyeStyle.value, accessory: fields.accessory.value,
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
    if (Math.abs(next - petX) > 2) runtime3D.setDirection(next >= petX ? 1 : -1);
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
    if (!pet?.enabled || currentView === 'analytics' || reduceMotion || !hub.classList.contains('is-hidden')) return;
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
    if (!pet?.enabled || !hub.classList.contains('is-hidden')) return;
    document.querySelector('#petMessageName').textContent = petDisplayName();
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
      home: 'Я рядом. Если задач много, выберите одну маленькую и начните только с неё.',
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

  function addChat(role, text) {
    life.messages.push({ role, text: String(text).slice(0, 500), at: Date.now() });
    life.messages = life.messages.slice(-30);
    saveLife();
    renderChat();
  }

  function renderChat() {
    const log = document.querySelector('#petChatLog');
    log.replaceChildren();
    life.messages.forEach((message) => {
      const item = document.createElement('div');
      item.className = `pet-chat-message ${message.role === 'user' ? 'is-user' : 'is-pet'}`;
      const author = document.createElement('small');
      author.textContent = message.role === 'user' ? 'Вы' : petDisplayName();
      const body = document.createElement('span');
      body.textContent = message.text;
      item.append(author, body);
      log.append(item);
    });
    log.scrollTop = log.scrollHeight;
  }

  function moodText() {
    if (life.energy < 34) return 'Немного устал, но рад быть рядом';
    if (life.hunger < 42) return 'Не отказался бы от угощения';
    if (life.mood > 84) return 'В отличном настроении';
    if (life.mood > 60) return 'Рад вас видеть';
    return 'Хочется немного внимания';
  }

  const stories = [
    'Однажды маленький корги решил помочь хозяину с отчётом. Он разложил все листы по цветам, гордо сел сверху и понял: иногда лучший порядок начинается с одной понятной стопки.',
    'Кот однажды целый день следил за солнечным зайчиком. К вечеру он понял, что не поймал его — зато хорошо отдохнул. Не каждая полезная пауза обязана давать измеримый результат.',
    'Шпиц нашёл в лесу три тропинки. Вместо самой длинной он выбрал ту, где был виден следующий шаг. Так он дошёл быстрее всех — маленькими, но понятными действиями.',
    'У старого лабрадора была привычка: перед важным решением он обходил дом, пил воду и возвращался к задаче. После короткой паузы сложные вещи почти всегда становились чуть проще.',
    'Мейн-кун устроил на полке идеальный архив, но оставил одно пустое место. «Это для новой хорошей идеи», — сказал он и спокойно пошёл спать.'
  ];

  function petReply(topic, rawText = '') {
    const lower = rawText.toLowerCase();
    if (topic === 'break' || /устал|устала|перерыв|отдох|стресс|тревог/.test(lower)) return 'Давайте сделаем минуту тише. Во вкладке «Забота» есть спокойное дыхание: я буду рядом и задам ритм.';
    if (topic === 'story' || /истори|сказк/.test(lower)) return stories[(life.interactions + life.messages.length) % stories.length];
    if (topic === 'work' || /работ|отч[её]т|аналит|таблиц|задач/.test(lower)) return contextualTip();
    if (topic === 'mood' || /как ты|настроен|чувству/.test(lower)) return `${moodText()}. Наш уровень дружбы — ${friendshipLevel()}.`;
    if (/привет|доброе|здравств/.test(lower)) return `Привет! Я ${petDisplayName()}. Рад, что мы снова вместе.`;
    if (/голод|есть|корм|лаком/.test(lower)) return life.hunger < 70 ? 'Немного проголодался. Угощение во вкладке «Забота» сейчас будет кстати.' : 'Спасибо, я сыт. Но от совместной игры точно не откажусь.';
    if (/дом|комнат|домик/.test(lower)) return 'Загляните в мой домик. С ростом нашей дружбы там открываются новые вещи и атмосферы.';
    if (/имя|зовут/.test(lower)) return `Меня зовут ${petDisplayName()}. Имя и внешность всегда можно изменить через ваш профиль.`;
    const answers = {
      helper: ['Я вас услышал. Давайте решим, какое одно действие сейчас принесёт больше всего ясности.', 'Я рядом. Можно сначала записать мысль как есть, а оформить её уже вторым шагом.'],
      curious: ['Интересно! А какая деталь здесь кажется вам самой неожиданной?', 'Давайте посмотрим на это как исследователи: что мы знаем точно, а что пока только предполагаем?'],
      calm: ['Не торопитесь. Иногда лучший следующий шаг становится заметен после пары спокойных вдохов.', 'Похоже, эту мысль стоит немного подержать в тишине. Я посижу рядом.'],
      playful: ['Звучит как маленькое приключение. Предлагаю выбрать самый лёгкий шаг и красиво с ним расправиться!', 'У меня есть план: одна задача, короткий рывок, потом заслуженная игра.']
    };
    const pool = answers[pet.personality] || answers.helper;
    return pool[(life.messages.length + life.interactions) % pool.length];
  }

  function addMemory(icon, title, detail) {
    life.memories.unshift({ icon, title, detail, at: Date.now() });
    life.memories = life.memories.slice(0, 40);
    saveLife();
  }

  function renderStats() {
    const stats = [['Настроение', life.mood, '#5f8ee8'], ['Энергия', life.energy, '#75a96d'], ['Сытость', life.hunger, '#d99a57']];
    const grid = document.querySelector('#petStatGrid');
    grid.replaceChildren();
    stats.forEach(([label, value, color]) => {
      const card = document.createElement('div');
      card.className = 'pet-stat';
      card.innerHTML = `<div><strong>${label}</strong><span>${Math.round(value)}%</span></div><i><b style="width:${Math.round(value)}%;background:${color}"></b></i>`;
      grid.append(card);
    });
    document.querySelector('#petBondLevel').textContent = `Уровень дружбы ${friendshipLevel()}`;
  }

  function renderHome() {
    const level = friendshipLevel();
    const room = document.querySelector('#petRoom');
    if (life.theme === 'evening' && level < 2) life.theme = 'morning';
    if (life.theme === 'forest' && level < 3) life.theme = 'morning';
    room.dataset.theme = life.theme;
    room.classList.toggle('is-plant-hidden', !life.furniture.plant);
    room.classList.toggle('is-shelf-hidden', !life.furniture.shelf);
    room.classList.toggle('is-toy-hidden', !life.furniture.toy);
    document.querySelectorAll('[data-room-theme]').forEach((button) => {
      const need = button.dataset.roomTheme === 'forest' ? 3 : button.dataset.roomTheme === 'evening' ? 2 : 1;
      button.disabled = level < need;
      button.title = level < need ? `Откроется на уровне дружбы ${need}` : '';
      button.classList.toggle('is-selected', button.dataset.roomTheme === life.theme);
    });
    const furniture = [['toy', 'Мячик', 1], ['plant', 'Растение', 2], ['shelf', 'Полка', 3]];
    const list = document.querySelector('#petFurnitureList');
    list.replaceChildren();
    furniture.forEach(([key, label, need]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.furniture = key;
      button.disabled = level < need;
      button.title = level < need ? `Откроется на уровне дружбы ${need}` : '';
      button.classList.toggle('is-selected', Boolean(life.furniture[key]));
      button.textContent = level < need ? `${label} · ур. ${need}` : label;
      list.append(button);
    });
    const activeItems = Object.values(life.furniture).filter(Boolean).length;
    document.querySelector('#petHomeProgress').textContent = `${activeItems} ${plural(activeItems, 'предмет', 'предмета', 'предметов')}`;
  }

  function renderMemories() {
    const achievements = [
      ['♡', 'Первое знакомство', 'Познакомиться с питомцем', life.interactions >= 1],
      ['✦', 'Заботливый друг', 'Пять взаимодействий', life.interactions >= 5],
      ['⌂', 'Новоселье', 'Выбрать атмосферу домика', life.theme !== 'morning'],
      ['◌', 'Хранитель историй', 'Шесть сообщений', life.messages.length >= 6],
      ['↑', 'Настоящая дружба', 'Достичь третьего уровня', friendshipLevel() >= 3]
    ];
    const holder = document.querySelector('#petAchievements');
    holder.replaceChildren();
    achievements.forEach(([icon, title, detail, unlocked]) => {
      const item = document.createElement('div');
      item.className = `pet-achievement${unlocked ? '' : ' is-locked'}`;
      item.innerHTML = `<span>${icon}</span><strong>${title}</strong><small>${detail}</small>`;
      holder.append(item);
    });
    const list = document.querySelector('#petMemoryList');
    list.replaceChildren();
    if (!life.memories.length) {
      const empty = document.createElement('div');
      empty.className = 'pet-memory-empty';
      empty.textContent = 'Ваши маленькие совместные события появятся здесь.';
      list.append(empty);
    } else {
      life.memories.forEach((memory) => {
        const item = document.createElement('div');
        item.className = 'pet-memory';
        const icon = document.createElement('span');
        icon.textContent = memory.icon || '♡';
        const copy = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = memory.title;
        const detail = document.createElement('small');
        const date = new Date(memory.at || Date.now()).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        detail.textContent = `${memory.detail} · ${date}`;
        copy.append(title, detail);
        item.append(icon, copy);
        list.append(item);
      });
    }
    document.querySelector('#petMemoryCount').textContent = `${life.memories.length} ${plural(life.memories.length, 'событие', 'события', 'событий')}`;
  }

  function renderHub() {
    if (!pet) return;
    document.querySelector('#petHubName').textContent = petDisplayName();
    document.querySelector('#petHubBreed').textContent = `${breedLabel(pet)} · ${PERSONALITY_LABELS[pet.personality]}`;
    document.querySelector('#petMoodLabel').textContent = moodText();
    renderChat();
    renderStats();
    renderHome();
    renderMemories();
  }

  function switchHubTab(name) {
    activeHubTab = name;
    document.querySelectorAll('[data-pet-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.petTab === name));
    document.querySelectorAll('[data-pet-view]').forEach((view) => view.classList.toggle('is-active', view.dataset.petView === name));
    syncHubModels();
    if (name === 'memories') renderMemories();
    if (name === 'home') renderHome();
  }

  function openHub() {
    if (!pet?.enabled) return;
    window.clearTimeout(walkTimer);
    window.clearTimeout(walkEndTimer);
    hideMessage();
    root.classList.add('is-hidden');
    runtime3D.setActive(false);
    hub.classList.remove('is-hidden');
    document.body.style.overflow = 'hidden';
    if (!life.messages.length) addChat('pet', `Привет! Я ${petDisplayName()}. Здесь можно поговорить, отдохнуть, поиграть и обустроить мой домик.`);
    life.interactions += 1;
    life.xp += 3;
    if (life.interactions === 1) addMemory('♡', 'Первое знакомство', `${petDisplayName()} стал частью вашего рабочего пространства`);
    saveLife();
    renderHub();
    ensure3D().then(() => {
      [hub3D, room3D].forEach((view) => view.setConfig(pet));
      hub3D.setMode('studio');
      room3D.setMode('house');
      syncHubModels();
    });
    window.setTimeout(() => document.querySelector('#petChatInput')?.focus(), 80);
  }

  function closeHub() {
    stopBreathing(false);
    hub.classList.add('is-hidden');
    hub3D.setActive(false);
    room3D.setActive(false);
    document.body.style.overflow = '';
    if (pet?.enabled) {
      root.classList.remove('is-hidden');
      runtime3D.setActive(!reduceMotion);
      setView(currentView);
    }
  }

  function applyCare(action) {
    const changes = {
      feed: { mood: 4, energy: 0, hunger: 25, xp: 5, reaction: 'feed', icon: '◒', title: 'Вкусное угощение', detail: `${petDisplayName()} с удовольствием подкрепился` },
      pet: { mood: 13, energy: 2, hunger: 0, xp: 8, reaction: 'pet', icon: '♡', title: 'Тёплая минутка', detail: `Вы уделили ${petDisplayName()} немного внимания` },
      play: { mood: 17, energy: -8, hunger: -6, xp: 10, reaction: 'play', icon: '●', title: 'Весёлая игра', detail: 'Мячик сделал один очень важный круг по комнате' },
      rest: { mood: 4, energy: 24, hunger: -2, xp: 5, reaction: 'happy', icon: '☾', title: 'Тихий отдых', detail: 'Вы немного отдохнули вместе' }
    };
    const item = changes[action];
    if (!item) return;
    life.mood = clamp(life.mood + item.mood);
    life.energy = clamp(life.energy + item.energy);
    life.hunger = clamp(life.hunger + item.hunger, 25, 100);
    life.xp += item.xp;
    life.interactions += 1;
    addMemory(item.icon, item.title, item.detail);
    saveLife();
    hub3D.react(item.reaction, 1100);
    room3D.react(item.reaction, 1100);
    if (action === 'rest') {
      hub3D.setMode('sleep');
      window.setTimeout(() => hub3D.setMode('studio'), 2200);
    }
    if (action === 'play') {
      const room = document.querySelector('#petRoom');
      room.classList.remove('is-playing');
      void room.offsetWidth;
      room.classList.add('is-playing');
    }
    renderHub();
  }

  function stopBreathing(completed) {
    window.clearInterval(breatheTimer);
    breatheTimer = null;
    document.querySelector('#petBreatheOrb').classList.remove('is-running');
    document.querySelector('#startPetBreak').textContent = 'Начать';
    if (!completed) {
      document.querySelector('#petBreakTitle').textContent = 'Минутка спокойствия';
      document.querySelector('#petBreakText').textContent = 'Подышите вместе с питомцем в течение минуты.';
    }
  }

  function startBreathing() {
    if (breatheTimer) { stopBreathing(false); return; }
    breatheRemaining = 60;
    const orb = document.querySelector('#petBreatheOrb');
    const title = document.querySelector('#petBreakTitle');
    const text = document.querySelector('#petBreakText');
    const button = document.querySelector('#startPetBreak');
    orb.classList.add('is-running');
    button.textContent = 'Остановить';
    title.textContent = 'Дышим вместе';
    const tick = () => {
      const phase = Math.floor((60 - breatheRemaining) / 4) % 2 === 0 ? 'Медленный вдох' : 'Спокойный выдох';
      text.textContent = `${phase} · осталось ${breatheRemaining} сек.`;
      if (breatheRemaining-- <= 0) {
        stopBreathing(true);
        title.textContent = 'Стало немного спокойнее';
        text.textContent = 'Хорошая пауза. Возвращайтесь к делам в удобном темпе.';
        life.mood = clamp(life.mood + 8);
        life.energy = clamp(life.energy + 4);
        life.xp += 8;
        life.interactions += 1;
        addMemory('◌', 'Минута спокойствия', `Вы и ${petDisplayName()} вместе сделали дыхательную паузу`);
        renderHub();
        hub3D.react('pet', 1200);
      }
    };
    tick();
    breatheTimer = window.setInterval(tick, 1000);
  }

  function setView(name) {
    currentView = name;
    window.clearTimeout(walkTimer);
    window.clearTimeout(walkEndTimer);
    if (!pet?.enabled || !hub.classList.contains('is-hidden')) return;
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
    hub3D.setConfig(pet);
    room3D.setConfig(pet);
    runtime3D.setActive(!reduceMotion);
    document.querySelector('#petNameTag').textContent = petDisplayName();
    character.setAttribute('aria-label', `${petDisplayName()}, ${breedLabel(pet)}. Открыть центр питомца`);
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
      window.requestAnimationFrame(() => { preview3D.resize(); renderPreview(); });
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
    const isNew = !pet;
    pet = config;
    try { localStorage.setItem(PET_KEY, JSON.stringify(pet)); }
    catch { toast('Не удалось сохранить питомца в этом браузере'); return; }
    [runtime3D, hub3D, room3D].forEach((view) => view.setConfig(pet));
    if (isNew) addMemory('✦', 'Новый друг', `${pet.name} поселился в MyWorkspace`);
    renderRuntime();
    closeEditor();
    toast(`${pet.name} теперь живёт в MyWorkspace в 3D`);
  });
  document.querySelector('#closePetMessage').addEventListener('click', (event) => { event.stopPropagation(); hideMessage(); });
  character.addEventListener('click', () => {
    root.classList.remove('is-happy');
    void root.offsetWidth;
    root.classList.add('is-happy');
    runtime3D.react('happy', 620);
    window.setTimeout(() => { root.classList.remove('is-happy'); openHub(); }, 260);
  });
  document.querySelector('#closePetHub').addEventListener('click', closeHub);
  hub.addEventListener('click', (event) => { if (event.target === hub) closeHub(); });
  document.querySelectorAll('[data-pet-tab]').forEach((button) => button.addEventListener('click', () => switchHubTab(button.dataset.petTab)));
  document.querySelectorAll('[data-pet-topic]').forEach((button) => button.addEventListener('click', () => {
    const labels = { break: 'Хочу немного отдохнуть', story: 'Расскажи историю', work: 'Помоги с работой', mood: 'Как ты себя чувствуешь?' };
    addChat('user', labels[button.dataset.petTopic]);
    addChat('pet', petReply(button.dataset.petTopic));
    hub3D.react('curious', 700);
  }));
  document.querySelector('#petChatForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.querySelector('#petChatInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addChat('user', text);
    addChat('pet', petReply('', text));
    hub3D.react('happy', 680);
  });
  document.querySelectorAll('[data-care]').forEach((button) => button.addEventListener('click', () => applyCare(button.dataset.care)));
  document.querySelector('#startPetBreak').addEventListener('click', startBreathing);
  document.querySelectorAll('[data-room-theme]').forEach((button) => button.addEventListener('click', () => {
    if (button.disabled) return;
    life.theme = button.dataset.roomTheme;
    life.xp += 2;
    saveLife();
    renderHome();
    renderMemories();
  }));
  document.querySelector('#petFurnitureList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-furniture]');
    if (!button || button.disabled) return;
    life.furniture[button.dataset.furniture] = !life.furniture[button.dataset.furniture];
    life.xp += 1;
    saveLife();
    renderHome();
  });
  document.addEventListener('myworkspace:view-change', (event) => setView(event.detail.name));
  document.querySelectorAll('[data-jump]').forEach((button) => button.addEventListener('click', () => {
    lastAnalyticsSection = button.dataset.jump;
    if (pet?.enabled && currentView === 'analytics') window.setTimeout(() => showMessage(analyticsTip(), 6000), 850);
  }));
  document.querySelectorAll('.dossier-section').forEach((section) => section.addEventListener('focusin', () => { lastAnalyticsSection = section.id; }));
  document.addEventListener('pointermove', (event) => {
    if (!pet?.enabled || lookFrame || !hub.classList.contains('is-hidden')) return;
    lookFrame = requestAnimationFrame(() => {
      lookFrame = null;
      const rect = character.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (event.clientX - (rect.left + rect.width / 2)) / 180));
      const dy = Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height / 2)) / 140));
      runtime3D.setLook(dx, dy);
    });
  }, { passive: true });
  document.addEventListener('pointerdown', (event) => {
    if (!pet?.enabled || character.contains(event.target) || !hub.classList.contains('is-hidden')) return;
    runtime3D.setDirection(event.clientX >= character.getBoundingClientRect().left ? 1 : -1);
    root.classList.add('is-curious');
    runtime3D.react('curious', 560);
    window.setTimeout(() => root.classList.remove('is-curious'), 560);
  }, { passive: true });
  window.addEventListener('resize', () => applyPetPosition(petX, 250));
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveLife(); });
  window.addEventListener('beforeunload', saveLife);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!modal.classList.contains('is-hidden')) closeEditor();
    else if (!hub.classList.contains('is-hidden')) closeHub();
  });

  updateProfilePetAction();
  renderRuntime();
}
