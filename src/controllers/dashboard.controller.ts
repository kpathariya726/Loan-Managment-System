import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { User } from '../models/user.model';
import { Loan } from '../models/loan.model';
import { Payment } from '../models/payment.model';
import { Role } from '../enums/role.enum';
import { LoanStatus } from '../enums/loan-status.enum';

/**
 * @desc    Get Sales Lead Dashboard (Registered users with incomplete applications)
 * @route   GET /api/dashboard/sales
 * @access  Protected (Requires ADMIN or SALES roles)
 */
export async function getSalesDashboard(_req: AuthenticatedRequest, res: Response) {
  try {
    // 1. Fetch all system borrowers
    const borrowers = await User.find({ role: Role.BORROWER }).select('-password');
    const salesLeads = [];

    // 2. Filter borrowers who have NOT progressed any loan past the 'REGISTERED' stage
    for (const borrower of borrowers) {
      const activeApplication = await Loan.findOne({
        borrowerId: borrower._id,
        status: {
          $in: [
            LoanStatus.APPLIED,
            LoanStatus.SANCTIONED,
            LoanStatus.DISBURSED,
            LoanStatus.CLOSED
          ]
        }
      });

      // If they don't have any application, or they only have a REGISTERED loan, they are a Sales Lead
      if (!activeApplication) {
        salesLeads.push(borrower);
      }
    }

    console.log(`[Sales Dashboard] Fetched ${salesLeads.length} leads who haven't completed their application.`);

    return res.status(200).json({
      success: true,
      count: salesLeads.length,
      data: salesLeads
    });

  } catch (error: any) {
    console.error(`[Sales Dashboard] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve sales lead metrics.',
      details: error.message
    });
  }
}

/**
 * @desc    Approve or Reject a Loan Application
 * @route   POST /api/dashboard/sanction/:loanId
 * @access  Protected (Requires ADMIN or SANCTION roles)
 */
export async function sanctionLoan(req: AuthenticatedRequest, res: Response) {
  const { loanId } = req.params;
  const { action, rejectionReason } = req.body;
  const officerId = req.user?.id;

  try {
    // 1. Fetch the targeted Loan
    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: `Loan application with ID ${loanId} not found.`
      });
    }

    // 2. Validate current stage (Must be in APPLIED status to be reviewed)
    if (loan.status !== LoanStatus.APPLIED) {
      return res.status(400).json({
        success: false,
        error: `Cannot perform sanction review. Loan status is currently in '${loan.status}' stage.`
      });
    }

    // 3. Process the Sanction Action (APPROVE / REJECT)
    if (action === 'APPROVE') {
      loan.status = LoanStatus.SANCTIONED;
    } else if (action === 'REJECT') {
      if (!rejectionReason || rejectionReason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error: A clear rejection reason string is required when rejecting a loan.'
        });
      }
      loan.status = LoanStatus.REJECTED;
      loan.rejectionReason = rejectionReason;
    } else {
      return res.status(400).json({
        success: false,
        error: "Validation Error: Action parameter must be either 'APPROVE' or 'REJECT'."
      });
    }

    // 4. Record officer auditing details
    loan.sanctionedBy = officerId as any;
    loan.sanctionedAt = new Date();

    await loan.save();

    console.log(`[Sanction Controller] Loan ${loan._id} successfully evaluated to ${loan.status} by Officer ID ${officerId}.`);

    return res.status(200).json({
      success: true,
      message: `Loan application successfully ${loan.status.toLowerCase()}.`,
      loanDetails: loan
    });

  } catch (error: any) {
    console.error(`[Sanction Controller] Error: ${error.message}`);
    return res.status(400).json({
      success: false,
      error: 'Failed to process loan evaluation.',
      details: error.message
    });
  }
}

/**
 * @desc    Mark Loan as Disbursed (Funds released)
 * @route   POST /api/dashboard/disburse/:loanId
 * @access  Protected (Requires ADMIN or DISBURSEMENT roles)
 */
export async function disburseLoan(req: AuthenticatedRequest, res: Response) {
  const { loanId } = req.params;

  try {
    // 1. Fetch targeted Loan
    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: `Loan with ID ${loanId} not found.`
      });
    }

    // 2. Validate current stage (Must be SANCTIONED)
    if (loan.status !== LoanStatus.SANCTIONED) {
      return res.status(400).json({
        success: false,
        error: `Cannot disburse funds. Loan must be approved/SANCTIONED first. Current status is '${loan.status}'.`
      });
    }

    // 3. Update status to DISBURSED
    loan.status = LoanStatus.DISBURSED;
    loan.disbursedAt = new Date();
    await loan.save();

    console.log(`[Disbursement Controller] Funds released for Loan ID: ${loan._id}. Stage is now DISBURSED.`);

    return res.status(200).json({
      success: true,
      message: 'Loan successfully marked as disbursed. Funds have been released to the borrower.',
      loanDetails: loan
    });

  } catch (error: any) {
    console.error(`[Disbursement Controller] Error: ${error.message}`);
    return res.status(400).json({
      success: false,
      error: 'Failed to execute disbursement transaction.',
      details: error.message
    });
  }
}

/**
 * @desc    Record Collection Payment and trigger loan status auto-closure checks
 * @route   POST /api/dashboard/collection/payment
 * @access  Protected (Requires ADMIN or COLLECTION roles)
 */
export async function recordPayment(req: AuthenticatedRequest, res: Response) {
  const { loanId, utrNumber, amount, paidAt } = req.body;
  const collectorId = req.user?.id;

  try {
    // 1. Inputs presence checks
    if (!loanId || !utrNumber || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Please provide loanId, unique utrNumber, and payment amount.'
      });
    }

    const numAmount = Number(amount);
    if (numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount must be a positive number greater than zero.'
      });
    }

    // 2. Fetch loan to verify status and track outstanding balance
    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: `Loan document with ID ${loanId} not found.`
      });
    }

    // 3. Confirm remaining balance before recording payment to prevent overpayments
    const outstandingBefore = await loan.getRemainingBalance();
    if (outstandingBefore === 0) {
      return res.status(400).json({
        success: false,
        error: 'This loan has already been fully repaid and settled (outstanding balance is 0).'
      });
    }

    // 4. Create and save the new Payment transaction
    // The Mongoose pre-save hook handles:
    // - Verification that the loan status is 'DISBURSED'
    // - Summing total payments (prior payments + current)
    // - Checking if total paid >= total repayment target
    // - Automatically transitioning the corresponding Loan's status to 'CLOSED' if target met
    const payment = new Payment({
      loanId,
      utrNumber,
      amount: numAmount,
      paidAt: paidAt ? new Date(paidAt) : undefined,
      collectedBy: collectorId
    });

    await payment.save();

    // 5. Query updated Loan to retrieve its final settlement status
    const updatedLoan = await Loan.findById(loanId);
    const outstandingAfter = await updatedLoan!.getRemainingBalance();

    console.log(`[Collection Controller] Processed Payment. Remaining: INR ${outstandingAfter}. Loan Status: ${updatedLoan!.status}`);

    return res.status(201).json({
      success: true,
      message: 'Repayment transaction recorded successfully.',
      paymentDetails: {
        id: payment._id,
        utrNumber: payment.utrNumber,
        amount: payment.amount,
        paidAt: payment.paidAt
      },
      loanStatusSummary: {
        loanId: updatedLoan!._id,
        status: updatedLoan!.status,
        remainingOutstanding: outstandingAfter
      }
    });

  } catch (error: any) {
    console.error(`[Collection Controller] Payment error: ${error.message}`);
    
    // Check if the database unique index threw an error (Duplicate UTR code)
    if (error.code === 11000 || error.message.includes('duplicate key')) {
      return res.status(409).json({
        success: false,
        error: 'Conflict: A transaction with this UTR number has already been recorded in the database.'
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Failed to record repayment transaction.',
      details: error.message
    });
  }
}
