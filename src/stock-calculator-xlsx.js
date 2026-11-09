import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

function xml(root) {
  const doc = new DOMParser().parseFromString(root, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Ошибка структуры XLSX.');
  return doc;
}
function descendants(node, name) {
  return [...node.getElementsByTagName('*')].filter(n => n.localName === name);
}
function first(node, name) {
  return descendants(node, name)[0];
}
function colIndex(ref) {
  let n = 0;
  for (const ch of (ref.match(/^[A-Z]+/i) || [''])[0].toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}
function safeText(value) {
  return String(value ?? '');
}
export async function readExcelRows(file) {
  const name = file.name.toLowerCase();
  if (!/\.(xlsx|csv|tsv)$/.test(name)) throw new Error('Выберите Excel XLSX, CSV или TSV.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Файл больше 25 МБ.');
  const buffer = await file.arrayBuffer();
  if (/\.(csv|tsv)$/.test(name)) {
    let source = new TextDecoder('utf-8').decode(buffer);
    if (source.includes('\uFFFD')) source = new TextDecoder('windows-1251').decode(buffer);
    source = source.replace(/^\uFEFF/, '');
    const separator = name.endsWith('.tsv') ? '\t' : (source.split('\n')[0].includes(';') ? ';' : ',');
    return [parseDelimited(source,separator)];
  }
  let files;
  try { files = unzipSync(new Uint8Array(buffer)); } catch { throw new Error('Не удалось открыть XLSX. Файл повреждён или имеет другой формат.'); }
  const fileText = (path) => files[path] ? strFromU8(files[path]) : null;
  const workbookText = fileText('xl/workbook.xml');
  if (!workbookText) throw new Error('Не найдено содержимое XLSX.');
  const workbook = xml(workbookText);
  const relsText = fileText('xl/_rels/workbook.xml.rels');
  const relationships = new Map();
  if (relsText) for (const relationship of descendants(xml(relsText),'Relationship')) {
    relationships.set(relationship.getAttribute('Id'),relationship.getAttribute('Target'));
  }
  const strings = [];
  const shared = fileText('xl/sharedStrings.xml');
  if (shared) for (const si of descendants(xml(shared),'si')) {
    strings.push(descendants(si,'t').map(node=>node.textContent).join(''));
  }
  const worksheets = [];
  for (const sheet of descendants(workbook,'sheet')) {
    const id = sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
    const target = relationships.get(id);
    if (!target) continue;
    const normalized = target.startsWith('/') ? target.replace(/^\/+/, '') :
      target.startsWith('xl/') ? target : 'xl/' + target.replace(/^(\.\.\/)+/g,'');
    const text = fileText(normalized);
    if (!text) continue;
    const data = xml(text);
    const rows = [];
    for (const row of descendants(data,'row')) {
      const rowIndex = Number(row.getAttribute('r')) - 1;
      const cells = [];
      for (const cell of descendants(row,'c')) {
        const col = colIndex(cell.getAttribute('r') || '');
        if (col < 0 || col > 1000) continue;
        const type = cell.getAttribute('t');
        const val = first(cell,'v')?.textContent ?? '';
        const inline = first(cell,'is');
        cells[col] = type === 's' ? (strings[Number(val)] ?? '') :
          type === 'inlineStr' ? (inline ? descendants(inline,'t').map(n=>n.textContent).join('') : '') :
          val;
      }
      if (Number.isInteger(rowIndex) && rowIndex >= 0 && rowIndex < 1000000) rows[rowIndex] = cells;
    }
    worksheets.push(rows);
  }
  if (!worksheets.length) throw new Error('В книге нет читаемых листов.');
  return worksheets;
}
function parseDelimited(source, delimiter) {
  const rows = [], row = [];
  let current = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { current += '"'; i++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(current); current='';
    } else if ((char === '\r' || char === '\n') && !quoted) {
      if (char === '\r' && source[i+1] === '\n') i++;
      row.push(current);
      rows.push(row.splice(0));
      current = '';
    } else current += char;
  }
  if (quoted) throw new Error('В CSV не закрыта кавычка.');
  if (current || row.length) {row.push(current);rows.push(row);}
  return rows;
}
function escXml(value) {
  return safeText(value).replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
}
export function createResultsWorkbook(rows) {
  const records = [['Баркод','Количество'],...rows.map(x => [String(x.barcode),x.quantity])];
  const sheetRows = records.map((values, index) => {
    const colA = '<c r="A'+(index+1)+'" t="inlineStr"><is><t>'+escXml(values[0])+'</t></is></c>';
    const colB = index ? '<c r="B'+(index+1)+'"><v>'+Number(values[1])+'</v></c>' :
      '<c r="B1" t="inlineStr"><is><t>Количество</t></is></c>';
    return '<row r="'+(index+1)+'">'+colA+colB+'</row>';
  }).join('');
  const entries = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Остатки" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/></cols><sheetData>'+sheetRows+'</sheetData></worksheet>'
  };
  return zipSync(Object.fromEntries(Object.entries(entries).map(([k,v])=>[k,strToU8(v)])),{level:6});
}
export function downloadWorkbook(rows) {
  const bytes=createResultsWorkbook(rows);
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const a=document.createElement('a'); a.href=url;
  a.download='Остатки_после_вычета_New_'+new Date().toISOString().slice(0,10)+'.xlsx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
