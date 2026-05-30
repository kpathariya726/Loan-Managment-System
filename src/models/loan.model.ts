import { Schema, model, Types } from 'mongoose';
import { ILoanDocument } from '../interfaces/loan.interface';
import { LoanStatus } from '../enums/loan-status.enum';
import { Role } from '../enums/role.enum';

const LoanSchema = new Schema<ILoanDocument>(
  {
    borrowerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Borrower ID is required'],
      validate: {
        validator: async function (v: Types.ObjectId) {
          const User = model('User');
          const user = await User.findById(v);
          return user ? user.role === Role.BORROWER : false;
        },
        message: 'Borrower ID must reference a User with BORROWER role.'
      }
    },
    loanAmount: {
      type: Number,
      required: [true, 'Loan amount is required'],
      min: [1, 'Loan amount must be greater than zero']
    },
    tenure: {
      type: Number,
      required: [true, 'Tenure in days is required'],
      min: [1, 'Tenure must be at least 1 day']
    },
    interestRate: {
      type: Number,
      default: 12, // 12% p.a.
      min: [0, 'Interest rate cannot be negative']
    },
    status: {
      type: String,
      enum: {
        values: Object.values(LoanStatus),
        message: 'Invalid loan status'
      },
      default: LoanStatus.REGISTERED
    },
    sanctionedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      validate: {
        validator: async function (v: Types.ObjectId) {
          if (!v) return true;
          const User = model('User');
          const user = await User.findById(v);
          return user ? (user.role === Role.SANCTION || user.role === Role.ADMIN) : false;
        },
        message: 'Sanctioning authority must have role SANCTION or ADMIN.'
      }
    },
    sanctionedAt: {
      type: Date
    },
    rejectionReason: {
      type: String,
      required: [
        function (this: ILoanDocument) {
          return this.status === LoanStatus.REJECTED;
        },
        'Rejection reason is required if status is REJECTED'
      ],
      trim: true
    },
    disbursedAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for calculating the total interest based on standard Simple Interest:
// Interest = Principal * (Rate / 100) * (Tenure / 365)
LoanSchema.virtual('totalInterest').get(function (this: ILoanDocument): number {
  const interest = this.loanAmount * (this.interestRate / 100) * (this.tenure / 365);
  // Round to 2 decimal places to maintain clean financial precision
  return Math.round((interest + Number.EPSILON) * 100) / 100;
});

// Virtual for calculating the total repayment (Principal + Simple Interest)
LoanSchema.virtual('totalRepayment').get(function (this: ILoanDocument): number {
  return this.loanAmount + this.totalInterest;
});

// Schema instance method to calculate outstanding balance dynamically
LoanSchema.methods.getRemainingBalance = async function (this: ILoanDocument): Promise<number> {
  const Payment = model('Payment');
  const payments = await Payment.find({ loanId: this._id });
  const totalPaid = payments.reduce((sum, pay) => sum + pay.amount, 0);
  
  const remaining = this.totalRepayment - totalPaid;
  // Financial round to prevent floating point errors
  const formattedRemaining = Math.round((remaining + Number.EPSILON) * 100) / 100;
  
  return formattedRemaining > 0 ? formattedRemaining : 0;
};

export const Loan = model<ILoanDocument>('Loan', LoanSchema);
