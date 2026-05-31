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
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const {
      customerId, machineId, title, type, status, estimatedLaborHours,
      quotedTotalPrice, termsAndConditions, materials,
    } = req.body;

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 90);

    const project = await prisma.$transaction(async (tx) => {
      const offer = await tx.offer.create({
        data: {
          title,
          customerId: customerId || null,
          status: 'draft',
          totalAmount: 0,
          validUntil,
          createdBy: req.user!.userId,
        },
      });

      return tx.project.create({
        data: {
          customerId,
          machineId,
          title,
          type,
          status: status || StatusType.draft,
          estimatedLaborHours: estimatedLaborHours || 0,
          quotedTotalPrice: quotedTotalPrice || 0,
          termsAndConditions,
          createdBy: req.user!.userId,
          offerId: offer.id,
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

  // Optionally upsert into inventory from the custom part data
  if (!inventoryId && saveToInventory) {
    const pnTrimmed   = partNumber?.trim() || null;
    const nameTrimmed = description!.trim();
    const unitCost    = Number(unitCostAtQuote ?? unitPriceAtQuote);
    const unitPrice   = unitCost * 2; // selling price = cost × 2

    // 1. Match by part number (if provided)
    // 2. Fall back to case-insensitive name match
    let existing = pnTrimmed
      ? await prisma.inventory.findUnique({ where: { partNumber: pnTrimmed } })
      : null;

    if (!existing) {
      // SQLite has no native case-insensitive index — fetch by exact name first,
      // then fall back to a JS toLowerCase scan across the full inventory
      existing = await prisma.inventory.findFirst({ where: { name: nameTrimmed } });
      if (!existing) {
        const lower = nameTrimmed.toLowerCase();
        const candidates = await prisma.inventory.findMany({ select: { id: true, name: true, partNumber: true, brand: true, unitCost: true, unitPrice: true } });
        const match = candidates.find((c) => c.name.toLowerCase() === lower);
        if (match) existing = await prisma.inventory.findUnique({ where: { id: match.id } });
      }
    }

    if (existing) {
      // Update price and name/brand if they changed — never create a duplicate
      const updated = await prisma.inventory.update({
        where: { id: existing.id },
        data: {
          name:      nameTrimmed,
          brand:     brand?.trim() || existing.brand || null,
          unitCost,
          unitPrice,
          ...(pnTrimmed && pnTrimmed !== existing.partNumber ? { partNumber: pnTrimmed } : {}),
        },
      });
      resolvedInventoryId = updated.id;
    } else {
      // Genuinely new part — generate part number if not provided
      const finalPn = pnTrimmed || `CUST-${Date.now().toString(36).toUpperCase()}`;
      const newItem = await prisma.inventory.create({
        data: {
          partNumber:       finalPn,
          name:             nameTrimmed,
          brand:            brand?.trim() || null,
          description:      null,
          stockQuantity:    Number(stockQuantity) || 0,
          safetyStockLevel: 0,
          unitCost,
          unitPrice,
          ceCertified:      false,
        },
      });
      resolvedInventoryId = newItem.id;
    }
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

    type InvoiceLineItem = {
      description: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      hoursLogged?: number;
      hourlyRate?: number;
    };

    // If the frontend already computed and confirmed the line items, use them directly
    const previewItems: InvoiceLineItem[] | undefined = Array.isArray(req.body.previewItems)
      ? req.body.previewItems
      : undefined;

    let items: InvoiceLineItem[];

    if (previewItems && previewItems.length > 0) {
      items = previewItems;
    } else {
      // Auto-build from service reports + materials
      items = [];

      // Labor items — one per service report
      for (const report of project.serviceReports) {
        const role       = resolveRole(report.workType);
        const hourlyRate = rateByRole.get(role) ?? 0;
        const hours      = Number(report.hoursLogged);
        const lineTotal  = hours * hourlyRate;
        const typeLabel  = WORK_TYPE_LABELS[role] ?? 'Labor';
        const dateLabel  = new Date(report.submittedAt).toLocaleDateString('en-GB');

        items.push({
          description: `${typeLabel} — ${report.technician?.name ?? 'Technician'} (${dateLabel})`,
          quantity:    hours,
          unitPrice:   hourlyRate,
          lineTotal,
          hoursLogged: hours,
          hourlyRate,
        });

        // Transportation cost logged on this report
        const transCost = Number((report as any).transportationCost ?? 0);
        if (transCost > 0) {
          items.push({
            description: `Transportation — ${report.technician?.name ?? 'Technician'} (${dateLabel})`,
            quantity:    1,
            unitPrice:   transCost,
            lineTotal:   transCost,
          });
        }
      }

      // Material items — selling price = unit cost × 2
      for (const mat of project.projectMaterials) {
        const unitPrice = Number(mat.unitCostAtQuote) * 2;
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
