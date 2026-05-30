import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUserDocument } from '../interfaces/user.interface';
import { Role } from '../enums/role.enum';
import { EmploymentMode } from '../enums/employment.enum';

// Regex validation rules
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UserSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v: string) => EMAIL_REGEX.test(v),
        message: (props: any) => `${props.value} is not a valid email address!`
      }
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long']
    },
    role: {
      type: String,
      enum: {
        values: Object.values(Role),
        message: 'Invalid role selection'
      },
      default: Role.BORROWER
    },
    pan: {
      type: String,
      required: [true, 'PAN is required'],
      unique: true,
      trim: true,
      uppercase: true,
      validate: {
        validator: (v: string) => PAN_REGEX.test(v),
        message: (props: any) => `${props.value} is not a valid Indian PAN format!`
      }
    },
    dob: {
      type: Date,
      required: [true, 'Date of birth is required'],
      validate: {
        validator: function (v: Date) {
          const today = new Date();
          // Precise calculation of age
          let age = today.getFullYear() - v.getFullYear();
          const monthDiff = today.getMonth() - v.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < v.getDate())) {
            age--;
          }
          return age >= 18;
        },
        message: 'Borrower must be at least 18 years of age.'
      }
    },
    monthlySalary: {
      type: Number,
      required: [true, 'Monthly salary is required'],
      min: [0, 'Monthly salary cannot be negative']
    },
    employmentMode: {
      type: String,
      enum: {
        values: Object.values(EmploymentMode),
        message: 'Invalid employment mode'
      },
      required: [true, 'Employment mode is required']
    },
    salarySlipUrl: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook to hash password if it has been modified or is new
UserSchema.pre<IUserDocument>('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

// Instance method to check password validity
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = model<IUserDocument>('User', UserSchema);
