import { Router } from 'express';
import { signup, login } from '../controllers/auth.controller';

const router = Router();

// Onboarding entrypoints
router.post('/signup', signup);
router.post('/login', login);

export default router;
