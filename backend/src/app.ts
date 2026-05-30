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
import suppliersRouter from './routes/suppliers';
import laborRatesRouter from './routes/laborRates';
import invoicesRouter from './routes/invoices';
import { errorHandler } from './middleware/errorHandler';
import { activityLogger } from './middleware/activityLogger';
import { authenticate } from './middleware/auth';
import adminRouter from './routes/admin';
import enrichRouter from './routes/enrich';
import gemiRouter from './routes/gemi';

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
app.use('/api/suppliers', suppliersRouter);
app.use('/api/labor-rates', laborRatesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/admin/activity', adminRouter);
app.use('/api/enrich-customer', enrichRouter);
app.use('/api/gemi-lookup', gemiRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Resolves a maps.app.goo.gl short URL to its full URL so the frontend can extract coordinates.
// Only accepts Google Maps short URLs to prevent abuse as an open proxy.
app.get('/api/resolve-maps-url', authenticate, async (req, res) => {
  const url = req.query.url as string;
  const allowed = url && (url.startsWith('https://maps.app.goo.gl/') || url.startsWith('https://share.google/'));
  if (!allowed) {
    res.status(400).json({ message: 'Only Google Maps short URLs are supported' });
    return;
  }
  try {
    const response = await fetch(url, { redirect: 'follow' });
    res.json({ resolvedUrl: response.url });
  } catch {
    res.status(502).json({ message: 'Failed to resolve URL' });
  }
});

const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')));

app.use(errorHandler);

export default app;
