import {
  AlignmentType, BorderStyle, Document, ImageRun, Packer, Paragraph, ShadingType,
  Table, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType
} from 'docx';

const COLORS = { ink: '202938', body: '465163', muted: '7A8699', blue: '2563EB', paleBlue: 'EDF4FF', line: 'D9DFE8' };
const CONTENT_WIDTH = 10080;
const borders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line }, bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line },
  left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line }, right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line }
};

const cleanLines = (value = '') => value.split('\n').map((line) => line.trim()).filter(Boolean);
const meaningfulRows = (table) => (table?.rows || []).filter((row) => row.some((cell) => cell && cell !== '—'));

function heading(text, level = 1) {
  return new Paragraph({ style: level === 1 ? 'SectionHeading' : 'Subheading', keepNext: true, children: [new TextRun(text)] });
}

function paragraph(text, options = {}) {
  return new Paragraph({ style: 'BodyText', ...options, children: [new TextRun(text || '')] });
}

function addTextSection(children, title, value) {
  const lines = cleanLines(value);
  if (!lines.length) return;
  children.push(heading(title));
  lines.forEach((line) => children.push(paragraph(line)));
}

function dataUrlBytes(dataUrl) {
  const binary = atob(dataUrl.split(',', 2)[1] || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function fitImage(width, height) {
  const scale = Math.min(1, 560 / width, 390 / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function fixedTable(table, widths) {
  const rows = meaningfulRows(table);
  if (!rows.length) return null;
  const cell = (text, width, header = false, shade = false) => new TableCell({
    width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    shading: header ? { type: ShadingType.CLEAR, fill: COLORS.paleBlue, color: 'auto' } : shade ? { type: ShadingType.CLEAR, fill: 'F8FAFD', color: 'auto' } : undefined,
    margins: { top: 110, bottom: 110, left: 140, right: 140 },
    children: [new Paragraph({ children: [new TextRun({ text: text || '', bold: header, size: 19, color: header ? COLORS.ink : COLORS.body })] })]
  });
  const header = new TableRow({ cantSplit: true, tableHeader: true, children: table.headers.map((text, index) => cell(text, widths[index], true)) });
  const body = rows.map((row, rowIndex) => new TableRow({ cantSplit: true, children: widths.map((width, index) => cell(row[index] || '', width, false, rowIndex % 2 === 1)) }));
  return new Table({ width: { size: CONTENT_WIDTH, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: widths, borders, rows: [header, ...body] });
}

function keyValueTable(items) {
  const rows = items.filter(([, value]) => value).map(([label, value], index) => new TableRow({ cantSplit: true, children: [
    new TableCell({ width: { size: 3100, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: index % 2 ? 'F8FAFD' : COLORS.paleBlue, color: 'auto' }, margins: { top: 110, bottom: 110, left: 140, right: 140 }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 19, color: COLORS.ink })] })] }),
    new TableCell({ width: { size: 6980, type: WidthType.DXA }, margins: { top: 110, bottom: 110, left: 140, right: 140 }, children: cleanLines(value).map((line) => new Paragraph({ children: [new TextRun({ text: line, size: 19, color: COLORS.body })] })) })
  ] }));
  if (!rows.length) return null;
  return new Table({ width: { size: CONTENT_WIDTH, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: [3100, 6980], borders, rows });
}

function addTableSection(children, title, table, widths = [3300, 3300, 3480]) {
  const built = fixedTable(table, widths);
  if (!built) return;
  children.push(heading(title), built, new Paragraph({ spacing: { after: 100 }, children: [] }));
}

async function addImages(children, images) {
  if (!images.length) return;
  children.push(heading('Фото и материалы'));
  for (const image of images) {
    const size = fitImage(image.width || 1200, image.height || 900);
    children.push(
      heading(image.category || 'Материал', 2),
      new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 60, after: 80 }, children: [new ImageRun({ data: dataUrlBytes(image.src), type: 'jpg', transformation: size })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: image.caption || 'Без подписи', italics: true, size: 18, color: COLORS.muted })] })
    );
  }
}

export async function buildAnalyticsDocxBlob(data) {
  const children = [
    new Paragraph({ spacing: { after: 220 }, children: [new TextRun({ text: 'MYWORKSPACE  ДОСЬЕ ИЗДЕЛИЯ', bold: true, size: 18, color: COLORS.blue, characterSpacing: 80 })] }),
    new Paragraph({ style: 'Title', children: [new TextRun(data.title || 'Разработка товара')] }),
    new Paragraph({ spacing: { before: 30, after: 300 }, children: [new TextRun({ text: data.period || new Intl.DateTimeFormat('ru-RU').format(new Date()), size: 20, color: COLORS.muted })] })
  ];

  const passport = keyValueTable([['Категория', data.productCategory], ['Этап', data.projectStage], ['Ответственный', data.projectOwner], ['Задача проекта', data.projectGoal]]);
  if (passport) children.push(heading('Паспорт проекта'), passport);
  const market = keyValueTable([['Товаров в категории', data.marketVolume], ['Средняя цена', data.averagePrice], ['Сезонность', data.seasonality], ['Главный конкурент', data.competitorName], ['Цена конкурента', data.competitorPrice], ['Что ценят покупатели', data.marketStrengths], ['Риски и жалобы', data.marketRisks], ['Вывод по рынку', data.observation]]);
  if (market) children.push(heading('Рынок и конкуренты'), market);

  await addImages(children, data.images || []);
  addTextSection(children, 'Примерка и образцы', data.fittingNotes);
  addTextSection(children, 'Дефекты и доработки', data.productDefects);
  addTableSection(children, 'Замеры', data.measurements, [2700, 4580, 2800]);
  addTableSection(children, 'Хронология разработки', data.timeline, [2100, 5480, 2500]);
  addTableSection(children, 'Экономика единицы', data.economics, [3500, 2400, 4180]);

  const fabric = keyValueTable([['Расход ткани', data.fabricConsumption], ['Стоимость ткани', data.fabricPrice], ['Стоимость пошива', data.sewingCost], ['Источник ткани', data.fabricSource], ['Минимальный заказ', data.fabricMoq], ['Комментарий', data.fabricNotes]]);
  if (fabric) children.push(heading('Ткань и производство'), fabric);
  const launch = keyValueTable([['Цвета запуска', data.launchColors], ['Лучший месяц запуска', data.launchMonth], ['Посылки и логистика', data.parcelNotes]]);
  if (launch) children.push(heading('План запуска'), launch);
  addTableSection(children, 'Первый заказ', data.sizes, [2500, 3000, 4580]);
  addTextSection(children, 'Итоговое решение', data.conclusion);

  const actions = cleanLines(data.actions);
  if (actions.length) {
    children.push(heading('Следующие действия'));
    actions.forEach((action) => children.push(new Paragraph({ style: 'BodyText', bullet: { level: 0 }, children: [new TextRun(action.replace(/^[•\-–\d.)\s]+/, ''))] })));
  }
  addTextSection(children, 'Описание товара', data.productDescription);

  const doc = new Document({
    creator: 'MyWorkspace', title: data.title || 'Досье изделия', description: 'Досье разработки товара, созданное в MyWorkspace',
    styles: { default: { document: { run: { font: 'Arial', size: 22, color: COLORS.body }, paragraph: { spacing: { after: 150, line: 300 } } } }, paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 38, bold: true, color: COLORS.ink }, paragraph: { spacing: { after: 40, line: 440 }, keepNext: true } },
      { id: 'SectionHeading', name: 'Section heading', basedOn: 'Normal', next: 'BodyText', quickFormat: true, run: { font: 'Arial', size: 23, bold: true, color: COLORS.ink }, paragraph: { spacing: { before: 320, after: 120 }, keepNext: true } },
      { id: 'Subheading', name: 'Subheading', basedOn: 'Normal', next: 'BodyText', quickFormat: true, run: { font: 'Arial', size: 19, bold: true, color: COLORS.blue }, paragraph: { spacing: { before: 180, after: 70 }, keepNext: true } },
      { id: 'BodyText', name: 'Body Text', basedOn: 'Normal', next: 'BodyText', run: { font: 'Arial', size: 22, color: COLORS.body }, paragraph: { spacing: { after: 150, line: 310 } } }
    ] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1000, right: 1080, bottom: 1000, left: 1080 } } }, children }]
  });

  return Packer.toBlob(doc);
}

export async function exportAnalyticsDocx(data, filename) {
  const blob = await buildAnalyticsDocxBlob(data);
  const link = window.document.createElement('a');
  link.href = URL.createObjectURL(blob); link.download = `${filename}.docx`; link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1500);
}
