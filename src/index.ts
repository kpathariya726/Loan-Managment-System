import mongoose from 'mongoose';
import { connectDB, disconnectDB } from './config/database';
import { User } from './models/user.model';
import { Loan } from './models/loan.model';
import { Payment } from './models/payment.model';
import { Role } from './enums/role.enum';
import { EmploymentMode } from './enums/employment.enum';
import { LoanStatus } from './enums/loan-status.enum';
import { runBRE, calculateLoan } from './utils/engine';

async function runSandbox() {
  console.log('================================================================');
  console.log('         LOAN MANAGEMENT SYSTEM (LMS) SANDBOX DEMO              ');
  console.log('================================================================');

  // A. Demonstrate the Financial Math Utility Engine
  console.log('\n[Sandbox] Running Financial Math Engine Utilities...');
  const testPrincipal = 150000;
  const testTenure = 270; // 270 days
  const calculationResult = calculateLoan(testPrincipal, testTenure);
  console.log(`- Calculation Inputs: Principal = INR ${testPrincipal}, Tenure = ${testTenure} Days`);
  console.log(`  Calculated Interest Amount: INR ${calculationResult.interestAmount}`);
  console.log(`  Calculated Total Repayment: INR ${calculationResult.totalRepayment}`);
  console.log(`  Outstanding Balance:        INR ${calculationResult.outstandingBalance}`);

  // B. Demonstrate the Business Rule Engine (BRE) Utilities
  console.log('\n[Sandbox] Running Business Rule Engine (BRE) Eligibility Checks...');
  
  const testCases = [
    {
      name: 'Eligible Salaried Borrower',
      data: {
        dob: new Date('1998-04-10'), // 28 years old (Passed)
        salary: 45000,              // > 25000 (Passed)
        pan: 'ABCDE1234F',           // Valid PAN format (Passed)
        employmentMode: EmploymentMode.SALARIED
      }
    },
    {
      name: 'Underage Applicant',
      data: {
        dob: new Date('2005-08-20'), // ~20 years old (Fail: Age must be between 23 and 50)
        salary: 30000,
        pan: 'BCDEF2345G',
        employmentMode: EmploymentMode.SALARIED
      }
    },
    {
      name: 'Overage Applicant',
      data: {
        dob: new Date('1970-01-01'), // ~56 years old (Fail: Age must be between 23 and 50)
        salary: 60000,
        pan: 'CDEFG3456H',
        employmentMode: EmploymentMode.SELF_EMPLOYED
      }
    },
    {
      name: 'Low Income Applicant',
      data: {
        dob: new Date('1990-12-15'), // ~35 years old (Passed)
        salary: 22000,              // < 25000 (Fail)
        pan: 'DEFGH4567I',
        employmentMode: EmploymentMode.SALARIED
      }
    },
    {
      name: 'Unemployed Applicant',
      data: {
        dob: new Date('1992-06-05'), // ~33 years old (Passed)
        salary: 35000,
        pan: 'EFGHI5678J',
        employmentMode: EmploymentMode.UNEMPLOYED // Unemployed (Fail)
      }
    },
    {
      name: 'Invalid PAN Applicant',
      data: {
        dob: new Date('1994-02-11'), // ~32 years old (Passed)
        salary: 40000,
        pan: 'INVALID123',          // Fail: Bad pattern
        employmentMode: EmploymentMode.SALARIED
      }
    }
  ];

  for (const tc of testCases) {
    const breResult = runBRE(tc.data);
    console.log(`- Test Case: "${tc.name}"`);
    console.log(`  Passed: ${breResult.passed ? '✔ YES' : '❌ NO'}`);
    if (!breResult.passed) {
      console.log(`  Reason: ${breResult.reason}`);
    }
  }

  // C. Execute Mongoose/Database Lifecycle Tests
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lms_sandbox_db';

  try {
    // 1. Connect to Database
    await connectDB(MONGO_URI);

    // 2. Clear previous data to ensure test idempotency
    console.log('\n[Sandbox] Cleaning up previous database data...');
    await User.deleteMany({});
    await Loan.deleteMany({});
    await Payment.deleteMany({});
    console.log('[Sandbox] Database clean.');

    // 3. Create Users with different Roles
    console.log('\n[Sandbox] Creating database entities...');
    
    // Create Borrower (Passed age check 18+ in schema, but we checked 23+ in BRE)
    const borrower = new User({
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      password: 'SecurePassword123!',
      role: Role.BORROWER,
      pan: 'ABCDE1234F',
      dob: new Date('1998-04-10'), // 28 years old
      monthlySalary: 45000,
      employmentMode: EmploymentMode.SALARIED
    });
    await borrower.save();
    console.log(`- Borrower Registered: ${borrower.name} (ID: ${borrower._id})`);
    console.log(`  Password Hashed: ${borrower.password.substring(0, 15)}...`);

    // Create Sanction Officer
    const sanctionOfficer = new User({
      name: 'Officer Bob',
      email: 'bob.sanction@lms.com',
      password: 'OfficerPassword123!',
      role: Role.SANCTION,
      pan: 'BCDEF2345G',
      dob: new Date('1988-10-10'),
      monthlySalary: 95000,
      employmentMode: EmploymentMode.SALARIED
    });
    await sanctionOfficer.save();
    console.log(`- Sanction Officer Registered: ${sanctionOfficer.name} (ID: ${sanctionOfficer._id})`);

    // Create Collection Agent
    const collectionAgent = new User({
      name: 'Agent Charlie',
      email: 'charlie.collect@lms.com',
      password: 'AgentPassword123!',
      role: Role.COLLECTION,
      pan: 'CDEFG3456H',
      dob: new Date('1990-01-01'),
      monthlySalary: 50000,
      employmentMode: EmploymentMode.SALARIED
    });
    await collectionAgent.save();
    console.log(`- Collection Agent Registered: ${collectionAgent.name} (ID: ${collectionAgent._id})`);

    // 4. Create Loan
    console.log('\n[Sandbox] Initializing Loan Application...');
    
    // Principal: INR 100,000, Tenure: 180 days
    const loan = new Loan({
      borrowerId: borrower._id,
      loanAmount: 100000,
      tenure: 180,
      interestRate: 12,
      status: LoanStatus.REGISTERED
    });
    await loan.save();
    console.log(`- Loan Saved: ID ${loan._id}`);
    console.log(`  Principal: INR ${loan.loanAmount}`);
    console.log(`  Interest Rate: ${loan.interestRate}% p.a.`);
    console.log(`  Simple Interest (Virtual): INR ${loan.totalInterest}`);
    console.log(`  Total Repayment Target (Virtual): INR ${loan.totalRepayment}`);

    // Update statuses through standard business transitions
    loan.status = LoanStatus.APPLIED;
    await loan.save();

    loan.status = LoanStatus.SANCTIONED;
    loan.sanctionedBy = sanctionOfficer._id;
    loan.sanctionedAt = new Date();
    await loan.save();
    console.log(`- Loan stage: ${loan.status} by ${sanctionOfficer.name}`);

    loan.status = LoanStatus.DISBURSED;
    loan.disbursedAt = new Date();
    await loan.save();
    console.log(`- Loan stage: ${loan.status} (Released to Borrower)`);

    // Verify dynamic balance
    let balance = await loan.getRemainingBalance();
    console.log(`- Current Outstanding Balance: INR ${balance}`);

    // 5. Recording Payments
    console.log('\n[Sandbox] Recording loan repayment installments...');

    // Installment 1
    const payment1 = new Payment({
      loanId: loan._id,
      utrNumber: 'TXN20260530A1',
      amount: 40000,
      collectedBy: collectionAgent._id
    });
    await payment1.save();
    
    balance = await loan.getRemainingBalance();
    console.log(`- Outstanding Balance after Payment 1: INR ${balance}`);

    // Installment 2
    const payment2 = new Payment({
      loanId: loan._id,
      utrNumber: 'TXN20260530C3',
      amount: 50000,
      collectedBy: collectionAgent._id
    });
    await payment2.save();

    balance = await loan.getRemainingBalance();
    console.log(`- Outstanding Balance after Payment 2: INR ${balance}`);

    // Final Installment to fully close (needs 15,917.81, paying 16,000)
    console.log('\n[Sandbox] Processing final payment to activate pre-save hook auto-closure...');
    const finalPayment = new Payment({
      loanId: loan._id,
      utrNumber: 'TXN20260530D4',
      amount: 16000,
      collectedBy: collectionAgent._id
    });
    await finalPayment.save();

    // 6. Fetch final Loan status from DB
    const finalLoanState = await Loan.findById(loan._id);
    console.log(`\n================================================================`);
    console.log('                     FINAL TRANSACTION AUDIT                    ');
    console.log(`================================================================`);
    console.log(`Loan ID:                   ${finalLoanState?._id}`);
    console.log(`Final Loan Status:         ${finalLoanState?.status} (Expected: CLOSED)`);
    
    const finalBalance = await finalLoanState?.getRemainingBalance();
    console.log(`Final Outstanding Balance: INR ${finalBalance} (Expected: 0)`);
    console.log(`================================================================`);

    // Clean up
    await disconnectDB();
    console.log('\n[Sandbox] Demo completed successfully.');
    
  } catch (error: any) {
    console.error(`\n[Sandbox Critical Error] Failed to run database test flow:`);
    console.error(error.message);
    try {
      await mongoose.connection.close();
    } catch {}
  }
}

// Execute the sandbox runner
runSandbox();
