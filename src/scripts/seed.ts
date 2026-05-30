import { connectDB, disconnectDB } from '../config/database';
import { User } from '../models/user.model';
import { Role } from '../enums/role.enum';
import { EmploymentMode } from '../enums/employment.enum';

const seedUsers = [
  {
    name: 'System Admin',
    email: 'admin@lms.com',
    password: 'LmsAdminPassword123!',
    role: Role.ADMIN,
    pan: 'PANAD1234E',
    dob: new Date('1985-01-01'),
    monthlySalary: 120000,
    employmentMode: EmploymentMode.SALARIED
  },
  {
    name: 'Sales Representative',
    email: 'sales@lms.com',
    password: 'LmsSalesPassword123!',
    role: Role.SALES,
    pan: 'PANSA1234S',
    dob: new Date('1990-06-15'),
    monthlySalary: 45000,
    employmentMode: EmploymentMode.SALARIED
  },
  {
    name: 'Sanction Officer',
    email: 'sanction@lms.com',
    password: 'LmsSanctionPassword123!',
    role: Role.SANCTION,
    pan: 'PANSO1234N',
    dob: new Date('1988-03-20'),
    monthlySalary: 85000,
    employmentMode: EmploymentMode.SALARIED
  },
  {
    name: 'Disbursement Officer',
    email: 'disburse@lms.com',
    password: 'LmsDisbursePassword123!',
    role: Role.DISBURSEMENT,
    pan: 'PANDI1234B',
    dob: new Date('1989-11-05'),
    monthlySalary: 80000,
    employmentMode: EmploymentMode.SALARIED
  },
  {
    name: 'Collection Agent',
    email: 'collection@lms.com',
    password: 'LmsCollectPassword123!',
    role: Role.COLLECTION,
    pan: 'PANCO1234L',
    dob: new Date('1992-09-10'),
    monthlySalary: 50000,
    employmentMode: EmploymentMode.SALARIED
  },
  {
    name: 'Test Borrower',
    email: 'borrower@lms.com',
    password: 'LmsBorrowPassword123!',
    role: Role.BORROWER,
    pan: 'PANBO1234R',
    dob: new Date('1995-07-25'),
    monthlySalary: 60000,
    employmentMode: EmploymentMode.SALARIED
  }
];

async function seedDatabase() {
  console.log('================================================================');
  console.log('            LOAN MANAGEMENT SYSTEM (LMS) SEED ENGINE            ');
  console.log('================================================================');

  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lms_sandbox_db';

  try {
    await connectDB(MONGO_URI);

    console.log('\n[Seed] Running user existence checks and injection...');
    const seededOutput = [];

    for (const u of seedUsers) {
      const existingUser = await User.findOne({ email: u.email });

      if (!existingUser) {
        const newUser = new User(u);
        // Pre-save hook automatically hashes password on .save()
        await newUser.save();
        seededOutput.push({
          Name: u.name,
          Email: u.email,
          Password: u.password,
          Role: u.role,
          PAN: u.pan,
          Status: 'CREATED'
        });
      } else {
        seededOutput.push({
          Name: existingUser.name,
          Email: existingUser.email,
          Password: '(Stored in DB)',
          Role: existingUser.role,
          PAN: existingUser.pan,
          Status: 'EXISTS'
        });
      }
    }

    console.log('\n--- SEEDED USER CREDENTIALS TABLE ---');
    console.table(seededOutput);
    console.log('-------------------------------------\n');

    await disconnectDB();
    console.log('[Seed] Database seeding run finished successfully.');

  } catch (error: any) {
    console.error(`\n[Seed Critical Error] Database seed failed:`);
    console.error(error.message);
  }
}

seedDatabase();
