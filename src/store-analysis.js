import { unzipSync } from 'fflate';

const decoder = new TextDecoder('utf-8');
const excelEpoch = Date.UTC(1899, 11, 30);

function xmlText(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function attr(source, name) {
  return source.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1] ?? '';
}

function columnIndex(reference = '') {
  const letters = reference.match(/[A-Z]+/)?.[0] || 'A';
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function normalizeTarget(target) {
  const normalized = target.replace(/\\/g, '/');
  const parts = (normalized.startsWith('/') ? normalized.slice(1) : `xl/${normalized}`).split('/');
  const clean = [];
  parts.forEach((part) => part === '..' ? clean.pop() : part !== '.' && clean.push(part));
  return clean.join('/').replace(/^xl\/xl\//, 'xl/');
}

function workbookBytes(bytes) {
  const first = unzipSync(bytes);
  if (first['[Content_Types].xml']) return first;
  const wrapped = Object.entries(first).find(([name]) => name.toLowerCase().endsWith('.xlsx'));
  if (!wrapped) throw new Error('В архиве не найден файл XLSX');
  return unzipSync(wrapped[1]);
}

function sheetRows(xml, shared) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const type = attr(attrs, 't');
      const index = columnIndex(attr(attrs, 'r'));
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = '';
      if (type === 'inlineStr') value = [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => xmlText(match[1])).join('');
      else if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'b') value = raw === '1';
      else if (raw !== undefined && raw !== '') value = Number.isFinite(Number(raw)) ? Number(raw) : xmlText(raw);
      row[index] = value;
    }
    rows.push(row);
  }
  return rows;
}

export function parseWorkbook(bytes, fileName = 'Отчёт') {
  const entries = workbookBytes(bytes);
  const text = (path) => entries[path] ? decoder.decode(entries[path]) : '';
  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((match) => [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((part) => xmlText(part[1])).join(''));
  const rels = {};
  for (const match of text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/g)) {
    rels[attr(match[1], 'Id')] = normalizeTarget(attr(match[1], 'Target'));
  }
  const sheets = [];
  for (const match of text('xl/workbook.xml').matchAll(/<sheet\b([^>]*)\/?>(?:<\/sheet>)?/g)) {
    const attrs = match[1];
    const path = rels[attr(attrs, 'r:id')];
    if (path && entries[path]) sheets.push({ name: xmlText(attr(attrs, 'name')), rows: sheetRows(text(path), shared) });
  }
  if (!sheets.length) throw new Error('Не удалось прочитать листы XLSX');
  return { fileName, sheets };
}

const clean = (value) => String(value ?? '').trim();
const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const pct = (current, previous) => previous ? (current - previous) / Math.abs(previous) * 100 : current ? 100 : 0;
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const weighted = (rows, valueKey, weightKey) => {
  const weight = rows.reduce((sum, row) => sum + Math.max(0, num(row[weightKey])), 0);
  return weight ? rows.reduce((sum, row) => sum + num(row[valueKey]) * Math.max(0, num(row[weightKey])), 0) / weight : 0;
};

function excelDate(value) {
  if (!Number.isFinite(Number(value))) return clean(value);
  return new Date(excelEpoch + Number(value) * 86400000).toISOString().slice(0, 10);
}

function objectRows(rows, headerIndex = 0) {
  const headers = rows[headerIndex] || [];
  return rows.slice(headerIndex + 1).map((row) => Object.fromEntries(headers.map((header, index) => [clean(header), row[index]])));
}

function reportKind(workbook) {
  const names = workbook.sheets.map((sheet) => sheet.name).join('|');
  const header = workbook.sheets[0]?.rows?.[0]?.map(clean) || [];
  if (names.includes('Детальные показатели')) return 'search';
  if (header.includes('Неделя года') && header.includes('Заказано, шт.')) return 'sales';
  if (header.includes('Размер') && header.some((value) => value.includes('Текущий остаток'))) return 'stock';
  return 'unknown';
}

function salesReport(workbook) {
  const rows = objectRows(workbook.sheets[0].rows).map((row) => ({
    brand: clean(row['Бренд']), sku: clean(row['Артикул продавца']), date: excelDate(row['День']),
    orders: num(row['Заказано, шт.']), orderAmount: num(row['Сумма заказов минус комиссия WB, руб.']),
    buyouts: num(row['Выкупили, шт.']), payout: num(row['К перечислению за товар, руб.']),
  })).filter((row) => row.sku && row.date);
  return { kind: 'sales', fileName: workbook.fileName, rows };
}

function stockReport(workbook) {
  const rows = objectRows(workbook.sheets[0].rows).map((row) => ({
    brand: clean(row['Бренд']), sku: clean(row['Артикул продавца']), size: clean(row['Размер']),
    stock: num(row['Текущий остаток, шт']),
  })).filter((row) => row.sku);
  return { kind: 'stock', fileName: workbook.fileName, rows };
}

function searchReport(workbook) {
  const infoSheet = workbook.sheets.find((sheet) => sheet.name === 'Общая информация');
  const info = Object.fromEntries((infoSheet?.rows || []).slice(1).map((row) => [clean(row[0]), clean(row[1])]));
  const filtersSheet = workbook.sheets.find((sheet) => sheet.name === 'Фильтры');
  const filters = objectRows(filtersSheet?.rows || [], 1)[0] || {};
  const detailsSheet = workbook.sheets.find((sheet) => sheet.name === 'Детальные показатели');
  const rows = objectRows(detailsSheet?.rows || [], 1).map((row) => ({
    sku: clean(row['Артикул продавца']), wb: clean(row['Артикул WB']), name: clean(row['Название']),
    subject: clean(row['Предмет']), brand: clean(row['Бренд']), rating: num(row['Рейтинг по отзывам']),
    query: clean(row['Поисковый запрос']), demand: num(row['Количество запросов']), demandPrev: num(row['Количество запросов (предыдущий период)']),
    visibility: num(row['Видимость, %']), visibilityPrev: num(row['Видимость, % (предыдущий период)']),
    position: num(row['Средняя позиция']), positionPrev: num(row['Средняя позиция (предыдущий период)']),
    clicks: num(row['Переходы в карточку']), clicksPrev: num(row['Переходы в карточку (предыдущий период)']),
    carts: num(row['Положили в корзину']), cartsPrev: num(row['Положили в корзину (предыдущий период)']),
    cartConversion: num(row['Конверсия в корзину, %']), cartConversionPrev: num(row['Конверсия в корзину, % (предыдущий период)']),
    orders: num(row['Заказали, шт']), ordersPrev: num(row['Заказали, шт (предыдущий период)']),
    orderConversion: num(row['Конверсия в заказ, %']), orderConversionPrev: num(row['Конверсия в заказ, % (предыдущий период)']),
    minPrice: num(row['Минимальная цена со скидкой (по размерам), ⃀']), maxPrice: num(row['Максимальная цена со скидкой (по размерам), ⃀']),
  })).filter((row) => row.sku);
  return { kind: 'search', fileName: workbook.fileName, period: info['Выбранный период'] || '', previousPeriod: info['Предыдущий период'] || '', filters, rows };
}

export function classifyWorkbook(workbook) {
  const kind = reportKind(workbook);
  if (kind === 'sales') return salesReport(workbook);
  if (kind === 'stock') return stockReport(workbook);
  if (kind === 'search') return searchReport(workbook);
  return { kind: 'unknown', fileName: workbook.fileName, rows: [] };
}

function aggregateSales(rows) {
  const dates = [...new Set(rows.map((row) => row.date))].sort();
  const half = Math.max(1, Math.floor(dates.length / 2));
  const previousDates = new Set(dates.slice(0, half));
  const currentDates = new Set(dates.slice(-half));
  const totals = (dateSet) => rows.filter((row) => dateSet.has(row.date)).reduce((acc, row) => ({
    orders: acc.orders + row.orders, amount: acc.amount + row.orderAmount, buyouts: acc.buyouts + row.buyouts, payout: acc.payout + row.payout,
  }), { orders: 0, amount: 0, buyouts: 0, payout: 0 });
  const current = totals(currentDates);
  const previous = totals(previousDates);
  const daily = dates.map((date) => ({ date, orders: rows.filter((row) => row.date === date).reduce((sum, row) => sum + row.orders, 0) }));
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.sku)) groups.set(row.sku, { sku: row.sku, brand: row.brand, current: 0, previous: 0, amount: 0, amountPrev: 0 });
    const item = groups.get(row.sku);
    if (currentDates.has(row.date)) { item.current += row.orders; item.amount += row.orderAmount; }
    if (previousDates.has(row.date)) { item.previous += row.orders; item.amountPrev += row.orderAmount; }
  });
  return {
    dates, currentDates: [...currentDates], previousDates: [...previousDates], current, previous, daily,
    products: [...groups.values()].map((item) => ({ ...item, delta: item.current - item.previous, deltaPct: pct(item.current, item.previous) })),
  };
}

function aggregateStocks(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.sku)) groups.set(row.sku, { sku: row.sku, brand: row.brand, stock: 0, sizes: 0, emptySizes: 0 });
    const item = groups.get(row.sku); item.stock += row.stock; item.sizes += 1; if (row.stock <= 0) item.emptySizes += 1;
  });
  return new Map([...groups.values()].map((item) => [item.sku, item]));
}

function aggregateSearch(report) {
  const groups = new Map();
  report.rows.forEach((row) => {
    if (!groups.has(row.sku)) groups.set(row.sku, []);
    groups.get(row.sku).push(row);
  });
  const products = [...groups.entries()].map(([sku, rows]) => ({
    sku, wb: rows[0].wb, name: rows[0].name, subject: rows[0].subject, brand: rows[0].brand, rating: rows[0].rating,
    demand: rows.reduce((sum, row) => sum + row.demand, 0), demandPrev: rows.reduce((sum, row) => sum + row.demandPrev, 0),
    visibility: weighted(rows, 'visibility', 'demand'), visibilityPrev: weighted(rows, 'visibilityPrev', 'demandPrev'),
    position: weighted(rows, 'position', 'demand'), positionPrev: weighted(rows, 'positionPrev', 'demandPrev'),
    clicks: rows.reduce((sum, row) => sum + row.clicks, 0), clicksPrev: rows.reduce((sum, row) => sum + row.clicksPrev, 0),
    carts: rows.reduce((sum, row) => sum + row.carts, 0), cartsPrev: rows.reduce((sum, row) => sum + row.cartsPrev, 0),
    orders: rows.reduce((sum, row) => sum + row.orders, 0), ordersPrev: rows.reduce((sum, row) => sum + row.ordersPrev, 0),
    cartConversion: weighted(rows, 'cartConversion', 'clicks'), cartConversionPrev: weighted(rows, 'cartConversionPrev', 'clicksPrev'),
    orderConversion: weighted(rows, 'orderConversion', 'carts'), orderConversionPrev: weighted(rows, 'orderConversionPrev', 'cartsPrev'),
    minPrice: Math.min(...rows.map((row) => row.minPrice).filter(Boolean)), maxPrice: Math.max(...rows.map((row) => row.maxPrice).filter(Boolean)),
    queries: rows.map((row) => ({ query: row.query, orders: row.orders, ordersPrev: row.ordersPrev, demand: row.demand, demandPrev: row.demandPrev, visibility: row.visibility, visibilityPrev: row.visibilityPrev, position: row.position, positionPrev: row.positionPrev }))
      .sort((a, b) => Math.abs(b.orders - b.ordersPrev) - Math.abs(a.orders - a.ordersPrev)).slice(0, 5),
  }));
  const f = report.filters;
  return {
    period: report.period, previousPeriod: report.previousPeriod, fileName: report.fileName, products,
    overall: {
      impressions: num(f['Показы']), impressionsPrev: num(f['Показы (предыдущий период)']),
      ctr: num(f['CTR']), ctrPrev: num(f['CTR (предыдущий период)']), visibility: num(f['Видимость, %']), visibilityPrev: num(f['Видимость, % (предыдущий период)']),
      position: num(f['Средняя позиция']), positionPrev: num(f['Средняя позиция (предыдущий период)']), clicks: num(f['Переходы в карточку']), clicksPrev: num(f['Переходы в карточку (предыдущий период)']),
      carts: num(f['Положили в корзину']), cartsPrev: num(f['Положили в корзину (предыдущий период)']), cartConversion: num(f['Конверсия в корзину, %']), cartConversionPrev: num(f['Конверсия в корзину, % (предыдущий период)']),
      orders: num(f['Заказали, шт']), ordersPrev: num(f['Заказали, шт (предыдущий период)']), orderConversion: num(f['Конверсия в заказ, %']), orderConversionPrev: num(f['Конверсия в заказ, % (предыдущий период)']),
    },
  };
}

function choosePrimary(searchReports) {
  const score = (report) => /17|недел/i.test(`${report.period} ${report.fileName}`) ? 3 : /месяц/i.test(report.fileName) ? 2 : 1;
  return [...searchReports].sort((a, b) => score(b) - score(a))[0] || null;
}

function diagnose(product) {
  const factors = [];
  const add = (key, label, evidence, impact) => factors.push({ key, label, evidence, impact });
  if (product.search) {
    const s = product.search;
    if (pct(s.demand, s.demandPrev) <= -10) add('demand', 'Спрос снизился', `частотность запросов ${Math.round(pct(s.demand, s.demandPrev))}%`, Math.abs(pct(s.demand, s.demandPrev)));
    if (s.visibility - s.visibilityPrev <= -5 || s.position - s.positionPrev >= 5) add('visibility', 'Потеря видимости', `видимость ${s.visibilityPrev.toFixed(0)}% → ${s.visibility.toFixed(0)}%, позиция ${s.positionPrev.toFixed(0)} → ${s.position.toFixed(0)}`, Math.abs(s.visibility - s.visibilityPrev) + Math.max(0, s.position - s.positionPrev));
    if (pct(s.clicks, s.clicksPrev) <= -10) add('traffic', 'Меньше переходов', `переходы ${Math.round(pct(s.clicks, s.clicksPrev))}%`, Math.abs(pct(s.clicks, s.clicksPrev)));
    if (s.cartConversion - s.cartConversionPrev <= -2) add('card', 'Слабее конверсия карточки', `в корзину ${s.cartConversionPrev.toFixed(1)}% → ${s.cartConversion.toFixed(1)}%`, Math.abs(s.cartConversion - s.cartConversionPrev) * 4);
    if (s.orderConversion - s.orderConversionPrev <= -2) add('checkout', 'Слабее конверсия в заказ', `в заказ ${s.orderConversionPrev.toFixed(1)}% → ${s.orderConversion.toFixed(1)}%`, Math.abs(s.orderConversion - s.orderConversionPrev) * 4);
  }
  if (product.stock && (product.stock.stock <= 0 || product.daysCover < 7)) add('stock', 'Ограничение по остаткам', product.stock.stock <= 0 ? 'остаток равен нулю' : `запаса примерно на ${product.daysCover.toFixed(0)} дн.`, 30);
  factors.sort((a, b) => b.impact - a.impact);
  const direction = product.delta < 0 ? 'decline' : product.delta > 0 ? 'growth' : 'flat';
  const confidence = product.search && product.sales ? (Math.sign(product.search.orders - product.search.ordersPrev) === Math.sign(product.delta) ? 'Высокая' : 'Средняя') : 'Предварительная';
  return { direction, factors: factors.slice(0, 3), confidence, conclusion: factors[0]?.label || (direction === 'growth' ? 'Рост без выраженного единственного фактора' : 'Причина не выделяется в загруженных данных') };
}

export function analyzeReports(reports) {
  const salesInput = reports.find((report) => report.kind === 'sales');
  const stockInput = reports.find((report) => report.kind === 'stock');
  const searchPeriods = reports.filter((report) => report.kind === 'search').map(aggregateSearch);
  const sales = salesInput ? aggregateSales(salesInput.rows) : null;
  const stocks = stockInput ? aggregateStocks(stockInput.rows) : new Map();
  const primarySearch = choosePrimary(searchPeriods);
  const salesMap = new Map((sales?.products || []).map((item) => [item.sku, item]));
  const searchMap = new Map((primarySearch?.products || []).map((item) => [item.sku, item]));
  const skus = new Set([...salesMap.keys(), ...searchMap.keys(), ...stocks.keys()]);
  const products = [...skus].map((sku) => {
    const sale = salesMap.get(sku); const search = searchMap.get(sku); const stock = stocks.get(sku);
    const current = sale?.current ?? search?.orders ?? 0; const previous = sale?.previous ?? search?.ordersPrev ?? 0;
    const dailyRate = sales ? current / Math.max(1, sales.currentDates.length) : 0;
    const product = { sku, name: search?.name || sku, brand: sale?.brand || search?.brand || stock?.brand || '', sales: sale || null, search: search || null, stock: stock || null, current, previous, delta: current - previous, deltaPct: pct(current, previous), daysCover: dailyRate && stock ? stock.stock / dailyRate : 0 };
    return { ...product, diagnosis: diagnose(product) };
  }).sort((a, b) => a.delta - b.delta);
  const decline = products.filter((product) => product.delta < 0);
  const growth = products.filter((product) => product.delta > 0).sort((a, b) => b.delta - a.delta);
  const factorCounts = {};
  decline.forEach((product) => product.diagnosis.factors.forEach((factor) => { factorCounts[factor.key] = (factorCounts[factor.key] || 0) + 1; }));
  return {
    reports, sales, searchPeriods, primarySearch, products, decline, growth, factorCounts,
    stockTotal: [...stocks.values()].reduce((sum, item) => sum + item.stock, 0),
    coverage: { sales: Boolean(salesInput), stock: Boolean(stockInput), search: searchPeriods.length },
  };
}

export async function readAnalysisFiles(files) {
  const reports = [];
  const errors = [];
  for (const file of files) {
    try {
      const workbook = parseWorkbook(new Uint8Array(await file.arrayBuffer()), file.name);
      const report = classifyWorkbook(workbook);
      if (report.kind === 'unknown') errors.push(`${file.name}: тип отчёта не распознан`);
      else reports.push(report);
    } catch (error) { errors.push(`${file.name}: ${error.message}`); }
  }
  return { reports, errors, analysis: analyzeReports(reports) };
}

export const analysisMath = { pct, average };
