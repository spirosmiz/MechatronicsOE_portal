import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserRole } from '../lib/enums';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

const FULL_INCLUDE = {
  _count: { select: { invoices: true } },
};

// GET /api/suppliers
router.get('/', async (_req, res: Response) => {
  const suppliers = await prisma.supplier.findMany({
    include: FULL_INCLUDE,
    orderBy: { companyName: 'asc' },
  });
  res.json(suppliers);
});

// GET /api/suppliers/:id
router.get('/:id', async (req, res: Response): Promise<void> => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: req.params.id },
    include: {
      invoices: {
        select: { id: true, invoiceNumber: true, totalAmount: true, status: true, issueDate: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!supplier) { res.status(404).json({ message: 'Supplier not found' }); return; }
  res.json(supplier);
});

// POST /api/suppliers
router.post(
  '/',
  requireRole(UserRole.admin, UserRole.project_manager),
  [body('companyName').trim().notEmpty()],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { companyName, vatNumber, contactPerson, email, phone, address, categories } = req.body;

    const supplier = await prisma.supplier.create({
      data: {
        companyName,
        vatNumber: vatNumber || null,
        contactPerson: contactPerson || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        categories: JSON.stringify(categories ?? []),
      },
      include: FULL_INCLUDE,
    });
    res.status(201).json(supplier);
  }
);

// PUT /api/suppliers/:id
router.put(
  '/:id',
  requireRole(UserRole.admin, UserRole.project_manager),
  [body('companyName').trim().notEmpty()],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { companyName, vatNumber, contactPerson, email, phone, address, categories } = req.body;

    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: {
        companyName,
        vatNumber: vatNumber || null,
        contactPerson: contactPerson || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        categories: JSON.stringify(categories ?? []),
      },
      include: FULL_INCLUDE,
    });
    res.json(supplier);
  }
);

// DELETE /api/suppliers/:id
router.delete('/:id', requireRole(UserRole.admin), async (req, res: Response) => {
  await prisma.supplier.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
