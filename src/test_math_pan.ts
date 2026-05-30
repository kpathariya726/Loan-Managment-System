import { runBRE, calculateLoan } from './utils/engine';
import { EmploymentMode } from './enums/employment.enum';

function runMathAndPanChecks() {
  console.log('================================================================');
  console.log('         PAN REGEX AND FINANCIAL MATH AUDIT REPORT             ');
  console.log('================================================================');

  // --- Part 1: PAN Regex Evaluation ---
  console.log('\n--- 1. PAN Regex Pattern Check ---');
  
  const PAN_TESTS = [
    { pan: 'ABCDE1234F', description: 'Standard Valid PAN', expected: true },
    { pan: 'abcde1234f', description: 'Lowercase Valid PAN (Should normalized to uppercase & pass)', expected: true },
    { pan: 'ABCDE1234',  description: 'Missing trailing letter (Too short)', expected: false },
    { pan: 'ABCD12345F', description: 'Incorrect letters/digits position', expected: false },
    { pan: 'ABCDE1234FG',description: 'Too long (Double trailing letter)', expected: false },
    { pan: '12345ABCDE', description: 'Reversed letters and digits', expected: false },
    { pan: 'ABC-E1234F', description: 'Special characters inside', expected: false },
    { pan: 'A1CDE1234F', description: 'Digit in first 5 characters', expected: false },
  ];

  for (const tc of PAN_TESTS) {
    const testData = {
      dob: new Date('1990-01-01'),
      salary: 50000,
      pan: tc.pan,
      employmentMode: EmploymentMode.SALARIED
    };
    
    const result = runBRE(testData);
    const passed = result.passed;
    const marker = passed === tc.expected ? '✔ CORRECT' : '❌ MISMATCH';
    console.log(`PAN: "${tc.pan}" (${tc.description})`);
    console.log(`  Expected: ${tc.expected ? 'PASS' : 'FAIL'}, Got: ${passed ? 'PASS' : 'FAIL'} [${marker}]`);
    if (!passed) {
      console.log(`  Reason given: ${result.reason}`);
    }
  }

  // --- Part 2: Decimal Rounding Math Evaluation ---
  console.log('\n--- 2. Floating-Point Financial Rounding Math Check ---');

  const FINANCIAL_TESTS = [
    { principal: 100000, tenure: 180, desc: 'Normal values (Repeating decimals: raw SI = 5917.808219...)' },
    { principal: 100000.55, tenure: 180, desc: 'Principal with decimal values (raw SI = 5917.840794...)' },
    { principal: 45281.33, tenure: 47, desc: 'Complex decimals & prime-like numbers (raw SI = 699.071194...)' },
    { principal: 1000000, tenure: 1, desc: 'Very short tenure / small interest portion (raw SI = 328.767123...)' },
  ];

  for (const tc of FINANCIAL_TESTS) {
    const res = calculateLoan(tc.principal, tc.tenure);
    console.log(`\nTest Case: ${tc.desc}`);
    console.log(`  Inputs: Principal = INR ${tc.principal}, Tenure = ${tc.tenure} days`);
    console.log(`  Interest:           INR ${res.interestAmount}`);
    console.log(`  Total Repayment:    INR ${res.totalRepayment}`);
    console.log(`  Outstanding Balance:INR ${res.outstandingBalance}`);
    
    // Perform checking to see if interest is rounded perfectly to 2 decimal places
    const interestStr = res.interestAmount.toString();
    const decimalPlaces = interestStr.includes('.') ? interestStr.split('.')[1].length : 0;
    console.log(`  Validation: Rounded to <= 2 decimal places? ${decimalPlaces <= 2 ? '✔ YES' : '❌ NO'}`);
    
    // Verify that Total Repayment matches Principal + Interest exactly without floating-point overflow
    const expectedTotal = Math.round((tc.principal + res.interestAmount + Number.EPSILON) * 100) / 100;
    const isSumPerfect = res.totalRepayment === expectedTotal;
    console.log(`  Validation: Total Repayment equals Principal + Interest? ${isSumPerfect ? '✔ YES' : '❌ NO'}`);
  }

  console.log('\n================================================================');
  console.log('                 AUDIT COMPLETED SUCCESSFUL                    ');
  console.log('================================================================');
}

runMathAndPanChecks();
