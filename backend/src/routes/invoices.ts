import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import {
  UserRole, InvoiceDirection, InvoiceCategory, InvoiceStatus, PaymentMethod,
} from '../lib/enums';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { generateInvoicePdf } from '../lib/invoiceDocument';

const router = Router();
router.use(authenticate);

const FULL_INCLUDE = {
  items:    { orderBy: { description: 'asc' } as const },
  payments: { include: { recordedBy: { select: { id: true, name: true } } }, orderBy: { paidAt: 'desc' } as const },
  customer: { select: { id: true, companyName: true, vatNumber: true } },
  supplier: { select: { id: true, companyName: true, vatNumber: true } },
  project:  { select: { id: true, title: true } },
  offer:    { select: { id: true, title: true } },
  createdBy: { select: { id: true, name: true } },
};

// Generates the next invoice number for a given direction and year
async function nextInvoiceNumber(direction: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = direction === InvoiceDirection.OUTGOING ? 'INV' : 'EXP';
  const count = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: `${prefix}-${year}-` } },
  });
  return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
}

// Recalculates invoice status from payments, then mirrors into linked offer.paymentStatus
async function syncPaymentStatus(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { totalAmount: true, offerId: true, direction: true, payments: { select: { amount: true } } },
  });
  if (!invoice) return;

  const paid  = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
  const total = Number(invoice.totalAmount);

  let status: string;
  if (paid <= 0)       status = InvoiceStatus.ISSUED;
  else if (paid >= total) status = InvoiceStatus.PAID;
  else                 status = InvoiceStatus.PARTIALLY_PAID;

  await prisma.invoice.update({ where: { id: invoiceId }, data: { status } });

  // Mirror into linked offer when this is an outgoing invoice
  if (invoice.offerId && invoice.direction === InvoiceDirection.OUTGOING) {
    const offerPayment =
      status === InvoiceStatus.PAID             ? 'paid'
      : status === InvoiceStatus.PARTIALLY_PAID ? 'partially_paid'
      :                                           'invoiced';
    await prisma.offer.update({
      where: { id: invoice.offerId },
      data:  { paymentStatus: offerPayment },
    }).catch(() => {/* non-fatal */});
  }
}

// GET /api/invoices
router.get('/', async (req, res: Response) => {
  const { direction, status, category, customerId, supplierId, projectId } = req.query as Record<string, string>;

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(direction   && { direction }),
      ...(status      && { status }),
      ...(category    && { category }),
      ...(customerId  && { customerId }),
      ...(supplierId  && { supplierId }),
      ...(projectId   && { projectId }),
    },
    include: {
      customer:  { select: { id: true, companyName: true } },
      supplier:  { select: { id: true, companyName: true } },
      project:   { select: { id: true, title: true } },
      createdBy: { select: { id: true, name: true } },
      _count:    { select: { items: true, payments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(invoices);
});

// GET /api/invoices/stats
router.get('/stats', async (_req, res: Response) => {
  const [outgoing, incoming, byStatus, byCategory] = await Promise.all([
    prisma.invoice.aggregate({
      where: { direction: InvoiceDirection.OUTGOING },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { direction: InvoiceDirection.INCOMING },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.invoice.groupBy({ by: ['status'], _count: true, _sum: { totalAmount: true } }),
    prisma.invoice.groupBy({ by: ['category'], _count: true, _sum: { totalAmount: true } }),
  ]);

  const outstanding = await prisma.invoice.aggregate({
    where: {
      direction: InvoiceDirection.OUTGOING,
      status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
    },
    _sum: { totalAmount: true },
  });

  res.json({
    totalIncome:      outgoing._sum.totalAmount ?? 0,
    totalExpenses:    incoming._sum.totalAmount ?? 0,
    outgoingCount:    outgoing._count,
    incomingCount:    incoming._count,
    outstanding:      outstanding._sum.totalAmount ?? 0,
    byStatus,
    byCategory,
  });
});

// GET /api/invoices/:id
router.get('/:id', async (req, res: Response): Promise<void> => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: FULL_INCLUDE,
  });
  if (!invoice) { res.status(404).json({ message: 'Invoice not found' }); return; }
  res.json(invoice);
});

// POST /api/invoices
router.post(
  '/',
  requireRole(UserRole.admin, UserRole.project_manager),
  [
    body('direction').isIn(Object.values(InvoiceDirection)),
    body('category').isIn(Object.values(InvoiceCategory)),
    body('subtotal').isFloat({ min: 0 }),
    body('items').isArray({ min: 1 }),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const {
      direction, category, customerId, supplierId, projectId, offerId,
      subtotal, taxRate, items, currency, status, issueDate, dueDate, notes,
    } = req.body;

    const resolvedTaxRate = taxRate ?? 0.24;
    const taxAmount = Number(subtotal) * resolvedTaxRate;
    const totalAmount = Number(subtotal) + taxAmount;
    const invoiceNumber = await nextInvoiceNumber(direction);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        direction,
        category,
        customerId:  customerId  || null,
        supplierId:  supplierId  || null,
        projectId:   projectId   || null,
        offerId:     offerId     || null,
        subtotal:    Number(subtotal),
        taxRate:     resolvedTaxRate,
        taxAmount,
        totalAmount,
        currency:    currency || 'EUR',
        status:      status || InvoiceStatus.DRAFT,
        issueDate:   issueDate  ? new Date(issueDate)  : null,
        dueDate:     dueDate    ? new Date(dueDate)    : null,
        notes:       notes      || null,
        createdById: req.user!.userId,
        items: {
          create: (items as { description: string; quantity: number; unitPrice: number; hoursLogged?: number; hourlyRate?: number }[]).map((item) => ({
            description: item.description,
            quantity:    Number(item.quantity),
            unitPrice:   Number(item.unitPrice),
            lineTotal:   Number(item.quantity) * Number(item.unitPrice),
            hoursLogged: item.hoursLogged ? Number(item.hoursLogged) : null,
            hourlyRate:  item.hourlyRate  ? Number(item.hourlyRate)  : null,
          })),
        },
      },
      include: FULL_INCLUDE,
    });
    res.status(201).json(invoice);
  }
);

// PUT /api/invoices/:id — only DRAFT invoices can be fully edited
router.put(
  '/:id',
  requireRole(UserRole.admin, UserRole.project_manager),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const existing = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!existing) { res.status(404).json({ message: 'Invoice not found' }); return; }
    if (existing.status !== InvoiceStatus.DRAFT) {
      res.status(400).json({ message: 'Only DRAFT invoices can be edited' }); return;
    }

    const {
      category, customerId, supplierId, projectId, offerId,
      subtotal, taxRate, items, currency, issueDate, dueDate, notes,
    } = req.body;

    const resolvedTaxRate = taxRate ?? 0.24;
    const taxAmount  = Number(subtotal) * resolvedTaxRate;
    const totalAmount = Number(subtotal) + taxAmount;

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        category,
        customerId:  customerId  || null,
        supplierId:  supplierId  || null,
        projectId:   projectId   || null,
        offerId:     offerId     || null,
        subtotal:    Number(subtotal),
        taxRate:     resolvedTaxRate,
        taxAmount,
        totalAmount,
        currency:    currency || 'EUR',
        issueDate:   issueDate  ? new Date(issueDate)  : null,
        dueDate:     dueDate    ? new Date(dueDate)    : null,
        notes:       notes      || null,
      },
      include: FULL_INCLUDE,
    });

    // Replace items
    if (Array.isArray(items)) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: req.params.id } });
      if (items.length > 0) {
        await prisma.invoiceItem.createMany({
          data: (items as { description: string; quantity: number; unitPrice: number; hoursLogged?: number; hourlyRate?: number }[]).map((item) => ({
            invoiceId:   req.params.id,
            description: item.description,
            quantity:    Number(item.quantity),
            unitPrice:   Number(item.unitPrice),
            lineTotal:   Number(item.quantity) * Number(item.unitPrice),
            hoursLogged: item.hoursLogged ? Number(item.hoursLogged) : null,
            hourlyRate:  item.hourlyRate  ? Number(item.hourlyRate)  : null,
          })),
        });
      }
    }

    res.json(invoice);
  }
);

// PATCH /api/invoices/:id/status
router.patch(
  '/:id/status',
  requireRole(UserRole.admin, UserRole.project_manager),
  [body('status').isIn(Object.values(InvoiceStatus))],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
    });
    res.json(invoice);
  }
);

// GET /api/invoices/:id/pdf
router.get('/:id/pdf', async (req, res: Response): Promise<void> => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      items:    true,
      customer: { select: { companyName: true, vatNumber: true, contactPerson: true, email: true, phone: true, address: true } },
      supplier: { select: { companyName: true, vatNumber: true } },
      project:  { select: { title: true } },
    },
  });
  if (!invoice) { res.status(404).json({ message: 'Invoice not found' }); return; }

  try {
    const buffer = await generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      issueDate:     invoice.issueDate,
      dueDate:       invoice.dueDate,
      subtotal:      invoice.subtotal.toNumber(),
      taxRate:       invoice.taxRate.toNumber(),
      taxAmount:     invoice.taxAmount.toNumber(),
      totalAmount:   invoice.totalAmount.toNumber(),
      currency:      invoice.currency,
      notes:         invoice.notes,
      customer:      invoice.customer ?? null,
      supplier:      invoice.supplier ?? null,
      project:       invoice.project  ?? null,
      items:         invoice.items.map((it) => ({
        description: it.description,
        quantity:    it.quantity.toNumber(),
        unitPrice:   it.unitPrice.toNumber(),
        lineTotal:   it.lineTotal.toNumber(),
      })),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('[Invoice PDF] Generation failed:', err);
    res.status(500).json({ message: 'Failed to generate PDF' });
  }
});

// DELETE /api/invoices/:id — admin only, DRAFT or CANCELLED only
router.delete('/:id', requireRole(UserRole.admin), async (req, res: Response): Promise<void> => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { status: true } });
  if (!invoice) { res.status(404).json({ message: 'Invoice not found' }); return; }
  if (!([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED] as string[]).includes(invoice.status)) {
    res.status(400).json({ message: 'Only DRAFT or CANCELLED invoices can be deleted' }); return;
  }
  await prisma.invoice.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// POST /api/invoices/:id/payments — record a payment
router.post(
  '/:id/payments',
  requireRole(UserRole.admin, UserRole.project_manager),
  [
    body('amount').isFloat({ min: 0.01 }),
    body('paidAt').isISO8601(),
    body('method').isIn(Object.values(PaymentMethod)),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!invoice) { res.status(404).json({ message: 'Invoice not found' }); return; }

    const { amount, paidAt, method, reference, notes } = req.body;

    const payment = await prisma.payment.create({
      data: {
        invoiceId:    req.params.id,
        amount:       Number(amount),
        paidAt:       new Date(paidAt),
        method,
        reference:    reference || null,
        notes:        notes     || null,
        recordedById: req.user!.userId,
      },
      include: { recordedBy: { select: { id: true, name: true } } },
    });

    await syncPaymentStatus(req.params.id);

    res.status(201).json(payment);
  }
);

// DELETE /api/invoices/:id/payments/:paymentId
router.delete('/:id/payments/:paymentId', requireRole(UserRole.admin), async (req, res: Response) => {
  await prisma.payment.delete({ where: { id: req.params.paymentId } });
  await syncPaymentStatus(req.params.id);
  res.status(204).send();
});

export default router;
