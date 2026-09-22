import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} from 'docx';

const COLORS = {
  ink: '202938',
  body: '465163',
  muted: '7A8699',
  blue: '2563EB',
  paleBlue: 'EDF4FF',
  line: 'D9DFE8',
  white: 'FFFFFF'
};

const pageBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line },
  left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line },
  right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLORS.line }
};

function sectionHeading(text) {
  return new Paragraph({
    style: 'SectionHeading',
    keepNext: true,
    children: [new TextRun(text)]
  });
}

function bodyParagraph(text) {
  return new Paragraph({
    style: 'BodyText',
    children: [new TextRun(text || '')]
  });
}

function dataUrlBytes(dataUrl) {
  const base64 = dataUrl.split(',', 2)[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function readImageSize(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = source;
  });
}

function fitImage(width, height) {
  const maxWidth = 278;
  const maxHeight = 205;
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

async function imageCell(image) {
  const size = image.width && image.height ? image : await readImageSize(image.src);
  const fitted = fitImage(size.width, size.height);
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 100, bottom: 120, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 90 },
        children: [new ImageRun({ data: dataUrlBytes(image.src), type: 'jpg', transformation: fitted })]
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 0, line: 230 },
        children: [new TextRun({ text: image.caption || 'Изображение', size: 18, color: COLORS.muted })]
      })
    ]
  });
}

function emptyImageCell() {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    margins: { top: 100, bottom: 120, left: 100, right: 100 },
    children: [new Paragraph('')]
  });
}

async function imagesTable(images) {
  const rows = [];
  for (let index = 0; index < images.length; index += 2) {
    const cells = [await imageCell(images[index])];
    cells.push(images[index + 1] ? await imageCell(images[index + 1]) : emptyImageCell());
    rows.push(new TableRow({ cantSplit: true, children: cells }));
  }
  const none = { style: BorderStyle.NONE, size: 0, color: COLORS.white };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows
  });
}

function reportTable({ headers, rows }) {
  const widths = [46, 27, 27];
  const header = new TableRow({
    cantSplit: true,
    tableHeader: true,
    children: headers.map((text, index) => new TableCell({
      width: { size: widths[index] || 27, type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
      shading: { type: ShadingType.CLEAR, fill: COLORS.paleBlue, color: 'auto' },
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      children: [new Paragraph({ children: [new TextRun({ text: text || '', bold: true, size: 19, color: COLORS.ink })] })]
    }))
  });
  const bodyRows = rows.map((row, rowIndex) => new TableRow({
    cantSplit: true,
    children: row.map((text, index) => new TableCell({
      width: { size: widths[index] || 27, type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
      shading: rowIndex % 2 ? { type: ShadingType.CLEAR, fill: 'F8FAFD', color: 'auto' } : undefined,
      margins: { top: 110, bottom: 110, left: 140, right: 140 },
      children: [new Paragraph({ children: [new TextRun({ text: text || '', size: 19, color: COLORS.body })] })]
    }))
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: pageBorders,
    rows: [header, ...bodyRows]
  });
}

function hasMeaningfulTable(table) {
  return table.rows.some((row) => row.some((cell) => cell && cell !== '—' && cell !== 'Наименование' && cell !== 'Результат'));
}

export async function exportAnalyticsDocx(data, filename) {
  const children = [
    new Paragraph({
      spacing: { after: 220 },
      children: [new TextRun({ text: 'MYWORKSPACE  АНАЛИТИКА', bold: true, size: 18, color: COLORS.blue, characterSpacing: 80 })]
    }),
    new Paragraph({ style: 'Title', children: [new TextRun(data.title || 'Аналитический отчёт')] }),
    new Paragraph({
      spacing: { before: 30, after: 360 },
      children: [new TextRun({ text: data.period || new Intl.DateTimeFormat('ru-RU').format(new Date()), size: 20, color: COLORS.muted })]
    })
  ];

  if (data.observation) {
    children.push(sectionHeading('Наблюдение'));
    data.observation.split('\n').filter(Boolean).forEach((line) => children.push(bodyParagraph(line)));
  }

  if (data.images.length) {
    children.push(sectionHeading('Материалы'));
    children.push(await imagesTable(data.images));
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }

  if (hasMeaningfulTable(data.table)) {
    children.push(sectionHeading('Данные'));
    children.push(reportTable(data.table));
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }

  if (data.conclusion) {
    children.push(sectionHeading('Вывод'));
    data.conclusion.split('\n').filter(Boolean).forEach((line) => children.push(bodyParagraph(line)));
  }

  const actions = data.actions.split('\n').map((line) => line.trim()).filter(Boolean);
  if (actions.length) {
    children.push(sectionHeading('Следующие действия'));
    actions.forEach((action) => children.push(new Paragraph({
      style: 'BodyText',
      bullet: { level: 0 },
      children: [new TextRun(action.replace(/^[•\-–\d.)\s]+/, ''))]
    })));
  }

  const document = new Document({
    creator: 'MyWorkspace',
    title: data.title || 'Аналитический отчёт',
    description: 'Аналитический отчёт, созданный в MyWorkspace',
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22, color: COLORS.body },
          paragraph: { spacing: { after: 150, line: 300 } }
        }
      },
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Arial', size: 38, bold: true, color: COLORS.ink },
          paragraph: { spacing: { before: 0, after: 40, line: 440 }, keepNext: true }
        },
        {
          id: 'SectionHeading',
          name: 'Section heading',
          basedOn: 'Normal',
          next: 'BodyText',
          quickFormat: true,
          run: { font: 'Arial', size: 21, bold: true, color: COLORS.ink },
          paragraph: { spacing: { before: 320, after: 120 }, keepNext: true }
        },
        {
          id: 'BodyText',
          name: 'Body Text',
          basedOn: 'Normal',
          next: 'BodyText',
          run: { font: 'Arial', size: 22, color: COLORS.body },
          paragraph: { spacing: { after: 150, line: 310 } }
        }
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1000, right: 1080, bottom: 1000, left: 1080 }
        }
      },
      children
    }]
  });

  const blob = await Packer.toBlob(document);
  const link = documentElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.docx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1500);
}

function documentElement(tagName) {
  return window.document.createElement(tagName);
}
