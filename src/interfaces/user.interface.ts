import { Document } from 'mongoose';
import { Role } from '../enums/role.enum';
import { EmploymentMode } from '../enums/employment.enum';

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: Role;
  pan: string;
  dob: Date;
  monthlySalary: number;
  employmentMode: EmploymentMode;
  salarySlipUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}
