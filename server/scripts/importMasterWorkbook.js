const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const baseDir = 'c:/Projects/Athiveera MFI';
const masterFile = path.join(baseDir, 'ATHIVEERA_MFI_MASTER_MERGED.xlsx');

if (!fs.existsSync(masterFile)) {
  console.error(`Master file not found at: ${masterFile}`);
  process.exit(1);
}

const WEEKDAY_INDEX = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4
};

function getNextCollectionDate(baseDate, collectionDay, weekNum) {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  const targetDay = WEEKDAY_INDEX[collectionDay] || 1;
  let dayOffset = (targetDay - d.getDay() + 7) % 7;
  if (dayOffset === 0) dayOffset = 7;
  d.setDate(d.getDate() + dayOffset + (weekNum - 1) * 7);
  return d;
}

async function runImport() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to database.');

  const db = mongoose.connection.db;

  // 1. Ensure Branches
  let pollachiBranch = await db.collection('branches').findOne({ code: 'POLLACHI' });
  if (!pollachiBranch) {
    const res = await db.collection('branches').insertOne({
      code: 'POLLACHI',
      name: 'Pollachi Branch',
      address: 'Main Road, Pollachi, Tamil Nadu',
      phone: '+91 9500485596',
      cashBalance: 0,
      bankBalance: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    pollachiBranch = { _id: res.insertedId, code: 'POLLACHI', name: 'Pollachi Branch' };
  }

  const branchId = pollachiBranch._id;

  // 2. Ensure Users (Admin, Manager, Field Staff)
  const defaultPasswordHash = await bcrypt.hash('Athiveera@123', 10);
  const staffConfig = [
    { username: 'sekar', name: 'Chandra Sekar', role: 'COLLECTION_STAFF', phone: '9443000001' },
    { username: 'vignesh', name: 'Vignesh', role: 'COLLECTION_STAFF', phone: '9443000002' },
    { username: 'raseeth', name: 'Raseeth', role: 'COLLECTION_STAFF', phone: '9443000003' },
    { username: 'manager', name: 'Branch Manager', role: 'BRANCH_MANAGER', phone: '9500485596' }
  ];

  const staffUserMap = new Map();
  for (const s of staffConfig) {
    let u = await db.collection('users').findOne({ username: s.username });
    if (!u) {
      const res = await db.collection('users').insertOne({
        username: s.username,
        passwordHash: defaultPasswordHash,
        name: s.name,
        role: s.role,
        branchId: branchId,
        phone: s.phone,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      u = { _id: res.insertedId, ...s };
    }
    staffUserMap.set(s.name, u);
  }

  // Also fetch admin user
  const adminUser = await db.collection('users').findOne({ role: 'MAIN_ADMIN' });

  // 3. Clean existing Customers, Loans, Groups, Installments, Payments, Followups, and Enquiries
  console.log('\nCleaning existing customer, loan, group, installment, payment, and loan enquiry records...');
  await db.collection('installments').deleteMany({});
  await db.collection('payments').deleteMany({});
  await db.collection('followups').deleteMany({});
  await db.collection('loans').deleteMany({});
  await db.collection('customers').deleteMany({});
  await db.collection('groups').deleteMany({});
  
  // Explicitly delete loan enquiries
  const enqDel = await db.collection('enquiries').deleteMany({});
  console.log(`Deleted ${enqDel.deletedCount} loan enquiries from database.`);

  await db.collection('cashtransactions').deleteMany({
    $or: [{ loanId: { $exists: true } }, { category: 'LOAN_COLLECTION' }, { category: 'LOAN_DISBURSEMENT' }]
  });
  console.log('Database tables cleared for fresh master import.');

  // 4. Read Master Merged Workbook
  console.log(`\nReading ${masterFile}...`);
  const wb = XLSX.readFile(masterFile, { cellDates: true });
  const groupsData = XLSX.utils.sheet_to_json(wb.Sheets['MASTER_GROUPS']);
  const loansData = XLSX.utils.sheet_to_json(wb.Sheets['MASTER_LOANS']);

  console.log(`Found ${groupsData.length} groups and ${loansData.length} loans in master workbook.`);

  // 5. Prepare Groups
  const groupCodeMap = new Map();
  const groupsToInsert = [];

  for (const g of groupsData) {
    const code = Number(g['Group Code']);
    const staffName = g['Assigned Staff'] || 'Chandra Sekar';
    const staffObj = staffUserMap.get(staffName) || staffUserMap.get('Chandra Sekar');
    const groupId = new mongoose.Types.ObjectId();

    const groupDoc = {
      _id: groupId,
      groupCode: code,
      name: g['Group Name'],
      branchId,
      headName: g['Head Name'] || '',
      headPhone: g['Head Phone'] ? String(g['Head Phone']) : '',
      headCustomerId: null,
      collectionDay: g['Route Day'],
      area: g['Operational Area'] || 'Pollachi Rural',
      staffName: staffName,
      staffId: staffObj ? staffObj._id : null,
      cycle: Number(g['Cycle']) || 1,
      status: g['Status'] === 'CLOSED' ? 'CLOSED' : 'LIVE',
      totalMembers: Number(g['Active Borrowers']) || 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    groupsToInsert.push(groupDoc);
    groupCodeMap.set(code, groupDoc);
  }

  await db.collection('groups').insertMany(groupsToInsert);
  console.log(`Successfully bulk-inserted ${groupsToInsert.length} groups.`);

  // 6. Prepare Customers, Loans, Installments, Payments
  const customerMap = new Map();
  const loansToInsert = [];
  const installmentsToInsert = [];
  const paymentsToInsert = [];

  for (const l of loansData) {
    const gCode = Number(l['Group Code']);
    const groupDoc = groupCodeMap.get(gCode);
    if (!groupDoc) {
      console.warn(`Group not found for code: ${gCode}, loan: ${l['Loan Account #']}`);
      continue;
    }

    const staffName = l['Assigned Staff'] || groupDoc.staffName;
    const staffObj = staffUserMap.get(staffName) || staffUserMap.get('Chandra Sekar');

    // Customer Lookup / Creation
    const custId = l['Customer ID'];
    let customerDoc = customerMap.get(custId);
    if (!customerDoc) {
      const phone = (l['Phone Number'] && l['Phone Number'] !== '-') ? String(l['Phone Number']).trim() : '';
      const nomineePhone = (l['Nominee Phone'] && l['Nominee Phone'] !== '-') ? String(l['Nominee Phone']).trim() : '';
      const customerObjId = new mongoose.Types.ObjectId();

      customerDoc = {
        _id: customerObjId,
        customerId: custId,
        name: String(l['Borrower Name']).trim(),
        phone,
        nomineePhone,
        spouseName: '',
        nomineeName: '',
        address: groupDoc.area,
        area: groupDoc.area,
        smartCardNumber: '',
        aadharNumber: '',
        voterIdNumber: '',
        panNumber: '',
        branchId,
        activeGroupId: groupDoc._id,
        status: 'ACTIVE',
        notes: `Imported from Master Register - ${groupDoc.name}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      customerMap.set(custId, customerDoc);
    }

    // Loan details
    const principal = Number(l['Principal Amount (₹)']) || 20000;
    const interest = Number(l['Interest Amount (₹)']) || (principal === 20000 ? 3800 : principal === 25000 ? 6300 : 9000);
    const totalPayable = Number(l['Total Contractual (₹)']) || (principal + interest);
    const tenureWeeks = Number(l['Tenure (Weeks)']) || (principal === 20000 ? 32 : principal === 25000 ? 42 : 52);
    const weeklyDue = Number(l['Weekly Installment (₹)']) || Math.round(totalPayable / tenureWeeks);
    const totalPaid = Number(l['Paid Amount (₹)']) || 0;
    const isClosed = l['Status'] === 'CLOSED';

    let issueDate = new Date();
    if (l['Issue Date']) {
      const parsedDate = new Date(l['Issue Date']);
      if (!isNaN(parsedDate.getTime())) issueDate = parsedDate;
    }

    const loanId = new mongoose.Types.ObjectId();
    const loanDoc = {
      _id: loanId,
      loanNumber: l['Loan Account #'],
      customerId: customerDoc._id,
      groupId: groupDoc._id,
      branchId,
      cycle: Number(l['Cycle']) || groupDoc.cycle || 1,
      productType: l['Product Tier'] || 'TIER_A_20K',
      principal,
      interestRate: 19.0,
      interestAmount: interest,
      docCharges: Math.round(principal * 0.06),
      savingsAmount: 0,
      totalPayable,
      tenureWeeks,
      repaymentFrequency: 'WEEKLY',
      disbursedDate: issueDate,
      status: isClosed ? 'CLOSED' : 'ACTIVE',
      assignedStaffId: staffObj ? staffObj._id : null,
      assignedStaffName: staffName,
      assignedAt: issueDate,
      verification: {
        smartCardNumber: '',
        aadharNumber: '',
        voterIdNumber: '',
        panNumber: '',
        remarks: 'Verified & authorized from Master Register',
        verifiedBy: staffObj ? staffObj._id : (adminUser ? adminUser._id : null),
        verifiedByName: staffName,
        verifiedAt: issueDate,
        status: 'APPROVED'
      },
      approvedBy: adminUser ? adminUser._id : null,
      approvedAt: issueDate,
      approvalRemarks: 'System initial approval from Master Ledger',
      collectionDay: groupDoc.collectionDay,
      area: groupDoc.area,
      groupName: groupDoc.name,
      customerName: customerDoc.name,
      customerPhone: customerDoc.phone,
      createdAt: issueDate,
      updatedAt: new Date()
    };

    loansToInsert.push(loanDoc);

    // Generate installments
    let remainingPaid = isClosed ? totalPayable : totalPaid;

    for (let w = 1; w <= tenureWeeks; w++) {
      const dueDate = getNextCollectionDate(issueDate, groupDoc.collectionDay, w);
      const isLastWeek = (w === tenureWeeks);
      const expAmt = isLastWeek ? (totalPayable - weeklyDue * (tenureWeeks - 1)) : weeklyDue;
      const allocPrincipal = Math.round(expAmt * (principal / totalPayable));
      const allocInterest = expAmt - allocPrincipal;

      let instStatus = 'PENDING';
      let instPaid = 0;
      let instBal = expAmt;
      let paidDate = null;

      if (remainingPaid >= expAmt) {
        instStatus = 'PAID';
        instPaid = expAmt;
        instBal = 0;
        paidDate = dueDate;
        remainingPaid -= expAmt;
      } else if (remainingPaid > 0) {
        instStatus = 'PARTIAL';
        instPaid = remainingPaid;
        instBal = expAmt - remainingPaid;
        paidDate = dueDate;
        remainingPaid = 0;
      } else {
        instStatus = (dueDate < new Date()) ? 'OVERDUE' : 'PENDING';
      }

      const installmentId = new mongoose.Types.ObjectId();
      const instDoc = {
        _id: installmentId,
        loanId: loanDoc._id,
        customerId: customerDoc._id,
        groupId: groupDoc._id,
        branchId,
        installmentNumber: w,
        dueDate,
        expectedAmount: expAmt,
        allocatedPrincipal: allocPrincipal,
        allocatedInterest: allocInterest,
        allocatedSavings: 0,
        paidAmount: instPaid,
        balanceAmount: instBal,
        status: instStatus,
        paidDate,
        overdueDays: (instStatus === 'OVERDUE') ? Math.max(0, Math.floor((new Date().getTime() - dueDate.getTime()) / (1000 * 86400))) : 0,
        overdueWeeks: (instStatus === 'OVERDUE') ? Math.max(0, Math.floor((new Date().getTime() - dueDate.getTime()) / (1000 * 86400 * 7))) : 0,
        remarks: instStatus === 'PAID' ? 'Collected as per schedule' : '',
        createdAt: issueDate,
        updatedAt: new Date()
      };

      installmentsToInsert.push(instDoc);

      // Create Payment entry if paid
      if (instPaid > 0) {
        paymentsToInsert.push({
          loanId: loanDoc._id,
          customerId: customerDoc._id,
          groupId: groupDoc._id,
          branchId,
          installmentId: installmentId,
          amount: instPaid,
          allocatedPrincipal: Math.round(instPaid * (principal / totalPayable)),
          allocatedInterest: instPaid - Math.round(instPaid * (principal / totalPayable)),
          allocatedSavings: 0,
          paymentDate: paidDate || dueDate,
          paymentMode: 'CASH',
          collectedBy: staffObj ? staffObj._id : (adminUser ? adminUser._id : null),
          receiptNumber: `RCP-${loanDoc.loanNumber}-W${w}`,
          isReversed: false,
          notes: `Master Ledger Installment #${w}`,
          createdAt: paidDate || dueDate,
          updatedAt: new Date()
        });
      }
    }

    // Check if head of group
    if (groupDoc.headName && customerDoc.name.toUpperCase().includes(groupDoc.headName.toUpperCase().replace(/\..*$/, ''))) {
      groupDoc.headCustomerId = customerDoc._id;
    }
  }

  // Bulk Insert Customers
  const customersArray = Array.from(customerMap.values());
  await db.collection('customers').insertMany(customersArray);
  console.log(`Successfully bulk-inserted ${customersArray.length} customers.`);

  // Bulk Insert Loans
  await db.collection('loans').insertMany(loansToInsert);
  console.log(`Successfully bulk-inserted ${loansToInsert.length} loans.`);

  // Bulk Insert Installments
  await db.collection('installments').insertMany(installmentsToInsert);
  console.log(`Successfully bulk-inserted ${installmentsToInsert.length} installments.`);

  // Bulk Insert Payments
  if (paymentsToInsert.length > 0) {
    await db.collection('payments').insertMany(paymentsToInsert);
    console.log(`Successfully bulk-inserted ${paymentsToInsert.length} payment records.`);
  }

  // Update Groups with actual member counts and headCustomerId
  console.log('Syncing group member counts and group heads...');
  for (const groupDoc of groupCodeMap.values()) {
    const memCount = loansToInsert.filter(l => String(l.groupId) === String(groupDoc._id)).length;
    await db.collection('groups').updateOne(
      { _id: groupDoc._id },
      { $set: { totalMembers: memCount, headCustomerId: groupDoc.headCustomerId } }
    );
  }

  console.log('\n================ IMPORT SUCCESS SUMMARY ================');
  console.log(`Groups imported:       ${groupCodeMap.size}`);
  console.log(`Customers registered:  ${customersArray.length}`);
  console.log(`Loans active/closed:   ${loansToInsert.length}`);
  console.log(`Installments inserted: ${installmentsToInsert.length}`);
  console.log(`Payments recorded:     ${paymentsToInsert.length}`);
  console.log('========================================================\n');

  process.exit(0);
}

runImport().catch(err => {
  console.error('Import failed with error:', err);
  process.exit(1);
});
