import './styles.css';
import { exportAnalyticsDocx } from './docx-export.js';
import { initStoreAnalysis } from './store-ui.js';
import { initWorkspaceModules, renderWorkspaceModule } from './workspace-modules.js';
import { initPetCompanion } from './pet.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const sections = { home: 'Главная', files: 'Мои файлы', products: 'Карточки товаров', analytics: 'Аналитика', store: 'Анализ магазина', history: 'История анализов', stock: 'Контроль остатков', calendar: 'Календарь', finance: 'Финансы товара', knowledge: 'База знаний', fbs: 'FBS · Таблицы' };
const keys = { files: 'myworkspace.files.v1', draft: 'myworkspace.analytics.v1', profile: 'myworkspace.profile.v1', tour: 'myworkspace.tour.v1' };
let files = load(keys.files, []);
let activeFileId = null;
let reportImages = [];
let toastTimer;
let profile = load(keys.profile, null);
let tourIndex = 0;

const tourSteps = [
  { target: 'navigation', icon: 'home', title: 'Всё под рукой', text: 'Слева находятся товары, аналитика, история проверок, остатки, календарь, финансы, инструкции и рабочие таблицы FBS.' },
  { target: 'quick-access', icon: 'external', title: 'Быстрый доступ', text: 'Отсюда открываются конвертер, сканер, Google Таблицы и два умных помощника.' },
  { target: 'files', icon: 'folder', title: 'Мои файлы', text: 'Создавайте заметки, планы и отчёты по шаблонам. Они автоматически сохраняются в этом браузере.' },
  { target: 'analytics', icon: 'sparkles', title: 'Досье изделия', text: 'Здесь собирается полный путь товара: рынок, фотографии, примерки, экономика, запуск и готовый DOCX.' },
  { target: 'store-analysis', icon: 'store-analysis', title: 'Анализ магазина', text: 'Загрузите отчёты WB, чтобы увидеть динамику магазина и причины изменений по каждому товару.' },
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
  renderWorkspaceModule(name);
  document.dispatchEvent(new CustomEvent('myworkspace:view-change', { detail: { name } }));
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
  'marketVolume', 'averagePrice', 'seasonality', 'competitorName', 'competitorLegalName',
  'competitorLaunchDate', 'competitorFulfillment', 'competitorPrice', 'competitorSizeRange',
  'competitorTopSizes', 'marketStrengths',
  'marketRisks', 'reportObservation', 'fittingNotes', 'productDefects', 'fabricConsumption', 'fabricPrice',
  'sewingCost', 'fabricSource', 'fabricMoq', 'fabricNotes', 'launchColors', 'launchMonth', 'parcelNotes',
  'reportConclusion', 'reportActions', 'productDescription'
];

const dossierTables = ['#measurementsTable', '#timelineTable', '#economicsTable', '#sizesTable', '#competitorSizesTable', '#competitorRevenueTable'];
const defaultDossierRows = Object.fromEntries(dossierTables.map((selector) => [selector, $(`${selector} tbody`).innerHTML]));

function reportData() {
  const values = Object.fromEntries(dossierIds.map((id) => [id, $(`#${id}`).value.trim()]));
  return { ...values, title: values.reportTitle, period: values.reportPeriod, observation: values.reportObservation,
    conclusion: values.reportConclusion, actions: values.reportActions, images: reportImages,
    measurements: tableData('#measurementsTable'), timeline: tableData('#timelineTable'),
    economics: tableData('#economicsTable'), sizes: tableData('#sizesTable'),
    competitorSizes: tableData('#competitorSizesTable'), competitorRevenue: tableData('#competitorRevenueTable') };
}

function meaningfulRows(table) {
  return table.rows.filter((row) => row.some((cell) => cell && cell !== '—'));
}

function previewTable(title, table, requiredColumn = null) {
  const rows = meaningfulRows(table).filter((row) => requiredColumn === null || (row[requiredColumn] && row[requiredColumn] !== '—'));
  if (!rows.length) return '';
  return `<section><h2>${title}</h2><table class="report-table"><thead><tr>${table.headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 6).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`;
}

function readableDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '';
  return new Intl.DateTimeFormat('ru-RU').format(new Date(`${value}T12:00:00`));
}

function revenueNumber(value = '') {
  const normalized = String(value).replace(/[^\d,.-]/g, '').replace(',', '.');
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function revenueMetrics(table) {
  const totals = { 2025: 0, 2026: 0 };
  const counts = { 2025: 0, 2026: 0 };
  (table?.rows || []).forEach((row) => {
    const year = String(row[0] || '').trim();
    const amount = revenueNumber(row[2]);
    if (year in totals && amount > 0) { totals[year] += amount; counts[year] += 1; }
  });
  const growth = totals[2025] > 0 && counts[2025] === counts[2026] && counts[2025] > 0 ? ((totals[2026] - totals[2025]) / totals[2025]) * 100 : null;
  return { ...totals, counts, growth };
}

function money(value) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value || 0) + ' ₽';
}

function updateRevenueSummary(table = tableData('#competitorRevenueTable')) {
  const metrics = revenueMetrics(table);
  $('#revenue2025Total').textContent = money(metrics[2025]);
  $('#revenue2026Total').textContent = money(metrics[2026]);
  $('#revenueGrowth').textContent = metrics.growth === null ? '—' : `${metrics.growth >= 0 ? '+' : ''}${metrics.growth.toFixed(1).replace('.', ',')}%`;
  $('#revenueGrowth').classList.toggle('is-positive', metrics.growth > 0);
  $('#revenueGrowth').classList.toggle('is-negative', metrics.growth < 0);
}

function reportMarkup(data, emptyAllowed = true) {
  const hasContent = dossierIds.some((id) => data[id]) || data.images.length;
  if (!hasContent && emptyAllowed) return '<div class="report-empty"><span>✦</span><strong>Досье появится здесь</strong><p>Заполняйте разделы слева — документ будет собираться автоматически.</p></div>';
  const actions = data.actions.split('\n').map((line) => line.trim()).filter(Boolean);
  const meta = [data.productCategory, data.projectStage, data.projectOwner].filter(Boolean).map(escapeHtml).join(' · ');
  const competitorProfile = [data.competitorName, data.competitorLegalName, data.competitorLaunchDate, data.competitorFulfillment, data.competitorPrice, data.competitorSizeRange, data.competitorTopSizes].some(Boolean);
  const revenue = revenueMetrics(data.competitorRevenue);
  const hasRevenue = (data.competitorRevenue?.rows || []).some((row) => revenueNumber(row[2]) > 0);
  const hasCompetitorSizes = meaningfulRows(data.competitorSizes).length > 0;
  return `<article class="report-doc dossier-doc"><span class="report-mark">MYWORKSPACE · ДОСЬЕ ИЗДЕЛИЯ</span><h1>${escapeHtml(data.title || 'Разработка товара')}</h1><div class="report-period">${escapeHtml(data.period || formatDate(new Date()))}</div>${meta ? `<p class="report-meta">${meta}</p>` : ''}<div class="report-rule"></div>
  ${data.projectGoal ? `<section><h2>Задача проекта</h2><p>${escapeHtml(data.projectGoal).replace(/\n/g, '<br>')}</p></section>` : ''}
  ${(data.marketVolume || data.averagePrice || data.seasonality) ? `<section><h2>Картина рынка</h2><div class="preview-facts">${data.marketVolume ? `<div><b>${escapeHtml(data.marketVolume)}</b><span>товаров в категории</span></div>` : ''}${data.averagePrice ? `<div><b>${escapeHtml(data.averagePrice)}</b><span>средняя цена</span></div>` : ''}${data.seasonality ? `<div><b>${escapeHtml(data.seasonality)}</b><span>сезонность</span></div>` : ''}</div></section>` : ''}
  ${competitorProfile ? `<section class="preview-competitor"><h2>Профиль конкурента</h2><h3>${escapeHtml(data.competitorName || 'Конкурент')}</h3>${data.competitorLegalName ? `<p class="preview-legal">${escapeHtml(data.competitorLegalName)}</p>` : ''}<div class="preview-facts compact">${data.competitorLaunchDate ? `<div><b>${escapeHtml(readableDate(data.competitorLaunchDate))}</b><span>запуск товара</span></div>` : ''}${data.competitorFulfillment ? `<div><b>${escapeHtml(data.competitorFulfillment)}</b><span>схема работы</span></div>` : ''}${data.competitorPrice ? `<div><b>${escapeHtml(data.competitorPrice)}</b><span>цена</span></div>` : ''}${data.competitorSizeRange ? `<div><b>${escapeHtml(data.competitorSizeRange)}</b><span>размерный ряд</span></div>` : ''}${data.competitorTopSizes ? `<div><b>${escapeHtml(data.competitorTopSizes)}</b><span>лидеры спроса</span></div>` : ''}</div></section>` : ''}
  ${hasCompetitorSizes ? previewTable('Спрос по размерам конкурента', data.competitorSizes) : ''}
  ${hasRevenue ? `<section><h2>Выручка конкурента</h2><div class="preview-facts revenue"><div><b>${money(revenue[2025])}</b><span>2025 год</span></div><div><b>${money(revenue[2026])}</b><span>2026 год</span></div><div><b>${revenue.growth === null ? '—' : `${revenue.growth >= 0 ? '+' : ''}${revenue.growth.toFixed(1).replace('.', ',')}%`}</b><span>динамика</span></div></div>${previewTable('Детализация выручки', data.competitorRevenue, 2)}</section>` : ''}
  ${(data.marketStrengths || data.marketRisks || data.observation) ? `<section><h2>Аналитический вывод</h2>${data.marketStrengths ? `<p><b>Сильные стороны:</b> ${escapeHtml(data.marketStrengths).replace(/\n/g, '<br>')}</p>` : ''}${data.marketRisks ? `<p><b>Риски:</b> ${escapeHtml(data.marketRisks).replace(/\n/g, '<br>')}</p>` : ''}${data.observation ? `<p>${escapeHtml(data.observation).replace(/\n/g, '<br>')}</p>` : ''}</section>` : ''}
  ${data.images.length ? `<section><h2>Материалы</h2><div class="report-images">${data.images.slice(0, 4).map((image) => `<div class="report-image"><img src="${image.src}" alt="" /><small><b>${escapeHtml(image.category || 'Материал')}</b> · ${escapeHtml(image.caption)}</small></div>`).join('')}</div></section>` : ''}
  ${data.fittingNotes ? `<section><h2>Примерка и образцы</h2><p>${escapeHtml(data.fittingNotes).replace(/\n/g, '<br>')}</p></section>` : ''}
  ${previewTable('Замеры', data.measurements, 2)}${previewTable('Экономика', data.economics, 1)}${previewTable('Первый заказ', data.sizes, 1)}
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
  [['#measurementsTable', data.measurements], ['#timelineTable', data.timeline], ['#economicsTable', data.economics], ['#sizesTable', data.sizes], ['#competitorSizesTable', data.competitorSizes], ['#competitorRevenueTable', data.competitorRevenue]].forEach(([selector, table]) => {
    if (!table?.rows?.length) return;
    $(`${selector} tbody`).innerHTML = table.rows.map((row) => `<tr>${row.map((cell) => `<td contenteditable="true">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
  });
  buildReport(false);
  updateRevenueSummary();
  updateProgress();
}

function resetReport() {
  dossierIds.forEach((id) => { $(`#${id}`).value = ''; });
  dossierTables.forEach((selector) => { $(`${selector} tbody`).innerHTML = defaultDossierRows[selector]; });
  reportImages = []; renderImages(); localStorage.removeItem(keys.draft); buildReport(false); updateProgress(); toast('Форма очищена');
  updateRevenueSummary();
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
  $(`${tableSelector} tbody`).append(row); buildReport(false); scheduleDraftSave();
}

let draftSaveTimer;
function scheduleDraftSave() {
  window.clearTimeout(draftSaveTimer);
  draftSaveTimer = window.setTimeout(() => save(keys.draft, { ...reportData(), images: [] }), 450);
}

function updateProgress() {
  const fields = $$('[data-dossier-field]');
  const hasCompetitorSizeData = meaningfulRows(tableData('#competitorSizesTable')).length > 0;
  const hasRevenueData = tableData('#competitorRevenueTable').rows.some((row) => revenueNumber(row[2]) > 0);
  const completed = fields.filter((field) => field.value.trim()).length + (reportImages.length ? 1 : 0) + (hasCompetitorSizeData ? 1 : 0) + (hasRevenueData ? 1 : 0);
  const percent = Math.round((completed / (fields.length + 3)) * 100);
  $('#dossierProgress').textContent = `${percent}%`;
}

function registerWebMcp() {
  if (!navigator.modelContext?.registerTool) return;
  navigator.modelContext.registerTool({
    name: 'open_workspace_section', description: 'Открывает раздел MyWorkspace',
    inputSchema: { type: 'object', properties: { section: { type: 'string', enum: ['home', 'files', 'products', 'analytics', 'store', 'history', 'stock', 'calendar', 'finance', 'knowledge', 'fbs'] } }, required: ['section'] },
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
$('#addCompetitorSize').addEventListener('click', () => addTableRow('#competitorSizesTable', ['—', '—', '—']));
$('#addCompetitorRevenue').addEventListener('click', () => addTableRow('#competitorRevenueTable', ['2026', 'Новый период', '—', '—']));
$$('[data-dossier-field]').forEach((field) => field.addEventListener('input', () => { buildReport(false); updateProgress(); scheduleDraftSave(); }));
$$('.input-table').forEach((table) => table.addEventListener('input', () => { buildReport(false); updateRevenueSummary(); updateProgress(); scheduleDraftSave(); }));
$$('[data-jump]').forEach((button) => button.addEventListener('click', () => {
  const section = $(`#${button.dataset.jump}`); section.open = true; section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));
$('#buildReport').addEventListener('click', () => buildReport(true)); $('#saveDraft').addEventListener('click', saveDraft); $('#resetReport').addEventListener('click', resetReport);
$('#exportPdf').addEventListener('click', () => { buildReport(false); window.print(); }); $('#exportWord').addEventListener('click', exportWord);

$('#today').textContent = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
$('#reportPreview').innerHTML = reportMarkup(reportData()); updateRevenueSummary();
updateFileCounts(); renderFiles(); loadDraft(); updateProgress(); updateProfileUi(); initStoreAnalysis(); initWorkspaceModules({ toast, switchView }); initPetCompanion({ toast }); registerWebMcp();
window.setTimeout(() => {
  $('#welcome')?.remove();
  if (!profile) openProfileModal(false);
  else if (!load(keys.tour, false)) startTour();
}, 2350);
