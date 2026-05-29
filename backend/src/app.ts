import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';

import authRouter from './routes/auth';
import usersRouter from './routes/users';
import customersRouter from './routes/customers';
import machinesRouter from './routes/machines';
import inventoryRouter from './routes/inventory';
import projectsRouter from './routes/projects';
import serviceReportsRouter from './routes/serviceReports';
import offersRouter from './routes/offers';
import mediaRouter from './routes/media';
import { errorHandler } from './middleware/errorHandler';
import { activityLogger } from './middleware/activityLogger';
import adminRouter from './routes/admin';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(activityLogger);

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/customers', customersRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/service-reports', serviceReportsRouter);
app.use('/api/offers', offersRouter);
app.use('/api/media', mediaRouter);
app.use('/api/admin/activity', adminRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')));

app.use(errorHandler);

export default app;
