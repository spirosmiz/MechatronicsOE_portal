import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserRole } from '../lib/enums';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

// GET /api/service-reports
router.get('/', async (req, res: Response) => {
  const { projectId, technicianId } = req.query;
  const reports = await prisma.serviceReport.findMany({
    where: {
      ...(projectId && { projectId: String(projectId) }),
      ...(technicianId && { technicianId: String(technicianId) }),
    },
    include: {
      technician: { select: { id: true, name: true } },
      project: { select: { id: true, title: true, customer: { select: { companyName: true } } } },
    },
    orderBy: { submittedAt: 'desc' },
  });
  res.json(reports);
});

// GET /api/service-reports/:id
router.get('/:id', async (req, res: Response) => {
  const report = await prisma.serviceReport.findUnique({
    where: { id: req.params.id },
    include: {
      technician: { select: { id: true, name: true, email: true } },
      project: {
        include: {
          customer: { select: { companyName: true, address: true } },
          machine: { select: { name: true, model: true, serialNumber: true } },
        },
      },
    },
  });
  if (!report) { res.status(404).json({ message: 'Report not found' }); return; }
  res.json(report);
});

// POST /api/service-reports
router.post(
  '/',
  [
    body('projectId').isUUID(),
    body('workPerformed').trim().notEmpty(),
    body('hoursLogged').isFloat({ min: 0.1, max: 24 }),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { projectId, workPerformed, hoursLogged, workType, digitalSignature, transportationCost } = req.body;

    const report = await prisma.serviceReport.create({
      data: {
        projectId,
        technicianId: req.user!.userId,
        workPerformed,
        hoursLogged,
        workType:          workType || null,
        digitalSignature,
        transportationCost: transportationCost != null ? Number(transportationCost) : null,
      },
      include: {
        technician: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
    });

    // Update actual labor hours on the project
    await prisma.project.update({
      where: { id: projectId },
      data: { actualLaborHours: { increment: hoursLogged } },
    });

    res.status(201).json(report);
  }
);

// PATCH /api/service-reports/:id
router.patch(
  '/:id',
  requireRole(UserRole.admin),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { workPerformed, hoursLogged, workType, digitalSignature, transportationCost } = req.body;
    const report = await prisma.serviceReport.update({
      where: { id: req.params.id },
      data: {
        workPerformed, hoursLogged, workType: workType || null, digitalSignature,
        transportationCost: transportationCost != null ? Number(transportationCost) : null,
      },
    });
    res.json(report);
  }
);

// DELETE /api/service-reports/:id
router.delete('/:id', requireRole(UserRole.admin), async (req, res: Response) => {
  await prisma.serviceReport.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
