import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

const LOGO_PATH = path.join(__dirname, '../../assets/machautolabs.png');
const logoExists = fs.existsSync(LOGO_PATH);

export type InvoiceDocumentData = {
  invoiceNumber: string;
  issueDate?: Date | string | null;
  dueDate?: Date | string | null;
  subtotal: string | number;
  taxRate: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  currency?: string;
  notes?: string | null;
  customer?: {
    companyName: string;
    vatNumber?: string | null;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  supplier?: {
    companyName: string;
    vatNumber?: string | null;
  } | null;
  project?: { title: string } | null;
  items: {
    description: string;
    quantity: string | number;
    unitPrice: string | number;
    lineTotal: string | number;
  }[];
};

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCurrency(n: string | number): string {
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export async function generateInvoicePdf(inv: InvoiceDocumentData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW = 595.28;
    const M  = 50;
    const W  = PW - M * 2;

    // ── Header bar ──────────────────────────────────────────────────────────
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

    // ── Green title stripe ───────────────────────────────────────────────────
    doc.rect(0, 75, PW, 28).fill('#15803d');
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#ffffff')
       .text('TAX INVOICE', M, 83, { width: W });
    doc.fillColor('#000000');

    // ── Reference box (top-right) ────────────────────────────────────────────
    const boxX = PW - M - 190;
    const boxY = 118;
    doc.rect(boxX, boxY, 190, 88).strokeColor('#e2e8f0').lineWidth(1).stroke();
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b')
       .text('INVOICE REFERENCE', boxX + 8, boxY + 8);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a')
       .text(inv.invoiceNumber, boxX + 8, boxY + 22);
    doc.fontSize(8).font('Helvetica').fillColor('#374151')
       .text(`Issue Date: ${fmtDate(inv.issueDate)}`, boxX + 8, boxY + 44)
       .text(`Due Date:   ${fmtDate(inv.dueDate)}`, boxX + 8, boxY + 57);
    if (inv.project?.title) {
      doc.fontSize(7.5).fillColor('#64748b')
         .text(inv.project.title, boxX + 8, boxY + 72, { width: 174, ellipsis: true });
    }
    doc.fillColor('#000000');

    // ── Bill To block (left) ─────────────────────────────────────────────────
    let cy = 118;
    const party = inv.customer ?? inv.supplier;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b')
       .text('BILL TO', M, cy);
    cy += 14;
    if (party) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a')
         .text(party.companyName, M, cy, { width: boxX - M - 15 });
      cy += 14;
      doc.fontSize(8.5).font('Helvetica').fillColor('#374151');
      const lines = [
        ('vatNumber' in party && party.vatNumber) ? `VAT: ${party.vatNumber}` : null,
        ('contactPerson' in party && party.contactPerson) ? party.contactPerson : null,
        ('email' in party && party.email)         ? party.email               : null,
        ('phone' in party && party.phone)         ? party.phone               : null,
        ('address' in party && party.address)     ? party.address             : null,
      ];
      for (const line of lines) {
        if (line) { doc.text(line as string, M, cy, { width: boxX - M - 15 }); cy += 12; }
      }
    }
    doc.fillColor('#000000');

    // ── Items table ──────────────────────────────────────────────────────────
    const tableTop = Math.max(cy, boxY + 92) + 20;
    const COL   = { desc: M, qty: M + 285, rate: M + 345, total: M + 415 };
    const COL_W = { desc: 275, qty: 55, rate: 65, total: 80 };

    // Header row
    doc.rect(M, tableTop, W, 20).fill('#1e293b');
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('Description', COL.desc + 5, tableTop + 6, { width: COL_W.desc });
    doc.text('Qty',         COL.qty,       tableTop + 6, { width: COL_W.qty,   align: 'right' });
    doc.text('Unit €',      COL.rate,      tableTop + 6, { width: COL_W.rate,  align: 'right' });
    doc.text('Amount',      COL.total,     tableTop + 6, { width: COL_W.total, align: 'right' });
    doc.fillColor('#000000');

    let ry = tableTop + 22;
    for (let i = 0; i < inv.items.length; i++) {
      const item = inv.items[i];
      if (i % 2 === 1) doc.rect(M, ry - 3, W, 17).fill('#f8fafc');
      doc.fontSize(8.5).font('Helvetica').fillColor('#111827');
      doc.text(item.description,            COL.desc + 5, ry, { width: COL_W.desc - 5, ellipsis: true });
      doc.text(String(Number(item.quantity).toFixed(2)), COL.qty, ry, { width: COL_W.qty, align: 'right' });
      doc.text(fmtCurrency(item.unitPrice), COL.rate,     ry, { width: COL_W.rate,  align: 'right' });
      doc.text(fmtCurrency(item.lineTotal), COL.total,    ry, { width: COL_W.total, align: 'right' });
      ry += 17;
    }

    // Divider
    ry += 6;
    doc.rect(M, ry, W, 0.5).fill('#cbd5e1');
    ry += 10;

    // Subtotal / VAT / Total summary
    const summaryX = COL.rate - 20;
    const summaryW = COL_W.rate + 20 + COL_W.total;
    const taxPct   = (Number(inv.taxRate) * 100).toFixed(0);

    doc.fontSize(8.5).font('Helvetica').fillColor('#374151');
    doc.text('Subtotal',          summaryX, ry, { width: summaryW - COL_W.total, align: 'right' });
    doc.text(fmtCurrency(inv.subtotal),  COL.total, ry, { width: COL_W.total, align: 'right' });
    ry += 16;
    doc.text(`VAT ${taxPct}%`,    summaryX, ry, { width: summaryW - COL_W.total, align: 'right' });
    doc.text(fmtCurrency(inv.taxAmount), COL.total, ry, { width: COL_W.total, align: 'right' });
    ry += 6;
    doc.rect(summaryX, ry, summaryW, 0.5).fill('#cbd5e1');
    ry += 8;

    // Total
    doc.rect(summaryX - 5, ry - 4, summaryW + 5, 24).fill('#0f172a');
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('TOTAL DUE', summaryX, ry + 3, { width: summaryW - COL_W.total, align: 'right' });
    doc.text(fmtCurrency(inv.totalAmount), COL.total, ry + 3, { width: COL_W.total, align: 'right' });
    doc.fillColor('#000000');
    ry += 38;

    // ── Notes ────────────────────────────────────────────────────────────────
    if (inv.notes) {
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#374151').text('Notes:', M, ry);
      ry += 13;
      doc.font('Helvetica').fillColor('#64748b').text(inv.notes, M, ry, { width: W });
      ry += doc.heightOfString(inv.notes, { width: W }) + 14;
    }

    // ── Payment instructions placeholder ─────────────────────────────────────
    doc.rect(M, ry, W, 0.5).fill('#e2e8f0');
    ry += 10;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151').text('PAYMENT INSTRUCTIONS', M, ry);
    ry += 12;
    doc.fontSize(8).font('Helvetica').fillColor('#64748b')
       .text('Please quote the invoice number when making payment. Payment due by the date shown above.', M, ry, { width: W });

    // ── Footer ───────────────────────────────────────────────────────────────
    const footerY = 805;
    doc.rect(0, footerY, PW, 0.5).fill('#e2e8f0');
    doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8')
       .text(
         `AUTOMECHLABS  •  Invoice ${inv.invoiceNumber}  •  Generated ${fmtDate(new Date())}`,
         M, footerY + 7, { width: W, align: 'center' }
       );

    doc.end();
  });
}
