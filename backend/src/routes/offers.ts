import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserRole, OfferStatus, PaymentStatus } from '../lib/enums';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

// Auto-expire sent offers whose validUntil has passed
async function autoExpire() {
  await prisma.offer.updateMany({
    where: { status: OfferStatus.sent, validUntil: { lt: new Date() } },
    data: { status: OfferStatus.expired },
  });
}

// GET /api/offers
router.get('/', async (req, res: Response) => {
  await autoExpire();
  const { customerId } = req.query as { customerId?: string };
  const offers = await prisma.offer.findMany({
    where: customerId ? { customerId } : undefined,
    include: {
      customer: { select: { id: true, companyName: true } },
      machine:  { select: { id: true, name: true, model: true } },
      creator:  { select: { id: true, name: true } },
      _count:   { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(offers);
});

// GET /api/offers/stats
router.get('/stats', async (_req, res: Response) => {
  await autoExpire();
  const [byStatus, byPayment, totalValue] = await Promise.all([
    prisma.offer.groupBy({ by: ['status'], _count: true }),
    prisma.offer.groupBy({ by: ['paymentStatus'], _count: true }),
    prisma.offer.aggregate({ _sum: { totalAmount: true } }),
  ]);
  res.json({
    byStatus,
    byPayment,
    totalValue: totalValue._sum.totalAmount,
    pendingCount: byStatus.find((s) => s.status === OfferStatus.sent)?._count ?? 0,
  });
});

// GET /api/offers/:id
router.get('/:id', async (req, res: Response) => {
  await autoExpire();
  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: {
      customer: { select: { id: true, companyName: true, email: true, contactPerson: true } },
      machine:  { select: { id: true, name: true, model: true } },
      creator:  { select: { id: true, name: true } },
      items:    { orderBy: { description: 'asc' } },
    },
  });
  if (!offer) { res.status(404).json({ message: 'Offer not found' }); return; }
  res.json(offer);
});

// POST /api/offers
router.post(
  '/',
  requireRole(UserRole.admin, UserRole.project_manager),
  [
    body('title').trim().notEmpty(),
    body('validUntil').isISO8601(),
    body('totalAmount').isFloat({ min: 0 }),
    body('items').optional().isArray(),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { customerId, machineId, title, description, offerDate, validUntil, totalAmount, notes, items } = req.body;

    const offer = await prisma.offer.create({
      data: {
        customerId: customerId || undefined,
        machineId:  machineId  || undefined,
        title,
        description,
        offerDate: offerDate ? new Date(offerDate) : undefined,
        validUntil: new Date(validUntil),
        totalAmount,
        notes,
        createdBy: req.user!.userId,
        ...(items?.length && {
          items: {
            create: items.map((item: { description: string; quantity: number; unitPrice: number }) => ({
              description: item.description,
              quantity: item.quantity ?? 1,
              unitPrice: item.unitPrice,
            })),
          },
        }),
      },
      include: {
        customer: { select: { id: true, companyName: true } },
        machine:  { select: { id: true, name: true, model: true } },
        creator:  { select: { id: true, name: true } },
        items: true,
      },
    });
    res.status(201).json(offer);
  }
);

// PUT /api/offers/:id
router.put('/:id', requireRole(UserRole.admin, UserRole.project_manager), async (req: AuthenticatedRequest, res: Response) => {
  const { customerId, machineId, title, description, offerDate, validUntil, totalAmount, notes } = req.body;
  const offer = await prisma.offer.update({
    where: { id: req.params.id },
    data: {
      customerId: customerId || undefined,
      machineId:  machineId  || null,
      title,
      description,
      offerDate: offerDate ? new Date(offerDate) : undefined,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      totalAmount,
      notes,
    },
    include: {
      customer: { select: { id: true, companyName: true } },
      machine:  { select: { id: true, name: true, model: true } },
      items: true,
    },
  });
  res.json(offer);
});

// PATCH /api/offers/:id/status
router.patch(
  '/:id/status',
  requireRole(UserRole.admin, UserRole.project_manager),
  [body('status').isIn(Object.values(OfferStatus))],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }
    const offer = await prisma.offer.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
    });
    res.json(offer);
  }
);

// PATCH /api/offers/:id/payment
router.patch(
  '/:id/payment',
  requireRole(UserRole.admin, UserRole.project_manager),
  [body('paymentStatus').isIn(Object.values(PaymentStatus))],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }
    const offer = await prisma.offer.update({
      where: { id: req.params.id },
      data: { paymentStatus: req.body.paymentStatus },
    });
    res.json(offer);
  }
);

// POST /api/offers/:id/items
router.post('/:id/items', requireRole(UserRole.admin, UserRole.project_manager), async (req, res: Response) => {
  const { description, quantity, unitPrice } = req.body;
  const item = await prisma.offerItem.create({
    data: { offerId: req.params.id, description, quantity: quantity ?? 1, unitPrice },
  });
  res.status(201).json(item);
});

// PUT /api/offers/:id/items/:itemId
router.put('/:id/items/:itemId', requireRole(UserRole.admin, UserRole.project_manager), async (req, res: Response) => {
  const { description, quantity, unitPrice } = req.body;
  const item = await prisma.offerItem.update({
    where: { id: req.params.itemId },
    data: { description, quantity, unitPrice },
  });
  res.json(item);
});

// DELETE /api/offers/:id/items/:itemId
router.delete('/:id/items/:itemId', requireRole(UserRole.admin, UserRole.project_manager), async (req, res: Response) => {
  await prisma.offerItem.delete({ where: { id: req.params.itemId } });
  res.status(204).send();
});

// DELETE /api/offers/:id
router.delete('/:id', requireRole(UserRole.admin), async (req, res: Response) => {
  await prisma.offer.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
