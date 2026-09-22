import './styles.css';
import { exportAnalyticsDocx } from './docx-export.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const sections = { home: 'Главная', files: 'Мои файлы', analytics: 'Аналитика', fbs: 'FBS · Таблицы' };
const keys = { files: 'myworkspace.files.v1', draft: 'myworkspace.analytics.v1' };
let files = load(keys.files, []);
let activeFileId = null;
let reportImages = [];
let toastTimer;

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

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('is-visible'), 2600);
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
    ? visible.map((file) => `<button class="file-row" data-file-id="${file.id}"><span>□</span><div><strong>${escapeHtml(file.title)}</strong><small>${escapeHtml(file.type)}</small></div><time>${formatDate(file.updatedAt)}</time></button>`).join('')
    : `<div class="files-empty"><div><span>□</span><strong>${query ? 'Ничего не найдено' : 'Пока здесь пусто'}</strong><p>${query ? 'Попробуйте изменить запрос.' : 'Выберите шаблон выше, чтобы создать первый документ.'}</p></div></div>`;
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
    $('#recentFiles').innerHTML = '<span>□</span><div><strong>Здесь появятся ваши документы</strong><p>Создайте первый файл по шаблону или соберите аналитический отчёт.</p></div>';
    return;
  }
  $('#recentFiles').className = 'recent-mini-list';
  $('#recentFiles').innerHTML = files.slice(0, 3).map((file) => `<button data-recent-id="${file.id}"><span>□</span><div><strong>${escapeHtml(file.title)}</strong><small>${formatDate(file.updatedAt)}</small></div><b>→</b></button>`).join('');
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
  return { id: crypto.randomUUID(), src: canvas.toDataURL('image/jpeg', .8), caption: file.name.replace(/\.[^.]+$/, ''), width: canvas.width, height: canvas.height };
}

async function addImages(event) {
  const chosen = [...event.target.files].slice(0, Math.max(0, 6 - reportImages.length));
  if (!chosen.length) return;
  toast('Подготавливаю изображения…');
  reportImages.push(...await Promise.all(chosen.map(prepareImage)));
  renderImages();
  buildReport(false);
  event.target.value = '';
}

function renderImages() {
  $('#imageList').innerHTML = reportImages.map((image) => `<div class="image-item"><img src="${image.src}" alt="" /><input value="${escapeHtml(image.caption)}" data-caption-id="${image.id}" aria-label="Подпись к изображению" /><button data-remove-image="${image.id}" aria-label="Удалить изображение">×</button></div>`).join('');
  $$('[data-caption-id]').forEach((input) => input.addEventListener('input', () => {
    reportImages.find((item) => item.id === input.dataset.captionId).caption = input.value; buildReport(false);
  }));
  $$('[data-remove-image]').forEach((button) => button.addEventListener('click', () => {
    reportImages = reportImages.filter((item) => item.id !== button.dataset.removeImage); renderImages(); buildReport(false);
  }));
}

function tableData() {
  return {
    headers: $$('.input-table thead th').map((cell) => cell.textContent.trim()),
    rows: $$('.input-table tbody tr').map((row) => [...row.cells].map((cell) => cell.textContent.trim()))
  };
}

function reportData() {
  return {
    title: $('#reportTitle').value.trim(), period: $('#reportPeriod').value.trim(), observation: $('#reportObservation').value.trim(),
    conclusion: $('#reportConclusion').value.trim(), actions: $('#reportActions').value.trim(), table: tableData(), images: reportImages
  };
}

function reportMarkup(data, emptyAllowed = true) {
  const hasContent = data.title || data.observation || data.conclusion || data.actions || data.images.length;
  if (!hasContent && emptyAllowed) return '<div class="report-empty"><span>✦</span><strong>Будущий отчёт появится здесь</strong><p>Заполните поля слева — предпросмотр будет обновляться автоматически.</p></div>';
  const actions = data.actions.split('\n').map((line) => line.trim()).filter(Boolean);
  const hasTable = data.table.rows.some((row) => row.some((cell) => cell && cell !== '—' && cell !== 'Наименование' && cell !== 'Результат'));
  const table = hasTable ? `<section><h2>Данные</h2><table class="report-table"><thead><tr>${data.table.headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${data.table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>` : '';
  return `<article class="report-doc"><span class="report-mark">MYWORKSPACE · АНАЛИТИКА</span><h1>${escapeHtml(data.title || 'Аналитический отчёт')}</h1><div class="report-period">${escapeHtml(data.period || formatDate(new Date()))}</div><div class="report-rule"></div>${data.observation ? `<section><h2>Наблюдение</h2><p>${escapeHtml(data.observation).replace(/\n/g, '<br>')}</p></section>` : ''}${data.images.length ? `<section><h2>Материалы</h2><div class="report-images">${data.images.map((image) => `<div class="report-image"><img src="${image.src}" alt="" /><small>${escapeHtml(image.caption)}</small></div>`).join('')}</div></section>` : ''}${table}${data.conclusion ? `<section><h2>Вывод</h2><p>${escapeHtml(data.conclusion).replace(/\n/g, '<br>')}</p></section>` : ''}${actions.length ? `<section><h2>Следующие действия</h2><ul>${actions.map((action) => `<li>${escapeHtml(action.replace(/^[•\-–\d.)\s]+/, ''))}</li>`).join('')}</ul></section>` : ''}</article>`;
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
  const content = [data.observation, data.conclusion, data.actions].filter(Boolean).join('\n\n');
  if (existing) Object.assign(existing, { title: data.title || 'Черновик аналитики', content, updatedAt: now });
  else files.unshift({ id: crypto.randomUUID(), title: data.title || 'Черновик аналитики', type: 'Аналитика', content, createdAt: now, updatedAt: now, analyticsDraft: true });
  save(keys.files, files); updateFileCounts(); toast('Черновик сохранён в «Мои файлы»');
}

function loadDraft() {
  const data = load(keys.draft, null);
  if (!data) return;
  $('#reportTitle').value = data.title || ''; $('#reportPeriod').value = data.period || '';
  $('#reportObservation').value = data.observation || ''; $('#reportConclusion').value = data.conclusion || ''; $('#reportActions').value = data.actions || '';
  buildReport(false);
}

function resetReport() {
  ['#reportTitle', '#reportPeriod', '#reportObservation', '#reportConclusion', '#reportActions'].forEach((selector) => $(selector).value = '');
  reportImages = []; renderImages(); localStorage.removeItem(keys.draft); buildReport(false); toast('Форма очищена');
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
    button.textContent = 'DOCX / Google Документы';
  }
}

function safeName(name) { return name.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80) || 'Аналитика'; }

function addTableRow() {
  const row = document.createElement('tr');
  row.innerHTML = '<td contenteditable="true">Новый показатель</td><td contenteditable="true">—</td><td contenteditable="true">—</td>';
  $('#analyticsTable').append(row); buildReport(false);
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
$('#fileSearch').addEventListener('input', renderFiles);
$('#closeEditor').addEventListener('click', closeEditor); $('#deleteFile').addEventListener('click', deleteFile);
$('#fileTitle').addEventListener('input', saveActiveFile); $('#fileContent').addEventListener('input', saveActiveFile);
$('#imageUpload').addEventListener('change', addImages); $('#addRow').addEventListener('click', addTableRow);
['#reportTitle', '#reportPeriod', '#reportObservation', '#reportConclusion', '#reportActions'].forEach((selector) => $(selector).addEventListener('input', () => buildReport(false)));
$('.input-table').addEventListener('input', () => buildReport(false));
$('#buildReport').addEventListener('click', () => buildReport(true)); $('#saveDraft').addEventListener('click', saveDraft); $('#resetReport').addEventListener('click', resetReport);
$('#exportPdf').addEventListener('click', () => { buildReport(false); window.print(); }); $('#exportWord').addEventListener('click', exportWord);

$('#today').textContent = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
$('#reportPreview').innerHTML = reportMarkup(reportData());
updateFileCounts(); renderFiles(); loadDraft(); registerWebMcp();
window.setTimeout(() => $('#welcome')?.remove(), 2500);
