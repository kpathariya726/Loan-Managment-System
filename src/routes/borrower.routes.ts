import { Router } from 'express';
import multer from 'multer';
import { apply, uploadSlip, loanRequest } from '../controllers/borrower.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '../enums/role.enum';

const router = Router();

// Multer in-memory configuration with strict validations
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB maximum file size limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file format. Only PDF, JPG, JPEG, and PNG are allowed.'));
    }
    cb(null, true);
  }
});

// Protect all routes under this router using JWT authentication and Borrower authorization
router.use(authenticateToken);
router.use(requireRole([Role.BORROWER]));

// 1. Submit borrower financial details & execute server-side BRE
router.post('/apply', apply);

// 2. Submit physical salary slip PDF/PNG with robust Multer boundary wrappers
router.post('/upload-slip', (req, res, next): void => {
  upload.single('slip')(req, res, (err: any) => {
    if (err) {
      console.log(`[Multer Middleware] File upload blocked: ${err.message}`);
      res.status(400).json({
        success: false,
        error: 'File Upload Validation Failed.',
        details: err.message
      });
      return;
    }
    return next();
  });
}, uploadSlip);

// 3. Register loan request (with boundaries validations)
router.post('/loan-request', loanRequest);

export default router;
