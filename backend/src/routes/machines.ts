import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserRole } from '../lib/enums';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

const parseMachine = (m: any) => ({
  ...m,
  technicalSpecs: m.technicalSpecs ? JSON.parse(m.technicalSpecs) : null,
});

// GET /api/machines
router.get('/', async (req, res: Response) => {
  const { customerId } = req.query;
  const machines = await prisma.machine.findMany({
    where: customerId ? { customerId: String(customerId) } : undefined,
    include: { customer: { select: { id: true, companyName: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(machines.map(parseMachine));
});

// GET /api/machines/:id
router.get('/:id', async (req, res: Response) => {
  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
    include: {
      customer: { select: { id: true, companyName: true } },
      projects: { orderBy: { createdAt: 'desc' }, select: { id: true, title: true, status: true, type: true, createdAt: true } },
    },
  });
  if (!machine) { res.status(404).json({ message: 'Machine not found' }); return; }
  res.json(parseMachine(machine));
});

// POST /api/machines
router.post(
  '/',
  requireRole(UserRole.admin, UserRole.project_manager),
  [body('name').trim().notEmpty(), body('customerId').optional().isUUID()],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { customerId, name, model, serialNumber, manufacturer, technicalSpecs } = req.body;

    if (serialNumber) {
      const exists = await prisma.machine.findUnique({ where: { serialNumber } });
      if (exists) { res.status(409).json({ message: 'Serial number already registered' }); return; }
    }

    const machine = await prisma.machine.create({
      data: {
        customerId,
        name,
        model,
        serialNumber,
        manufacturer,
        technicalSpecs: technicalSpecs != null ? JSON.stringify(technicalSpecs) : undefined,
      },
      include: { customer: { select: { id: true, companyName: true } } },
    });
    res.status(201).json(parseMachine(machine));
  }
);

// PUT /api/machines/:id
router.put('/:id', requireRole(UserRole.admin, UserRole.project_manager), async (req, res: Response) => {
  const { customerId, name, model, serialNumber, manufacturer, technicalSpecs } = req.body;
  const machine = await prisma.machine.update({
    where: { id: req.params.id },
    data: {
      customerId,
      name,
      model,
      serialNumber,
      manufacturer,
      technicalSpecs: technicalSpecs != null ? JSON.stringify(technicalSpecs) : undefined,
    },
    include: { customer: { select: { id: true, companyName: true } } },
  });
  res.json(parseMachine(machine));
});

// DELETE /api/machines/:id
router.delete('/:id', requireRole(UserRole.admin), async (req, res: Response) => {
  await prisma.machine.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
