import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, BorderStyle, VerticalAlign, ImageRun,
} from 'docx';

const LOGO_PATH = path.join(__dirname, '../../assets/machautolabs.png');
const logoExists = fs.existsSync(LOGO_PATH);

export type OfferDocumentData = {
  id: string;
  title: string;
  description?: string | null;
  offerDate: Date | string;
  validUntil: Date | string;
  status: string;
  paymentStatus: string;
  totalAmount: string | number;
  notes?: string | null;
  customer?: {
    companyName: string;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  machines?: { machine: { name: string; model?: string | null }; notes?: string | null }[];
  items?: { description: string; quantity: number; unitPrice: string | number }[];
};

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtCurrency(n: string | number) {
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export async function generateOfferPdf(offer: OfferDocumentData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW = 595.28;
    const M = 50;
    const W = PW - M * 2; // 495.28

    // ── Header bar ──────────────────────────────────────────
    doc.rect(0, 0, PW, 75).fill('#0f172a');

    if (logoExists) {
      doc.image(LOGO_PATH, M, 10, { height: 55, fit: [160, 55] });
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff')
         .text('AUTOMECHLABS', M + 170, 20, { width: W - 170 });
      doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
         .text('Industrial Automation & Retrofit Solutions', M + 170, 40, { width: W - 170 });
    } else {
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff')
         .text('AUTOMECHLABS', M, 18, { width: W });
      doc.fontSize(9).font('Helvetica').fillColor('#94a3b8')
         .text('Industrial Automation & Retrofit Solutions', M, 44, { width: W });
    }

    // ── Blue title stripe ────────────────────────────────────
    doc.rect(0, 75, PW, 28).fill('#1d4ed8');
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#ffffff')
       .text('COMMERCIAL OFFER', M, 83, { width: W });
    doc.fillColor('#000000');

    // ── Reference box (top-right) ────────────────────────────
    const boxX = PW - M - 190;
    const boxY = 118;
    doc.rect(boxX, boxY, 190, 88).strokeColor('#e2e8f0').lineWidth(1).stroke();
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b')
       .text('REFERENCE', boxX + 8, boxY + 8);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a')
       .text(offer.title, boxX + 8, boxY + 20, { width: 174 });
    doc.fontSize(8).font('Helvetica').fillColor('#374151')
       .text(`Date:  ${fmtDate(offer.offerDate)}`, boxX + 8, boxY + 44)
       .text(`Valid: ${fmtDate(offer.validUntil)}`, boxX + 8, boxY + 57)
       .text(`Status: ${offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}`, boxX + 8, boxY + 70);
    doc.fillColor('#000000');

    // ── Bill To block (left) ─────────────────────────────────
    let cy = 118;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b')
       .text('BILL TO', M, cy);
    cy += 14;
    if (offer.customer) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a')
         .text(offer.customer.companyName, M, cy, { width: boxX - M - 15 });
      cy += 14;
      doc.fontSize(8.5).font('Helvetica').fillColor('#374151');
      for (const line of [
        offer.customer.contactPerson,
        offer.customer.email,
        offer.customer.phone,
        offer.customer.address,
      ]) {
        if (line) { doc.text(line, M, cy, { width: boxX - M - 15 }); cy += 12; }
      }
    }
    if (offer.machines && offer.machines.length > 0) {
      cy += 4;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569').text('Machines:', M, cy);
      cy += 12;
      for (const om of offer.machines) {
        const ml = `${om.machine.name}${om.machine.model ? ` (${om.machine.model})` : ''}${om.notes ? ` — ${om.notes}` : ''}`;
        doc.fontSize(8).font('Helvetica').fillColor('#374151').text(`• ${ml}`, M + 6, cy, { width: boxX - M - 20 });
        cy += 12;
      }
      doc.fillColor('#000000');
    }

    // ── Items table ──────────────────────────────────────────
    const tableTop = Math.max(cy, boxY + 92) + 20;
    const COL = { desc: M, qty: M + 305, rate: M + 355, total: M + 415 };
    const COL_W = { desc: 295, qty: 45, rate: 55, total: 80 };

    // Header row
    doc.rect(M, tableTop, W, 20).fill('#1e293b');
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('Description', COL.desc + 5, tableTop + 6, { width: COL_W.desc });
    doc.text('Qty', COL.qty, tableTop + 6, { width: COL_W.qty, align: 'right' });
    doc.text('Rate €', COL.rate, tableTop + 6, { width: COL_W.rate, align: 'right' });
    doc.text('Amount', COL.total, tableTop + 6, { width: COL_W.total, align: 'right' });
    doc.fillColor('#000000');

    let ry = tableTop + 22;
    for (let i = 0; i < (offer.items ?? []).length; i++) {
      const item = (offer.items ?? [])[i];
      const lineTotal = Number(item.quantity) * Number(item.unitPrice);
      if (i % 2 === 1) doc.rect(M, ry - 3, W, 17).fill('#f8fafc');
      doc.fontSize(8.5).font('Helvetica').fillColor('#111827');
      doc.text(item.description, COL.desc + 5, ry, { width: COL_W.desc - 5, ellipsis: true });
      doc.text(String(item.quantity), COL.qty, ry, { width: COL_W.qty, align: 'right' });
      doc.text(fmtCurrency(item.unitPrice), COL.rate, ry, { width: COL_W.rate, align: 'right' });
      doc.text(fmtCurrency(lineTotal), COL.total, ry, { width: COL_W.total, align: 'right' });
      ry += 17;
    }

    // Divider
    ry += 4;
    doc.rect(M, ry, W, 1).fill('#cbd5e1');
    ry += 8;

    // Total row
    doc.rect(COL.qty - 10, ry - 4, W - (COL.qty - M) + 10, 24).fill('#0f172a');
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff')
       .text('TOTAL', COL.qty, ry + 3, { width: COL_W.qty + COL_W.rate + 10 })
       .text(fmtCurrency(offer.totalAmount), COL.total, ry + 3, { width: COL_W.total, align: 'right' });
    doc.fillColor('#000000');
    ry += 35;

    // ── Notes / Description ──────────────────────────────────
    if (offer.description) {
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#374151').text('Scope of Work:', M, ry);
      ry += 13;
      doc.font('Helvetica').fillColor('#374151').text(offer.description, M, ry, { width: W });
      ry += doc.heightOfString(offer.description, { width: W }) + 12;
    }
    if (offer.notes) {
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#374151').text('Notes & Terms:', M, ry);
      ry += 13;
      doc.font('Helvetica').fillColor('#64748b').text(offer.notes, M, ry, { width: W });
    }

    // ── Footer ───────────────────────────────────────────────
    const footerY = 805;
    doc.rect(0, footerY, PW, 1).fill('#e2e8f0');
    doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8')
       .text(
         `AUTOMECHLABS  •  Generated ${fmtDate(new Date())}  •  Offer valid until ${fmtDate(offer.validUntil)}`,
         M, footerY + 7, { width: W, align: 'center' }
       );

    doc.end();
  });
}

// ─── DOCX ─────────────────────────────────────────────────────────────────────

const NO_BORDER = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};

type CellAlign = (typeof AlignmentType)[keyof typeof AlignmentType];

function cell(
  text: string,
  opts: { bold?: boolean; align?: CellAlign; color?: string; size?: number; width?: number; shading?: string } = {}
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: opts.bold ?? false,
            color: opts.color ?? '000000',
            size: opts.size ?? 20,
          }),
        ],
      }),
    ],
    verticalAlign: VerticalAlign.CENTER,
    borders: NO_BORDER,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.shading ? { fill: opts.shading } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

export async function generateOfferDocx(offer: OfferDocumentData): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Logo + Title
  if (logoExists) {
    const logoBuffer = fs.readFileSync(LOGO_PATH);
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: logoBuffer,
            transformation: { width: 160, height: 55 },
            type: 'png',
          }),
        ],
      }),
    );
  }
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'AUTOMECHLABS', bold: true, size: 36, color: '0f172a' })],
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Industrial Automation & Retrofit Solutions', size: 18, color: '64748b' })],
    }),
    new Paragraph({ children: [new TextRun({ text: '' })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'COMMERCIAL OFFER', bold: true, size: 40, color: '1d4ed8' })],
    }),
    new Paragraph({ children: [new TextRun({ text: '' })] }),
  );

  // Reference info
  children.push(
    new Table({
      width: { size: 9000, type: WidthType.DXA },
      rows: [
        ['Reference', offer.title],
        ['Date', fmtDate(offer.offerDate)],
        ['Valid Until', fmtDate(offer.validUntil)],
        ['Status', offer.status.charAt(0).toUpperCase() + offer.status.slice(1)],
      ].map(([label, value]) =>
        new TableRow({
          children: [
            cell(label, { bold: true, color: '374151', width: 2000 }),
            cell(value, { width: 7000 }),
          ],
        })
      ),
      borders: NO_BORDER,
    }),
    new Paragraph({ children: [new TextRun({ text: '' })] }),
  );

  // Customer
  if (offer.customer) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: 'BILL TO', bold: true, size: 18, color: '64748b' })] }),
      new Paragraph({ children: [new TextRun({ text: offer.customer.companyName, bold: true, size: 24 })] }),
    );
    for (const line of [
      offer.customer.contactPerson,
      offer.customer.email,
      offer.customer.phone,
      offer.customer.address,
    ]) {
      if (line) children.push(new Paragraph({ children: [new TextRun({ text: line, size: 18, color: '374151' })] }));
    }
    children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  }

  if (offer.machines && offer.machines.length > 0) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: 'Machines', bold: true, size: 18, color: '374151' })] }),
    );
    for (const om of offer.machines) {
      const ml = `${om.machine.name}${om.machine.model ? ` (${om.machine.model})` : ''}${om.notes ? ` — ${om.notes}` : ''}`;
      children.push(
        new Paragraph({ children: [new TextRun({ text: `• ${ml}`, size: 18, color: '374151' })] }),
      );
    }
    children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  }

  // Items table
  children.push(
    new Paragraph({ children: [new TextRun({ text: 'COST BREAKDOWN', bold: true, size: 20, color: '0f172a' })] }),
    new Paragraph({ children: [new TextRun({ text: '' })] }),
  );

  const headerRow = new TableRow({
    children: [
      cell('Description', { bold: true, color: 'ffffff', shading: '1e293b', width: 5500 }),
      cell('Qty', { bold: true, color: 'ffffff', shading: '1e293b', align: AlignmentType.RIGHT, width: 800 }),
      cell('Rate €', { bold: true, color: 'ffffff', shading: '1e293b', align: AlignmentType.RIGHT, width: 1200 }),
      cell('Amount', { bold: true, color: 'ffffff', shading: '1e293b', align: AlignmentType.RIGHT, width: 1500 }),
    ],
    tableHeader: true,
  });

  const itemRows = (offer.items ?? []).map((item, i) => {
    const shade = i % 2 === 1 ? 'f8fafc' : 'ffffff';
    const lineTotal = Number(item.quantity) * Number(item.unitPrice);
    return new TableRow({
      children: [
        cell(item.description, { shading: shade, width: 5500 }),
        cell(String(item.quantity), { shading: shade, align: AlignmentType.RIGHT, width: 800 }),
        cell(fmtCurrency(item.unitPrice), { shading: shade, align: AlignmentType.RIGHT, width: 1200 }),
        cell(fmtCurrency(lineTotal), { shading: shade, align: AlignmentType.RIGHT, width: 1500 }),
      ],
    });
  });

  const totalRow = new TableRow({
    children: [
      cell('', { shading: '0f172a', width: 5500 }),
      cell('', { shading: '0f172a', width: 800 }),
      cell('TOTAL', { bold: true, color: 'ffffff', shading: '0f172a', align: AlignmentType.RIGHT, width: 1200 }),
      cell(fmtCurrency(offer.totalAmount), { bold: true, color: 'ffffff', shading: '0f172a', align: AlignmentType.RIGHT, width: 1500 }),
    ],
  });

  children.push(
    new Table({
      width: { size: 9000, type: WidthType.DXA },
      rows: [headerRow, ...itemRows, totalRow],
      borders: NO_BORDER,
    }),
    new Paragraph({ children: [new TextRun({ text: '' })] }),
  );

  // Notes
  if (offer.description) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: 'Scope of Work', bold: true, size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: offer.description, size: 18, color: '374151' })] }),
      new Paragraph({ children: [new TextRun({ text: '' })] }),
    );
  }
  if (offer.notes) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: 'Notes & Terms', bold: true, size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: offer.notes, size: 18, color: '64748b' })] }),
    );
  }

  const document = new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20 },
        },
      },
    },
  });

  return Packer.toBuffer(document);
}
