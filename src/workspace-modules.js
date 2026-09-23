const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = () => dateKey(new Date());
const uid = () => crypto.randomUUID();
const keys = {
  products: 'myworkspace.products.v1', history: 'myworkspace.analysis-history.v1', stockSettings: 'myworkspace.stock-settings.v1',
  calendar: 'myworkspace.calendar.v1', finance: 'myworkspace.finance.v1', knowledge: 'myworkspace.knowledge.v1',
};

let notify = () => {};
let navigate = () => {};
let activeHistoryId = null;
let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { notify('Недостаточно места для сохранения'); return false; }
}

function download(name, content, type = 'application/json;charset=utf-8') {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name; link.click(); URL.revokeObjectURL(link.href);
}

function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', options).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function openModal({ eyebrow = 'MYWORKSPACE', title, body, onSubmit, submitText = 'Сохранить', wide = false, dangerText = '', onDanger = null }) {
  const modal = $('#moduleModal');
  $('#moduleModalEyebrow').textContent = eyebrow; $('#moduleModalTitle').textContent = title;
  modal.querySelector('.module-dialog').classList.toggle('is-wide', wide);
  $('#moduleModalBody').innerHTML = `<form class="module-form" id="moduleForm">${body}<div class="module-form-actions">${dangerText ? `<button type="button" class="danger-text module-danger" data-modal-danger>${dangerText}</button>` : ''}<button type="button" class="ghost-button" data-close-modal>Отмена</button><button type="submit" class="primary-action">${submitText}</button></div></form>`;
  modal.classList.remove('is-hidden'); document.body.style.overflow = 'hidden';
  $('#moduleForm').addEventListener('submit', async (event) => { event.preventDefault(); const ok = await onSubmit(new FormData(event.currentTarget), event.currentTarget); if (ok !== false) closeModal(); });
  modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
  modal.querySelector('[data-modal-danger]')?.addEventListener('click', () => { if (onDanger?.() !== false) closeModal(); });
  window.setTimeout(() => $('#moduleForm input:not([type="hidden"]), #moduleForm textarea')?.focus(), 30);
}

function closeModal() {
  $('#moduleModal').classList.add('is-hidden'); document.body.style.overflow = '';
}

function emptyState(icon, title, text, action = '') {
  return `<div class="module-empty"><span><svg><use href="#icon-${icon}"/></svg></span><h3>${title}</h3><p>${text}</p>${action}</div>`;
}

// Products
function products() { return load(keys.products, []); }
function setProducts(items) { save(keys.products, items); $('#productsCount').textContent = items.length; }

function productForm(item = {}) {
  return `<div class="module-form-grid two"><label><span>Артикул продавца *</span><input name="sku" required value="${escapeHtml(item.sku)}" placeholder="211_КБрюки_жилет_бежевый"></label><label><span>Название товара *</span><input name="name" required value="${escapeHtml(item.name)}" placeholder="Костюм женский брючный"></label></div>
    <div class="module-form-grid three"><label><span>Бренд</span><input name="brand" value="${escapeHtml(item.brand)}" placeholder="Beltanee"></label><label><span>Категория</span><input name="category" value="${escapeHtml(item.category)}" placeholder="Костюмы"></label><label><span>Этап</span><select name="stage">${['В продаже','Подготовка запуска','Разработка','Приостановлен','Архив'].map((value) => `<option ${item.stage === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div>
    <div class="module-form-grid two"><label><span>Ответственный</span><input name="owner" value="${escapeHtml(item.owner)}" placeholder="Имя сотрудника"></label><label><span>Артикул WB</span><input name="wb" value="${escapeHtml(item.wb)}" placeholder="370305326"></label></div>
    <label><span>Рабочая заметка</span><textarea name="notes" rows="5" placeholder="Особенности товара, изменения и договорённости">${escapeHtml(item.notes)}</textarea></label>
    <label class="compact-upload"><span>Обложка товара</span><input name="cover" type="file" accept="image/*"><small>Необязательно · до 1,5 МБ</small></label><input type="hidden" name="existingCover" value="${escapeHtml(item.cover)}">`;
}

async function coverFromForm(formData) {
  const file = formData.get('cover');
  if (!file?.size) return formData.get('existingCover') || '';
  if (file.size > 1.5 * 1024 * 1024) { notify('Изображение больше 1,5 МБ'); return null; }
  return await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); });
}

function editProduct(id = null) {
  const list = products(); const item = list.find((product) => product.id === id) || {};
  openModal({ eyebrow: 'КАРТОЧКА ТОВАРА', title: id ? 'Редактировать товар' : 'Новый товар', body: productForm(item), wide: true, dangerText: id ? 'Удалить товар' : '', onDanger: () => { if (!confirm('Удалить карточку товара?')) return false; setProducts(list.filter((product) => product.id !== id)); renderProducts(); renderFinance(); notify('Товар удалён'); }, onSubmit: async (data) => {
    const cover = await coverFromForm(data); if (cover === null) return false;
    const sku = String(data.get('sku')).trim();
    if (list.some((product) => product.sku.toLowerCase() === sku.toLowerCase() && product.id !== id)) { notify('Товар с таким артикулом уже существует'); return false; }
    const record = { id: id || uid(), sku, name: String(data.get('name')).trim(), brand: String(data.get('brand')).trim(), category: String(data.get('category')).trim(), stage: String(data.get('stage')), owner: String(data.get('owner')).trim(), wb: String(data.get('wb')).trim(), notes: String(data.get('notes')).trim(), cover, createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    const next = id ? list.map((product) => product.id === id ? record : product) : [record, ...list]; setProducts(next); renderProducts(); renderFinance(); notify(id ? 'Карточка обновлена' : 'Товар добавлен');
  }});
}

function renderProducts() {
  const root = $('#productsWorkspace'); if (!root) return;
  const list = products(); $('#productsCount').textContent = list.length;
  if (!list.length) { root.innerHTML = emptyState('product', 'Каталог пока пуст', 'Добавьте товар вручную или сформируйте «Анализ магазина» — найденные артикулы появятся здесь автоматически.', '<button class="primary-action" data-empty-product>＋ Добавить первый товар</button>'); root.querySelector('[data-empty-product]')?.addEventListener('click', () => editProduct()); return; }
  const query = root.querySelector('#productCatalogSearch')?.value || '';
  const stages = Object.entries(list.reduce((acc, item) => ({ ...acc, [item.stage || 'В продаже']: (acc[item.stage || 'В продаже'] || 0) + 1 }), {}));
  const latestProducts = new Map((latestSnapshot()?.products || []).map((item) => [item.sku, item]));
  root.innerHTML = `<div class="module-summary-grid"><article><span>Всего товаров</span><strong>${list.length}</strong><small>${new Set(list.map((item) => item.brand).filter(Boolean)).size} брендов</small></article><article><span>В продаже</span><strong>${list.filter((item) => item.stage === 'В продаже').length}</strong><small>активные карточки</small></article><article><span>В разработке</span><strong>${list.filter((item) => /Разработка|Подготовка/.test(item.stage)).length}</strong><small>до запуска</small></article><article><span>Обновлено сегодня</span><strong>${list.filter((item) => item.updatedAt?.slice(0,10) === today()).length}</strong><small>карточек</small></article></div>
    <div class="module-toolbar"><div class="status-pills">${stages.map(([stage,count]) => `<span>${escapeHtml(stage)} <b>${count}</b></span>`).join('')}</div><label class="module-search"><span>⌕</span><input id="productCatalogSearch" type="search" value="${escapeHtml(query)}" placeholder="Артикул, название или бренд"></label></div><div class="product-catalog" id="productCatalog"></div>`;
  const renderCatalog = () => {
    const text = ($('#productCatalogSearch').value || '').toLowerCase();
    const filtered = list.filter((item) => `${item.sku} ${item.name} ${item.brand} ${item.category}`.toLowerCase().includes(text));
    $('#productCatalog').innerHTML = filtered.map((item) => { const metric = latestProducts.get(item.sku); return `<article class="catalog-card"><div class="catalog-cover">${item.cover ? `<img src="${item.cover}" alt="">` : `<svg><use href="#icon-product"/></svg>`}<span>${escapeHtml(item.stage || 'В продаже')}</span></div><div class="catalog-body"><small>${escapeHtml(item.brand || 'Без бренда')} · ${escapeHtml(item.category || 'Категория не указана')}</small><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.sku)}${item.wb ? ` · WB ${escapeHtml(item.wb)}` : ''}</p>${metric ? `<dl class="catalog-metrics"><div><dt>Заказы</dt><dd>${number.format(metric.current)}</dd></div><div><dt>Изменение</dt><dd class="${metric.delta >= 0 ? 'positive' : 'negative'}">${metric.delta > 0 ? '+' : ''}${number.format(metric.delta)}</dd></div><div><dt>Остаток</dt><dd>${metric.stock === null ? '—' : number.format(metric.stock)}</dd></div></dl>` : ''}<div><span>${item.owner ? `Ответственный: ${escapeHtml(item.owner)}` : 'Ответственный не назначен'}</span><button data-edit-product="${item.id}">Открыть →</button></div></div></article>`; }).join('') || emptyState('product', 'Ничего не найдено', 'Измените запрос и попробуйте снова.');
    $('#productCatalog').querySelectorAll('[data-edit-product]').forEach((button) => button.addEventListener('click', () => editProduct(button.dataset.editProduct)));
  };
  $('#productCatalogSearch').addEventListener('input', renderCatalog); renderCatalog();
}

// Analysis history
function compactSnapshot(analysis) {
  const sales = analysis.sales; const search = analysis.primarySearch?.overall;
  return { id: uid(), createdAt: new Date().toISOString(), title: `Анализ от ${new Date().toLocaleDateString('ru-RU')}`, sources: analysis.reports.map((item) => item.fileName), coverage: analysis.coverage,
    metrics: { orders: sales?.current.orders ?? search?.orders ?? 0, ordersPrev: sales?.previous.orders ?? search?.ordersPrev ?? 0, amount: sales?.current.amount ?? 0, amountPrev: sales?.previous.amount ?? 0, clicks: search?.clicks ?? 0, clicksPrev: search?.clicksPrev ?? 0, visibility: search?.visibility ?? 0, visibilityPrev: search?.visibilityPrev ?? 0, stockTotal: analysis.stockTotal },
    products: analysis.products.map((item) => ({ sku: item.sku, name: item.name, brand: item.brand, current: item.current, previous: item.previous, delta: item.delta, deltaPct: item.deltaPct, factor: item.diagnosis.conclusion, confidence: item.diagnosis.confidence, stock: item.stock?.stock ?? null, sizes: item.stock?.sizes ?? null, emptySizes: item.stock?.emptySizes ?? null, daysCover: item.daysCover || 0 })),
  };
}

function history() { return load(keys.history, []); }
function storeSnapshot(analysis) {
  const snapshot = compactSnapshot(analysis); const list = [snapshot, ...history()].slice(0, 20); save(keys.history, list); activeHistoryId = snapshot.id;
  const current = products(); const bySku = new Map(current.map((item) => [item.sku, item]));
  snapshot.products.forEach((item) => { if (!bySku.has(item.sku)) bySku.set(item.sku, { id: uid(), sku: item.sku, name: item.name || item.sku, brand: item.brand, category: '', stage: 'В продаже', owner: '', wb: '', notes: '', cover: '', createdAt: snapshot.createdAt, updatedAt: snapshot.createdAt }); });
  setProducts([...bySku.values()]); renderHistory(); renderStock(); renderProducts(); renderFinance();
}

function historyDelta(current, previous) { return previous ? (current - previous) / Math.abs(previous) * 100 : current ? 100 : 0; }
function metricDelta(value) { return `<b class="${value > 0 ? 'positive' : value < 0 ? 'negative' : ''}">${value > 0 ? '+' : ''}${one.format(value)}%</b>`; }

function renderHistory() {
  const root = $('#historyWorkspace'); if (!root) return; const list = history();
  if (!list.length) { root.innerHTML = emptyState('history', 'История начнётся после первого анализа', 'Загрузите отчёты WB в разделе «Анализ магазина». Итоговый срез сохранится здесь автоматически.', '<button class="primary-action" data-open-analysis>Перейти к анализу магазина</button>'); root.querySelector('[data-open-analysis]')?.addEventListener('click', () => navigate('store')); return; }
  if (!activeHistoryId || !list.some((item) => item.id === activeHistoryId)) activeHistoryId = list[0].id;
  const active = list.find((item) => item.id === activeHistoryId); const m = active.metrics; const index = list.findIndex((item) => item.id === active.id); const older = list[index + 1];
  const savedComparison = older ? `<div class="saved-comparison"><span>Изменение между сохранёнными проверками</span><div><b>Заказы ${metricDelta(historyDelta(m.orders, older.metrics.orders))}</b><b>Сумма ${metricDelta(historyDelta(m.amount, older.metrics.amount))}</b><b>Остаток ${metricDelta(historyDelta(m.stockTotal, older.metrics.stockTotal))}</b></div><small>${formatDate(older.createdAt.slice(0,10))} → ${formatDate(active.createdAt.slice(0,10))}</small></div>` : '<div class="saved-comparison is-muted"><span>Сравнение между проверками появится после следующего анализа</span></div>';
  root.innerHTML = `<div class="history-layout"><aside class="history-list"><div class="history-list-head"><span>СОХРАНЁННЫЕ СРЕЗЫ</span><b>${list.length}/20</b></div>${list.map((item) => `<button class="history-item ${item.id === active.id ? 'is-active' : ''}" data-history="${item.id}"><span>${formatDate(item.createdAt.slice(0,10))}</span><strong>${number.format(item.metrics.orders)} заказов</strong><small>${item.coverage.search} поисковых периода · ${item.products.length} товаров</small></button>`).join('')}</aside><section class="history-detail"><div class="history-title"><div><span class="eyebrow">СОХРАНЁННЫЙ ОТЧЁТ</span><h2>${escapeHtml(active.title)}</h2><p>${active.sources.length} источников · ${active.products.length} товаров</p></div><button class="danger-text" data-delete-history="${active.id}">Удалить</button></div>${savedComparison}<div class="module-summary-grid compact"><article><span>Заказы</span><strong>${number.format(m.orders)}</strong><small>${metricDelta(historyDelta(m.orders,m.ordersPrev))} к прошлому периоду</small></article><article><span>Сумма заказов</span><strong>${money.format(m.amount)}</strong><small>${metricDelta(historyDelta(m.amount,m.amountPrev))}</small></article><article><span>Переходы</span><strong>${number.format(m.clicks)}</strong><small>${metricDelta(historyDelta(m.clicks,m.clicksPrev))}</small></article><article><span>Остаток</span><strong>${number.format(m.stockTotal)}</strong><small>текущий срез, шт.</small></article></div><div class="history-columns"><div><h3>Наибольшее снижение</h3>${active.products.filter((item) => item.delta < 0).sort((a,b)=>a.delta-b.delta).slice(0,8).map(historyProductLine).join('') || '<p class="muted">Снижения не найдено</p>'}</div><div><h3>Наибольший рост</h3>${active.products.filter((item) => item.delta > 0).sort((a,b)=>b.delta-a.delta).slice(0,8).map(historyProductLine).join('') || '<p class="muted">Роста не найдено</p>'}</div></div></section></div>`;
  root.querySelectorAll('[data-history]').forEach((button) => button.addEventListener('click', () => { activeHistoryId = button.dataset.history; renderHistory(); }));
  root.querySelector('[data-delete-history]')?.addEventListener('click', () => { if (!confirm('Удалить этот сохранённый анализ?')) return; save(keys.history, list.filter((item) => item.id !== active.id)); activeHistoryId = null; renderHistory(); renderStock(); notify('Анализ удалён'); });
}

function historyProductLine(item) { return `<div class="history-product"><span><strong>${escapeHtml(item.sku)}</strong><small>${escapeHtml(item.factor)}</small></span><b class="${item.delta > 0 ? 'positive' : 'negative'}">${item.delta > 0 ? '+' : ''}${number.format(item.delta)}</b></div>`; }

// Stock
function latestSnapshot() { return history()[0] || null; }
function stockStatus(item, settings) {
  if (item.stock === null) return { key: 'unknown', label: 'Нет данных' };
  if (item.stock <= 0 || item.emptySizes === item.sizes) return { key: 'zero', label: 'Нет в наличии' };
  if (!item.daysCover && item.current <= 0) return { key: 'unknown', label: 'Нет темпа' };
  if (item.daysCover && item.daysCover < settings.critical) return { key: 'critical', label: 'Критический' };
  if (item.daysCover > settings.excess) return { key: 'excess', label: 'Избыток' };
  if (item.emptySizes > 0) return { key: 'sizes', label: 'Неполный ряд' };
  return { key: 'healthy', label: 'Достаточно' };
}

function stockData() { const snapshot = latestSnapshot(); return snapshot ? snapshot.products.filter((item) => item.stock !== null).map((item) => ({ ...item, status: stockStatus(item, load(keys.stockSettings,{critical:14,excess:90})) })) : []; }
function renderStock() {
  const root = $('#stockWorkspace'); if (!root) return; const snapshot = latestSnapshot();
  if (!snapshot) { root.innerHTML = emptyState('stock', 'Нет актуального среза остатков', 'Сформируйте анализ магазина с файлом текущих остатков. Раздел обновится автоматически.', '<button class="primary-action" data-open-analysis>Загрузить отчёты</button>'); root.querySelector('[data-open-analysis]')?.addEventListener('click', () => navigate('store')); return; }
  const settings = load(keys.stockSettings,{critical:14,excess:90}); const data = stockData();
  const counts = (key) => data.filter((item) => item.status.key === key).length;
  root.innerHTML = `<div class="module-summary-grid"><article class="danger-summary"><span>Нет в наличии</span><strong>${counts('zero')}</strong><small>товаров</small></article><article class="warning-summary"><span>Критический запас</span><strong>${counts('critical')}</strong><small>менее ${settings.critical} дней</small></article><article><span>Неполный размерный ряд</span><strong>${counts('sizes')}</strong><small>есть нулевые размеры</small></article><article><span>Избыточный запас</span><strong>${counts('excess')}</strong><small>более ${settings.excess} дней</small></article></div><div class="module-toolbar stock-toolbar"><div class="status-pills"><button class="is-active" data-stock-filter="risk">Требуют внимания</button><button data-stock-filter="all">Все товары</button><button data-stock-filter="healthy">Достаточно</button></div><div class="thresholds"><label>Критично до <input id="criticalDays" type="number" min="1" max="90" value="${settings.critical}"> дней</label><label>Избыток от <input id="excessDays" type="number" min="30" max="365" value="${settings.excess}"> дней</label></div></div><div class="data-table stock-table"><div class="data-table-head"><span>Товар</span><span>Остаток</span><span>Размеры</span><span>Запас</span><span>Статус</span></div><div id="stockRows"></div></div><p class="data-caption">Срез от ${formatDate(snapshot.createdAt.slice(0,10))}. Запас в днях рассчитывается по заказам последнего сравниваемого периода и служит ориентиром, а не прогнозом.</p>`;
  let filter = 'risk'; const draw = () => { const items = filter === 'all' ? data : filter === 'healthy' ? data.filter((item) => item.status.key === 'healthy') : data.filter((item) => !['healthy','unknown'].includes(item.status.key)); $('#stockRows').innerHTML = items.sort((a,b) => (a.daysCover || 9999) - (b.daysCover || 9999)).map((item) => `<div class="data-row"><span><strong>${escapeHtml(item.sku)}</strong><small>${escapeHtml(item.name)}</small></span><span><strong>${number.format(item.stock)} шт.</strong></span><span>${item.sizes ? `${item.sizes-item.emptySizes} из ${item.sizes}` : '—'}</span><span>${item.daysCover ? `${one.format(item.daysCover)} дн.` : 'нет темпа'}</span><span><b class="stock-status ${item.status.key}">${item.status.label}</b></span></div>`).join('') || '<div class="table-empty">В этой категории товаров нет</div>'; };
  root.querySelectorAll('[data-stock-filter]').forEach((button) => button.addEventListener('click', () => { filter = button.dataset.stockFilter; root.querySelectorAll('[data-stock-filter]').forEach((item) => item.classList.toggle('is-active', item === button)); draw(); }));
  ['criticalDays','excessDays'].forEach((id) => $(`#${id}`).addEventListener('change', () => { save(keys.stockSettings,{critical:Number($('#criticalDays').value)||14,excess:Number($('#excessDays').value)||90}); renderStock(); })); draw();
}

// Calendar
function events() { return load(keys.calendar, []); }
function setEvents(items) { save(keys.calendar, items); updateCalendarCount(items); }
function updateCalendarCount(items = events()) { $('#calendarCount').textContent = items.filter((item) => item.status !== 'Готово' && item.date <= today()).length; }
function eventForm(item = {}, presetDate = '') {
  const productOptions = products().map((product) => `<option value="${escapeHtml(product.sku)}" ${item.sku === product.sku ? 'selected' : ''}>${escapeHtml(product.sku)} · ${escapeHtml(product.name)}</option>`).join('');
  return `<label><span>Название события *</span><input name="title" required value="${escapeHtml(item.title)}" placeholder="Повторный анализ магазина"></label><div class="module-form-grid three"><label><span>Дата *</span><input name="date" type="date" required value="${item.date || presetDate || today()}"></label><label><span>Тип</span><select name="type">${['Поставка','Перемещение','Примерка','Запуск','Анализ','Акция','Другое'].map((value)=>`<option ${item.type===value?'selected':''}>${value}</option>`).join('')}</select></label><label><span>Статус</span><select name="status">${['Запланировано','В работе','Готово'].map((value)=>`<option ${item.status===value?'selected':''}>${value}</option>`).join('')}</select></label></div><label><span>Товар</span><select name="sku"><option value="">Без привязки к товару</option>${productOptions}</select></label><label><span>Комментарий</span><textarea name="notes" rows="4" placeholder="Что нужно подготовить и проверить">${escapeHtml(item.notes)}</textarea></label>`;
}
function editEvent(id = null, presetDate = '') {
  const list = events(); const item = list.find((event) => event.id === id) || {};
  openModal({ eyebrow:'КАЛЕНДАРЬ', title:id?'Редактировать событие':'Новое событие', body:eventForm(item,presetDate), dangerText:id?'Удалить событие':'', onDanger:()=>{if(!confirm('Удалить событие?'))return false;setEvents(list.filter((event)=>event.id!==id));renderCalendar();notify('Событие удалено');}, onSubmit:(data)=>{ const record={id:id||uid(),title:String(data.get('title')).trim(),date:String(data.get('date')),type:String(data.get('type')),status:String(data.get('status')),sku:String(data.get('sku')),notes:String(data.get('notes')).trim()}; setEvents(id?list.map((event)=>event.id===id?record:event):[...list,record]); renderCalendar(); notify(id?'Событие обновлено':'Событие добавлено'); }});
}
function isoDate(year, month, day) { return dateKey(new Date(year, month, day)); }
function renderCalendar() {
  const root=$('#calendarWorkspace'); if(!root)return; const list=events(); updateCalendarCount(list);
  const y=calendarCursor.getFullYear(), m=calendarCursor.getMonth(); const first=(new Date(y,m,1).getDay()+6)%7; const days=new Date(y,m+1,0).getDate(); const previousDays=new Date(y,m,0).getDate();
  const cells=[]; for(let i=first-1;i>=0;i--) cells.push({day:previousDays-i,muted:true,date:isoDate(y,m-1,previousDays-i)}); for(let d=1;d<=days;d++) cells.push({day:d,date:isoDate(y,m,d)}); while(cells.length%7) {const d=cells.length-first-days+1; cells.push({day:d,muted:true,date:isoDate(y,m+1,d)});}
  const upcoming=[...list].filter((item)=>item.status!=='Готово').sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8);
  root.innerHTML=`<div class="calendar-layout"><section class="calendar-card"><div class="calendar-head"><button data-cal-prev aria-label="Предыдущий месяц">←</button><div><strong>${new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(calendarCursor)}</strong><button data-cal-today>Сегодня</button></div><button data-cal-next aria-label="Следующий месяц">→</button></div><div class="weekdays">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d)=>`<span>${d}</span>`).join('')}</div><div class="month-grid">${cells.map((cell)=>{const dayEvents=list.filter((item)=>item.date===cell.date);return `<button class="calendar-day ${cell.muted?'is-muted':''} ${cell.date===today()?'is-today':''}" data-calendar-date="${cell.date}"><span>${cell.day}</span>${dayEvents.slice(0,3).map((item)=>`<i class="event-dot ${item.type.toLowerCase()}">${escapeHtml(item.title)}</i>`).join('')}${dayEvents.length>3?`<small>+${dayEvents.length-3}</small>`:''}</button>`;}).join('')}</div></section><aside class="agenda-card"><div class="agenda-head"><span class="eyebrow">БЛИЖАЙШИЕ СОБЫТИЯ</span><strong>${upcoming.length}</strong></div><div class="agenda-list">${upcoming.map((item)=>`<button data-edit-event="${item.id}" class="agenda-item ${item.date<today()?'is-overdue':''}"><span>${formatDate(item.date,{day:'2-digit',month:'short'})}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.type)}${item.sku?` · ${escapeHtml(item.sku)}`:''}</small></div><b>${item.status}</b></button>`).join('')||'<p class="muted">Ближайших событий нет</p>'}</div></aside></div>`;
  root.querySelector('[data-cal-prev]').addEventListener('click',()=>{calendarCursor=new Date(y,m-1,1);renderCalendar();}); root.querySelector('[data-cal-next]').addEventListener('click',()=>{calendarCursor=new Date(y,m+1,1);renderCalendar();}); root.querySelector('[data-cal-today]').addEventListener('click',()=>{calendarCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderCalendar();}); root.querySelectorAll('[data-calendar-date]').forEach((button)=>button.addEventListener('click',()=>editEvent(null,button.dataset.calendarDate))); root.querySelectorAll('[data-edit-event]').forEach((button)=>button.addEventListener('click',()=>editEvent(button.dataset.editEvent)));
}

// Finance
function financeItems(){return load(keys.finance,[]);} function financeCalc(data){const list=num(data.listPrice),discount=num(data.discount),commission=num(data.commission),logistics=num(data.logistics),tax=num(data.tax),cogs=num(data.cogs),other=num(data.other),orders=num(data.orders);const price=list*(1-discount/100),fee=price*commission/100,taxValue=price*tax/100,payout=price-fee-logistics-taxValue-other,profit=payout-cogs,margin=price?profit/price*100:0,roi=cogs?profit/cogs*100:0,denom=1-(commission+tax)/100,breakEven=denom>0?(cogs+logistics+other)/denom:0;return{price,fee,taxValue,payout,profit,margin,roi,breakEven,totalProfit:profit*orders};} const num=(value)=>Number(value)||0;
function renderFinance(){const root=$('#financeWorkspace');if(!root)return;const saved=financeItems();const opts=products().map((item)=>`<option value="${escapeHtml(item.sku)}">${escapeHtml(item.sku)} · ${escapeHtml(item.name)}</option>`).join('');root.innerHTML=`<div class="finance-layout"><section class="finance-calculator"><div class="finance-head"><span class="eyebrow">РАСЧЁТ СЦЕНАРИЯ</span><h2>Экономика одной единицы</h2></div><form id="financeForm"><label><span>Товар</span><select name="sku"><option value="">Без привязки</option>${opts}</select></label><div class="finance-inputs"><label><span>Цена до скидки, ₽</span><input name="listPrice" type="number" min="0" step="1" value="6000"></label><label><span>Скидка, %</span><input name="discount" type="number" min="0" max="99" step="0.1" value="10"></label><label><span>Себестоимость, ₽</span><input name="cogs" type="number" min="0" step="1" value="1800"></label><label><span>Комиссия WB, %</span><input name="commission" type="number" min="0" max="100" step="0.1" value="25"></label><label><span>Логистика, ₽</span><input name="logistics" type="number" min="0" step="1" value="350"></label><label><span>Налог, %</span><input name="tax" type="number" min="0" max="100" step="0.1" value="6"></label><label><span>Другие расходы, ₽</span><input name="other" type="number" min="0" step="1" value="100"></label><label><span>План заказов, шт.</span><input name="orders" type="number" min="0" step="1" value="100"></label></div><button class="primary-action" type="submit">Сохранить сценарий</button></form></section><aside class="finance-result" id="financeResult"></aside></div><section class="scenario-section"><div class="store-section-head"><div><span class="eyebrow">СОХРАНЁННЫЕ СЦЕНАРИИ</span><h3>Сравнение вариантов</h3></div><span>${saved.length} сценариев</span></div><div class="scenario-grid">${saved.map((item)=>{const r=financeCalc(item);return `<article><div><span>${escapeHtml(item.sku||'Без товара')}</span><button data-delete-finance="${item.id}">×</button></div><strong>${money.format(r.profit)} <small>прибыль/шт.</small></strong><dl><div><dt>Цена</dt><dd>${money.format(r.price)}</dd></div><div><dt>Маржа</dt><dd class="${r.margin<15?'negative':'positive'}">${one.format(r.margin)}%</dd></div><div><dt>ROI</dt><dd>${one.format(r.roi)}%</dd></div><div><dt>План</dt><dd>${money.format(r.totalProfit)}</dd></div></dl><button class="scenario-load" data-load-finance="${item.id}">Открыть в калькуляторе</button></article>`;}).join('')||emptyState('finance','Сценариев пока нет','Заполните калькулятор и сохраните первый вариант.')}</div></section>`;
  const form=$('#financeForm');const draw=()=>{const data=Object.fromEntries(new FormData(form));const r=financeCalc(data);$('#financeResult').innerHTML=`<span class="eyebrow">РЕЗУЛЬТАТ</span><div class="profit-orbit ${r.profit<0?'is-loss':''}"><small>Прибыль с единицы</small><strong>${money.format(r.profit)}</strong><span>${r.profit>=0?'положительная экономика':'убыточный сценарий'}</span></div><div class="finance-kpis"><div><span>Цена покупателя</span><b>${money.format(r.price)}</b></div><div><span>К выплате до себестоимости</span><b>${money.format(r.payout)}</b></div><div><span>Маржинальность</span><b>${one.format(r.margin)}%</b></div><div><span>Рентабельность</span><b>${one.format(r.roi)}%</b></div><div><span>Минимальная цена</span><b>${money.format(r.breakEven)}</b></div><div><span>Прибыль по плану</span><b>${money.format(r.totalProfit)}</b></div></div><p>Расчёт ориентировочный. Он учитывает введённые значения и не заменяет финансовый отчёт Wildberries.</p>`;};form.addEventListener('input',draw);form.addEventListener('submit',(event)=>{event.preventDefault();const record={id:uid(),...Object.fromEntries(new FormData(form)),createdAt:new Date().toISOString()};save(keys.finance,[record,...saved].slice(0,30));renderFinance();notify('Сценарий сохранён');});root.querySelectorAll('[data-delete-finance]').forEach((button)=>button.addEventListener('click',()=>{save(keys.finance,saved.filter((item)=>item.id!==button.dataset.deleteFinance));renderFinance();}));root.querySelectorAll('[data-load-finance]').forEach((button)=>button.addEventListener('click',()=>{const item=saved.find((entry)=>entry.id===button.dataset.loadFinance);if(!item)return;Object.entries(item).forEach(([name,value])=>{const field=form.elements.namedItem(name);if(field)field.value=value;});draw();form.scrollIntoView({behavior:'smooth',block:'start'});notify('Сценарий открыт в калькуляторе');}));draw();}

// Knowledge base
const starterKnowledge=[
  {title:'Как читать анализ магазина',category:'Аналитика',content:'Начните с общего изменения заказов.\n\nЗатем проверьте воронку: показы, переходы, корзина и заказ.\n\nОткройте товары с наибольшим снижением и проверьте подтверждённые сигналы.\n\nНе считайте текущий остаток доказанной причиной изменения без исторического среза.'},
  {title:'Проверка снижения заказов',category:'Чек-листы',content:'1. Сравнить равные завершённые периоды.\n2. Найти товары с наибольшим вкладом в снижение.\n3. Проверить спрос и видимость.\n4. Проверить переходы и конверсию карточки.\n5. Проверить размерные остатки.\n6. Зафиксировать одно изменение и дату повторной проверки.'},
  {title:'Подготовка перемещения FBS',category:'FBS',content:'1. Проверить актуальность остатков.\n2. Сформировать список товаров и размеров.\n3. Проверить количество и адрес хранения.\n4. Зафиксировать дату и ответственного.\n5. После перемещения обновить статус в рабочей таблице.'},
  {title:'Карточка нового товара',category:'Товары',content:'Заполните артикул, название, бренд и категорию.\n\nДобавьте ответственного и этап разработки.\n\nЗафиксируйте решения по образцам, размерам, цене и запуску.\n\nПосле старта продаж назначьте дату первого анализа.'},
  {title:'Еженедельный контроль магазина',category:'Чек-листы',content:'1. Загрузить динамику продаж и текущие остатки.\n2. Добавить недельную аналитику поиска.\n3. Сохранить сформированный анализ.\n4. Проверить критические остатки.\n5. Создать контрольные события в календаре.\n6. Через неделю сравнить результат.'},
].map((item,index)=>({id:`starter-${index}`,favorite:index<2,system:true,updatedAt:new Date().toISOString(),...item}));
function knowledge(){const stored=load(keys.knowledge,null);if(stored)return stored;save(keys.knowledge,starterKnowledge);return starterKnowledge;}
function knowledgeForm(item={}){return `<div class="module-form-grid two"><label><span>Название *</span><input name="title" required value="${escapeHtml(item.title)}" placeholder="Название инструкции"></label><label><span>Категория</span><select name="category">${['Аналитика','Чек-листы','FBS','Товары','Финансы','Общее'].map((value)=>`<option ${item.category===value?'selected':''}>${value}</option>`).join('')}</select></label></div><label><span>Содержание *</span><textarea name="content" rows="15" required placeholder="Шаги, правила и важные замечания">${escapeHtml(item.content)}</textarea></label>`;}
function editKnowledge(id=null){const list=knowledge(),item=list.find((record)=>record.id===id)||{};openModal({eyebrow:'БАЗА ЗНАНИЙ',title:id?'Редактировать инструкцию':'Новая инструкция',body:knowledgeForm(item),wide:true,onSubmit:(data)=>{const record={id:id||uid(),title:String(data.get('title')).trim(),category:String(data.get('category')),content:String(data.get('content')).trim(),favorite:item.favorite||false,system:false,updatedAt:new Date().toISOString()};save(keys.knowledge,id?list.map((entry)=>entry.id===id?record:entry):[record,...list]);renderKnowledge();notify(id?'Инструкция обновлена':'Инструкция добавлена');}});}
function articleMarkup(content){return content.split(/\n+/).filter(Boolean).map((line)=>/^\d+\./.test(line)?`<li>${escapeHtml(line.replace(/^\d+\.\s*/,''))}</li>`:`<p>${escapeHtml(line)}</p>`).join('').replace(/(<li>[\s\S]*<\/li>)/,'<ol>$1</ol>');}
function renderKnowledge(){const root=$('#knowledgeWorkspace');if(!root)return;const list=knowledge();root.innerHTML=`<div class="knowledge-toolbar"><label class="module-search"><span>⌕</span><input id="knowledgeSearch" type="search" placeholder="Найти инструкцию"></label><div class="status-pills" id="knowledgeFilters"><button class="is-active" data-knowledge-filter="Все">Все</button>${[...new Set(list.map((item)=>item.category))].map((value)=>`<button data-knowledge-filter="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join('')}</div></div><div class="knowledge-layout"><div class="knowledge-grid" id="knowledgeGrid"></div><aside class="knowledge-reader" id="knowledgeReader">${emptyState('knowledge','Выберите инструкцию','Содержание откроется здесь.')}</aside></div>`;let filter='Все',active=null;const draw=()=>{const q=$('#knowledgeSearch').value.toLowerCase();const items=list.filter((item)=>(filter==='Все'||item.category===filter)&&`${item.title} ${item.content}`.toLowerCase().includes(q)).sort((a,b)=>Number(b.favorite)-Number(a.favorite));$('#knowledgeGrid').innerHTML=items.map((item)=>`<button class="knowledge-card ${active===item.id?'is-active':''}" data-read-knowledge="${item.id}"><span>${escapeHtml(item.category)}${item.favorite?' · Избранное':''}</span><strong>${escapeHtml(item.title)}</strong><small>Обновлено ${formatDate(item.updatedAt.slice(0,10))}</small></button>`).join('')||'<div class="table-empty">Инструкции не найдены</div>';$('#knowledgeGrid').querySelectorAll('[data-read-knowledge]').forEach((button)=>button.addEventListener('click',()=>{active=button.dataset.readKnowledge;draw();read();}));};const read=()=>{const item=list.find((record)=>record.id===active);if(!item)return;$('#knowledgeReader').innerHTML=`<div class="reader-head"><div><span>${escapeHtml(item.category)}</span><h2>${escapeHtml(item.title)}</h2></div><button data-favorite-knowledge title="Избранное">${item.favorite?'★':'☆'}</button></div><article>${articleMarkup(item.content)}</article><div class="reader-actions"><button class="ghost-button" data-copy-knowledge>Копировать</button><button class="ghost-button" data-edit-knowledge>Редактировать</button>${!item.system?'<button class="danger-text" data-delete-knowledge>Удалить</button>':''}</div>`;$('#knowledgeReader [data-favorite-knowledge]').addEventListener('click',()=>{save(keys.knowledge,list.map((entry)=>entry.id===item.id?{...entry,favorite:!entry.favorite}:entry));renderKnowledge();});$('#knowledgeReader [data-copy-knowledge]').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(`${item.title}\n\n${item.content}`);notify('Инструкция скопирована');}catch{notify('Не удалось скопировать текст');}});$('#knowledgeReader [data-edit-knowledge]').addEventListener('click',()=>editKnowledge(item.id));$('#knowledgeReader [data-delete-knowledge]')?.addEventListener('click',()=>{if(confirm('Удалить инструкцию?')){save(keys.knowledge,list.filter((entry)=>entry.id!==item.id));renderKnowledge();}});};$('#knowledgeSearch').addEventListener('input',draw);root.querySelectorAll('[data-knowledge-filter]').forEach((button)=>button.addEventListener('click',()=>{filter=button.dataset.knowledgeFilter;root.querySelectorAll('[data-knowledge-filter]').forEach((entry)=>entry.classList.toggle('is-active',entry===button));draw();}));draw();}

export function renderWorkspaceModule(name){({products:renderProducts,history:renderHistory,stock:renderStock,calendar:renderCalendar,finance:renderFinance,knowledge:renderKnowledge}[name]||(()=>{}))();}
export function initWorkspaceModules(options={}){notify=options.toast||notify;navigate=options.switchView||navigate;$('#closeModuleModal')?.addEventListener('click',closeModal);$('#moduleModal')?.addEventListener('click',(event)=>{if(event.target.id==='moduleModal')closeModal();});document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!$('#moduleModal').classList.contains('is-hidden'))closeModal();});$('#addProduct')?.addEventListener('click',()=>editProduct());$('#addCalendarEvent')?.addEventListener('click',()=>editEvent());$('#addKnowledge')?.addEventListener('click',()=>editKnowledge());$('#exportHistory')?.addEventListener('click',()=>download(`myworkspace-history-${today()}.json`,JSON.stringify(history(),null,2)));$('#exportStock')?.addEventListener('click',()=>{const rows=stockData();if(!rows.length)return notify('Нет данных для выгрузки');const csv=['Артикул;Название;Остаток;Размеров;Нулевых размеров;Запас, дней;Статус',...rows.map((item)=>[item.sku,item.name,item.stock,item.sizes,item.emptySizes,one.format(item.daysCover),item.status.label].map((value)=>`"${String(value).replace(/"/g,'""')}"`).join(';'))].join('\r\n');download(`stock-control-${today()}.csv`,`\ufeff${csv}`,'text/csv;charset=utf-8');});window.addEventListener('myworkspace:analysis-complete',(event)=>{storeSnapshot(event.detail);notify('Анализ сохранён в истории');});setProducts(products());updateCalendarCount();renderKnowledge();}
