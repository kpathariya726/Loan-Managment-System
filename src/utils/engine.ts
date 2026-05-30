import { EmploymentMode } from '../enums/employment.enum';

// Interfaces for our Engine inputs and outputs
export interface BREInput {
  dob: Date;
  salary: number;
  pan: string;
  employmentMode: EmploymentMode | string;
}

export interface BREResult {
  passed: boolean;
  reason?: string;
}

export interface LoanCalculationResult {
  principal: number;
  interestAmount: number;
  totalRepayment: number;
  outstandingBalance: number;
}

/**
 * Business Rule Engine (BRE)
 * Validates the borrower eligibility against core institutional guidelines.
 * 
 * Rules enforced:
 * - Age: Must be between 23 and 50 years old (precisely calculated).
 * - Salary: Must be at least INR 25,000 per month.
 * - Employment: If 'Unemployed', instantly reject.
 * - PAN Format: Verification with Indian Income Tax Department pattern.
 */
export function runBRE(userData: BREInput): BREResult {
  const { dob, salary, pan, employmentMode } = userData;

  // 1. Employment Mode Validation
  const formattedEmployment = employmentMode.trim();
  if (
    formattedEmployment.toLowerCase() === 'unemployed' ||
    formattedEmployment === EmploymentMode.UNEMPLOYED
  ) {
    return {
      passed: false,
      reason: 'Rule Violation: Unemployed applicants do not meet the minimum criteria.'
    };
  }

  // 2. Monthly Salary Validation
  if (salary < 25000) {
    return {
      passed: false,
      reason: `Rule Violation: Monthly salary of ${salary} is below the required threshold of 25,000.`
    };
  }

  // 3. Indian PAN Format Validation
  const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const normalizedPan = pan.trim().toUpperCase();
  if (!PAN_REGEX.test(normalizedPan)) {
    return {
      passed: false,
      reason: `Rule Violation: PAN identification '${pan}' violates official Income Tax format regulations.`
    };
  }

  // 4. Precise Age Validation (23 - 50 years inclusive)
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDifference = today.getMonth() - dob.getMonth();
  
  // Adjust age based on current date month and day comparison
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  if (age < 23 || age > 50) {
    return {
      passed: false,
      reason: `Rule Violation: Applicant age (${age}) must be between 23 and 50 years old.`
    };
  }

  return {
    passed: true
  };
}

/**
 * Financial Math Engine
 * Calculates Simple Interest and total repayment based on fixed 12% p.a.
 * Enforces strict financial rounding (2 decimal places) for floating-point calculations.
 * 
 * Formula:
 * Simple Interest (SI) = (Principal * InterestRate * TenureInDays) / (365 * 100)
 * Total Repayment = Principal + SI
 */
export function calculateLoan(principal: number, tenureInDays: number): LoanCalculationResult {
  if (principal <= 0) {
    throw new Error('Principal must be a positive number greater than zero.');
  }
  if (tenureInDays <= 0) {
    throw new Error('Tenure in days must be a positive integer greater than zero.');
  }

  const interestRatePa = 12; // 12% fixed p.a. Simple Interest

  // Calculate Simple Interest with high precision
  const rawInterest = (principal * interestRatePa * tenureInDays) / 36500;
  
  // Safe financial rounding to two decimal places
  const interestAmount = Math.round((rawInterest + Number.EPSILON) * 100) / 100;
  
  const rawTotal = principal + interestAmount;
  const totalRepayment = Math.round((rawTotal + Number.EPSILON) * 100) / 100;

  return {
    principal,
    interestAmount,
    totalRepayment,
    outstandingBalance: totalRepayment // Initially, the outstanding balance equals total repayment target
  };
}
