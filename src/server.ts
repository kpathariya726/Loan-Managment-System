import express from 'express';
import { connectDB } from './config/database';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import borrowerRoutes from './routes/borrower.routes';
import dashboardRoutes from './routes/dashboard.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing middleware
app.use(express.json());

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Initialize Database connection
connectDB(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lms_sandbox_db');

// --- REST API Route Mounting ---
app.use('/api/auth', authRoutes);
app.use('/api/borrower', borrowerRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Fallback route error handler for undefined routes
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Validation Error: Target route endpoint does not exist.'
  });
});

// Start Express Listener
app.listen(PORT, () => {
  console.log(`\n🚀 Production-Grade LMS Express Server listening on http://127.0.0.1:${PORT}`);
  console.log(`- Public Authentication Module mounted at  [POST] /api/auth/*`);
  console.log(`- Borrower Operations Module mounted at      [POST] /api/borrower/*`);
  console.log(`- Administrative Dashboard Module mounted at  [ANY]  /api/dashboard/*\n`);
});
