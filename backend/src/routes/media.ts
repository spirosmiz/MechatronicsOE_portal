import { Router, Response } from 'express';
import multer from 'multer';
import { UserRole } from '../lib/enums';
import { uploadToDrive, deleteFromDrive, isDriveConfigured, createCustomerFolders } from '../lib/googleDrive';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Resolve which Drive folder to upload into, auto-creating folders if needed
async function resolveFolderId(entityType: string, entityId: string, subfolder: string): Promise<string | undefined> {
  if (entityType === 'customer') {
    let customer = await prisma.customer.findUnique({ where: { id: entityId } });
    if (!customer) return undefined;

    if (!customer.driveMediaFolderId && isDriveConfigured()) {
      try {
        const folders = await createCustomerFolders(customer.companyName);
        customer = await prisma.customer.update({
          where: { id: entityId },
          data: {
            driveFolderId: folders.rootId,
            driveMediaFolderId: folders.mediaId,
            driveOffersFolderId: folders.offersId,
            driveContractsFolderId: folders.contractsId,
          },
        });
      } catch (err) {
        console.error('Auto Drive folder setup failed for customer:', err);
      }
    }

    if (subfolder === 'offers')    return customer.driveOffersFolderId    ?? undefined;
    if (subfolder === 'contracts') return customer.driveContractsFolderId ?? undefined;
    return customer.driveMediaFolderId ?? undefined;
  }

  if (entityType === 'machine') {
    const machine = await prisma.machine.findUnique({ where: { id: entityId } });
    if (!machine?.customerId) return undefined;

    let customer = await prisma.customer.findUnique({ where: { id: machine.customerId } });
    if (!customer) return undefined;

    if (!customer.driveMediaFolderId && isDriveConfigured()) {
      try {
        const folders = await createCustomerFolders(customer.companyName);
        customer = await prisma.customer.update({
          where: { id: machine.customerId },
          data: {
            driveFolderId: folders.rootId,
            driveMediaFolderId: folders.mediaId,
            driveOffersFolderId: folders.offersId,
            driveContractsFolderId: folders.contractsId,
          },
        });
      } catch (err) {
        console.error('Auto Drive folder setup failed for machine customer:', err);
      }
    }

    return customer.driveMediaFolderId ?? undefined;
  }

  if (entityType === 'inventory') {
    const item = await prisma.inventory.findUnique({ where: { id: entityId } });
    return item?.driveFolderId ?? undefined;
  }

  return undefined;
}

// GET /api/media?entityType=&entityId=&subfolder=
router.get('/', async (req, res: Response) => {
  const { entityType, entityId } = req.query;
  if (!entityType || !entityId) {
    res.status(400).json({ message: 'entityType and entityId are required' });
    return;
  }
  const files = await prisma.mediaFile.findMany({
    where: { entityType: String(entityType), entityId: String(entityId) },
    include: { uploader: { select: { id: true, name: true } } },
    orderBy: { uploadedAt: 'desc' },
  });
  res.json(files);
});

// POST /api/media  (multipart/form-data: file, entityType, entityId, subfolder?)
router.post(
  '/',
  requireRole(UserRole.admin, UserRole.project_manager, UserRole.technician),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return; }

    const { entityType, entityId, subfolder = 'media' } = req.body;
    if (!entityType || !entityId) {
      res.status(400).json({ message: 'entityType and entityId are required' });
      return;
    }

    if (!isDriveConfigured()) {
      res.status(503).json({ message: 'Google Drive is not configured on this server' });
      return;
    }

    const targetFolderId = await resolveFolderId(entityType, entityId, subfolder);

    const safeFileName = `${entityType}-${entityId}-${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const driveFile = await uploadToDrive(req.file.buffer, req.file.mimetype, safeFileName, targetFolderId);

    const media = await prisma.mediaFile.create({
      data: {
        entityType,
        entityId,
        driveFileId: driveFile.fileId,
        name: req.file.originalname,
        mimeType: req.file.mimetype,
        driveUrl: driveFile.webViewLink,
        thumbnailUrl: driveFile.thumbnailUrl,
        uploadedBy: req.user?.userId,
      },
      include: { uploader: { select: { id: true, name: true } } },
    });

    res.status(201).json(media);
  }
);

// DELETE /api/media/:id
router.delete('/:id', requireRole(UserRole.admin, UserRole.project_manager), async (req, res: Response) => {
  const media = await prisma.mediaFile.findUnique({ where: { id: req.params.id } });
  if (!media) { res.status(404).json({ message: 'File not found' }); return; }

  await deleteFromDrive(media.driveFileId).catch(() => {});
  await prisma.mediaFile.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
