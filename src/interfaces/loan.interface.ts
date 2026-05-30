import { Document, Types } from 'mongoose';
import { LoanStatus } from '../enums/loan-status.enum';

export interface ILoan {
  borrowerId: Types.ObjectId;
  loanAmount: number;
  tenure: number; // in days
  interestRate: number; // fixed 12% p.a.
  status: LoanStatus;
  sanctionedBy?: Types.ObjectId;
  sanctionedAt?: Date;
  rejectionReason?: string;
  disbursedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ILoanDocument extends ILoan, Document {
  // Virtual properties
  totalRepayment: number;
  totalInterest: number;
  
  // Instance methods
  getRemainingBalance(): Promise<number>;
}
