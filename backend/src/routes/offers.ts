import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserRole, OfferStatus, PaymentStatus } from '../lib/enums';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { isDriveConfigured, createDriveFolder, createCustomerFolders, uploadToDrive } from '../lib/googleDrive';
import { generateOfferPdf, generateOfferDocx, OfferDocumentData } from '../lib/offerDocument';

const router = Router();
router.use(authenticate);

// Auto-expire sent offers whose validUntil has passed
async function autoExpire() {
  await prisma.offer.updateMany({
    where: { status: OfferStatus.sent, validUntil: { lt: new Date() } },
    data: { status: OfferStatus.expired },
  });
}

const FULL_INCLUDE = {
  customer: { select: { id: true, companyName: true, email: true, contactPerson: true, phone: true, address: true, driveFolderId: true, driveOffersFolderId: true } },
  machines: { include: { machine: { select: { id: true, name: true, model: true } } } },
  creator:  { select: { id: true, name: true } },
  items:    { orderBy: { description: 'asc' } as const },
  projects: { select: { id: true, machineId: true } },
};

async function getOrCreateCustomersRoot(): Promise<string> {
  let rootId = (await prisma.driveConfig.findUnique({ where: { key: 'customers_root' } }))?.value;
  if (!rootId) {
    rootId = await createDriveFolder('Customers', process.env.GOOGLE_DRIVE_FOLDER_ID!);
    await prisma.driveConfig.upsert({
      where: { key: 'customers_root' },
      update: { value: rootId },
      create: { key: 'customers_root', value: rootId },
    });
  }
  return rootId;
}

// Upload PDF to customer's Drive Offers folder; returns webViewLink or null
async function uploadOfferPdfToDrive(
  offerId: string,
  offer: OfferDocumentData,
  customerId: string | null | undefined,
): Promise<string | null> {
  if (!customerId || !isDriveConfigured()) return null;
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { companyName: true, driveFolderId: true, driveOffersFolderId: true },
    });
    if (!customer) return null;

    let offersFolderId = customer.driveOffersFolderId;

    if (!offersFolderId) {
      if (!customer.driveFolderId) {
        // No folder tree at all — create the full Customer/Media/Offers/Contracts tree
        const customersRootId = await getOrCreateCustomersRoot();
        const folders = await createCustomerFolders(customer.companyName, customersRootId);
        await prisma.customer.update({
          where: { id: customerId },
          data: {
            driveFolderId:          folders.rootId,
            driveMediaFolderId:     folders.mediaId,
            driveOffersFolderId:    folders.offersId,
            driveContractsFolderId: folders.contractsId,
          },
        });
        offersFolderId = folders.offersId;
      } else {
        // Root exists but Offers subfolder is missing — create it
        offersFolderId = await createDriveFolder('Offers', customer.driveFolderId);
        await prisma.customer.update({
          where: { id: customerId },
          data: { driveOffersFolderId: offersFolderId },
        });
      }
    }

    const pdfBuffer = await generateOfferPdf(offer);
    const safeTitle = offer.title.replace(/[^\w\s\-]/g, '').trim().substring(0, 60);
    const fileName = `${safeTitle} — Offer.pdf`;

    const driveFile = await uploadToDrive(pdfBuffer, 'application/pdf', fileName, offersFolderId);

    await prisma.offer.update({
      where: { id: offerId },
      data: { drivePdfId: driveFile.fileId, drivePdfUrl: driveFile.webViewLink },
    });
    return driveFile.webViewLink;
  } catch (err) {
    console.error('[Drive] Failed to upload offer PDF:', err);
    return null;
  }
}

// GET /api/offers
router.get('/', async (req, res: Response) => {
  await autoExpire();
  const { customerId } = req.query as { customerId?: string };
  const offers = await prisma.offer.findMany({
    where: customerId ? { customerId } : undefined,
    include: {
      customer: { select: { id: true, companyName: true } },
      machines: { include: { machine: { select: { id: true, name: true, model: true } } } },
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

// GET /api/offers/:id/pdf
router.get('/:id/pdf', async (req, res: Response): Promise<void> => {
  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: FULL_INCLUDE,
  });
  if (!offer) { res.status(404).json({ message: 'Offer not found' }); return; }

  try {
    const buffer = await generateOfferPdf(offer as unknown as OfferDocumentData);
    const safeTitle = offer.title.replace(/[^\w\s\-]/g, '').trim().substring(0, 60);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle} - Offer.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('[PDF] Generation failed:', err);
    res.status(500).json({ message: 'Failed to generate PDF' });
  }
});

// GET /api/offers/:id/docx
router.get('/:id/docx', async (req, res: Response): Promise<void> => {
  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: FULL_INCLUDE,
  });
  if (!offer) { res.status(404).json({ message: 'Offer not found' }); return; }

  try {
    const buffer = await generateOfferDocx(offer as unknown as OfferDocumentData);
    const safeTitle = offer.title.replace(/[^\w\s\-]/g, '').trim().substring(0, 60);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle} - Offer.docx"`);
    res.send(buffer);
  } catch (err) {
    console.error('[DOCX] Generation failed:', err);
    res.status(500).json({ message: 'Failed to generate DOCX' });
  }
});

// GET /api/offers/:id
router.get('/:id', async (req, res: Response) => {
  await autoExpire();
  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: FULL_INCLUDE,
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

    const { customerId, machines, title, description, offerDate, validUntil, totalAmount, notes, items } = req.body;

    const offer = await prisma.offer.create({
      data: {
        customerId: customerId || undefined,
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
              quantity:    item.quantity ?? 1,
              unitPrice:   item.unitPrice,
            })),
          },
        }),
        ...(machines?.length && {
          machines: {
            create: (machines as { machineId: string; notes?: string }[]).map((m) => ({
              machineId: m.machineId,
              notes:     m.notes || null,
            })),
          },
        }),
      },
      include: FULL_INCLUDE,
    });

    // Fire-and-forget Drive upload (errors are caught inside)
    uploadOfferPdfToDrive(offer.id, offer as unknown as OfferDocumentData, customerId);

    res.status(201).json(offer);
  }
);

// PUT /api/offers/:id
router.put('/:id', requireRole(UserRole.admin, UserRole.project_manager), async (req: AuthenticatedRequest, res: Response) => {
  const { customerId, machines, title, description, offerDate, validUntil, totalAmount, notes, items } = req.body;

  const offer = await prisma.offer.update({
    where: { id: req.params.id },
    data: {
      customerId: customerId || undefined,
      title,
      description,
      offerDate: offerDate ? new Date(offerDate) : undefined,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      totalAmount,
      notes,
      drivePdfId:  null,
      drivePdfUrl: null,
    },
    include: FULL_INCLUDE,
  });

  // Replace items
  if (Array.isArray(items)) {
    await prisma.offerItem.deleteMany({ where: { offerId: req.params.id } });
    if (items.length > 0) {
      await prisma.offerItem.createMany({
        data: items.map((item: { description: string; quantity: number; unitPrice: number }) => ({
          offerId:     req.params.id,
          description: item.description,
          quantity:    item.quantity ?? 1,
          unitPrice:   item.unitPrice,
        })),
      });
    }
  }

  // Replace machines
  if (Array.isArray(machines)) {
    await prisma.offerMachine.deleteMany({ where: { offerId: req.params.id } });
    if (machines.length > 0) {
      await prisma.offerMachine.createMany({
        data: (machines as { machineId: string; notes?: string }[]).map((m) => ({
          offerId:   req.params.id,
          machineId: m.machineId,
          notes:     m.notes || null,
        })),
      });
    }
  }

  // Re-generate and upload PDF to Drive
  uploadOfferPdfToDrive(offer.id, offer as unknown as OfferDocumentData, customerId);

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

    const newStatus: string = req.body.status;

    const offer = await prisma.offer.update({
      where: { id: req.params.id },
      data: { status: newStatus },
      include: {
        machines: { include: { machine: { select: { id: true, name: true } } } },
        projects: { select: { id: true, machineId: true } },
        items:    true,
      },
    });

    let projectsCreated = 0;
    const creationErrors: string[] = [];

    if (newStatus === OfferStatus.accepted) {

      // ── Parse offer items into labor hours + material records ──────────────
      let estimatedLaborHours = 0;
      const materialItems: { description: string; unitPrice: number; quantity: number }[] = [];

      for (const item of offer.items) {
        const desc = item.description;
        const qty  = Number(item.quantity);
        const price = Number(item.unitPrice);

        if (desc.startsWith('Design Engineering') || desc.startsWith('Service / Installation')) {
          // quantity = hours logged in the offer cost breakdown
          estimatedLaborHours += qty;
        } else if (desc === 'Machining' || desc === 'Parts' || desc.startsWith('Parts — ')) {
          const label = desc.startsWith('Parts — ') ? desc.slice(8) : desc;
          materialItems.push({ description: label, unitPrice: price, quantity: qty });
        }
        // Transportation is skipped — it's a travel cost, not a project material
      }

      // ── Helper: create ProjectMaterial records for a newly created project ──
      async function seedMaterials(projectId: string) {
        if (materialItems.length === 0) return;
        await prisma.projectMaterial.createMany({
          data: materialItems.map((m) => ({
            projectId,
            inventoryId:      null,
            description:      m.description,
            quantityRequired: m.quantity,
            unitCostAtQuote:  m.unitPrice,
            unitPriceAtQuote: m.unitPrice,
          })),
        });
      }

      const existingMachineIds = new Set(offer.projects.map((p) => p.machineId));
      const hasGenericProject   = offer.projects.some((p) => p.machineId == null);

      if (offer.machines.length === 0) {
        if (!hasGenericProject) {
          try {
            const project = await prisma.project.create({
              data: {
                offerId:              offer.id,
                customerId:           offer.customerId ?? undefined,
                title:                offer.title,
                type:                 'retrofit',
                status:               'approved',
                quotedTotalPrice:     offer.totalAmount,
                estimatedLaborHours,
                createdBy:            req.user?.userId,
              },
            });
            await seedMaterials(project.id);
            projectsCreated++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[project-create] generic project failed:', msg);
            creationErrors.push(msg);
          }
        }
      } else {
        for (const om of offer.machines) {
          if (existingMachineIds.has(om.machineId)) continue;
          try {
            const project = await prisma.project.create({
              data: {
                offerId:              offer.id,
                customerId:           offer.customerId ?? undefined,
                machineId:            om.machineId,
                title:                `${offer.title} — ${om.machine.name}`,
                type:                 'retrofit',
                status:               'approved',
                quotedTotalPrice:     offer.totalAmount,
                estimatedLaborHours,
                createdBy:            req.user?.userId,
              },
            });
            await seedMaterials(project.id);
            projectsCreated++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[project-create] machine project failed:', msg);
            creationErrors.push(msg);
          }
        }
      }
    }

    res.json({ offer, projectsCreated, creationErrors });
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
