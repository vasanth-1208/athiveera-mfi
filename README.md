# Athiveera Microfinance Management System (MFI Core Banking)

A production-grade, full-stack microfinance core management application engineered to replace spreadsheet-based microfinance operations (`MONDAY.xlsx`, `TUESDAY.xlsx`, `WEDNESDAY.xlsx`, `THURSDAY.xlsx`, `OVER ALL.xlsx`, `PENDING.xlsx`, and `Z LEDGER NOTE BOOK.xlsx`) with a secure, multi-branch, audit-logged web system.

---

## 1. System Architecture & Features

### Core Modules
1. **Multi-Branch Isolation**:
   - Built for Pollachi and Madathukulam (MDKM) branches with strict branch data isolation.
   - Non-admin staff and branch managers are restricted to their assigned branch.
   - Main Admin has cross-branch visibility and exclusive loan approval authority.
2. **Customer & Group Route Management**:
   - Searchable directory of unique member borrowers and group heads.
   - Groups mapped to weekday collection routes (`MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`), collection areas, and assigned field officers.
   - Prevents duplicate customer entries when individuals take multiple loan cycles across different sheets.
3. **Loan Application, Stepped-Down Amortization & Approvals**:
   - Strict 4-tier graduated repayment schedules derived from historical books:
     - **Tier A (₹20,000 / 32w)**: 19% flat interest + ₹1,200 savings/doc fees. Weeks 1–10: ₹850, Weeks 11–20: ₹800, Weeks 21–30: ₹750, Weeks 31–32: ₹500. Total: ₹25,000.
     - **Tier B (₹25,000 / 42w)**: 25.2% flat interest + ₹1,000 savings. Graduated ₹850 → ₹650. Total: ₹32,300.
     - **Tier C (₹30,000 / 52w)**: 30% flat interest + ₹2,000 savings. Graduated ₹900 → ₹500. Total: ₹41,000.
     - **Custom Tier**: Custom principal, tenure, and stepped-down installment brackets.
   - **Main Admin Approval Exclusivity**: Only `MAIN_ADMIN` can approve or reject applications; branch staff/managers cannot disburse unapproved loans.
4. **Early Payoff & Interest Discount Matrix**:
   - Realized discount on remaining unaccrued interest:
     - Weeks 0–10: **75% discount**
     - Weeks 11–20: **50% discount**
     - Weeks 21–30: **25% discount**
     - Weeks 31+: **0% discount**
5. **Real-Time Collections & Delinquency Follow-Ups**:
   - Digital weekday route collection sheets with automated balance reconciliation.
   - Printable receipts with unique receipt numbers.
   - Overdue delinquency screen reproducing `PENDING.xlsx` with follow-up tracking and promised settlement dates.
6. **Cashbook & Double-Entry Ledger**:
   - Distinguishes physical vault cash from bank/UPI reserves.
   - Double-entry inter-branch transfers (`POLLACHI` ⇄ `MDKM`) preventing false income/expense postings.
   - Operating expense vouchers and travel claims with the exact fuel formula (`KM × ₹2.16`, based on fuel @ ₹108/L and 50 KM/L mileage).
7. **Excel Export & Historical Migration**:
   - Live XLSX reports for daily collections, loan portfolio, pending overdue, and cashbook transactions.
   - Automated migration engine with dry-run previews and duplicate prevention for all 7 Excel workbooks.

---

## 2. Zero-Prefixing & Pure Database Storage

All credentials and records are stored **directly in MongoDB**:
- **No Hardcoded Login Credentials**: Default login fields are empty.
- **No Mock or Pre-Seeded Financial Balances**: Zero mock cash or phantom loans.
- **First-Time System Initialization**:
  - When you first connect a fresh MongoDB database, the system automatically detects that no admin exists and prompts you to create your master `MAIN_ADMIN` account directly in the database.
  - Once the master admin is created, the setup endpoint is permanently locked. All subsequent users and branches are created by the authenticated administrator.

---

## 3. Technology Stack

- **Backend**: Node.js, Express, TypeScript, Mongoose, JWT, Bcrypt, Vitest, XLSX
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, Recharts, Lucide Icons
- **Database**: MongoDB Atlas (with automatic in-memory fallback for offline test suites)

---

## 4. Setup & Running Locally

### Step 1: Install Dependencies
```powershell
npm install
npm --prefix server install
npm --prefix client install
```

### Step 2: Configure Environment (`.env`)
Create or edit `.env` in the root workspace (or `server/.env`):
```env
PORT=5000
NODE_ENV=development

# Paste your MongoDB Atlas Connection String here:
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/athiveera_mfi?retryWrites=true&w=majority

JWT_SECRET=athiveera_mfi_jwt_super_secure_production_secret_key_2026
JWT_EXPIRES_IN=24h
CORS_ORIGIN=*
```

### Step 3: Run the Application
You can run the servers using the root scripts:

- **Run Backend API Server (Port 5000):**
  ```powershell
  npm run dev:server
  ```
- **Run Frontend Client (Port 3000):**
  ```powershell
  npm run dev:client
  ```

### Step 4: First-Time Setup
1. Open your browser at `http://localhost:3000`.
2. Because your MongoDB database is fresh, the login screen will automatically show the **First-Time System Initialization** form.
3. Enter your desired **Admin Username**, **Password**, **Full Name**, and **Initial Branch**.
4. Click **Initialize System & Create Admin**. The system creates the administrator in MongoDB and logs you straight into the dashboard!

### Step 5: (Optional) Migrate Historical Excel Data
To populate your MongoDB database with all historical data from the 7 source Excel workbooks:
- **Option A (Via Dashboard UI)**: Go to **Import / Migration** in the sidebar, review the dry-run summary, and click **Commit Migration to Database**.
- **Option B (Via Terminal Command)**:
  ```powershell
  npm run migrate
  ```

---

## 5. Verification & Testing

Run all automated unit and integration tests:
```powershell
npm test
```
**Test Results:**
- `src/tests/financial_correctness.test.ts`: 5/5 passed (Stepped-down schedules, early settlement interest discount tiers, double-entry transfers).
- `src/tests/auth_and_setup.test.ts`: 5/5 passed (Database setup status, first-time admin creation, lockdown against duplicate setup, JWT login).

Build for production:
```powershell
npm run build
```
*(Compiles both TypeScript backend into `server/dist/` and Vite frontend into `client/dist/` with 0 errors).*
