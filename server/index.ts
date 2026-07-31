import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { seedIfEmpty } from './db.ts';
import { authRouter, authMiddleware } from './routes/auth.ts';
import { settingsRouter } from './routes/settings.ts';
import { clientsRouter } from './routes/clients.ts';
import { invoicesRouter } from './routes/invoices.ts';
import { estimatesRouter } from './routes/estimates.ts';
import { servicesRouter } from './routes/services.ts';
import { reportsRouter } from './routes/reports.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

seedIfEmpty();

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);

// Protect all other API routes with auth middleware
app.use('/api/settings', authMiddleware, settingsRouter);
app.use('/api/clients', authMiddleware, clientsRouter);
app.use('/api/invoices', authMiddleware, invoicesRouter);
app.use('/api/estimates', authMiddleware, estimatesRouter);
app.use('/api/services', authMiddleware, servicesRouter);
app.use('/api/reports', authMiddleware, reportsRouter);

// Fallback JSON 404 for unmatched API routes.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// In production, serve the built client and let the SPA handle routing.
const distDir = join(__dirname, '..', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(join(distDir, 'index.html')));
}

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Ledgerly API listening on http://localhost:${port}`);
});
