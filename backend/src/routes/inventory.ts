import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserRole } from '../lib/enums';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

// GET /api/inventory
router.get('/', async (req, res: Response) => {
  const { lowStock } = req.query;
  const items = await prisma.inventory.findMany({ orderBy: { name: 'asc' } });
  // Field-to-field comparison isn't supported in Prisma WHERE, so filter in JS
  const result = items.map((i) => ({ ...i, isLowStock: i.stockQuantity <= i.safetyStockLevel }));
  if (lowStock === 'true') {
    res.json(result.filter((i) => i.isLowStock));
  } else {
    res.json(result);
  }
});

// GET /api/inventory/:id
router.get('/:id', async (req, res: Response) => {
  const item = await prisma.inventory.findUnique({ where: { id: req.params.id } });
  if (!item) { res.status(404).json({ message: 'Item not found' }); return; }
  res.json({ ...item, isLowStock: item.stockQuantity <= item.safetyStockLevel });
});

// POST /api/inventory
router.post(
  '/',
  requireRole(UserRole.admin, UserRole.project_manager),
  [
    body('partNumber').trim().notEmpty(),
    body('name').trim().notEmpty(),
    body('unitCost').isFloat({ min: 0 }),
    body('unitPrice').isFloat({ min: 0 }),
    body('stockQuantity').isInt({ min: 0 }),
    body('safetyStockLevel').isInt({ min: 0 }),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { partNumber, name, description, stockQuantity, safetyStockLevel, unitCost, unitPrice, ceCertified } = req.body;
    const exists = await prisma.inventory.findUnique({ where: { partNumber } });
    if (exists) { res.status(409).json({ message: 'Part number already exists' }); return; }

    const item = await prisma.inventory.create({
      data: { partNumber, name, description, stockQuantity, safetyStockLevel, unitCost, unitPrice, ceCertified: ceCertified ?? true },
    });
    res.status(201).json(item);
  }
);

// PUT /api/inventory/:id
router.put('/:id', requireRole(UserRole.admin, UserRole.project_manager), async (req, res: Response) => {
  const { partNumber, name, description, stockQuantity, safetyStockLevel, unitCost, unitPrice, ceCertified } = req.body;
  const item = await prisma.inventory.update({
    where: { id: req.params.id },
    data: { partNumber, name, description, stockQuantity, safetyStockLevel, unitCost, unitPrice, ceCertified },
  });
  res.json(item);
});

// PATCH /api/inventory/:id/stock
router.patch('/:id/stock', requireRole(UserRole.admin, UserRole.project_manager, UserRole.technician), async (req, res: Response) => {
  const { adjustment } = req.body; // positive = add, negative = subtract
  const item = await prisma.inventory.update({
    where: { id: req.params.id },
    data: { stockQuantity: { increment: adjustment } },
  });
  res.json(item);
});

// DELETE /api/inventory/:id
router.delete('/:id', requireRole(UserRole.admin), async (req, res: Response) => {
  await prisma.inventory.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
