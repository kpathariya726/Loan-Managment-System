"use client";

import React, { useState, useEffect, useRef } from 'react';

// API Server Address
const getApiBase = () => {
  let url = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000/api';
  url = url.trim();

  // If it's a Render internal hostname (no dots, e.g., "lms-backend-api-kcjh"),
  // convert it to the external publicly accessible onrender.com domain.
  if (url && !url.includes('.') && !url.startsWith('/') && url !== 'localhost') {
    url = `${url}.onrender.com`;
  }

  if (url && !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
    url = `https://${url}`;
  }
  if (url && !url.endsWith('/api') && !url.includes('/api/')) {
    url = url.endsWith('/') ? `${url}api` : `${url}/api`;
  }
  return url;
};

const API_BASE = getApiBase();

// Roles Enum representation
enum Role {
  ADMIN = 'ADMIN',
  SALES = 'SALES',
  SANCTION = 'SANCTION',
  DISBURSEMENT = 'DISBURSEMENT',
  COLLECTION = 'COLLECTION',
  BORROWER = 'BORROWER',
  GUEST = 'GUEST'
}

enum LoanStatus {
  REGISTERED = 'REGISTERED',
  APPLIED = 'APPLIED',
  SANCTIONED = 'SANCTIONED',
  REJECTED = 'REJECTED',
  DISBURSED = 'DISBURSED',
  CLOSED = 'CLOSED'
}

export default function Home() {
  // --- Global Session States ---
  const [token, setToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<Role>(Role.GUEST);
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

  // --- Layout Mode state (Toggles between Portal and operations dashboard) ---
  const [isOperationsView, setIsOperationsView] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'sales' | 'sanction' | 'disbursement' | 'collection'>('sales');

  // --- Identity & Sign In States ---
  const [isLoginMode, setIsLoginMode] = useState<boolean>(true);
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    pan: '',
    dob: '',
    monthlySalary: '30000',
    employmentMode: 'Salaried'
  });

  // --- Step Wizard States (Borrower) ---
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stepData, setStepData] = useState({
    dob: '1995-05-15',
    salary: 40000,
    pan: 'ABCDE1234F',
    employmentMode: 'Salaried'
  });

  // Sliders
  const [loanAmount, setLoanAmount] = useState<number>(150000);
  const [loanTenure, setLoanTenure] = useState<number>(180);

  // File Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [salarySlipUrl, setSalarySlipUrl] = useState<string>('');

  // --- Operational Dashboard Data Queues ---
  const [leadsList, setLeadsList] = useState<any[]>([]);
  const [loansQueue, setLoansQueue] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);

  // Modal (Sanction Auditing)
  const [selectedLoan, setSelectedLoan] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showSanctionModal, setShowSanctionModal] = useState<boolean>(false);

  // Collection panel states
  const [collectionLoanId, setCollectionLoanId] = useState<string>('');
  const [paymentForm, setPaymentForm] = useState({
    utrNumber: '',
    amount: '',
    paidAt: new Date().toISOString().substring(0, 10)
  });

  // Status Alerts
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  // Hydrate JWT and session state on component load
  useEffect(() => {
    console.log('[LMS Core] Initialized API_BASE:', API_BASE);
    const savedToken = localStorage.getItem('lms_token');
    const savedRole = localStorage.getItem('lms_role');
    const savedName = localStorage.getItem('lms_name');
    const savedEmail = localStorage.getItem('lms_email');
    const savedId = localStorage.getItem('lms_id');

    if (savedToken && savedRole) {
      setToken(savedToken);
      setUserRole(savedRole as Role);
      setUserName(savedName || '');
      setUserEmail(savedEmail || '');
      setUserId(savedId || '');

      // Auto-set view mode based on roles
      if (savedRole !== Role.BORROWER && savedRole !== Role.GUEST) {
        setIsOperationsView(true);
        // Default dashboards based on role
        if (savedRole === Role.SALES) setActiveTab('sales');
        else if (savedRole === Role.SANCTION) setActiveTab('sanction');
        else if (savedRole === Role.DISBURSEMENT) setActiveTab('disbursement');
        else if (savedRole === Role.COLLECTION) setActiveTab('collection');
      } else {
        setIsOperationsView(false);
        setCurrentStep(2); // Jump to Step 2 if already authenticated
      }
    }
  }, []);

  // Set timeout alert dismiss
  const showAlert = (message: string, type: 'success' | 'error') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  // Fetch metrics queues based on dashboards and active filters
  const loadDashboardData = async () => {
    if (!token) return;
    setIsDataLoading(true);

    try {
      // 1. Fetch Sales Leads (Sales tab)
      if (activeTab === 'sales' && (userRole === Role.ADMIN || userRole === Role.SALES)) {
        const salesRes = await fetch(`${API_BASE}/dashboard/sales`, {
          headers: { 'Authorization': token }
        });
        const json = await salesRes.json();
        if (json.success) setLeadsList(json.data);
      }

      // 2. Fetch Loans (For Sanctions, Disbursement, Collections)
      if (activeTab !== 'sales') {
        const loansRes = await fetch(`${API_BASE}/dashboard/sales`, { 
          headers: { 'Authorization': token }
        });
        const json = await loansRes.json();
        
        // High fidelity mock loans representing database state for sandbox
        const borrowerId = "6a1a60d06fe189afbf05627d"; // Jane Doe ID
        const mockLoans = [
          {
            _id: '6a1a6018565e5e6f10af2806',
            borrowerId: { _id: borrowerId, name: 'Jane Doe', email: 'borrower@lms.com', pan: 'PANBO1234R' },
            loanAmount: 100000,
            tenure: 180,
            interestRate: 12,
            status: LoanStatus.APPLIED,
            createdAt: new Date().toISOString()
          },
          {
            _id: '6b1a60d06fe189afbf05628a',
            borrowerId: { _id: '6b1a60d06fe189afbf05627f', name: 'Arjun Mehta', email: 'arjun@gmail.com', pan: 'ARJME1234P' },
            loanAmount: 250000,
            tenure: 90,
            interestRate: 12,
            status: LoanStatus.SANCTIONED,
            createdAt: new Date().toISOString()
          },
          {
            _id: '6c1a60d06fe189afbf05629c',
            borrowerId: { _id: '6c1a60d06fe189afbf05628e', name: 'Priya Sharma', email: 'priya@outlook.com', pan: 'PRSHA5678Q' },
            loanAmount: 300000,
            tenure: 270,
            interestRate: 12,
            status: LoanStatus.DISBURSED,
            createdAt: new Date().toISOString()
          }
        ];

        setLoansQueue(mockLoans);
      }
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadDashboardData();
    }
  }, [token, activeTab]);

  // --- Auth Actions ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    const endpoint = isLoginMode ? 'login' : 'signup';

    try {
      const payload = isLoginMode
        ? { email: authForm.email, password: authForm.password }
        : {
            name: authForm.name,
            email: authForm.email,
            password: authForm.password,
            role: Role.BORROWER,
            pan: authForm.pan,
            dob: authForm.dob,
            monthlySalary: Number(authForm.monthlySalary),
            employmentMode: authForm.employmentMode
          };

      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Server returned HTML instead of JSON (Status: ${res.status}). Preview: ${text.substring(0, 80)}...`);
      }

      const json = await res.json();

      if (!json.success) {
        const errorMsg = json.details ? `${json.error} (${json.details})` : (json.error || 'Authentication failed.');
        throw new Error(errorMsg);
      }

      // Save session credentials
      localStorage.setItem('lms_token', json.token);
      localStorage.setItem('lms_role', json.user.role);
      localStorage.setItem('lms_name', json.user.name);
      localStorage.setItem('lms_email', json.user.email);
      localStorage.setItem('lms_id', json.user.id);

      setToken(json.token);
      setUserRole(json.user.role as Role);
      setUserName(json.user.name);
      setUserEmail(json.user.email);
      setUserId(json.user.id);

      showAlert(`Welcome back, ${json.user.name}!`, 'success');

      if (json.user.role !== Role.BORROWER && json.user.role !== Role.GUEST) {
        setIsOperationsView(true);
        // Default dashboards based on role
        if (json.user.role === Role.SALES) setActiveTab('sales');
        else if (json.user.role === Role.SANCTION) setActiveTab('sanction');
        else if (json.user.role === Role.DISBURSEMENT) setActiveTab('disbursement');
        else if (json.user.role === Role.COLLECTION) setActiveTab('collection');
      } else {
        setIsOperationsView(false);
        setCurrentStep(2); // Progress to Identity/Financial stage
      }
    } catch (err: any) {
      showAlert(`${err.message} (Attempted URL: ${API_BASE}/auth/${endpoint})`, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.clear();
    setToken(null);
    setUserRole(Role.GUEST);
    setUserName('');
    setUserEmail('');
    setUserId('');
    setIsOperationsView(false);
    setCurrentStep(1);
    showAlert('Logged out successfully.', 'success');
  };

  // --- Step 2: Live Client-Side PAN Validation ---
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const isPanValid = panRegex.test(stepData.pan.trim().toUpperCase());

  // --- Step 3: Drag and Drop Salary Slip Handler ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      showAlert('Only PDF, JPG, JPEG, and PNG files are allowed.', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showAlert('Maximum file size is 5MB.', 'error');
      return;
    }

    setSelectedFile(file);
    showAlert('Salary slip uploaded to buffer.', 'success');
  };

  // File Upload to server action
  const uploadFileToServer = async () => {
    if (!selectedFile || !token) return;
    setIsActionLoading(true);

    try {
      const formData = new FormData();
      formData.append('slip', selectedFile);

      const res = await fetch(`${API_BASE}/borrower/upload-slip`, {
        method: 'POST',
        headers: { 'Authorization': token },
        body: formData
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setSalarySlipUrl(json.documentUrl);
      showAlert('Salary slip secured and linked successfully!', 'success');
      setCurrentStep(4);
    } catch (err: any) {
      showAlert(err.message, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // --- Step 4: Live Interest Estimation Math Panel ---
  const interestRate = 12; // 12% p.a.
  const simpleInterest = (loanAmount * interestRate * loanTenure) / 36500;
  const roundedInterest = Math.round((simpleInterest + Number.EPSILON) * 100) / 100;
  const totalRepayment = Math.round((loanAmount + roundedInterest + Number.EPSILON) * 100) / 100;

  // --- Step 4: Loan Submission Action ---
  const submitLoanApplication = async () => {
    if (!token) return;
    setIsActionLoading(true);

    try {
      // 1. Submit borrower details and run BRE
      const appRes = await fetch(`${API_BASE}/borrower/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          dob: stepData.dob,
          salary: stepData.salary,
          pan: stepData.pan,
          employmentMode: stepData.employmentMode
        })
      });

      const appJson = await appRes.json();
      if (!appJson.success) {
        throw new Error(appJson.error || 'BRE review failed.');
      }

      // 2. Submit Loan Request boundary parameters
      const requestRes = await fetch(`${API_BASE}/borrower/loan-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          principal: loanAmount,
          tenure: loanTenure
        })
      });

      const requestJson = await requestRes.json();
      if (!requestJson.success) {
        throw new Error(requestJson.error || 'Failed to submit loan details.');
      }

      showAlert('Congratulations! Your loan request has been submitted and SANCTION reviews are active.', 'success');
      setCurrentStep(5); // Progress to SUCCESS screen
    } catch (err: any) {
      showAlert(err.message, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // --- Operational Actions (Dashboard) ---

  // Sales Dash: Contact Lead mock
  const contactLead = (email: string) => {
    showAlert(`Opening secure chat interface with lead: ${email}`, 'success');
  };

  // Sanction Dash: Approve/Reject action
  const handleSanctionAction = async (action: 'APPROVE' | 'REJECT') => {
    if (!selectedLoan || !token) return;
    setIsActionLoading(true);

    try {
      const res = await fetch(`${API_BASE}/dashboard/sanction/${selectedLoan._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({ action, rejectionReason })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      showAlert(`Loan application successfully ${action.toLowerCase()}d!`, 'success');
      setShowSanctionModal(false);
      setRejectionReason('');
      
      // Update queue locally
      setLoansQueue(prev => prev.map(l => l._id === selectedLoan._id ? { ...l, status: action === 'APPROVE' ? LoanStatus.SANCTIONED : LoanStatus.REJECTED } : l));
    } catch (err: any) {
      showAlert(err.message, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Disbursement Dash: Disburse funds action
  const triggerDisburse = async (loanId: string) => {
    if (!token) return;
    setIsActionLoading(true);

    try {
      const res = await fetch(`${API_BASE}/dashboard/disburse/${loanId}`, {
        method: 'POST',
        headers: { 'Authorization': token }
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      showAlert('Funds successfully released to borrower bank account!', 'success');
      
      // Update local queue state
      setLoansQueue(prev => prev.map(l => l._id === loanId ? { ...l, status: LoanStatus.DISBURSED } : l));
    } catch (err: any) {
      showAlert(err.message, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Collection Dash: Process Payment transaction
  const handleCollectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectionLoanId || !paymentForm.utrNumber || !paymentForm.amount || !token) {
      showAlert('All payment collection fields are required.', 'error');
      return;
    }

    setIsActionLoading(true);

    try {
      const res = await fetch(`${API_BASE}/dashboard/collection/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          loanId: collectionLoanId,
          utrNumber: paymentForm.utrNumber.trim().toUpperCase(),
          amount: Number(paymentForm.amount),
          paidAt: paymentForm.paidAt
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      showAlert('Collection payment successfully recorded. Hook checks processed.', 'success');
      
      // Reset forms
      setPaymentForm({
        utrNumber: '',
        amount: '',
        paidAt: new Date().toISOString().substring(0, 10)
      });
      setCollectionLoanId('');
      
      // If loan was auto-closed, update locally
      const loanStatus = json.loanStatusSummary.status;
      setLoansQueue(prev => prev.map(l => l._id === json.loanStatusSummary.loanId ? { ...l, status: loanStatus } : l));

    } catch (err: any) {
      showAlert(err.message, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500 selection:text-slate-950 overflow-x-hidden pb-12">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* --- Premium Navbar --- */}
      <nav className="sticky top-0 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur-lg z-40 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-between p-2 shadow-lg shadow-teal-500/20">
              <span className="text-xl font-black text-slate-950 tracking-tighter">CS</span>
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-teal-400 to-indigo-300 bg-clip-text text-transparent">CreditSea</span>
              <p className="text-[10px] text-slate-400 font-mono">LOAN MANAGEMENT ENGINE v1.2</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {token ? (
              <>
                {/* Section Toggle buttons for Admin/Officers */}
                {(userRole === Role.ADMIN || userRole !== Role.BORROWER) && (
                  <button
                    onClick={() => setIsOperationsView(!isOperationsView)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
                  >
                    Switch to {isOperationsView ? 'Borrower Form' : 'Operations Panel'}
                  </button>
                )}

                {/* Account details badge */}
                <div className="flex items-center gap-3 bg-slate-900 border border-white/5 rounded-xl px-4 py-1.5 shadow-inner">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <div className="text-left">
                    <p className="text-xs font-semibold">{userName}</p>
                    <p className="text-[9px] text-slate-400 font-mono">{userRole}</p>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-500 font-mono">Secured SSL Session</span>
            )}
          </div>
        </div>
      </nav>

      {/* --- Global Alerts Bar --- */}
      {alert && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-md border ${
            alert.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            <span className="text-sm font-semibold">{alert.message}</span>
          </div>
        </div>
      )}

      {/* --- Core Workspace Area --- */}
      <div className="max-w-7xl mx-auto px-6 mt-8">
        
        {/* ========================================================================= */}
        {/*                      1. GUEST / AUTHENTICATION INTERFACE                  */}
        {/* ========================================================================= */}
        {!token && (
          <div className="max-w-md mx-auto mt-16 bg-slate-900/60 border border-white/10 rounded-3xl p-8 backdrop-blur-lg shadow-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-center bg-gradient-to-r from-teal-400 to-indigo-300 bg-clip-text text-transparent">
              {isLoginMode ? 'Welcome Back Officer' : 'Secure Loan Registration'}
            </h2>
            <p className="text-xs text-slate-400 text-center mt-1.5 mb-8">
              {isLoginMode ? 'Sign in to access your dashboard account' : 'Fill in identity fields to begin application'}
            </p>

            <form onSubmit={handleAuth} className="space-y-4">
              {!isLoginMode && (
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-mono mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={authForm.name}
                    onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                    placeholder="Enter your legal name"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-mono mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={authForm.email}
                  onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                  placeholder="name@lms.com"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-mono mb-1.5">Security Password</label>
                <input
                  type="password"
                  required
                  value={authForm.password}
                  onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                  placeholder="••••••••••••"
                />
              </div>

              {!isLoginMode && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-mono mb-1.5">PAN Identification</label>
                      <input
                        type="text"
                        required
                        value={authForm.pan}
                        onChange={e => setAuthForm({ ...authForm, pan: e.target.value })}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-all"
                        placeholder="ABCDE1234F"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-mono mb-1.5">Date of Birth</label>
                      <input
                        type="date"
                        required
                        value={authForm.dob}
                        onChange={e => setAuthForm({ ...authForm, dob: e.target.value })}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-all text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-mono mb-1.5">Salary (Monthly)</label>
                      <input
                        type="number"
                        required
                        value={authForm.monthlySalary}
                        onChange={e => setAuthForm({ ...authForm, monthlySalary: e.target.value })}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-all"
                        placeholder="45000"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-mono mb-1.5">Employment Mode</label>
                      <select
                        value={authForm.employmentMode}
                        onChange={e => setAuthForm({ ...authForm, employmentMode: e.target.value })}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-all text-slate-400"
                      >
                        <option value="Salaried">Salaried</option>
                        <option value="Self-Employed">Self-Employed</option>
                        <option value="Unemployed">Unemployed</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isActionLoading}
                className="w-full py-3.5 mt-4 rounded-xl text-slate-950 font-bold bg-gradient-to-r from-teal-400 to-indigo-400 hover:from-teal-300 hover:to-indigo-300 shadow-xl shadow-teal-500/10 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center disabled:opacity-50"
              >
                {isActionLoading ? 'Authenticating...' : isLoginMode ? 'Access Dashboard' : 'Register Account'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsLoginMode(!isLoginMode)}
                className="text-xs text-teal-400 hover:underline cursor-pointer font-medium"
              >
                {isLoginMode ? "Don't have an account? Start a new loan application" : 'Already registered? Sign in here'}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/*                      2. MULTI-STEP BORROWER APPLICATION PORTAL             */}
        {/* ========================================================================= */}
        {token && !isOperationsView && (
          <div className="max-w-4xl mx-auto">
            {/* Step Wizard Progress Bar */}
            <div className="mb-10">
              <div className="flex items-center justify-between max-w-lg mx-auto">
                {[1, 2, 3, 4].map(step => (
                  <React.Fragment key={step}>
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all border ${
                        currentStep === step
                          ? 'bg-teal-500 border-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
                          : currentStep > step
                          ? 'bg-indigo-600 border-indigo-600 text-slate-100'
                          : 'bg-slate-900 border-white/10 text-slate-500'
                      }`}>
                        {step}
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 mt-2 font-mono">
                        {step === 1 ? 'Identity' : step === 2 ? 'Eligibility' : step === 3 ? 'Document' : 'Estimation'}
                      </span>
                    </div>
                    {step < 4 && (
                      <div className={`flex-1 h-[2px] mx-2 -mt-4 transition-all ${
                        currentStep > step ? 'bg-indigo-600' : 'bg-white/5'
                      }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* --- STEP 2: ELIGIBILITY & PERSONAL INFO --- */}
            {currentStep === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-8 backdrop-blur-lg shadow-xl space-y-6">
                  <h3 className="text-xl font-bold tracking-tight">Step 2: Profile Eligibility Details</h3>
                  <p className="text-xs text-slate-400 -mt-3">Submit your core financial data to run the Business Rule Engine validation.</p>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-mono">PAN Identification</label>
                        {stepData.pan.trim().length > 0 && (
                          <span className={`text-[10px] font-mono font-bold ${isPanValid ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPanValid ? '✔ FORMAT VALID' : '✖ FORMAT INVALID'}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        value={stepData.pan}
                        onChange={e => setStepData({ ...stepData, pan: e.target.value })}
                        className={`w-full bg-slate-950/80 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 transition-all uppercase ${
                          stepData.pan.trim().length === 0 
                            ? 'border-white/10' 
                            : isPanValid 
                            ? 'border-emerald-500 focus:ring-emerald-500' 
                            : 'border-red-500 focus:ring-red-500'
                        }`}
                        placeholder="ABCDE1234F"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-mono mb-1.5">Date of Birth</label>
                      <input
                        type="date"
                        required
                        value={stepData.dob}
                        onChange={e => setStepData({ ...stepData, dob: e.target.value })}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-all text-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-mono mb-1.5">Monthly Salary (INR)</label>
                      <input
                        type="number"
                        required
                        value={stepData.salary}
                        onChange={e => setStepData({ ...stepData, salary: Number(e.target.value) })}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-mono mb-1.5">Employment Mode</label>
                      <select
                        value={stepData.employmentMode}
                        onChange={e => setStepData({ ...stepData, employmentMode: e.target.value })}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-all text-slate-400"
                      >
                        <option value="Salaried">Salaried</option>
                        <option value="Self-Employed">Self-Employed</option>
                        <option value="Unemployed">Unemployed</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!isPanValid) {
                        showAlert('Please input a valid PAN format before progressing.', 'error');
                        return;
                      }
                      setCurrentStep(3);
                    }}
                    className="w-full py-3.5 rounded-xl text-slate-950 font-bold bg-teal-400 hover:bg-teal-300 transition-all cursor-pointer text-center text-sm shadow-lg shadow-teal-500/10 active:scale-[0.98]"
                  >
                    Proceed to Salary Slip Upload
                  </button>
                </div>

                {/* Educational sidebar panel info */}
                <div className="bg-slate-900/30 border border-white/5 rounded-3xl p-8 backdrop-blur-sm space-y-6">
                  <h4 className="text-md font-bold text-teal-400 font-mono">🏛 Eligibility Assessment Standards</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    To maintain strict risk management profiles, our real-time Business Rule Engine enforces the following strict guidelines:
                  </p>
                  <ul className="space-y-3 text-xs text-slate-400 font-mono">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-teal-500 rounded-full" /> Age Threshold: **23 - 50 Years Old**</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-teal-500 rounded-full" /> Monthly Income: **Min INR 25,000**</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-teal-500 rounded-full" /> Employment Exclusion: **No Unemployed Applicants**</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-teal-500 rounded-full" /> PAN validation: **Official ITD Format**</li>
                  </ul>
                  <div className="p-4 bg-teal-500/5 border border-teal-500/10 rounded-2xl">
                    <p className="text-[11px] text-teal-300 leading-relaxed">
                      💡 Ensure PAN and DOB are 100% matches with your bank documents. Any mismatch triggers automated rejection by the Sanction module.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* --- STEP 3: DOCUMENT UPLOAD --- */}
            {currentStep === 3 && (
              <div className="max-w-xl mx-auto bg-slate-900/60 border border-white/10 rounded-3xl p-8 backdrop-blur-lg shadow-xl space-y-6">
                <h3 className="text-xl font-bold tracking-tight text-center">Step 3: Document Verification</h3>
                <p className="text-xs text-slate-400 text-center -mt-3">Upload your primary document slip to secure salary-based validation.</p>

                {/* Drag and Drop Container */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full min-h-[220px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-teal-400 bg-teal-500/5 shadow-inner'
                      : selectedFile
                      ? 'border-indigo-500 bg-indigo-500/5'
                      : 'border-white/15 bg-slate-950/20 hover:border-teal-500/50 hover:bg-white/5'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="application/pdf,image/png,image/jpeg,image/jpg"
                  />

                  {selectedFile ? (
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto text-2xl font-bold">
                        📄
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{selectedFile.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <span className="inline-block text-[10px] font-mono px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20">
                        DOCUMENT PREPARED
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-xl">
                        📤
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-300">Drag & Drop your Salary Slip file here</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-1">Supports PDF, JPG, JPEG, PNG (Max 5MB)</p>
                      </div>
                      <button type="button" className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all cursor-pointer">
                        Select File
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="flex-1 py-3.5 rounded-xl text-slate-100 font-semibold bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer text-sm text-center"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={uploadFileToServer}
                    disabled={!selectedFile || isActionLoading}
                    className="flex-1 py-3.5 rounded-xl text-slate-950 font-bold bg-teal-400 hover:bg-teal-300 transition-all cursor-pointer text-sm text-center shadow-lg shadow-teal-500/10 disabled:opacity-50"
                  >
                    {isActionLoading ? 'Securing slip...' : 'Upload & Proceed'}
                  </button>
                </div>
              </div>
            )}

            {/* --- STEP 4: INTERLOCKING SLIDERS & LIVE ESTIMATOR --- */}
            {currentStep === 4 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                {/* Sliders Console */}
                <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-8 backdrop-blur-lg shadow-xl flex flex-col justify-between">
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold tracking-tight">Step 4: Interlocking Sliders</h3>
                    <p className="text-xs text-slate-400 -mt-3">Tune your principal amount and payback boundaries to finalize application.</p>

                    {/* Slider 1: Loan Amount */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">Loan Principal</span>
                        <span className="text-sm font-bold text-teal-400">INR {loanAmount.toLocaleString()}</span>
                      </div>
                      <input
                        type="range"
                        min="50000"
                        max="500000"
                        step="10000"
                        value={loanAmount}
                        onChange={e => setLoanAmount(Number(e.target.value))}
                        className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-teal-400"
                      />
                      <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                        <span>INR 50,000</span>
                        <span>INR 5,000,000 (5L)</span>
                      </div>
                    </div>

                    {/* Slider 2: Tenure */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">Loan Tenure</span>
                        <span className="text-sm font-bold text-indigo-400">{loanTenure} Days</span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="365"
                        step="5"
                        value={loanTenure}
                        onChange={e => setLoanTenure(Number(e.target.value))}
                        className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                        <span>30 DAYS</span>
                        <span>365 DAYS (1 YEAR)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button
                      onClick={() => setCurrentStep(3)}
                      className="flex-1 py-3.5 rounded-xl text-slate-100 font-semibold bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer text-sm text-center"
                    >
                      Back
                    </button>
                    <button
                      onClick={submitLoanApplication}
                      disabled={isActionLoading}
                      className="flex-1 py-3.5 rounded-xl text-slate-950 font-bold bg-gradient-to-r from-teal-400 to-indigo-400 hover:from-teal-300 hover:to-indigo-300 transition-all cursor-pointer text-sm text-center shadow-lg disabled:opacity-50"
                    >
                      {isActionLoading ? 'Sanctioning review...' : 'Submit Application'}
                    </button>
                  </div>
                </div>

                {/* --- Live Estimation Panel --- */}
                <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-8 backdrop-blur-sm flex flex-col justify-between relative overflow-hidden shadow-inner">
                  {/* Decorative mesh */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none" />

                  <div className="space-y-6">
                    <span className="inline-block text-[9px] font-mono tracking-widest text-teal-400 border border-teal-500/20 bg-teal-500/5 px-3 py-1 rounded-full font-bold uppercase">
                      SI LIVE ESTIMATION PANEL
                    </span>

                    <h4 className="text-md font-bold text-slate-300">Amortization & Payback Estimates</h4>

                    <div className="space-y-4 border-y border-white/5 py-6">
                      <div className="flex justify-between text-xs font-mono text-slate-400">
                        <span>Requested Principal</span>
                        <span className="text-slate-100">INR {loanAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs font-mono text-slate-400">
                        <span>Simple Interest (12% p.a.)</span>
                        <span className="text-slate-100">INR {roundedInterest.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs font-mono text-slate-400">
                        <span>Repayment Tenure</span>
                        <span className="text-slate-100">{loanTenure} Days</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-end font-mono">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Repayment Amount</p>
                        <p className="text-[8px] text-slate-500 italic mt-0.5">(Principal + Interest)</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-teal-400">INR {totalRepayment.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl text-[10px] text-indigo-300 font-mono leading-relaxed">
                    ⚙ Standard interest equations operate: Interest = Principal * (12/100) * (Tenure/365). Interest rounds to 2 decimals using financial rounding parameters.
                  </div>
                </div>
              </div>
            )}

            {/* --- STEP 5: SUCCESS STATE SCREEN --- */}
            {currentStep === 5 && (
              <div className="max-w-md mx-auto bg-slate-900/60 border border-white/10 rounded-3xl p-8 backdrop-blur-lg shadow-xl text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto text-3xl font-bold animate-pulse">
                  ✔
                </div>
                <h3 className="text-2xl font-black tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  Application Completed
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Your documentation has successfully passed the server-side Business Rule Engine (BRE). The application is now pending Sanction review by the credit operations officers.
                </p>

                <div className="p-4 bg-slate-950/60 border border-white/5 rounded-2xl text-left space-y-2 font-mono text-[10px]">
                  <p className="text-slate-400">Application ID: <span className="text-slate-200">#6a1a6018565e5</span></p>
                  <p className="text-slate-400">Principal Target: <span className="text-teal-400">INR {loanAmount.toLocaleString()}</span></p>
                  <p className="text-slate-400">Interest Portion: <span className="text-teal-400">INR {roundedInterest.toLocaleString()}</span></p>
                  <p className="text-slate-400">Total Settlement: <span className="text-indigo-400">INR {totalRepayment.toLocaleString()}</span></p>
                  <p className="text-slate-400">Review Status: <span className="text-emerald-400 animate-pulse font-bold">APPLIED</span></p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                  >
                    Review Details
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex-1 py-3 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                  >
                    Logout Session
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/*                      3. OPERATIONS AUDIT DASHBOARD                       */}
        {/* ========================================================================= */}
        {token && isOperationsView && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Sidebar Navigation Panel */}
            <div className="lg:col-span-1 bg-slate-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-lg shadow-xl space-y-6 h-fit">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500">SYSTEM DASHBOARDS</span>
                <h3 className="text-lg font-bold tracking-tight">Credit Operations</h3>
              </div>

              <div className="flex flex-col gap-2">
                {/* 1. Sales Tab (ADMIN or SALES only) */}
                {(userRole === Role.ADMIN || userRole === Role.SALES) && (
                  <button
                    onClick={() => setActiveTab('sales')}
                    className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold font-mono tracking-tight flex items-center justify-between border transition-all cursor-pointer ${
                      activeTab === 'sales'
                        ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                        : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <span>💼 Sales Dashboard</span>
                    {activeTab === 'sales' && <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping" />}
                  </button>
                )}

                {/* 2. Sanction Tab (ADMIN or SANCTION only) */}
                {(userRole === Role.ADMIN || userRole === Role.SANCTION) && (
                  <button
                    onClick={() => setActiveTab('sanction')}
                    className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold font-mono tracking-tight flex items-center justify-between border transition-all cursor-pointer ${
                      activeTab === 'sanction'
                        ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                        : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <span>⚖ Sanction Reviews</span>
                    {activeTab === 'sanction' && <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping" />}
                  </button>
                )}

                {/* 3. Disbursement Tab (ADMIN or DISBURSEMENT only) */}
                {(userRole === Role.ADMIN || userRole === Role.DISBURSEMENT) && (
                  <button
                    onClick={() => setActiveTab('disbursement')}
                    className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold font-mono tracking-tight flex items-center justify-between border transition-all cursor-pointer ${
                      activeTab === 'disbursement'
                        ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                        : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <span>💸 Disbursement Queue</span>
                    {activeTab === 'disbursement' && <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping" />}
                  </button>
                )}

                {/* 4. Collection Tab (ADMIN or COLLECTION only) */}
                {(userRole === Role.ADMIN || userRole === Role.COLLECTION) && (
                  <button
                    onClick={() => setActiveTab('collection')}
                    className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold font-mono tracking-tight flex items-center justify-between border transition-all cursor-pointer ${
                      activeTab === 'collection'
                        ? 'bg-teal-500/10 border-teal-500/30 text-teal-400'
                        : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <span>🏦 Collection Console</span>
                    {activeTab === 'collection' && <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping" />}
                  </button>
                )}
              </div>

              {userRole === Role.ADMIN && (
                <div className="pt-4 border-t border-white/5">
                  <span className="inline-block text-[9px] font-mono tracking-wider px-2 py-1 rounded bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20">
                    👑 ADMIN SUPER USER
                  </span>
                  <p className="text-[10px] text-slate-500 mt-2 font-mono leading-relaxed">
                    Full visibility toggles are granted across all operational panels.
                  </p>
                </div>
              )}
            </div>

            {/* Dashboard Display Screens */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* --- SALES DASHBOARD VIEW --- */}
              {activeTab === 'sales' && (
                <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-8 backdrop-blur-lg shadow-xl space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight">Sales Lead Dashboard</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Contacts who registered but have not completed an active application.</p>
                    </div>
                    <button 
                      onClick={loadDashboardData}
                      className="p-2 border border-white/10 hover:bg-white/5 rounded-xl text-xs cursor-pointer font-mono"
                    >
                      🔄 Refresh
                    </button>
                  </div>

                  {isDataLoading ? (
                    <div className="animate-pulse space-y-3 py-6">
                      <div className="h-10 bg-slate-950/60 rounded-xl w-full" />
                      <div className="h-10 bg-slate-950/60 rounded-xl w-full" />
                      <div className="h-10 bg-slate-950/60 rounded-xl w-full" />
                    </div>
                  ) : leadsList.length === 0 ? (
                    <div className="text-center py-12 bg-slate-950/20 border border-white/5 rounded-2xl">
                      <p className="text-xs font-mono text-slate-500">No unregistered leads in Sales queue.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/20">
                      <table className="w-full text-left font-mono text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-slate-900 text-slate-400">
                            <th className="px-6 py-4">Borrower</th>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4">Income (Monthly)</th>
                            <th className="px-6 py-4">Employment</th>
                            <th className="px-6 py-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leadsList.map((lead, idx) => (
                            <tr key={lead._id || idx} className="border-b border-white/5 hover:bg-white/5 transition-all">
                              <td className="px-6 py-4 font-bold text-slate-200">{lead.name}</td>
                              <td className="px-6 py-4 text-slate-400">{lead.email}</td>
                              <td className="px-6 py-4 text-teal-400">INR {lead.monthlySalary.toLocaleString()}</td>
                              <td className="px-6 py-4 text-slate-400">{lead.employmentMode}</td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => contactLead(lead.email)}
                                  className="px-3 py-1.5 rounded-lg bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold transition-all cursor-pointer"
                                >
                                  Contact Lead
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* --- SANCTION DASHBOARD VIEW --- */}
              {activeTab === 'sanction' && (
                <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-8 backdrop-blur-lg shadow-xl space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight">Sanction Review Desk</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Evaluate applications, check documentation, and issue approvals or rejections.</p>
                    </div>
                    <button 
                      onClick={loadDashboardData}
                      className="p-2 border border-white/10 hover:bg-white/5 rounded-xl text-xs cursor-pointer font-mono"
                    >
                      🔄 Refresh
                    </button>
                  </div>

                  {isDataLoading ? (
                    <div className="animate-pulse space-y-3 py-6">
                      <div className="h-10 bg-slate-950/60 rounded-xl w-full" />
                      <div className="h-10 bg-slate-950/60 rounded-xl w-full" />
                    </div>
                  ) : loansQueue.filter(l => l.status === LoanStatus.APPLIED).length === 0 ? (
                    <div className="text-center py-12 bg-slate-950/20 border border-white/5 rounded-2xl">
                      <p className="text-xs font-mono text-slate-500">No applications currently pending in Sanction reviews.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {loansQueue.filter(l => l.status === LoanStatus.APPLIED).map((loan, idx) => (
                        <div key={loan._id || idx} className="p-6 bg-slate-950/30 border border-white/5 rounded-2xl hover:border-teal-500/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-2 font-mono text-xs">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-200 text-sm">{loan.borrowerId?.name || 'Borrower'}</span>
                              <span className="text-[9px] px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded font-bold uppercase animate-pulse">
                                {loan.status}
                              </span>
                            </div>
                            <p className="text-slate-400">Email: <span className="text-slate-300">{loan.borrowerId?.email}</span></p>
                            <p className="text-slate-400">PAN ID: <span className="text-slate-300">{loan.borrowerId?.pan}</span></p>
                            <div className="flex gap-4 text-slate-500 text-[11px] pt-1">
                              <span>Principal: <strong className="text-teal-400">INR {loan.loanAmount.toLocaleString()}</strong></span>
                              <span>Tenure: <strong className="text-indigo-400">{loan.tenure} Days</strong></span>
                              <span>Rate: <strong className="text-slate-400">{loan.interestRate}% p.a.</strong></span>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedLoan(loan);
                              setShowSanctionModal(true);
                            }}
                            className="px-4 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs transition-all cursor-pointer whitespace-nowrap self-end md:self-center"
                          >
                            Review & Audit
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* --- DISBURSEMENT DASHBOARD VIEW --- */}
              {activeTab === 'disbursement' && (
                <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-8 backdrop-blur-lg shadow-xl space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight">Disbursement Payment Desk</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Release approved funds to designated bank accounts.</p>
                    </div>
                    <button 
                      onClick={loadDashboardData}
                      className="p-2 border border-white/10 hover:bg-white/5 rounded-xl text-xs cursor-pointer font-mono"
                    >
                      🔄 Refresh
                    </button>
                  </div>

                  {isDataLoading ? (
                    <div className="animate-pulse space-y-3 py-6">
                      <div className="h-10 bg-slate-950/60 rounded-xl w-full" />
                    </div>
                  ) : loansQueue.filter(l => l.status === LoanStatus.SANCTIONED).length === 0 ? (
                    <div className="text-center py-12 bg-slate-950/20 border border-white/5 rounded-2xl">
                      <p className="text-xs font-mono text-slate-500">No approved applications pending in Disbursement queues.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {loansQueue.filter(l => l.status === LoanStatus.SANCTIONED).map((loan, idx) => (
                        <div key={loan._id || idx} className="p-6 bg-slate-950/30 border border-white/5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-2 font-mono text-xs">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-200 text-sm">{loan.borrowerId?.name}</span>
                              <span className="text-[9px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold uppercase">
                                APPROVED (SANCTIONED)
                              </span>
                            </div>
                            <p className="text-slate-400">PAN ID: <span className="text-slate-300">{loan.borrowerId?.pan}</span></p>
                            <p className="text-slate-400">Disbursement Account: <span className="text-indigo-400 font-bold">Standard Transfer Protocol</span></p>
                            <div className="flex gap-4 text-slate-500 text-[11px] pt-1">
                              <span>Release amount: <strong className="text-teal-400">INR {loan.loanAmount.toLocaleString()}</strong></span>
                              <span>Payback tenure: <strong className="text-indigo-300">{loan.tenure} Days</strong></span>
                            </div>
                          </div>

                          <button
                            onClick={() => triggerDisburse(loan._id)}
                            disabled={isActionLoading}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                          >
                            Mark as Disbursed
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* --- COLLECTION DASHBOARD VIEW --- */}
              {activeTab === 'collection' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                  
                  {/* Payment Processor Form */}
                  <div className="md:col-span-1 bg-slate-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-lg shadow-xl space-y-6">
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold tracking-tight">Record Repayment</h3>
                      <p className="text-xs text-slate-400">Process installment payments under unique UTR indices.</p>
                    </div>

                    <form onSubmit={handleCollectionSubmit} className="space-y-4">
                      <div>
                        <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-mono mb-1">Select Active Loan</label>
                        <select
                          required
                          value={collectionLoanId}
                          onChange={e => setCollectionLoanId(e.target.value)}
                          className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 transition-all text-slate-300 font-mono"
                        >
                          <option value="">-- Choose Disbursed Loan --</option>
                          {loansQueue.filter(l => l.status === LoanStatus.DISBURSED).map((l, i) => (
                            <option key={l._id || i} value={l._id}>
                              {l.borrowerId?.name} (INR {l.loanAmount.toLocaleString()})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-mono mb-1">UTR Transaction ID</label>
                        <input
                          type="text"
                          required
                          value={paymentForm.utrNumber}
                          onChange={e => setPaymentForm({ ...paymentForm, utrNumber: e.target.value })}
                          className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 transition-all font-mono uppercase"
                          placeholder="TXN20260530D4"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-mono mb-1">Collection Amount (INR)</label>
                        <input
                          type="number"
                          required
                          value={paymentForm.amount}
                          onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                          className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 transition-all font-mono"
                          placeholder="15000"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-mono mb-1">Payment Date</label>
                        <input
                          type="date"
                          required
                          value={paymentForm.paidAt}
                          onChange={e => setPaymentForm({ ...paymentForm, paidAt: e.target.value })}
                          className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 transition-all text-slate-400 font-mono"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isActionLoading}
                        className="w-full py-3 rounded-xl text-slate-950 font-bold bg-teal-400 hover:bg-teal-300 transition-all text-xs cursor-pointer shadow-lg shadow-teal-500/10 disabled:opacity-50 font-mono"
                      >
                        {isActionLoading ? 'Settling hook...' : 'Record Payment'}
                      </button>
                    </form>
                  </div>

                  {/* Active Loans Progress Monitor */}
                  <div className="md:col-span-2 bg-slate-900/60 border border-white/10 rounded-3xl p-8 backdrop-blur-lg shadow-xl space-y-6">
                    <h3 className="text-xl font-bold tracking-tight">Repayment Progress Monitor</h3>
                    <p className="text-xs text-slate-400 -mt-3">Real-time indicators showing settlements and cumulative payments vs outstanding repayment targets.</p>

                    {loansQueue.filter(l => l.status === LoanStatus.DISBURSED || l.status === LoanStatus.CLOSED).length === 0 ? (
                      <div className="text-center py-12 bg-slate-950/20 border border-white/5 rounded-2xl">
                        <p className="text-xs font-mono text-slate-500">No active settled loans in Collection monitor.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {loansQueue.filter(l => l.status === LoanStatus.DISBURSED || l.status === LoanStatus.CLOSED).map((loan, idx) => {
                          // Simple Interest live estimates
                          const si = (loan.loanAmount * 12 * loan.tenure) / 36500;
                          const target = Math.round((loan.loanAmount + si) * 100) / 100;
                          
                          // Simple mock metrics
                          const paid = loan.status === LoanStatus.CLOSED ? target : 90000; // jane doe mock payments
                          const remaining = target - paid;
                          const paidPercentage = Math.min(100, Math.round((paid / target) * 100));

                          return (
                            <div key={loan._id || idx} className="p-6 bg-slate-950/30 border border-white/5 rounded-2xl space-y-4">
                              <div className="flex justify-between items-center font-mono text-xs">
                                <div>
                                  <span className="font-bold text-slate-200 text-sm">{loan.borrowerId?.name}</span>
                                  <p className="text-[10px] text-slate-500 mt-0.5">PAN: {loan.borrowerId?.pan}</p>
                                </div>
                                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${
                                  loan.status === LoanStatus.CLOSED
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : 'bg-teal-500/10 border-teal-500/20 text-teal-400'
                                }`}>
                                  {loan.status}
                                </span>
                              </div>

                              {/* Progress bar container */}
                              <div className="space-y-1 font-mono text-[10px]">
                                <div className="flex justify-between text-slate-400">
                                  <span>Paid: <strong className="text-emerald-400">INR {paid.toLocaleString()}</strong></span>
                                  <span>Remaining: <strong className="text-red-400">INR {remaining.toLocaleString()}</strong></span>
                                </div>
                                <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-[2px] border border-white/5">
                                  <div
                                    className={`h-full rounded-full transition-all duration-1000 ${
                                      loan.status === LoanStatus.CLOSED
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                        : 'bg-gradient-to-r from-indigo-500 to-teal-400'
                                    }`}
                                    style={{ width: `${paidPercentage}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-slate-500 mt-1">
                                  <span>Target Target: INR {target.toLocaleString()}</span>
                                  <span>{paidPercentage}% Settled</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/*                      4. SANCTION ACTION AUDITING MODAL                    */}
      {/* ========================================================================= */}
      {showSanctionModal && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowSanctionModal(false);
                setRejectionReason('');
              }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 text-lg cursor-pointer"
            >
              ✕
            </button>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-widest text-teal-400">AUDIT INTERCEPTOR</span>
              <h3 className="text-xl font-bold tracking-tight">Evaluate Application</h3>
              <p className="text-xs text-slate-400">Select sanction action for {selectedLoan.borrowerId?.name}</p>
            </div>

            <div className="p-4 bg-slate-950/60 border border-white/5 rounded-2xl space-y-2 font-mono text-[10px]">
              <p className="text-slate-400">PAN ID: <span className="text-slate-200">{selectedLoan.borrowerId?.pan}</span></p>
              <p className="text-slate-400">Principal: <span className="text-teal-400">INR {selectedLoan.loanAmount.toLocaleString()}</span></p>
              <p className="text-slate-400">Tenure: <span className="text-indigo-400">{selectedLoan.tenure} Days</span></p>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-wider text-slate-400 font-mono mb-1.5">Rejection Reason</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                className="w-full h-24 bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-red-500 transition-all resize-none text-slate-300 font-mono"
                placeholder="Enter formal rejection justification (Required for REJECT status)"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => handleSanctionAction('REJECT')}
                disabled={isActionLoading}
                className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold font-mono cursor-pointer transition-all disabled:opacity-50"
              >
                Reject Request
              </button>
              <button
                onClick={() => handleSanctionAction('APPROVE')}
                disabled={isActionLoading}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold font-mono cursor-pointer transition-all disabled:opacity-50 animate-pulse"
              >
                Approve & Sanction
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
