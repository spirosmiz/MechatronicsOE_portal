import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserRole, StatusType, JobType } from '../lib/enums';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

const projectInclude = {
  customer: { select: { id: true, companyName: true } },
  machine: { select: { id: true, name: true, model: true } },
  creator: { select: { id: true, name: true } },
  projectMaterials: {
    include: { inventory: { select: { id: true, partNumber: true, name: true } } },
  },
  serviceReports: {
    include: { technician: { select: { id: true, name: true } } },
    orderBy: { submittedAt: 'desc' as const },
  },
};

// GET /api/projects
router.get('/', async (req, res: Response) => {
  const { status, type, customerId } = req.query;
  const projects = await prisma.project.findMany({
    where: {
      ...(status && { status: status as StatusType }),
      ...(type && { type: type as JobType }),
      ...(customerId && { customerId: String(customerId) }),
    },
    include: {
      customer: { select: { id: true, companyName: true } },
      machine: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
      _count: { select: { serviceReports: true, projectMaterials: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(projects);
});

// GET /api/projects/dashboard-stats
router.get('/dashboard-stats', async (_req, res: Response) => {
  const [total, byStatus, byType, recentProjects, lowStockCount] = await Promise.all([
    prisma.project.count(),
    prisma.project.groupBy({ by: ['status'], _count: true }),
    prisma.project.groupBy({ by: ['type'], _count: true }),
    prisma.project.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { companyName: true } } },
    }),
    prisma.inventory.count({ where: { stockQuantity: { lte: 5 } } }),
  ]);

  const totalValue = await prisma.project.aggregate({ _sum: { quotedTotalPrice: true } });

  res.json({ total, byStatus, byType, recentProjects, lowStockCount, totalValue: totalValue._sum.quotedTotalPrice });
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/projects/:id
router.get('/:id', async (req, res: Response) => {
  if (!UUID_RE.test(req.params.id)) {
    res.status(400).json({ message: 'Invalid project ID' });
    return;
  }
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: projectInclude,
  });
  if (!project) { res.status(404).json({ message: 'Project not found' }); return; }
  res.json(project);
});

// POST /api/projects
router.post(
  '/',
  requireRole(UserRole.admin, UserRole.project_manager),
  [
    body('title').trim().notEmpty(),
    body('type').isIn(Object.values(JobType)),
    body('quotedTotalPrice').isFloat({ min: 0 }),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const {
      customerId, machineId, title, type, status, estimatedLaborHours,
      quotedTotalPrice, termsAndConditions, materials,
    } = req.body;

    const project = await prisma.project.create({
      data: {
        customerId,
        machineId,
        title,
        type,
        status: status || StatusType.draft,
        estimatedLaborHours: estimatedLaborHours || 0,
        quotedTotalPrice,
        termsAndConditions,
        createdBy: req.user!.userId,
        ...(materials?.length && {
          projectMaterials: {
            create: materials.map((m: { inventoryId: string; quantityRequired: number; unitCostAtQuote: number; unitPriceAtQuote: number }) => ({
              inventoryId: m.inventoryId,
              quantityRequired: m.quantityRequired,
              unitCostAtQuote: m.unitCostAtQuote,
              unitPriceAtQuote: m.unitPriceAtQuote,
            })),
          },
        }),
      },
      include: projectInclude,
    });
    res.status(201).json(project);
  }
);

// PATCH /api/projects/:id/status
router.use('/:id', (req, res, next) => {
  if (!UUID_RE.test(req.params.id)) { res.status(400).json({ message: 'Invalid project ID' }); return; }
  next();
});

router.patch(
  '/:id/status',
  requireRole(UserRole.admin, UserRole.project_manager),
  [body('status').isIn(Object.values(StatusType))],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
      include: { customer: { select: { companyName: true } } },
    });
    res.json(project);
  }
);

// PUT /api/projects/:id
router.put('/:id', requireRole(UserRole.admin, UserRole.project_manager), async (req, res: Response) => {
  const {
    customerId, machineId, title, type, status, estimatedLaborHours,
    actualLaborHours, quotedTotalPrice, termsAndConditions,
  } = req.body;

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      customerId, machineId, title, type, status,
      estimatedLaborHours, actualLaborHours, quotedTotalPrice, termsAndConditions,
    },
    include: projectInclude,
  });
  res.json(project);
});

// POST /api/projects/:id/materials
router.post('/:id/materials', requireRole(UserRole.admin, UserRole.project_manager), async (req, res: Response) => {
  const { inventoryId, quantityRequired, unitCostAtQuote, unitPriceAtQuote } = req.body;
  const material = await prisma.projectMaterial.create({
    data: { projectId: req.params.id, inventoryId, quantityRequired, unitCostAtQuote, unitPriceAtQuote },
    include: { inventory: { select: { partNumber: true, name: true } } },
  });
  res.status(201).json(material);
});

// DELETE /api/projects/:id/materials/:materialId
router.delete('/:id/materials/:materialId', requireRole(UserRole.admin, UserRole.project_manager), async (req, res: Response) => {
  await prisma.projectMaterial.delete({ where: { id: req.params.materialId } });
  res.status(204).send();
});

// DELETE /api/projects/:id
router.delete('/:id', requireRole(UserRole.admin), async (req, res: Response) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
