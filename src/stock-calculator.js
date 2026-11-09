import { zipSync, strToU8 } from 'fflate';
import { parseWorkbook } from './store-analysis.js';
import { stockCalculatorCore as calc } from './stock-calculator-core.js';

const STORAGE_KEY = 'myworkspace.stock-calculator.catalog.v1';
const $ = (selector) => document.querySelector(selector);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => Number(n || 0).toLocaleString('ru-RU');

let stockFile = null;
let ordersFile = null;
let catalogFile = null;
let result = null;
let uploadedCatalog = [];
let savedCatalog = [];
try {
  const fromStorage = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (Array.isArray(fromStorage)) savedCatalog = fromStorage;
} catch (_) { /* Invalid local cache is ignored. */ }

function workbookRows(workbook, kind) {
  for (const sheet of workbook.sheets) {
    try {
      calc.identify(sheet.rows, kind);
      return sheet.rows;
    } catch (_) { /* Inspect next worksheet. */ }
  }
  const expected = kind === 'stock' ? 'Баркод и Количество' :
    kind === 'orders' ? 'Баркод либо Артикул продавца и Размер' :
    'Артикул продавца, Размер и Баркод';
  throw new Error('В файле «' + workbook.fileName + '» не обнаружены столбцы: ' + expected + '.');
}

async function readRows(file, kind) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Файл «' + file.name + '» превышает 20 МБ.');
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Поддерживается формат XLSX. Сохраните «' + file.name + '» как .xlsx.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  return workbookRows(parseWorkbook(bytes, file.name), kind);
}

function escapeXml(v) {
  return String(v ?? '').replace(/[<>&"']/g, (c) => ({
    '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;'
  })[c]);
}

export function makeStockXlsx(rows) {
  const data = [['Баркод','Количество'], ...rows.map(item => [String(item.barcode), item.quantity])];
  let cells = '';
  data.forEach((values, i) => {
    const row = i + 1;
    // Inline string preserves EAN and leading zeroes without Excel number conversion.
    cells += '<row r="' + row + '"><c r="A' + row + '" t="inlineStr"><is><t>' +
      escapeXml(values[0]) + '</t></is></c>' +
      (i === 0 ?
        '<c r="B1" t="inlineStr"><is><t>Количество</t></is></c>' :
        '<c r="B' + row + '"><v>' + Number(values[1]) + '</v></c>') + '</row>';
  });
  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<dimension ref="A1:B' + data.length + '"/>' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="17" customWidth="1"/></cols>' +
    '<sheetData>' + cells + '</sheetData></worksheet>';
  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Остатки" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '</Relationships>';
  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';
  const types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '</Types>';
  return zipSync({
    '[Content_Types].xml': strToU8(types),
    '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(wbRels),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  });
}

function downloadResult() {
  if (!result || result.unresolved.length) return;
  const bytes = makeStockXlsx(result.rows);
  const blob = new Blob([bytes], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Остатки_после_вычета_New_' + new Date().toISOString().slice(0,10) + '.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function changeFile(input, kind) {
  const file = input.files?.[0] || null;
  if (kind === 'stock') stockFile = file;
  if (kind === 'orders') ordersFile = file;
  if (kind === 'catalog') catalogFile = file;
  result = null;
  const name = $('#calcName-' + kind);
  if (name) name.textContent = file ? file.name : 'Выбрать файл XLSX';
  const button = $('#calculateStock');
  if (button) button.disabled = !(stockFile && ordersFile);
  $('#calculatorResult').innerHTML = '<p class="mw-calc-muted">Файлы обновлены. Нажмите «Рассчитать остатки».</p>';
}

function renderResult() {
  const host = $('#calculatorResult');
  if (!host || !result) return;
  const r = result, s = r.summary;
  const errors = r.unresolved.length;
  host.innerHTML = `
    <div class="mw-calc-section-head"><h2>Результат расчёта</h2>
      <span class="mw-calc-chip ${errors ? 'is-warning' : 'is-good'}">
        ${errors ? 'Требуется сопоставление' : 'Готов к выгрузке'}</span></div>
    <div class="mw-calc-metrics">
      <div><span>Остатки до вычета</span><strong>${fmt(s.stockTotal)}</strong></div>
      <div><span>Активные заказы</span><strong>${fmt(s.orderTotal)}</strong></div>
      <div><span>Вычтено</span><strong>${fmt(s.deductedTotal)}</strong></div>
      <div><span>Осталось</span><strong>${fmt(s.remainingTotal)}</strong></div>
    </div>
    <p class="mw-calc-muted">Баркодов в исходном файле: ${fmt(s.stockPositions)}. В результате: ${fmt(s.remainingPositions)}. Нулевые остатки исключаются.</p>
    ${s.outsideTotal ? '<p class="mw-calc-alert">Заказы на ' + fmt(s.outsideTotal) + ' шт. относятся к товарам, которых нет в загруженных остатках. Они не уменьшали другие позиции.</p>' : ''}
    ${s.deficitTotal ? '<p class="mw-calc-alert">Не хватает товара: ' + fmt(s.deficitTotal) + ' шт. По таким баркодам остаток равен нулю, отрицательные остатки не выгружаются.</p>' : ''}
    ${errors ? '<div class="mw-calc-alert is-danger">Не удалось определить баркоды для ' + fmt(s.unresolvedTotal) + ' шт. Добавьте корректный справочник и повторите расчёт. Выгрузка временно заблокирована.</div>' : ''}
    ${errors ? '<div class="mw-calc-table-wrap"><table><thead><tr><th>Строка New</th><th>Артикул</th><th>Размер</th><th>Количество</th><th>Причина</th></tr></thead><tbody>' +
      r.unresolved.slice(0,80).map(item=>'<tr><td>'+esc(item.row || '—')+'</td><td>'+esc(item.article)+'</td><td>'+esc(item.size)+'</td><td>'+fmt(item.quantity)+'</td><td>'+esc(item.reason)+'</td></tr>').join('') +
      '</tbody></table></div>' : ''}
    <div class="mw-calc-section-head"><h3>Предпросмотр Excel</h3><span>Баркод / Количество</span></div>
    <div class="mw-calc-table-wrap mw-calc-preview"><table><thead><tr><th>Баркод</th><th>Количество</th></tr></thead><tbody>
      ${r.rows.slice(0,100).map(row=>'<tr><td>'+esc(row.barcode)+'</td><td>'+fmt(row.quantity)+'</td></tr>').join('') || '<tr><td colspan="2">Нет положительных остатков</td></tr>'}
    </tbody></table></div>
    ${r.rows.length>100?'<p class="mw-calc-muted">Показаны первые 100 позиций, в Excel попадут все '+fmt(r.rows.length)+'.</p>':''}
    <button type="button" class="primary-action" id="downloadStockResult" ${errors?'disabled':''}>↓ Скачать Excel — Баркод / Количество</button>
    <p class="mw-calc-muted">Калькулятор не изменяет остатки и заказы на сайте.</p>
  `;
  $('#downloadStockResult')?.addEventListener('click',downloadResult);
}

async function calculate() {
  const button = $('#calculateStock');
  const host = $('#calculatorResult');
  if (!stockFile || !ordersFile || !button || !host) return;
  button.disabled = true;
  button.textContent = 'Обрабатываем файлы…';
  host.innerHTML = '<p class="mw-calc-muted">Читаем Excel и сопоставляем позиции…</p>';
  try {
    const [stocksRaw,ordersRaw,referenceRaw] = await Promise.all([
      readRows(stockFile,'stock'),
      readRows(ordersFile,'orders'),
      catalogFile ? readRows(catalogFile,'catalog') : Promise.resolve(null)
    ]);
    if (referenceRaw) {
      uploadedCatalog = calc.parseCatalog(referenceRaw);
      if (uploadedCatalog.length) {
        try { localStorage.setItem(STORAGE_KEY,JSON.stringify(uploadedCatalog)); savedCatalog = uploadedCatalog; }
        catch (_) { savedCatalog = uploadedCatalog; }
      }
    }
    const reference = uploadedCatalog.length ? uploadedCatalog : savedCatalog;
    result = calc.calculate(calc.parseStock(stocksRaw),calc.parseOrders(ordersRaw),[],reference);
    const status = $('#calculatorCatalogStatus');
    if (status) status.textContent = reference.length
      ? 'Справочник: ' + fmt(reference.length) + ' позиций. Сохранён на этом устройстве.'
      : 'Справочник ещё не загружен. Если в New пустые баркоды, потребуется загрузить его один раз.';
    renderResult();
  } catch (error) {
    result=null;
    host.innerHTML='<p class="mw-calc-alert is-danger" role="alert">'+esc(error?.message||'Ошибка обработки Excel.')+'</p>';
  } finally {
    button.disabled = !(stockFile && ordersFile);
    button.textContent = 'Рассчитать остатки';
  }
}

export function initStockCalculator() {
  const stock = $('#calculatorStockFile'), orders = $('#calculatorOrdersFile'), catalog = $('#calculatorCatalogFile');
  if (!stock || !orders || !catalog) return;
  stock.addEventListener('change',()=>changeFile(stock,'stock'));
  orders.addEventListener('change',()=>changeFile(orders,'orders'));
  catalog.addEventListener('change',()=>changeFile(catalog,'catalog'));
  $('#calculateStock')?.addEventListener('click',calculate);
  $('#clearStockCatalog')?.addEventListener('click',()=>{
    uploadedCatalog=[];savedCatalog=[];catalogFile=null;catalog.value='';
    localStorage.removeItem(STORAGE_KEY);
    result=null;
    $('#calculatorCatalogStatus').textContent='Справочник не сохранён.';
    $('#calcName-catalog').textContent='Выбрать файл XLSX';
    $('#calculatorResult').innerHTML='<p class="mw-calc-muted">Справочник очищен. Загрузите новый файл и пересчитайте остатки.</p>';
  });
  if (savedCatalog.length) $('#calculatorCatalogStatus').textContent =
    'Справочник: '+fmt(savedCatalog.length)+' позиций. Сохранён на этом устройстве.';
}
