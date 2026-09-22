import './styles.css';
import { exportAnalyticsDocx } from './docx-export.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const sections = { home: 'Главная', files: 'Мои файлы', analytics: 'Аналитика', fbs: 'FBS · Таблицы' };
const keys = { files: 'myworkspace.files.v1', draft: 'myworkspace.analytics.v1', profile: 'myworkspace.profile.v1', tour: 'myworkspace.tour.v1' };
let files = load(keys.files, []);
let activeFileId = null;
let reportImages = [];
let toastTimer;
let profile = load(keys.profile, null);
let tourIndex = 0;

const tourSteps = [
  { target: 'navigation', icon: 'home', title: 'Всё под рукой', text: 'Слева находятся основные разделы: главная, ваши файлы, аналитика и рабочие таблицы FBS.' },
  { target: 'quick-access', icon: 'external', title: 'Быстрый доступ', text: 'Отсюда открываются конвертер, сканер, Google Таблицы и конструктор аналитики.' },
  { target: 'files', icon: 'folder', title: 'Мои файлы', text: 'Создавайте заметки, планы и отчёты по шаблонам. Они автоматически сохраняются в этом браузере.' },
  { target: 'analytics', icon: 'sparkles', title: 'Досье изделия', text: 'Здесь собирается полный путь товара: рынок, фотографии, примерки, экономика, запуск и готовый DOCX.' },
  { target: 'fbs', icon: 'table', title: 'Рабочие таблицы FBS', text: 'Открывайте таблицы хранения и планирования перемещений, не теряя MyWorkspace.' }
];

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { toast('Недостаточно места для сохранения'); return false; }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function svgIcon(name, className = '') {
  return `<svg class="${className}" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
}

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('is-visible'), 2600);
}

function updateProfileUi() {
  const name = profile?.name?.trim();
  $('#homeGreeting').textContent = name ? `Чем сегодня займёмся, ${name}?` : 'Что нужно сделать сегодня?';
  $('#userName').textContent = name || 'Профиль';
  $('#userInitial').textContent = name ? name.slice(0, 1).toUpperCase() : 'Я';
}

function openProfileModal(isEditing = false) {
  $('#profileTitle').textContent = isEditing ? 'Как к вам обращаться?' : 'Добро пожаловать в MyWorkspace';
  $('#profileText').textContent = isEditing ? 'Измените имя — новое обращение сразу появится на главной странице.' : 'Давайте познакомимся — так рабочее пространство сможет обращаться к вам по имени.';
  $('#saveProfile').textContent = isEditing ? 'Сохранить' : 'Продолжить →';
  $('#cancelProfile').classList.toggle('is-hidden', !isEditing);
  $('#profileName').value = profile?.name || '';
  $('#profileModal').classList.remove('is-hidden');
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => $('#profileName').focus(), 50);
}

function closeProfileModal() {
  $('#profileModal').classList.add('is-hidden');
  document.body.style.overflow = '';
}

function clearTourTarget() {
  $('.tour-target')?.classList.remove('tour-target');
  $('#sidebar').classList.remove('is-open');
}

function positionTourCard(target) {
  const card = $('#tourCard');
  const rect = target.getBoundingClientRect();
  const cardWidth = Math.min(360, window.innerWidth - 32);
  const cardHeight = card.offsetHeight || 280;
  const gap = 24;
  let left;
  let top;
  if (rect.right + cardWidth + gap <= window.innerWidth) {
    left = rect.right + gap;
    top = Math.min(Math.max(rect.top, 16), window.innerHeight - cardHeight - 16);
  } else if (rect.left - cardWidth - gap >= 0) {
    left = rect.left - cardWidth - gap;
    top = Math.min(Math.max(rect.top, 16), window.innerHeight - cardHeight - 16);
  } else {
    left = Math.min(Math.max(rect.left, 16), window.innerWidth - cardWidth - 16);
    top = rect.bottom + cardHeight + gap <= window.innerHeight ? rect.bottom + gap : Math.max(16, rect.top - cardHeight - gap);
  }
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function showTourStep(index) {
  clearTourTarget();
  tourIndex = Math.min(Math.max(index, 0), tourSteps.length - 1);
  const step = tourSteps[tourIndex];
  const target = $(`[data-tour="${step.target}"]`);
  if (!target) return finishTour();
  if (step.target === 'navigation' && window.innerWidth <= 760) $('#sidebar').classList.add('is-open');
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('#tourCounter').textContent = `${tourIndex + 1} из ${tourSteps.length}`;
  $('#tourIcon').innerHTML = svgIcon(step.icon);
  $('#tourTitle').textContent = step.title;
  $('#tourText').textContent = step.text;
  $('#prevTour').disabled = tourIndex === 0;
  $('#nextTour').textContent = tourIndex === tourSteps.length - 1 ? 'Готово ✓' : 'Далее →';
  window.setTimeout(() => { target.classList.add('tour-target'); positionTourCard(target); }, 220);
}

function startTour() {
  switchView('home');
  $('#tourLayer').classList.remove('is-hidden');
  showTourStep(0);
}

function finishTour() {
  clearTourTarget();
  $('#tourLayer').classList.add('is-hidden');
  save(keys.tour, true);
  toast('Готово — вы знаете, где что находится');
}

function switchView(name) {
  $$('.view').forEach((view) => view.classList.toggle('is-active', view.id === `view-${name}`));
  $$('.nav-item').forEach((item) => item.classList.toggle('is-active', item.dataset.view === name));
  $('#currentSection').textContent = sections[name];
  $('#sidebar').classList.remove('is-open');
  if (name === 'files') renderFiles();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const templates = {
  note: ['Новая рабочая заметка', 'Рабочая заметка', 'Тема\n\nЗафиксируйте основную мысль.\n\nДетали\n\n• Важный факт\n• Наблюдение\n• Вопрос, который нужно решить\n\nСледующий шаг\n\nОпишите, что нужно сделать дальше.'],
  plan: ['Новый план действий', 'План действий', 'Цель\n\nКакого результата хотим достичь?\n\nПлан\n\n1. Первый шаг\n2. Второй шаг\n3. Проверка результата\n\nОтветственные\n\nУкажите, кто участвует в работе.\n\nСрок\n\nУкажите желаемую дату.'],
  report: ['Новый краткий отчёт', 'Краткий отчёт', 'Ситуация\n\nКратко опишите, что произошло.\n\nНаблюдения\n\n• Первый факт\n• Второй факт\n\nВывод\n\nСформулируйте главную мысль.\n\nРешение\n\nЧто предлагаем сделать.']
};

function createFile(kind) {
  const [title, type, content] = templates[kind];
  const now = new Date().toISOString();
  const file = { id: crypto.randomUUID(), title, type, content, createdAt: now, updatedAt: now };
  files.unshift(file);
  save(keys.files, files);
  updateFileCounts();
  openFile(file.id);
  toast('Документ создан');
}

function plural(number, words) {
  const n = Math.abs(number) % 100;
  const n1 = n % 10;
  return n > 10 && n < 20 ? words[2] : n1 > 1 && n1 < 5 ? words[1] : n1 === 1 ? words[0] : words[2];
}

function formatDate(date) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
}

function renderFiles() {
  if (activeFileId) return;
  const query = ($('#fileSearch').value || '').trim().toLowerCase();
  const visible = files.filter((file) => `${file.title} ${file.type}`.toLowerCase().includes(query));
  $('#filesSummary').textContent = files.length ? `${files.length} ${plural(files.length, ['документ', 'документа', 'документов'])}` : 'Пока нет документов';
  $('#filesList').innerHTML = visible.length
    ? visible.map((file) => `<button class="file-row" data-file-id="${file.id}"><span class="file-symbol">${svgIcon('note')}</span><div><strong>${escapeHtml(file.title)}</strong><small>${escapeHtml(file.type)}</small></div><time>${formatDate(file.updatedAt)}</time></button>`).join('')
    : `<div class="files-empty"><div><span class="file-symbol">${svgIcon('folder')}</span><strong>${query ? 'Ничего не найдено' : 'Пока здесь пусто'}</strong><p>${query ? 'Попробуйте изменить запрос.' : 'Выберите шаблон выше, чтобы создать первый документ.'}</p></div></div>`;
  $$('[data-file-id]').forEach((button) => button.addEventListener('click', () => openFile(button.dataset.fileId)));
}

function openFile(id) {
  const file = files.find((item) => item.id === id);
  if (!file) return;
  activeFileId = id;
  $('#filesLibrary').classList.add('is-hidden');
  $('#fileEditor').classList.remove('is-hidden');
  $('#fileTitle').value = file.title;
  $('#fileContent').value = file.content;
  $('#fileMeta').textContent = `${file.type} · создан ${formatDate(file.createdAt)}`;
  $('#fileTitle').focus();
}

function saveActiveFile() {
  const file = files.find((item) => item.id === activeFileId);
  if (!file) return;
  file.title = $('#fileTitle').value.trim() || 'Без названия';
  file.content = $('#fileContent').value;
  file.updatedAt = new Date().toISOString();
  save(keys.files, files);
  $('#editorSaved').textContent = 'Сохранено сейчас';
  updateFileCounts();
}

function closeEditor() {
  activeFileId = null;
  $('#fileEditor').classList.add('is-hidden');
  $('#filesLibrary').classList.remove('is-hidden');
  renderFiles();
}

function deleteFile() {
  if (!activeFileId || !confirm('Удалить этот документ? Отменить действие не получится.')) return;
  files = files.filter((item) => item.id !== activeFileId);
  save(keys.files, files);
  closeEditor();
  updateFileCounts();
  toast('Документ удалён');
}

function updateFileCounts() {
  $('#filesCount').textContent = files.length;
  if (!files.length) {
    $('#recentFiles').className = 'empty-recent';
    $('#recentFiles').innerHTML = `<span class="file-symbol">${svgIcon('folder')}</span><div><strong>Здесь появятся ваши документы</strong><p>Создайте первый файл по шаблону или соберите аналитический отчёт.</p></div>`;
    return;
  }
  $('#recentFiles').className = 'recent-mini-list';
  $('#recentFiles').innerHTML = files.slice(0, 3).map((file) => `<button data-recent-id="${file.id}"><span class="file-symbol">${svgIcon('note')}</span><div><strong>${escapeHtml(file.title)}</strong><small>${formatDate(file.updatedAt)}</small></div><b>${svgIcon('arrow')}</b></button>`).join('');
  $$('[data-recent-id]').forEach((button) => button.addEventListener('click', () => { switchView('files'); openFile(button.dataset.recentId); }));
}

async function prepareImage(file) {
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const element = new Image(); element.onload = () => resolve(element); element.onerror = reject; element.src = source;
  });
  const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return { id: crypto.randomUUID(), src: canvas.toDataURL('image/jpeg', .82), caption: file.name.replace(/\.[^.]+$/, ''), category: 'Примерка', width: canvas.width, height: canvas.height };
}

async function addImages(event) {
  const chosen = [...event.target.files].slice(0, Math.max(0, 12 - reportImages.length));
  if (!chosen.length) return;
  toast('Подготавливаю изображения…');
  reportImages.push(...await Promise.all(chosen.map(prepareImage)));
  renderImages();
  buildReport(false);
  updateProgress();
  event.target.value = '';
}

function renderImages() {
  const categories = ['Конкурент', 'Примерка', 'Дефект', 'Ткань', 'Посылка', 'Другое'];
  $('#imageList').innerHTML = reportImages.map((image) => `<div class="image-item"><img src="${image.src}" alt="" /><div class="image-fields"><select data-category-id="${image.id}" aria-label="Тип изображения">${categories.map((category) => `<option${category === image.category ? ' selected' : ''}>${category}</option>`).join('')}</select><input value="${escapeHtml(image.caption)}" data-caption-id="${image.id}" aria-label="Подпись к изображению" /></div><button data-remove-image="${image.id}" aria-label="Удалить изображение">×</button></div>`).join('');
  $$('[data-caption-id]').forEach((input) => input.addEventListener('input', () => {
    reportImages.find((item) => item.id === input.dataset.captionId).caption = input.value; buildReport(false);
  }));
  $$('[data-category-id]').forEach((select) => select.addEventListener('change', () => {
    reportImages.find((item) => item.id === select.dataset.categoryId).category = select.value; buildReport(false);
  }));
  $$('[data-remove-image]').forEach((button) => button.addEventListener('click', () => {
    reportImages = reportImages.filter((item) => item.id !== button.dataset.removeImage); renderImages(); buildReport(false); updateProgress();
  }));
}

function tableData(selector) {
  const table = $(selector);
  return {
    headers: [...table.querySelectorAll('thead th')].map((cell) => cell.textContent.trim()),
    rows: [...table.querySelectorAll('tbody tr')].map((row) => [...row.cells].map((cell) => cell.textContent.trim()))
  };
}

const dossierIds = [
  'reportTitle', 'reportPeriod', 'productCategory', 'projectStage', 'projectOwner', 'projectGoal',
  'marketVolume', 'averagePrice', 'seasonality', 'competitorName', 'competitorPrice', 'marketStrengths',
  'marketRisks', 'reportObservation', 'fittingNotes', 'productDefects', 'fabricConsumption', 'fabricPrice',
  'sewingCost', 'fabricSource', 'fabricMoq', 'fabricNotes', 'launchColors', 'launchMonth', 'parcelNotes',
  'reportConclusion', 'reportActions', 'productDescription'
];

function reportData() {
  const values = Object.fromEntries(dossierIds.map((id) => [id, $(`#${id}`).value.trim()]));
  return { ...values, title: values.reportTitle, period: values.reportPeriod, observation: values.reportObservation,
    conclusion: values.reportConclusion, actions: values.reportActions, images: reportImages,
    measurements: tableData('#measurementsTable'), timeline: tableData('#timelineTable'),
    economics: tableData('#economicsTable'), sizes: tableData('#sizesTable') };
}

function meaningfulRows(table) {
  return table.rows.filter((row) => row.some((cell) => cell && cell !== '—'));
}

function previewTable(title, table) {
  const rows = meaningfulRows(table);
  if (!rows.length) return '';
  return `<section><h2>${title}</h2><table class="report-table"><thead><tr>${table.headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 6).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`;
}

function reportMarkup(data, emptyAllowed = true) {
  const hasContent = dossierIds.some((id) => data[id]) || data.images.length;
  if (!hasContent && emptyAllowed) return '<div class="report-empty"><span>✦</span><strong>Досье появится здесь</strong><p>Заполняйте разделы слева — документ будет собираться автоматически.</p></div>';
  const actions = data.actions.split('\n').map((line) => line.trim()).filter(Boolean);
  const meta = [data.productCategory, data.projectStage, data.projectOwner].filter(Boolean).map(escapeHtml).join(' · ');
  return `<article class="report-doc dossier-doc"><span class="report-mark">MYWORKSPACE · ДОСЬЕ ИЗДЕЛИЯ</span><h1>${escapeHtml(data.title || 'Разработка товара')}</h1><div class="report-period">${escapeHtml(data.period || formatDate(new Date()))}</div>${meta ? `<p class="report-meta">${meta}</p>` : ''}<div class="report-rule"></div>
  ${data.projectGoal ? `<section><h2>Задача проекта</h2><p>${escapeHtml(data.projectGoal).replace(/\n/g, '<br>')}</p></section>` : ''}
  ${(data.marketVolume || data.averagePrice || data.seasonality || data.competitorName) ? `<section><h2>Рынок и конкурент</h2><div class="preview-facts">${data.marketVolume ? `<div><b>${escapeHtml(data.marketVolume)}</b><span>товаров в категории</span></div>` : ''}${data.averagePrice ? `<div><b>${escapeHtml(data.averagePrice)}</b><span>средняя цена</span></div>` : ''}${data.competitorName ? `<div><b>${escapeHtml(data.competitorName)}</b><span>главный конкурент</span></div>` : ''}</div>${data.observation ? `<p>${escapeHtml(data.observation).replace(/\n/g, '<br>')}</p>` : ''}</section>` : ''}
  ${data.images.length ? `<section><h2>Материалы</h2><div class="report-images">${data.images.slice(0, 4).map((image) => `<div class="report-image"><img src="${image.src}" alt="" /><small><b>${escapeHtml(image.category || 'Материал')}</b> · ${escapeHtml(image.caption)}</small></div>`).join('')}</div></section>` : ''}
  ${data.fittingNotes ? `<section><h2>Примерка и образцы</h2><p>${escapeHtml(data.fittingNotes).replace(/\n/g, '<br>')}</p></section>` : ''}
  ${previewTable('Замеры', data.measurements)}${previewTable('Экономика', data.economics)}${previewTable('Первый заказ', data.sizes)}
  ${data.conclusion ? `<section><h2>Итоговое решение</h2><p>${escapeHtml(data.conclusion).replace(/\n/g, '<br>')}</p></section>` : ''}${actions.length ? `<section><h2>Следующие действия</h2><ul>${actions.map((action) => `<li>${escapeHtml(action.replace(/^[•\-–\d.)\s]+/, ''))}</li>`).join('')}</ul></section>` : ''}</article>`;
}

function buildReport(notify = true) {
  $('#reportPreview').innerHTML = reportMarkup(reportData());
  if (notify) { $('#reportPreview').scrollIntoView({ behavior: 'smooth', block: 'center' }); toast('Аналитика оформлена'); }
}

function saveDraft() {
  const data = reportData();
  save(keys.draft, { ...data, images: [] });
  const now = new Date().toISOString();
  const existing = files.find((file) => file.analyticsDraft);
  const content = [data.projectGoal, data.observation, data.fittingNotes, data.conclusion, data.actions].filter(Boolean).join('\n\n');
  if (existing) Object.assign(existing, { title: data.title || 'Черновик аналитики', content, updatedAt: now });
  else files.unshift({ id: crypto.randomUUID(), title: data.title || 'Черновик аналитики', type: 'Аналитика', content, createdAt: now, updatedAt: now, analyticsDraft: true });
  save(keys.files, files); updateFileCounts(); toast('Черновик сохранён в «Мои файлы»');
}

function loadDraft() {
  const data = load(keys.draft, null);
  if (!data) return;
  if (!data.reportTitle && data.title) data.reportTitle = data.title;
  if (!data.reportPeriod && data.period) data.reportPeriod = data.period;
  dossierIds.forEach((id) => { if (data[id] !== undefined) $(`#${id}`).value = data[id]; });
  [['#measurementsTable', data.measurements], ['#timelineTable', data.timeline], ['#economicsTable', data.economics], ['#sizesTable', data.sizes]].forEach(([selector, table]) => {
    if (!table?.rows?.length) return;
    $(`${selector} tbody`).innerHTML = table.rows.map((row) => `<tr>${row.map((cell) => `<td contenteditable="true">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
  });
  buildReport(false);
  updateProgress();
}

function resetReport() {
  dossierIds.forEach((id) => { $(`#${id}`).value = ''; });
  reportImages = []; renderImages(); localStorage.removeItem(keys.draft); buildReport(false); updateProgress(); toast('Форма очищена');
}

async function exportWord() {
  const data = reportData();
  const button = $('#exportWord');
  button.disabled = true;
  button.textContent = 'Собираю DOCX…';
  try {
    await exportAnalyticsDocx(data, safeName(data.title || 'Аналитика'));
    toast('DOCX скачан — загрузите его в Google Документы');
  } catch (error) {
    console.error(error);
    toast('Не удалось собрать DOCX. Попробуйте ещё раз');
  } finally {
    button.disabled = false;
    button.textContent = 'DOCX для Google Документов';
  }
}

function safeName(name) { return name.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80) || 'Аналитика'; }

function addTableRow(tableSelector, cells) {
  const row = document.createElement('tr');
  row.innerHTML = cells.map((cell) => `<td contenteditable="true">${cell}</td>`).join('');
  $(`${tableSelector} tbody`).append(row); buildReport(false);
}

function updateProgress() {
  const fields = $$('[data-dossier-field]');
  const completed = fields.filter((field) => field.value.trim()).length + (reportImages.length ? 1 : 0);
  const percent = Math.round((completed / (fields.length + 1)) * 100);
  $('#dossierProgress').textContent = `${percent}%`;
}

function registerWebMcp() {
  if (!navigator.modelContext?.registerTool) return;
  navigator.modelContext.registerTool({
    name: 'open_workspace_section', description: 'Открывает раздел MyWorkspace',
    inputSchema: { type: 'object', properties: { section: { type: 'string', enum: ['home', 'files', 'analytics', 'fbs'] } }, required: ['section'] },
    execute: ({ section }) => { switchView(section); return { content: [{ type: 'text', text: `Открыт раздел ${sections[section]}` }] }; }
  });
}

$$('[data-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
$$('[data-go]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.go)));
$$('[data-template]').forEach((button) => button.addEventListener('click', () => createFile(button.dataset.template)));
$('#mobileMenu').addEventListener('click', () => $('#sidebar').classList.toggle('is-open'));
$('#editProfile').addEventListener('click', () => openProfileModal(true));
$('#cancelProfile').addEventListener('click', closeProfileModal);
$('#profileForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('#profileName').value.trim().replace(/\s+/g, ' ').slice(0, 32);
  if (!name) return $('#profileName').focus();
  const firstSetup = !profile;
  profile = { name };
  save(keys.profile, profile);
  updateProfileUi();
  closeProfileModal();
  if (firstSetup) window.setTimeout(startTour, 250);
  else toast(`Имя изменено: ${name}`);
});
$('#restartTour').addEventListener('click', startTour);
$('#skipTour').addEventListener('click', finishTour);
$('#nextTour').addEventListener('click', () => tourIndex === tourSteps.length - 1 ? finishTour() : showTourStep(tourIndex + 1));
$('#prevTour').addEventListener('click', () => showTourStep(tourIndex - 1));
window.addEventListener('resize', () => {
  const target = $('.tour-target');
  if (target && !$('#tourLayer').classList.contains('is-hidden')) positionTourCard(target);
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!$('#tourLayer').classList.contains('is-hidden')) finishTour();
  else if (!$('#profileModal').classList.contains('is-hidden') && profile) closeProfileModal();
});
$('#fileSearch').addEventListener('input', renderFiles);
$('#closeEditor').addEventListener('click', closeEditor); $('#deleteFile').addEventListener('click', deleteFile);
$('#fileTitle').addEventListener('input', saveActiveFile); $('#fileContent').addEventListener('input', saveActiveFile);
$('#imageUpload').addEventListener('change', addImages);
$('#addMeasurement').addEventListener('click', () => addTableRow('#measurementsTable', ['Часть изделия', 'Новый параметр', '—']));
$('#addTimeline').addEventListener('click', () => addTableRow('#timelineTable', ['—', 'Новое событие', 'В работе']));
$('#addEconomic').addEventListener('click', () => addTableRow('#economicsTable', ['Новый показатель', '—', '—']));
$('#addSize').addEventListener('click', () => addTableRow('#sizesTable', ['—', '—', '—']));
$$('[data-dossier-field]').forEach((field) => field.addEventListener('input', () => { buildReport(false); updateProgress(); }));
$$('.input-table').forEach((table) => table.addEventListener('input', () => buildReport(false)));
$$('[data-jump]').forEach((button) => button.addEventListener('click', () => {
  const section = $(`#${button.dataset.jump}`); section.open = true; section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
$('#buildReport').addEventListener('click', () => buildReport(true)); $('#saveDraft').addEventListener('click', saveDraft); $('#resetReport').addEventListener('click', resetReport);
$('#exportPdf').addEventListener('click', () => { buildReport(false); window.print(); }); $('#exportWord').addEventListener('click', exportWord);

$('#today').textContent = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
$('#reportPreview').innerHTML = reportMarkup(reportData());
updateFileCounts(); renderFiles(); loadDraft(); updateProgress(); updateProfileUi(); registerWebMcp();
window.setTimeout(() => {
  $('#welcome')?.remove();
  if (!profile) openProfileModal(false);
  else if (!load(keys.tour, false)) startTour();
}, 2350);
