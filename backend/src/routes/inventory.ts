import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserRole } from '../lib/enums';
import { createDriveFolder, createInventoryItemFolders, isDriveConfigured } from '../lib/googleDrive';
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

    const { partNumber, brand, name, description, stockQuantity, safetyStockLevel, unitCost, unitPrice, ceCertified } = req.body;
    const exists = await prisma.inventory.findUnique({ where: { partNumber } });
    if (exists) { res.status(409).json({ message: 'Part number already exists' }); return; }

    const item = await prisma.inventory.create({
      data: { partNumber, brand: brand || null, name, description, stockQuantity, safetyStockLevel, unitCost, unitPrice, ceCertified: ceCertified ?? true },
    });
    res.status(201).json({ ...item, isLowStock: item.stockQuantity <= item.safetyStockLevel });

    if (isDriveConfigured()) {
      setImmediate(async () => {
        try {
          await setupInventoryDriveFolders(item.partNumber, item.name, item.brand, item.id);
        } catch (err) {
          console.error('Drive folder setup failed for inventory item:', err);
        }
      });
    }
  }
);

// POST /api/inventory/:id/setup-drive
router.post('/:id/setup-drive', requireRole(UserRole.admin, UserRole.project_manager), async (req, res: Response): Promise<void> => {
  const item = await prisma.inventory.findUnique({ where: { id: req.params.id } });
  if (!item) { res.status(404).json({ message: 'Item not found' }); return; }
  if (item.driveFolderId) { res.json({ ...item, isLowStock: item.stockQuantity <= item.safetyStockLevel }); return; }
  if (!isDriveConfigured()) { res.status(503).json({ message: 'Google Drive is not configured' }); return; }

  try {
    const driveFolderId = await setupInventoryDriveFolders(item.partNumber, item.name, item.brand, item.id);
    const updated = await prisma.inventory.findUnique({ where: { id: item.id } });
    res.json({ ...updated, driveFolderId, isLowStock: (updated?.stockQuantity ?? 0) <= (updated?.safetyStockLevel ?? 0) });
  } catch (err) {
    console.error('Drive setup failed:', err);
    res.status(500).json({ message: 'Failed to create Drive folders' });
  }
});

// PUT /api/inventory/:id
router.put('/:id', requireRole(UserRole.admin, UserRole.project_manager), async (req, res: Response) => {
  const { partNumber, brand, name, description, stockQuantity, safetyStockLevel, unitCost, unitPrice, ceCertified } = req.body;
  const item = await prisma.inventory.update({
    where: { id: req.params.id },
    data: { partNumber, brand: brand || null, name, description, stockQuantity, safetyStockLevel, unitCost, unitPrice, ceCertified },
  });
  res.json({ ...item, isLowStock: item.stockQuantity <= item.safetyStockLevel });
});

// PATCH /api/inventory/:id/stock
router.patch('/:id/stock', requireRole(UserRole.admin, UserRole.project_manager, UserRole.technician), async (req, res: Response) => {
  const { adjustment } = req.body;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function setupInventoryDriveFolders(partNumber: string, partName: string, brand: string | null, itemId: string): Promise<string> {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const effectiveBrand = brand?.trim() || 'General';
  const brandKey = `inventory_brand_${effectiveBrand.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  let invRootId = (await prisma.driveConfig.findUnique({ where: { key: 'inventory_root' } }))?.value;
  if (!invRootId) {
    invRootId = await createDriveFolder('Inventory', rootFolderId);
    await prisma.driveConfig.upsert({ where: { key: 'inventory_root' }, update: { value: invRootId }, create: { key: 'inventory_root', value: invRootId } });
  }

  let brandFolderId = (await prisma.driveConfig.findUnique({ where: { key: brandKey } }))?.value;
  if (!brandFolderId) {
    brandFolderId = await createDriveFolder(effectiveBrand, invRootId);
    await prisma.driveConfig.upsert({ where: { key: brandKey }, update: { value: brandFolderId }, create: { key: brandKey, value: brandFolderId } });
  }

  const folders = await createInventoryItemFolders(partNumber, partName, brandFolderId);
  await prisma.inventory.update({
    where: { id: itemId },
    data: {
      driveFolderId: folders.rootId,
      drivePhotosFolderId: folders.photosId,
      driveDatasheetsFolderId: folders.datasheetsId,
    },
  });
  return folders.rootId;
}
