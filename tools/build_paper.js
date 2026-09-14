const fs = require('fs');
const d = require('docx');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, HeightRule,
  convertMillimetersToTwip, PageNumber, Footer
} = d;

const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const OUTPATH = process.argv[3];

const FONT = { ascii: 'Microsoft JhengHei', eastAsia: '微軟正黑體', hAnsi: 'Microsoft JhengHei', cs: 'Microsoft JhengHei' };
const TOTAL = 9639;
const INK = '17231E', SUB = '5A6B62', ACCENT = '0E6B4F', GREY = 'F2F4F1';
const KEYS = ['A', 'B', 'C', 'D'];

const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const THIN = { style: BorderStyle.SINGLE, size: 4, color: 'BFC8C2' };
const allThin = { top: THIN, bottom: THIN, left: THIN, right: THIN };

const T = (t, o = {}) => new TextRun(Object.assign({ text: String(t), font: FONT }, o));
function P(t, o = {}) {
  const { size = 20, bold = false, color = INK, align, spacing, indent, border } = o;
  return new Paragraph({
    alignment: align, spacing: spacing || { before: 30, after: 30 }, indent, border,
    children: t === '' ? [] : [T(t, { size, bold, color })]
  });
}
function cell(children, width, o = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: o.shade ? { type: ShadingType.CLEAR, fill: o.shade, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    borders: o.borders || allThin,
    verticalAlign: o.valign,
    columnSpan: o.span,
    children
  });
}

const kids = [];

/* ---- title ---- */
kids.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 30 },
  children: [T('中正高工　115 學年度第一學期彈性課程　AI 應用入門與 iPAS 初級考照', { size: 18, color: SUB })]
}));
kids.push(new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 30, after: 30 },
  children: [T(payload.title.replace(/_/g, '　'), { size: 30, bold: true })]
}));
kids.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 0, after: 160 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: ACCENT } },
  children: [T(payload.subtitle, { size: 18, color: ACCENT })]
}));

/* ---- name row (blank papers only) ---- */
if (!payload.withAnswer) {
  const w = [1100, 2200, 1100, 1700, 1100, TOTAL - 1100 - 2200 - 1100 - 1700 - 1100];
  kids.push(new Table({
    columnWidths: w,
    width: { size: TOTAL, type: WidthType.DXA },
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
    rows: [new TableRow({
      height: { value: 420, rule: HeightRule.ATLEAST },
      children: [
        cell([P('班級', { size: 18, color: SUB })], w[0], { borders: { top: NONE, left: NONE, right: NONE, bottom: NONE } }),
        cell([P('')], w[1], { borders: { top: NONE, left: NONE, right: NONE, bottom: THIN } }),
        cell([P('座號', { size: 18, color: SUB })], w[2], { borders: { top: NONE, left: NONE, right: NONE, bottom: NONE } }),
        cell([P('')], w[3], { borders: { top: NONE, left: NONE, right: NONE, bottom: THIN } }),
        cell([P('姓名', { size: 18, color: SUB })], w[4], { borders: { top: NONE, left: NONE, right: NONE, bottom: NONE } }),
        cell([P('')], w[5], { borders: { top: NONE, left: NONE, right: NONE, bottom: THIN } })
      ]
    })]
  }));
  kids.push(P('作答說明：全部為單選題，請將答案填入題號前的括號內。情境題的題幹較長，建議先看最後的問句，再回頭讀題幹。',
    { size: 17, color: SUB, spacing: { before: 140, after: 60 } }));
}

/* ---- questions ---- */
payload.items.forEach((q, i) => {
  const no = i + 1;
  const tagLine = `W${('0' + q.w).slice(-2)}　${q.s}　${q.lc}　${q.t}`;

  kids.push(new Paragraph({
    spacing: { before: 200, after: 30 },
    children: [
      T(payload.withAnswer ? `${no}.　` : `（　　）${no}.　`, { size: 20, bold: true, color: ACCENT }),
      T(q.q, { size: 20 })
    ]
  }));
  if (payload.withAnswer) {
    kids.push(new Paragraph({
      spacing: { before: 0, after: 50 },
      indent: { left: 340 },
      children: [T(tagLine, { size: 15, color: SUB })]
    }));
  }

  q.o.forEach((opt, k) => {
    const isAns = payload.withAnswer && k === q.a;
    kids.push(new Paragraph({
      spacing: { before: 25, after: 25 },
      indent: { left: 560, hanging: 220 },
      children: [
        T(`(${KEYS[k]}) `, { size: 19, bold: isAns, color: isAns ? ACCENT : INK }),
        T(opt, { size: 19, bold: isAns, color: isAns ? ACCENT : INK })
      ]
    }));
  });

  if (payload.withAnswer) {
    kids.push(new Table({
      columnWidths: [TOTAL],
      width: { size: TOTAL, type: WidthType.DXA },
      rows: [new TableRow({
        cantSplit: true,
        children: [cell([
          new Paragraph({
            spacing: { before: 20, after: 20 },
            children: [
              T('答案 ' + KEYS[q.a] + '　', { size: 17, bold: true, color: ACCENT }),
              T(q.e, { size: 17, color: SUB })
            ]
          })
        ], TOTAL, { shade: GREY, borders: { top: THIN, bottom: THIN, left: NONE, right: NONE } })]
      })]
    }));
  }
});

/* ---- answer key table for blank papers ---- */
if (!payload.withAnswer) {
  kids.push(new Paragraph({ spacing: { before: 260, after: 60 }, children: [T('（本卷結束）', { size: 18, color: SUB })] }));
}

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 20, color: INK }, paragraph: { spacing: { line: 280 } } } } },
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertMillimetersToTwip(18), bottom: convertMillimetersToTwip(16),
          left: convertMillimetersToTwip(19), right: convertMillimetersToTwip(19)
        }
      }
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: ['— ', PageNumber.CURRENT, ' —'], font: FONT, size: 16, color: SUB })]
        })]
      })
    },
    children: kids
  }]
});

Packer.toBuffer(doc).then(b => {
  fs.writeFileSync(OUTPATH, b);
  console.log('  ->', OUTPATH.split('/').pop(), b.length, 'bytes');
});
