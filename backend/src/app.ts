import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import authRouter from './routes/auth';
import usersRouter from './routes/users';
import customersRouter from './routes/customers';
import machinesRouter from './routes/machines';
import inventoryRouter from './routes/inventory';
import projectsRouter from './routes/projects';
import serviceReportsRouter from './routes/serviceReports';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/customers', customersRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/service-reports', serviceReportsRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use(errorHandler);

export default app;
