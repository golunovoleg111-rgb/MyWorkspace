import { readAnalysisFiles } from './store-analysis.js';

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
const one = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const change = (current, previous) => previous ? (current - previous) / Math.abs(previous) * 100 : current ? 100 : 0;
const deltaClass = (value) => value > 0 ? 'is-positive' : value < 0 ? 'is-negative' : 'is-neutral';
const deltaText = (value, suffix = '%') => `${value > 0 ? '+' : ''}${one.format(value)}${suffix}`;

let selectedFiles = [];
let currentAnalysis = null;
let productMode = 'decline';

function fileKind(fileName) {
  if (/квартал/i.test(fileName)) return 'Квартал к кварталу';
  if (/месяц/i.test(fileName)) return 'Месяц к месяцу';
  if (/недел/i.test(fileName)) return 'Неделя к неделе';
  if (/\(1\)/.test(fileName)) return 'Остатки по размерам';
  return 'Динамика продаж';
}

function renderFiles() {
  const list = $('#storeFileList');
  list.innerHTML = selectedFiles.length ? selectedFiles.map((file, index) => `
    <div class="source-file"><span class="source-file-mark">${file.name.toLowerCase().endsWith('.zip') ? 'ZIP' : 'XLSX'}</span><div><strong>${escapeHtml(file.name)}</strong><small>${fileKind(file.name)} · ${(file.size / 1024).toFixed(0)} КБ</small></div><button type="button" data-remove-source="${index}" aria-label="Удалить файл">×</button></div>
  `).join('') : '<div class="source-empty">Отчёты ещё не выбраны</div>';
  $('#runStoreAnalysis').disabled = !selectedFiles.length;
  $('#runStoreAnalysis').textContent = selectedFiles.length ? `Сформировать анализ · ${selectedFiles.length}` : 'Сформировать анализ';
}

function addFiles(fileList) {
  const incoming = [...fileList].filter((file) => /\.(xlsx|zip)$/i.test(file.name));
  incoming.forEach((file) => {
    if (!selectedFiles.some((item) => item.name === file.name && item.size === file.size)) selectedFiles.push(file);
  });
  renderFiles();
}

function metricCard(label, current, previous, formatter = number.format.bind(number), invert = false) {
  const delta = change(current, previous);
  const good = invert ? delta < 0 : delta > 0;
  return `<article class="store-metric"><span>${label}</span><strong>${formatter(current)}</strong><div><b class="${delta === 0 ? 'is-neutral' : good ? 'is-positive' : 'is-negative'}">${deltaText(delta)}</b><small>было ${formatter(previous)}</small></div></article>`;
}

function trendChart(points) {
  if (!points?.length) return '<div class="chart-empty">Загрузите отчёт динамики продаж, чтобы увидеть график.</div>';
  const width = 820; const height = 220; const pad = 20;
  const values = points.map((point) => point.orders);
  const max = Math.max(...values, 1); const min = Math.min(...values, 0);
  const x = (index) => pad + index * ((width - pad * 2) / Math.max(1, points.length - 1));
  const y = (value) => height - pad - ((value - min) / Math.max(1, max - min)) * (height - pad * 2);
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(point.orders).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(points.length - 1)} ${height - pad} L ${x(0)} ${height - pad} Z`;
  const labels = points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 5) === 0).map((point, index, filtered) => {
    const originalIndex = points.indexOf(point); const label = new Date(`${point.date}T12:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    return `<text x="${x(originalIndex)}" y="218" text-anchor="${index === 0 ? 'start' : index === filtered.length - 1 ? 'end' : 'middle'}">${label}</text>`;
  }).join('');
  return `<svg class="trend-svg" viewBox="0 0 ${width} ${height + 6}" role="img" aria-label="Динамика заказов"><defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#377df0" stop-opacity=".28"/><stop offset="1" stop-color="#377df0" stop-opacity="0"/></linearGradient></defs><path class="trend-area" d="${area}"/><path class="trend-line" d="${line}"/>${points.map((point, index) => `<circle cx="${x(index)}" cy="${y(point.orders)}" r="3"><title>${point.date}: ${point.orders} заказов</title></circle>`).join('')}${labels}</svg>`;
}

function factorLabel(key) {
  return ({ demand: 'Спрос', visibility: 'Видимость', traffic: 'Переходы', card: 'Карточка', checkout: 'Заказ', stock: 'Остатки' })[key] || key;
}

function periodCards(periods) {
  if (!periods.length) return '<div class="store-empty-panel">Поисковые отчёты пока не загружены.</div>';
  return periods.map((period) => {
    const data = period.overall; const ordersDelta = change(data.orders, data.ordersPrev);
    return `<article class="period-card"><div><span>${escapeHtml(period.fileName.replace(/\.(zip|xlsx)$/i, ''))}</span><b class="${deltaClass(ordersDelta)}">${deltaText(ordersDelta)}</b></div><strong>${number.format(data.orders)} заказов из поиска</strong><p>${escapeHtml(period.period)}<br><small>Сравнение: ${escapeHtml(period.previousPeriod)}</small></p><dl><div><dt>Показы</dt><dd>${deltaText(change(data.impressions, data.impressionsPrev))}</dd></div><div><dt>Переходы</dt><dd>${deltaText(change(data.clicks, data.clicksPrev))}</dd></div><div><dt>Корзина</dt><dd>${deltaText(change(data.carts, data.cartsPrev))}</dd></div><div><dt>Видимость</dt><dd>${one.format(data.visibilityPrev)} → ${one.format(data.visibility)}%</dd></div></dl></article>`;
  }).join('');
}

function executiveSummary(analysis) {
  const sales = analysis.sales; const search = analysis.primarySearch;
  const salesDelta = sales ? change(sales.current.orders, sales.previous.orders) : null;
  const searchDelta = search ? change(search.overall.orders, search.overall.ordersPrev) : null;
  const top = analysis.decline[0];
  const parts = [];
  if (sales) parts.push(`Заказы во второй половине загруженного периода ${salesDelta >= 0 ? 'выросли' : 'снизились'} на ${one.format(Math.abs(salesDelta))}%: ${number.format(sales.previous.orders)} → ${number.format(sales.current.orders)} шт.`);
  if (search) parts.push(`В поиске за основной период заказы изменились на ${deltaText(searchDelta)}. Переходы — ${deltaText(change(search.overall.clicks, search.overall.clicksPrev))}, видимость — ${one.format(search.overall.visibilityPrev)}% → ${one.format(search.overall.visibility)}%.`);
  if (top) parts.push(`Наибольший вклад в снижение даёт ${top.sku}: ${number.format(top.previous)} → ${number.format(top.current)} заказов. Основной сигнал — ${top.diagnosis.conclusion.toLowerCase()}.`);
  return parts.join(' ') || 'Для итогового вывода добавьте отчёт по продажам или поисковой аналитике.';
}

function productRows(analysis) {
  const query = ($('#storeProductSearch')?.value || '').toLowerCase().trim();
  let products = productMode === 'decline' ? analysis.decline : productMode === 'growth' ? analysis.growth : analysis.products;
  products = products.filter((product) => `${product.sku} ${product.name} ${product.brand}`.toLowerCase().includes(query)).slice(0, 250);
  if (!products.length) return '<div class="store-empty-panel">Товары по выбранному фильтру не найдены.</div>';
  return products.map((product) => {
    const primary = product.diagnosis.factors[0];
    const queries = product.search?.queries?.map((item) => `<tr><td>${escapeHtml(item.query)}</td><td>${number.format(item.ordersPrev)} → ${number.format(item.orders)}</td><td>${one.format(item.visibilityPrev)} → ${one.format(item.visibility)}%</td><td>${one.format(item.positionPrev)} → ${one.format(item.position)}</td></tr>`).join('') || '';
    return `<details class="product-row"><summary><span class="product-name"><strong>${escapeHtml(product.sku)}</strong><small>${escapeHtml(product.name !== product.sku ? product.name : product.brand)}</small></span><span><small>Заказы</small><strong>${number.format(product.previous)} → ${number.format(product.current)}</strong></span><span><small>Изменение</small><strong class="${deltaClass(product.delta)}">${product.delta > 0 ? '+' : ''}${number.format(product.delta)} · ${deltaText(product.deltaPct)}</strong></span><span><small>Остаток</small><strong>${product.stock ? `${number.format(product.stock.stock)} шт.` : 'нет данных'}</strong></span><span class="product-driver"><small>Главный сигнал</small><strong>${escapeHtml(primary?.label || product.diagnosis.conclusion)}</strong></span><b class="details-chevron">⌄</b></summary><div class="product-detail"><div class="evidence-grid">${product.diagnosis.factors.length ? product.diagnosis.factors.map((factor) => `<div><span>${factorLabel(factor.key)}</span><strong>${escapeHtml(factor.label)}</strong><p>${escapeHtml(factor.evidence)}</p></div>`).join('') : '<div><span>Вывод</span><strong>Недостаточно сигналов</strong><p>Загрузите поисковую аналитику и остатки для более точного объяснения.</p></div>'}<div><span>Уверенность</span><strong>${product.diagnosis.confidence}</strong><p>Вывод основан только на совпадающих данных загруженных отчётов.</p></div></div>${queries ? `<div class="query-table"><h4>Запросы с наибольшим изменением заказов</h4><div class="table-scroll"><table><thead><tr><th>Запрос</th><th>Заказы</th><th>Видимость</th><th>Позиция</th></tr></thead><tbody>${queries}</tbody></table></div></div>` : ''}</div></details>`;
  }).join('');
}

function actionPlan(analysis) {
  const factor = Object.entries(analysis.factorCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const first = factor === 'visibility' ? 'Проверить позиции и запросы у товаров с наибольшей потерей видимости.' : factor === 'card' ? 'Проверить главное фото, цену и оффер у карточек с падением конверсии.' : factor === 'stock' ? 'Пополнить нулевые и критичные размеры у товаров с устойчивым спросом.' : 'Разобрать первые 10 товаров по вкладу в снижение и подтвердить основной фактор.';
  return `<article><span>48 часов</span><strong>Остановить потери</strong><p>${first} Не менять несколько факторов одновременно.</p></article><article><span>7 дней</span><strong>Проверить гипотезы</strong><p>Сравнить показы, переходы, корзину и заказы после изменений. Отдельно контролировать размерные остатки.</p></article><article><span>30 дней</span><strong>Закрепить результат</strong><p>Повторить анализ месяц к месяцу и обновить приоритеты по товарам, а не по среднему магазину.</p></article>`;
}

function renderAnalysis(analysis, errors = []) {
  currentAnalysis = analysis;
  const root = $('#storeResults');
  const sales = analysis.sales;
  const search = analysis.primarySearch?.overall;
  const metrics = sales ? [
    metricCard('Заказы', sales.current.orders, sales.previous.orders),
    metricCard('Сумма заказов', sales.current.amount, sales.previous.amount, money.format.bind(money)),
    metricCard('Средний заказ', sales.current.orders ? sales.current.amount / sales.current.orders : 0, sales.previous.orders ? sales.previous.amount / sales.previous.orders : 0, money.format.bind(money)),
    metricCard('Выкупы', sales.current.buyouts, sales.previous.buyouts),
  ] : search ? [
    metricCard('Заказы из поиска', search.orders, search.ordersPrev), metricCard('Переходы', search.clicks, search.clicksPrev),
    metricCard('Показы', search.impressions, search.impressionsPrev), metricCard('Средняя позиция', search.position, search.positionPrev, one.format.bind(one), true),
  ] : [];
  root.innerHTML = `
    ${errors.length ? `<div class="source-warning"><strong>Не все файлы прочитаны</strong><p>${errors.map(escapeHtml).join('<br>')}</p></div>` : ''}
    <div class="report-cover"><div><span class="eyebrow">ОТЧЁТ ПО МАГАЗИНУ</span><h2>Что изменилось и почему</h2><p>${escapeHtml(executiveSummary(analysis))}</p></div><div class="report-cover-actions"><span>Сформировано ${new Date().toLocaleDateString('ru-RU')}</span><button id="printStoreReport" class="ghost-button">Скачать PDF</button></div></div>
    <div class="store-metrics">${metrics.join('')}</div>
    <div class="store-dashboard-grid"><section class="store-panel trend-panel"><div class="store-panel-head"><div><span class="eyebrow">ДИНАМИКА</span><h3>Заказы по дням</h3></div>${sales ? `<small>${sales.previousDates[0]} — ${sales.currentDates.at(-1)}</small>` : ''}</div>${trendChart(sales?.daily)}</section><section class="store-panel factor-panel"><div class="store-panel-head"><div><span class="eyebrow">ФАКТОРЫ</span><h3>Где искать причину</h3></div></div><div class="factor-list">${Object.entries(analysis.factorCounts).sort((a,b) => b[1]-a[1]).slice(0,6).map(([key, count]) => `<div><span>${factorLabel(key)}</span><b>${count} товаров</b><i style="--factor:${Math.min(100, count / Math.max(1, analysis.decline.length) * 100)}%"></i></div>`).join('') || '<p>Добавьте поисковый отчёт, чтобы разложить снижение по факторам.</p>'}</div></section></div>
    <section class="store-section"><div class="store-section-head"><div><span class="eyebrow">ПОИСКОВАЯ АНАЛИТИКА</span><h3>Три масштаба периода</h3></div><p>Короткий период показывает свежую проблему, длинный — устойчивый тренд.</p></div><div class="period-grid">${periodCards(analysis.searchPeriods)}</div></section>
    <section class="store-section product-section"><div class="store-section-head product-toolbar"><div><span class="eyebrow">ТОВАРНЫЙ РАЗБОР</span><h3>История каждого артикула</h3></div><div class="product-controls"><div class="segmented"><button data-product-mode="decline" class="is-active">Снижение · ${analysis.decline.length}</button><button data-product-mode="growth">Рост · ${analysis.growth.length}</button><button data-product-mode="all">Все · ${analysis.products.length}</button></div><label><span>⌕</span><input id="storeProductSearch" type="search" placeholder="Артикул или товар" /></label></div></div><div class="product-table-head"><span>Товар</span><span>Заказы</span><span>Изменение</span><span>Остаток</span><span>Главный сигнал</span><b></b></div><div id="storeProducts">${productRows(analysis)}</div></section>
    <section class="store-section"><div class="store-section-head"><div><span class="eyebrow">ПЛАН ДЕЙСТВИЙ</span><h3>Что делать дальше</h3></div></div><div class="action-plan">${actionPlan(analysis)}</div></section>
    <div class="method-note"><strong>Как читать выводы</strong><p>Помощник показывает подтверждённые изменения в загруженных данных и наиболее вероятные факторы. Он не называет причиной рекламу, цену, контент или логистику, если этих данных нет в отчётах. Остатки используются только из отдельного агрегированного отчёта по текущим остаткам.</p></div>`;
  root.classList.remove('is-hidden');
  $('#storeSetup').classList.add('is-compact');
  root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#printStoreReport').addEventListener('click', () => { document.body.classList.add('printing-store'); window.print(); window.setTimeout(() => document.body.classList.remove('printing-store'), 500); });
  root.querySelectorAll('[data-product-mode]').forEach((button) => button.addEventListener('click', () => {
    productMode = button.dataset.productMode; root.querySelectorAll('[data-product-mode]').forEach((item) => item.classList.toggle('is-active', item === button)); $('#storeProducts').innerHTML = productRows(analysis);
  }));
  $('#storeProductSearch').addEventListener('input', () => { $('#storeProducts').innerHTML = productRows(analysis); });
}

async function runAnalysis() {
  const button = $('#runStoreAnalysis');
  button.disabled = true; button.textContent = 'Читаю отчёты…';
  $('#storeProcessing').classList.remove('is-hidden');
  try {
    const result = await readAnalysisFiles(selectedFiles);
    if (!result.reports.length) throw new Error(result.errors[0] || 'Не удалось распознать отчёты');
    renderAnalysis(result.analysis, result.errors);
  } catch (error) {
    $('#storeProcessing').classList.add('is-hidden');
    $('#storeError').textContent = error.message; $('#storeError').classList.remove('is-hidden');
  } finally {
    $('#storeProcessing').classList.add('is-hidden'); button.disabled = false; renderFiles();
  }
}

export function initStoreAnalysis() {
  const input = $('#storeUpload'); const zone = $('#storeDropzone');
  if (!input || !zone) return;
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  zone.addEventListener('dragover', (event) => { event.preventDefault(); zone.classList.add('is-dragging'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-dragging'));
  zone.addEventListener('drop', (event) => { event.preventDefault(); zone.classList.remove('is-dragging'); addFiles(event.dataTransfer.files); });
  $('#storeFileList').addEventListener('click', (event) => { const button = event.target.closest('[data-remove-source]'); if (!button) return; selectedFiles.splice(Number(button.dataset.removeSource), 1); renderFiles(); });
  $('#runStoreAnalysis').addEventListener('click', runAnalysis);
  $('#resetStoreAnalysis').addEventListener('click', () => { selectedFiles = []; currentAnalysis = null; productMode = 'decline'; renderFiles(); $('#storeResults').classList.add('is-hidden'); $('#storeResults').innerHTML = ''; $('#storeSetup').classList.remove('is-compact'); });
  renderFiles();
}
