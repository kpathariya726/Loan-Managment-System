import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { User } from '../models/user.model';
import { Loan } from '../models/loan.model';
import { LoanStatus } from '../enums/loan-status.enum';
import { runBRE, calculateLoan } from '../utils/engine';

/**
 * @desc    Submit financial info and execute Business Rule Engine (BRE)
 * @route   POST /api/borrower/apply
 */
export async function apply(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;
  const { dob, salary, pan, employmentMode } = req.body;

  try {
    // 1. Fetch user to verify status
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Borrower profile not found.'
      });
    }

    // 2. Map financial inputs and invoke the BRE
    const parsedDob = new Date(dob);
    const parsedSalary = Number(salary);
    
    const breResult = runBRE({
      dob: parsedDob,
      salary: parsedSalary,
      pan,
      employmentMode
    });

    // 3. If the applicant fails BRE guidelines, return 400 Bad Request
    if (!breResult.passed) {
      return res.status(400).json({
        success: false,
        error: 'Loan application rejected by Business Rule Engine.',
        reason: breResult.reason
      });
    }

    // 4. BRE Passed -> Save financial details to User profile
    user.dob = parsedDob;
    user.monthlySalary = parsedSalary;
    user.pan = pan;
    user.employmentMode = employmentMode;
    await user.save();

    // 5. Check if the borrower has a 'REGISTERED' loan application, and progress it to 'APPLIED'
    const activeLoan = await Loan.findOne({
      borrowerId: user._id,
      status: LoanStatus.REGISTERED
    });

    if (activeLoan) {
      activeLoan.status = LoanStatus.APPLIED;
      await activeLoan.save();
      console.log(`[Borrower Controller] Transitioned Loan ID ${activeLoan._id} to APPLIED.`);
    }

    return res.status(200).json({
      success: true,
      message: 'Financial profile saved. BRE validation passed successfully.',
      user: {
        id: user._id,
        pan: user.pan,
        dob: user.dob,
        salary: user.monthlySalary,
        employmentMode: user.employmentMode,
        loanStatus: activeLoan ? activeLoan.status : 'NO_ACTIVE_LOAN'
      }
    });

  } catch (error: any) {
    console.error(`[Borrower Controller] Apply error: ${error.message}`);
    return res.status(400).json({
      success: false,
      error: 'Failed to process application details.',
      details: error.message
    });
  }
}

/**
 * @desc    Upload Salary Slip (Multer memory stream)
 * @route   POST /api/borrower/upload-slip
 */
export async function uploadSlip(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please upload a PDF, JPG, JPEG, or PNG document.'
      });
    }

    // 1. Fetch the user document
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found.'
      });
    }

    // 2. Generate a secure Mock Document URL in a production environment
    // In a live system, we would stream this file buffer directly to AWS S3/Azure Blob
    const mockFileUrl = `https://lms-vault-storage.s3.ap-south-1.amazonaws.com/slips/slip_${user._id}_${Date.now()}_${req.file.originalname}`;

    // 3. Attach file URL to the database user record
    user.salarySlipUrl = mockFileUrl;
    await user.save();

    console.log(`[Borrower Controller] Slip uploaded for user ID: ${user._id}. Mapped to S3 Sarcophagus URL.`);

    return res.status(200).json({
      success: true,
      message: 'Salary slip uploaded successfully.',
      documentUrl: mockFileUrl,
      fileMetadata: {
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size
      }
    });

  } catch (error: any) {
    console.error(`[Borrower Controller] File Upload error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to process document upload.',
      details: error.message
    });
  }
}

/**
 * @desc    Submit a Loan Request (Principal & Tenure checks)
 * @route   POST /api/borrower/loan-request
 */
export async function loanRequest(req: AuthenticatedRequest, res: Response) {
  const borrowerId = req.user?.id;
  const { principal, tenure } = req.body;

  try {
    const numPrincipal = Number(principal);
    const numTenure = Number(tenure);

    // 1. Boundary Limits Validation
    // Principal boundary: INR 50,000 (50K) to INR 500,000 (5L)
    if (numPrincipal < 50000 || numPrincipal > 500000) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error: Principal amount must be between INR 50,000 and INR 500,000.'
      });
    }

    // Tenure boundary: 30 days to 365 days
    if (numTenure < 30 || numTenure > 365) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error: Tenure must be between 30 and 365 days.'
      });
    }

    // 2. Fetch Borrower to check if they exist
    const borrower = await User.findById(borrowerId);
    if (!borrower) {
      return res.status(404).json({
        success: false,
        error: 'Borrower record not found.'
      });
    }

    // 3. Invoke Math Engine to check repayments and simple interest
    const mathResults = calculateLoan(numPrincipal, numTenure);

    // 4. Save loan request as 'REGISTERED' (Initial application stage)
    const newLoan = new Loan({
      borrowerId: borrower._id,
      loanAmount: numPrincipal,
      tenure: numTenure,
      interestRate: 12, // Standard fixed interest rate
      status: LoanStatus.REGISTERED
    });

    await newLoan.save();

    console.log(`[Borrower Controller] Created new Loan ID: ${newLoan._id} in REGISTERED stage.`);

    return res.status(201).json({
      success: true,
      message: 'Loan application registered successfully.',
      loanDetails: {
        id: newLoan._id,
        principal: newLoan.loanAmount,
        tenureDays: newLoan.tenure,
        interestRatePa: `${newLoan.interestRate}%`,
        calculatedInterest: mathResults.interestAmount,
        totalRepayment: mathResults.totalRepayment,
        status: newLoan.status
      }
    });

  } catch (error: any) {
    console.error(`[Borrower Controller] Loan Request error: ${error.message}`);
    return res.status(400).json({
      success: false,
      error: 'Failed to record loan application.',
      details: error.message
    });
  }
}
