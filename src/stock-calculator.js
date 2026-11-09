import { stockCalculatorCore as calc } from './stock-calculator-core.js';
import { readExcelRows, downloadWorkbook } from './stock-calculator-xlsx.js';
import './stock-calculator.css';

const $ = (sel) => document.querySelector(sel);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt = (n) => Number(n||0).toLocaleString('ru-RU');
const state = { stock:null, orders:null, catalog:null, report:null, error:'', busy:false };
function upload(name,title,desc) {
  const file = state[name];
  return '<label class="stockcalc-upload"><span class="stockcalc-upload-icon">⇧</span><b>'+esc(title)+'</b><small>'+esc(desc)+'</small>'+
    '<span class="stockcalc-file">'+esc(file?.name || 'Нажмите, чтобы выбрать файл')+'</span>'+
    '<input type="file" id="stockcalc-'+name+'" accept=".xlsx,.csv,.tsv" /></label>';
}
function metric(label,amount) {
  return '<div class="stockcalc-metric"><small>'+label+'</small><strong>'+fmt(amount)+'</strong></div>';
}
function results() {
  if (!state.report) return '';
  const r=state.report,s=r.summary,valid=!r.unresolved.length;
  const issueRows=r.unresolved.slice(0,30).map(x=>'<tr><td>'+esc(x.row||'—')+'</td><td>'+esc(x.article||'—')+'</td><td>'+esc(x.size||'—')+'</td><td>'+fmt(x.quantity)+'</td><td>'+esc(x.reason)+'</td></tr>').join('');
  const deficitRows=r.deficits.slice(0,30).map(x=>'<tr><td>'+esc(x.barcode)+'</td><td>'+fmt(x.available)+'</td><td>'+fmt(x.ordered)+'</td><td>'+fmt(x.shortage)+'</td></tr>').join('');
  return '<article class="stockcalc-panel"><div class="stockcalc-result-head"><h2>Результат расчёта</h2><span class="'+(valid?'stockcalc-ok':'stockcalc-bad')+'">'+(valid?'Сопоставление выполнено':'Требуется справочник')+'</span></div>'+
    '<div class="stockcalc-metrics">'+metric('Всего на складе',s.stockTotal)+metric('Активных заказов',s.orderTotal)+metric('Вычтено',s.deductedTotal)+metric('Осталось',s.remainingTotal)+'</div>'+
    '<p class="stockcalc-hint">Позиций до расчёта: '+fmt(s.stockPositions)+' · в итоговом файле: '+fmt(s.remainingPositions)+'. Нулевые остатки в выгрузку не включаются.</p>'+
    (s.outsideTotal?'<p class="stockcalc-info">Заказы на '+fmt(s.outsideTotal)+' шт. отсутствуют в исходном складском файле. Из других товаров они не вычитались.</p>':'')+
    (s.deficitTotal?'<p class="stockcalc-warn">Не хватает '+fmt(s.deficitTotal)+' шт. Итог по дефицитным баркодам не становится отрицательным.</p>':'')+
    (r.unresolved.length?'<p class="stockcalc-warn">Не удалось определить '+fmt(s.unresolvedTotal)+' шт. Заказов. Экспорт заблокирован, пока не будет загружен корректный справочник.</p><h3>Неопределённые товары</h3><div class="stockcalc-scroll"><table><thead><tr><th>Строка</th><th>Артикул</th><th>Размер</th><th>Шт.</th><th>Причина</th></tr></thead><tbody>'+issueRows+'</tbody></table></div>':'')+
    (r.deficits.length?'<h3>Дефицит</h3><div class="stockcalc-scroll"><table><thead><tr><th>Баркод</th><th>На складе</th><th>Заказано</th><th>Не хватает</th></tr></thead><tbody>'+deficitRows+'</tbody></table></div>':'')+
    '<h3>Предпросмотр: Баркод / Количество</h3><div class="stockcalc-scroll stockcalc-preview"><table><thead><tr><th>Баркод</th><th>Количество</th></tr></thead><tbody>'+
    (r.rows.slice(0,100).map(x=>'<tr><td>'+esc(x.barcode)+'</td><td>'+fmt(x.quantity)+'</td></tr>').join('') || '<tr><td colspan="2">Положительных остатков не осталось</td></tr>')+
    '</tbody></table></div><div class="stockcalc-actions"><button class="primary-action" type="button" id="stockcalc-download" '+(valid?'':'disabled')+'>↓ Скачать Excel</button><small>Реальные остатки на сайте не изменяются.</small></div></article>';
}
function paint() {
  const root=$('#stockCalculatorWorkspace');
  if (!root) return;
  root.innerHTML='<div class="stockcalc-page"><div class="page-heading compact-heading"><div><p class="eyebrow">СКЛАД И ЗАКАЗЫ</p><h1>Калькулятор остатков</h1><p>Вычитаем активные заказы New из текущего остатка и получаем готовый Excel по баркодам.</p></div></div>'+
    '<article class="stockcalc-panel"><h2>1. Загрузите файлы</h2><div class="stockcalc-grid">'+
      upload('stock','Остатки склада или офиса','Столбцы: Баркод, Количество')+
      upload('orders','Активные заказы New','Артикул продавца + Размер, либо Баркод')+'</div>'+
    '<details class="stockcalc-details" '+(state.catalog?'open':'')+'><summary>Дополнительно: справочник баркодов</summary><p>Если в заказах нет баркодов, загрузите справочник с тремя колонками: Артикул продавца, Размер, Баркод. В карточках товаров MyWorkSpace сейчас нет размерных баркодов, поэтому для таких заказов справочник необходим.</p>'+
      upload('catalog','Справочник номенклатуры','Необязательно, если в заказах уже есть баркоды')+
      (state.catalog?'<button class="stockcalc-link" type="button" id="stockcalc-remove-catalog">Убрать справочник</button>':'')+'</details>'+
    '<div class="stockcalc-actions"><button class="primary-action" type="button" id="stockcalc-run" '+(state.stock&&state.orders&&!state.busy?'':'disabled')+'>'+(state.busy?'Читаем Excel…':'Рассчитать остатки')+'</button><small>Все файлы обрабатываются на этом устройстве.</small></div>'+
    (state.error?'<p role="alert" class="stockcalc-warn">'+esc(state.error)+'</p>':'')+'</article>'+results()+'</div>';
  for (const name of ['stock','orders','catalog']) {
    const input=$('#stockcalc-'+name);
    input?.addEventListener('change',()=>{
      state[name]=input.files?.[0] || null;
      state.report=null;state.error='';paint();
    });
  }
  $('#stockcalc-remove-catalog')?.addEventListener('click',()=>{state.catalog=null;state.report=null;paint();});
  $('#stockcalc-run')?.addEventListener('click',run);
  $('#stockcalc-download')?.addEventListener('click',()=>{if(state.report&&!state.report.unresolved.length)downloadWorkbook(state.report.rows);});
}
async function parseFirstValid(file,type) {
  const sheets=await readExcelRows(file);
  let last;
  for (const rows of sheets) {
    try {
      calc.identify(rows,type);
      return type==='stock'?calc.parseStock(rows):type==='orders'?calc.parseOrders(rows):calc.parseCatalog(rows);
    } catch(e) {
      if (String(e.message).startsWith('Не найдены колонки:')) {last=e;continue;}
      throw e;
    }
  }
  throw last || new Error('Не найдены нужные колонки в файле '+file.name+'.');
}
async function run() {
  if (!state.stock||!state.orders||state.busy) return;
  state.busy=true;state.error='';state.report=null;paint();
  try {
    const [stocks,orders,catalog]=await Promise.all([
      parseFirstValid(state.stock,'stock'),
      parseFirstValid(state.orders,'orders'),
      state.catalog?parseFirstValid(state.catalog,'catalog'):Promise.resolve([])
    ]);
    state.report=calc.calculate(stocks,orders,[],catalog);
  } catch(e) {state.error=e.message || 'Ошибка обработки файлов.';}
  finally {state.busy=false;paint();}
}
export function renderStockCalculator() {paint();}
