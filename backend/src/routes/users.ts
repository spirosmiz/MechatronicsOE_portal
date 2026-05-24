import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { UserRole } from '../lib/enums';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

// GET /api/users
router.get('/', requireRole(UserRole.admin, UserRole.project_manager), async (_req, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

// POST /api/users
router.post(
  '/',
  requireRole(UserRole.admin),
  [
    body('name').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(Object.values(UserRole)),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { name, email, password, role } = req.body;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) { res.status(409).json({ message: 'Email already in use' }); return; }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.status(201).json(user);
  }
);

// PATCH /api/users/:id
router.patch(
  '/:id',
  requireRole(UserRole.admin),
  [body('role').optional().isIn(Object.values(UserRole))],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { name, email, role } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(email && { email }), ...(role && { role }) },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.json(user);
  }
);

// DELETE /api/users/:id
router.delete('/:id', requireRole(UserRole.admin), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (req.user!.userId === req.params.id) {
    res.status(400).json({ message: 'Cannot delete your own account' });
    return;
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
