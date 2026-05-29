import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserRole, StatusType, JobType, InvoiceDirection, InvoiceCategory, InvoiceStatus } from '../lib/enums';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

const projectInclude = {
  customer: { select: { id: true, companyName: true } },
  machine: { select: { id: true, name: true, model: true } },
  offer: { select: { id: true, title: true, items: true } },
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
      offer: { select: { id: true, title: true } },
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
router.post('/:id/materials', requireRole(UserRole.admin, UserRole.project_manager), async (req, res: Response): Promise<void> => {
  const {
    inventoryId, description, quantityRequired,
    unitCostAtQuote, unitPriceAtQuote,
    saveToInventory, partNumber, brand, stockQuantity,
  } = req.body;

  if (!inventoryId && !description) {
    res.status(400).json({ message: 'Either inventoryId or description is required' }); return;
  }

  let resolvedInventoryId: string | null = inventoryId || null;

  // Optionally create a new inventory item from the custom part data
  if (!inventoryId && saveToInventory) {
    // Auto-generate a unique part number if not provided
    const pn = (partNumber?.trim()) || `CUST-${Date.now().toString(36).toUpperCase()}`;

    // Ensure uniqueness — append suffix if already taken
    let finalPn = pn;
    const existing = await prisma.inventory.findUnique({ where: { partNumber: pn } });
    if (existing) {
      finalPn = `${pn}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    }

    const newItem = await prisma.inventory.create({
      data: {
        partNumber:      finalPn,
        name:            description!,
        brand:           brand?.trim()    || null,
        description:     null,
        stockQuantity:   Number(stockQuantity) || 0,
        safetyStockLevel: 0,
        unitCost:        Number(unitCostAtQuote  ?? unitPriceAtQuote),
        unitPrice:       Number(unitPriceAtQuote),
        ceCertified:     false,
      },
    });
    resolvedInventoryId = newItem.id;
  }

  const material = await prisma.projectMaterial.create({
    data: {
      projectId:        req.params.id,
      inventoryId:      resolvedInventoryId,
      description:      resolvedInventoryId ? null : (description || null),
      quantityRequired: Number(quantityRequired) || 1,
      unitCostAtQuote:  Number(unitCostAtQuote  ?? unitPriceAtQuote),
      unitPriceAtQuote: Number(unitPriceAtQuote),
    },
    include: { inventory: { select: { partNumber: true, name: true } } },
  });
  res.status(201).json(material);
});

// DELETE /api/projects/:id/materials/:materialId
router.delete('/:id/materials/:materialId', requireRole(UserRole.admin, UserRole.project_manager), async (req, res: Response) => {
  await prisma.projectMaterial.delete({ where: { id: req.params.materialId } });
  res.status(204).send();
});

// POST /api/projects/:id/generate-invoice
// Builds a draft outgoing invoice from service reports × labor rates + project materials
router.post(
  '/:id/generate-invoice',
  requireRole(UserRole.admin, UserRole.project_manager),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { select: { id: true, companyName: true, vatNumber: true, contactPerson: true, email: true, phone: true, address: true } },
        projectMaterials: { include: { inventory: { select: { partNumber: true, name: true } } } },
        serviceReports:   { include: { technician: { select: { id: true, name: true, role: true } } } },
      },
    });

    if (!project) { res.status(404).json({ message: 'Project not found' }); return; }

    // Fetch the currently active labor rates
    const now = new Date();
    const activeRates = await prisma.laborRate.findMany({
      where: {
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    // Deduplicate: one per role (latest wins)
    const rateByRole = new Map<string, number>();
    for (const r of activeRates) {
      if (!rateByRole.has(r.role)) rateByRole.set(r.role, Number(r.ratePerHour));
    }

    // Resolve the labor role: workType on the report takes priority;
    // falls back to SERVICE_ENGINEER when not set (backward compat with old reports)
    function resolveRole(workType: string | null | undefined): string {
      if (workType === 'SERVICE_ENGINEER' || workType === 'DESIGN_ENGINEER' || workType === 'PROJECT_MANAGER') {
        return workType;
      }
      return 'SERVICE_ENGINEER';
    }

    const WORK_TYPE_LABELS: Record<string, string> = {
      SERVICE_ENGINEER: 'Service / Installation',
      DESIGN_ENGINEER:  'Design / Engineering',
      PROJECT_MANAGER:  'Project Management',
    };

    // Build invoice line items
    const items: {
      description: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      hoursLogged?: number;
      hourlyRate?: number;
    }[] = [];

    // Labor items — one per service report, using the report's own workType
    for (const report of project.serviceReports) {
      const role       = resolveRole(report.workType);
      const hourlyRate = rateByRole.get(role) ?? 0;
      const hours      = Number(report.hoursLogged);
      const lineTotal  = hours * hourlyRate;
      const typeLabel  = WORK_TYPE_LABELS[role] ?? 'Labor';

      items.push({
        description: `${typeLabel} — ${report.technician?.name ?? 'Technician'} (${new Date(report.submittedAt).toLocaleDateString('en-GB')})`,
        quantity:    hours,
        unitPrice:   hourlyRate,
        lineTotal,
        hoursLogged: hours,
        hourlyRate,
      });
    }

    // Material items — one per project material
    for (const mat of project.projectMaterials) {
      const unitPrice = Number(mat.unitPriceAtQuote);
      const qty       = mat.quantityRequired;
      const label     = mat.inventory
        ? `${mat.inventory.name} [${mat.inventory.partNumber}]`
        : (mat.description ?? 'Custom Part');
      items.push({
        description: label,
        quantity:    qty,
        unitPrice,
        lineTotal:   qty * unitPrice,
      });
    }

    if (items.length === 0) {
      res.status(400).json({ message: 'No service reports or materials found — nothing to invoice' });
      return;
    }

    const subtotal   = items.reduce((s, it) => s + it.lineTotal, 0);
    const taxRate    = 0.24;
    const taxAmount  = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;

    // Auto-generate invoice number
    const year   = new Date().getFullYear();
    const prefix = 'INV';
    const count  = await prisma.invoice.count({
      where: { invoiceNumber: { startsWith: `${prefix}-${year}-` } },
    });
    const invoiceNumber = `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        direction:   InvoiceDirection.OUTGOING,
        category:    InvoiceCategory.PROJECT_BILLING,
        customerId:  project.customerId  ?? undefined,
        projectId:   project.id,
        offerId:     project.offerId     ?? undefined,
        subtotal,
        taxRate,
        taxAmount,
        totalAmount,
        currency:    'EUR',
        status:      InvoiceStatus.DRAFT,
        issueDate:   new Date(),
        createdById: req.user!.userId,
        notes:       `Generated from project: ${project.title}`,
        items: {
          create: items.map((it) => ({
            description: it.description,
            quantity:    it.quantity,
            unitPrice:   it.unitPrice,
            lineTotal:   it.lineTotal,
            hoursLogged: it.hoursLogged ?? null,
            hourlyRate:  it.hourlyRate  ?? null,
          })),
        },
      },
      include: {
        items:    true,
        customer: { select: { id: true, companyName: true } },
        project:  { select: { id: true, title: true } },
      },
    });

    // If offer is linked, mark it as invoiced
    if (project.offerId) {
      await prisma.offer.update({
        where: { id: project.offerId },
        data:  { paymentStatus: 'invoiced' },
      }).catch(() => {/* non-fatal */});
    }

    res.status(201).json(invoice);
  }
);

// DELETE /api/projects/:id
router.delete('/:id', requireRole(UserRole.admin), async (req, res: Response) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
