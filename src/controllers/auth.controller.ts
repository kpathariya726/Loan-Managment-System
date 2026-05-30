import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { Role } from '../enums/role.enum';
import { JWT_SECRET } from '../middleware/auth.middleware';

/**
 * @desc    Sign Up a New User
 * @route   POST /api/auth/signup
 */
export async function signup(req: Request, res: Response) {
  const { name, email, password, role, pan, dob, monthlySalary, employmentMode } = req.body;

  try {
    // 1. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email registration already exists.'
      });
    }

    // 2. Instantiate and save the new User document
    // PAN, DOB, monthlySalary and employmentMode validations are handled by User Mongoose Schema
    const user = new User({
      name,
      email,
      password,
      role: role || Role.BORROWER,
      pan,
      dob: dob ? new Date(dob) : undefined,
      monthlySalary,
      employmentMode
    });

    await user.save();

    // 3. Issue Token immediately for UX onboarding flow
    const payload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

    console.log(`[Auth Controller] Onboarded new user: ${user.email} (${user.role})`);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token: `Bearer ${token}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error: any) {
    console.error(`[Auth Controller] Signup error: ${error.message}`);
    return res.status(400).json({
      success: false,
      error: 'Signup validation failed.',
      details: error.message
    });
  }
}

/**
 * @desc    Authenticate User & Issue Token
 * @route   POST /api/auth/login
 */
export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Please provide both email and password'
    });
  }

  try {
    // 1. Fetch user and password hash
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. User does not exist.'
      });
    }

    // 2. Compare candidate password using schema method
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Incorrect password.'
      });
    }

    // 3. Issue JWT Token
    const payload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token: `Bearer ${token}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error: any) {
    console.error(`[Auth Controller] Login error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during login operation.'
    });
  }
}
