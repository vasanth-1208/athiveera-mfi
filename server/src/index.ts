import express from 'express';
import cors from 'cors';
import { ENV } from './config/env';
import { connectDB } from './config/db';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/authRoutes';
import branchRoutes from './routes/branchRoutes';
import userRoutes from './routes/userRoutes';
import customerRoutes from './routes/customerRoutes';
import groupRoutes from './routes/groupRoutes';
import loanRoutes from './routes/loanRoutes';
import collectionRoutes from './routes/collectionRoutes';
import pendingRoutes from './routes/pendingRoutes';
import cashbookRoutes from './routes/cashbookRoutes';
import expenseRoutes from './routes/expenseRoutes';
import transferRoutes from './routes/transferRoutes';
import reportRoutes from './routes/reportRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import importRoutes from './routes/importRoutes';
import auditRoutes from './routes/auditRoutes';
import settingsRoutes from './routes/settingsRoutes';
import enquiryRoutes from './routes/enquiryRoutes';
import loanTierRoutes from './routes/loanTierRoutes';
import masterDataRoutes from './routes/masterDataRoutes';

export const app = express();

app.use(cors({ origin: ENV.CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Health checks
app.get(['/', '/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), app: 'Athiveera MFI API' });
});

// API Routes
app.use(['/api/auth', '/auth'], authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/pending', pendingRoutes);
app.use('/api/cashbook', cashbookRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/import', importRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/loan-tiers', loanTierRoutes);
app.use('/api/master-data', masterDataRoutes);

// Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    app.listen(ENV.PORT, () => {
      console.log(`Athiveera MFI API Server running on port ${ENV.PORT}`);
    });
  });
}
