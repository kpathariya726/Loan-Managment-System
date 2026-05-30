import { Router } from 'express';
import {
  getSalesDashboard,
  sanctionLoan,
  disburseLoan,
  recordPayment
} from '../controllers/dashboard.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '../enums/role.enum';

const router = Router();

// Secure all endpoints under this router using JWT validations
router.use(authenticateToken);

// 1. Sales Dashboard lead metrics (ADMIN and SALES only)
router.get('/sales', requireRole([Role.ADMIN, Role.SALES]), getSalesDashboard);

// 2. Loan review and sanction review action (ADMIN and SANCTION only)
router.post('/sanction/:loanId', requireRole([Role.ADMIN, Role.SANCTION]), sanctionLoan);

// 3. Disbursement release action (ADMIN and DISBURSEMENT only)
router.post('/disburse/:loanId', requireRole([Role.ADMIN, Role.DISBURSEMENT]), disburseLoan);

// 4. Collection payment recording (ADMIN and COLLECTION only)
router.post('/collection/payment', requireRole([Role.ADMIN, Role.COLLECTION]), recordPayment);

export default router;
