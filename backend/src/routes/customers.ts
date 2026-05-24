import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserRole } from '../lib/enums';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { createCustomerFolders, isDriveConfigured } from '../lib/googleDrive';

const router = Router();
router.use(authenticate);

async function setupDriveFolders(customerId: string, companyName: string) {
  if (!isDriveConfigured()) return;
  try {
    const folders = await createCustomerFolders(companyName);
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        driveFolderId: folders.rootId,
        driveMediaFolderId: folders.mediaId,
        driveOffersFolderId: folders.offersId,
        driveContractsFolderId: folders.contractsId,
      },
    });
  } catch (err) {
    console.error(`Failed to create Drive folders for customer ${customerId}:`, err);
  }
}

// GET /api/customers
router.get('/', async (_req, res: Response) => {
  const customers = await prisma.customer.findMany({
    orderBy: { companyName: 'asc' },
    include: { _count: { select: { machines: true, projects: true } } },
  });
  res.json(customers);
});

// GET /api/customers/:id
router.get('/:id', async (req, res: Response) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: {
      machines: true,
      projects: { orderBy: { createdAt: 'desc' }, include: { machine: { select: { name: true } } } },
    },
  });
  if (!customer) { res.status(404).json({ message: 'Customer not found' }); return; }
  res.json(customer);
});

// POST /api/customers
router.post(
  '/',
  requireRole(UserRole.admin, UserRole.project_manager),
  [
    body('companyName').trim().notEmpty(),
    body('vatNumber').trim().notEmpty(),
    body('address').trim().notEmpty(),
    body('email').optional({ checkFalsy: true }).isEmail(),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { companyName, vatNumber, contactPerson, email, phone, address } = req.body;
    const exists = await prisma.customer.findUnique({ where: { vatNumber } });
    if (exists) { res.status(409).json({ message: 'VAT number already registered' }); return; }

    const customer = await prisma.customer.create({
      data: { companyName, vatNumber, contactPerson, email, phone, address },
    });

    // Create Drive folder structure in the background (don't block response)
    setupDriveFolders(customer.id, companyName);

    res.status(201).json(customer);
  }
);

// POST /api/customers/:id/setup-drive  — initialise Drive folders for existing customers
router.post('/:id/setup-drive', requireRole(UserRole.admin, UserRole.project_manager), async (req, res: Response) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) { res.status(404).json({ message: 'Customer not found' }); return; }

  if (customer.driveFolderId) {
    res.status(409).json({ message: 'Drive folders already exist for this customer' });
    return;
  }

  if (!isDriveConfigured()) {
    res.status(503).json({ message: 'Google Drive is not configured on this server' });
    return;
  }

  const folders = await createCustomerFolders(customer.companyName);
  const updated = await prisma.customer.update({
    where: { id: req.params.id },
    data: {
      driveFolderId: folders.rootId,
      driveMediaFolderId: folders.mediaId,
      driveOffersFolderId: folders.offersId,
      driveContractsFolderId: folders.contractsId,
    },
  });
  res.json(updated);
});

// PUT /api/customers/:id
router.put(
  '/:id',
  requireRole(UserRole.admin, UserRole.project_manager),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { companyName, vatNumber, contactPerson, email, phone, address } = req.body;
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { companyName, vatNumber, contactPerson, email, phone, address },
    });
    res.json(customer);
  }
);

// DELETE /api/customers/:id
router.delete('/:id', requireRole(UserRole.admin), async (req, res: Response) => {
  await prisma.customer.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
