import { Schema, model, Types } from 'mongoose';
import { IPaymentDocument } from '../interfaces/payment.interface';
import { LoanStatus } from '../enums/loan-status.enum';
import { Role } from '../enums/role.enum';

const PaymentSchema = new Schema<IPaymentDocument>(
  {
    loanId: {
      type: Schema.Types.ObjectId,
      ref: 'Loan',
      required: [true, 'Loan ID is required']
    },
    utrNumber: {
      type: String,
      required: [true, 'UTR number is required'],
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
      validate: {
        validator: function (v: string) {
          // Standard UTR code format: alphanumeric, typical length between 16 and 22 characters
          return /^[A-Z0-9]{12,22}$/.test(v);
        },
        message: (props: any) => `${props.value} is not a valid transaction UTR format!`
      }
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [1, 'Payment amount must be greater than zero']
    },
    paidAt: {
      type: Date,
      default: Date.now
    },
    collectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Collector ID is required'],
      validate: {
        validator: async function (v: Types.ObjectId) {
          const User = model('User');
          const user = await User.findById(v);
          return user ? (user.role === Role.COLLECTION || user.role === Role.ADMIN) : false;
        },
        message: 'Payment collector must have ROLE COLLECTION or ADMIN.'
      }
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook to safely check total repayments and close the corresponding Loan
PaymentSchema.pre<IPaymentDocument>('save', async function (next) {
  try {
    const Loan = model('Loan');
    const loanDoc = await Loan.findById(this.loanId);

    if (!loanDoc) {
      throw new Error(`Failed to save payment: Corresponding Loan with ID ${this.loanId} does not exist.`);
    }

    // Verify the loan is in active state (DISBURSED) to receive payments
    if (loanDoc.status !== LoanStatus.DISBURSED) {
      throw new Error(
        `Cannot record payment of ${this.amount} because the loan is in '${loanDoc.status}' status. Payments are only accepted on active 'DISBURSED' loans.`
      );
    }

    // Retrieve the Mongoose model dynamically to query all historical payments for this loan
    const Payment = model('Payment');
    
    // Sum all prior payments
    const previousPayments = await Payment.find({
      loanId: this.loanId,
      _id: { $ne: this._id } // exclude current payment if it's an update (standard practice)
    });
    
    const totalPreviouslyPaid = previousPayments.reduce((sum, pay) => sum + pay.amount, 0);
    const totalPaidWithCurrent = totalPreviouslyPaid + this.amount;
    
    // Retrieve the virtual total repayment from the loan document
    const totalRepaymentAmount = loanDoc.totalRepayment;
    const remainingBalanceBeforePayment = totalRepaymentAmount - totalPreviouslyPaid;

    console.log(`\n--- PAYMENT TRANSACTION REPORT ---`);
    console.log(`Loan ID:              ${this.loanId}`);
    console.log(`Principal:            INR ${loanDoc.loanAmount}`);
    console.log(`Interest rate (p.a.): ${loanDoc.interestRate}%`);
    console.log(`Tenure:               ${loanDoc.tenure} Days`);
    console.log(`Total Repay Target:   INR ${totalRepaymentAmount}`);
    console.log(`Previously Paid:      INR ${totalPreviouslyPaid}`);
    console.log(`Current Paid (UTR):   INR ${this.amount} (${this.utrNumber})`);
    console.log(`Remaining Balance:    INR ${Math.max(0, remainingBalanceBeforePayment - this.amount)}`);
    console.log(`---------------------------------\n`);

    // If total paid equals or exceeds the total simple interest-based repayment target, close the loan
    if (totalPaidWithCurrent >= totalRepaymentAmount) {
      loanDoc.status = LoanStatus.CLOSED;
      await loanDoc.save();
      console.log(`>>> AUTO-CLOSURE: Loan ID ${this.loanId} is fully repaid. Status updated to 'CLOSED'.`);
    }

    next();
  } catch (error: any) {
    next(error);
  }
});

export const Payment = model<IPaymentDocument>('Payment', PaymentSchema);
