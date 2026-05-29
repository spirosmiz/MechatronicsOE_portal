import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserRole, LaborRoleType } from '../lib/enums';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/labor-rates — list all rates ordered by role, then effectiveFrom desc
router.get('/', async (_req, res: Response) => {
  const rates = await prisma.laborRate.findMany({
    orderBy: [{ role: 'asc' }, { effectiveFrom: 'desc' }],
  });
  res.json(rates);
});

// GET /api/labor-rates/current — only the active rate per role
router.get('/current', async (_req, res: Response) => {
  const now = new Date();
  const rates = await prisma.laborRate.findMany({
    where: {
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  // Deduplicate: keep only the latest per role
  const byRole = new Map<string, (typeof rates)[number]>();
  for (const r of rates) {
    if (!byRole.has(r.role)) byRole.set(r.role, r);
  }
  res.json([...byRole.values()]);
});

// POST /api/labor-rates — create a new rate; closes previous active rate for same role
router.post(
  '/',
  requireRole(UserRole.admin),
  [
    body('role').isIn(Object.values(LaborRoleType)),
    body('ratePerHour').isFloat({ min: 0 }),
    body('effectiveFrom').isISO8601(),
  ],
  async (req, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { role, ratePerHour, currency, effectiveFrom } = req.body;
    const effectiveFromDate = new Date(effectiveFrom);

    // Close previous open rate for this role
    await prisma.laborRate.updateMany({
      where: { role, effectiveTo: null },
      data: { effectiveTo: effectiveFromDate },
    });

    const rate = await prisma.laborRate.create({
      data: {
        role,
        ratePerHour,
        currency: currency || 'EUR',
        effectiveFrom: effectiveFromDate,
      },
    });
    res.status(201).json(rate);
  }
);

// DELETE /api/labor-rates/:id — remove a rate (admin only)
router.delete('/:id', requireRole(UserRole.admin), async (req, res: Response) => {
  await prisma.laborRate.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
