import { Document, Types } from 'mongoose';

export interface IPayment {
  loanId: Types.ObjectId;
  utrNumber: string; // Globally unique
  amount: number;
  paidAt: Date;
  collectedBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPaymentDocument extends IPayment, Document {}
