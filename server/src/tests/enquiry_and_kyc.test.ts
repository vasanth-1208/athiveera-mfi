import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../index';
import { User } from '../models/User';
import { Branch } from '../models/Branch';
import { Enquiry } from '../models/Enquiry';
import { ENV } from '../config/env';

let mongod: MongoMemoryServer;
let branchId: string;
let staff1Token: string;
let staff1Id: string;
let staff2Token: string;
let staff2Id: string;
let managerToken: string;
let managerId: string;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const branch = await Branch.create({
    code: 'POLLACHI',
    name: 'Pollachi Branch',
    cashBalance: 500000,
    bankBalance: 500000
  });
  branchId = branch._id.toString();

  const passwordHash = await bcrypt.hash('Athiveera@MFI', 10);

  const staff1 = await User.create({
    username: 'staff1',
    passwordHash,
    name: 'Ramesh Staff',
    role: 'COLLECTION_STAFF',
    branchId: branch._id
  });
  staff1Id = staff1._id.toString();
  staff1Token = jwt.sign(
    { id: staff1Id, username: staff1.username, name: staff1.name, role: staff1.role, branchId },
    ENV.JWT_SECRET
  );

  const staff2 = await User.create({
    username: 'staff2',
    passwordHash,
    name: 'Suresh Staff',
    role: 'COLLECTION_STAFF',
    branchId: branch._id
  });
  staff2Id = staff2._id.toString();
  staff2Token = jwt.sign(
    { id: staff2Id, username: staff2.username, name: staff2.name, role: staff2.role, branchId },
    ENV.JWT_SECRET
  );

  const manager = await User.create({
    username: 'manager1',
    passwordHash,
    name: 'Vignesh Manager',
    role: 'BRANCH_MANAGER',
    branchId: branch._id
  });
  managerId = manager._id.toString();
  managerToken = jwt.sign(
    { id: managerId, username: manager.username, name: manager.name, role: manager.role, branchId },
    ENV.JWT_SECRET
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Enquiry Visit Approval and Logger KYC Submission Workflow', () => {
  let createdEnquiryId: string;

  it('1. Collection Staff logs a new loan enquiry with place, members count, name, and amount', async () => {
    const res = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${staff1Token}`)
      .send({
        place: 'Pollachi Town Market',
        membersCount: 5,
        name: 'Lakshmi Self Help Group',
        phone: '9876543210',
        amount: 20000,
        remarks: 'Fruit vendors group looking for weekly microfinance'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.enquiry.status).toBe('PENDING');
    expect(res.body.enquiry.place).toBe('Pollachi Town Market');
    expect(res.body.enquiry.membersCount).toBe(5);
    expect(res.body.enquiry.enquiryNo).toContain('ENQ-');

    createdEnquiryId = res.body.enquiry._id;
  });

  it('2. Staff cannot enter KYC before manager visits and approves the enquiry', async () => {
    const res = await request(app)
      .post(`/api/enquiries/${createdEnquiryId}/kyc`)
      .set('Authorization', `Bearer ${staff1Token}`)
      .send({
        smartCardNumber: '33/G/1234567',
        aadharNumber: '999988887777',
        voterIdNumber: 'TN/12/345/678901',
        panNumber: 'ABCDE1234F',
        remarks: 'Premises verified'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('after the manager has visited and approved');
  });

  it('3. Manager visits the location and approves the enquiry with visit remarks', async () => {
    const res = await request(app)
      .put(`/api/enquiries/${createdEnquiryId}/review`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        status: 'APPROVED',
        managerRemarks: 'Visited Pollachi market shop. Physically verified 5 active group members.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.enquiry.status).toBe('APPROVED');
    expect(res.body.enquiry.managerRemarks).toContain('Visited Pollachi market');
  });

  it('4. Another staff member (not the logger) cannot enter KYC for this enquiry', async () => {
    const res = await request(app)
      .post(`/api/enquiries/${createdEnquiryId}/kyc`)
      .set('Authorization', `Bearer ${staff2Token}`)
      .send({
        smartCardNumber: '33/G/1234567',
        aadharNumber: '999988887777',
        voterIdNumber: 'TN/12/345/678901',
        panNumber: 'ABCDE1234F'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Only the field staff who logged/created this enquiry');
  });

  it('5. The logger/creator staff enters the 4 KYC details (Smart Card, Aadhaar, Voter, PAN) with remarks', async () => {
    const res = await request(app)
      .post(`/api/enquiries/${createdEnquiryId}/kyc`)
      .set('Authorization', `Bearer ${staff1Token}`)
      .send({
        smartCardNumber: '33/G/1234567',
        aadharNumber: '999988887777',
        voterIdNumber: 'TN/12/345/678901',
        panNumber: 'ABCDE1234F',
        remarks: 'Physical documents verified with originals at residence'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.enquiry.status).toBe('KYC_SUBMITTED');
    expect(res.body.enquiry.kyc.smartCardNumber).toBe('33/G/1234567');
    expect(res.body.enquiry.kyc.aadharNumber).toBe('999988887777');
    expect(res.body.enquiry.kyc.voterIdNumber).toBe('TN/12/345/678901');
    expect(res.body.enquiry.kyc.panNumber).toBe('ABCDE1234F');
    expect(res.body.enquiry.kyc.submittedByName).toBe('Ramesh Staff');
  });

  it('6. Manager creates formal loan pre-populated with customer and verified KYC', async () => {
    const res = await request(app)
      .post('/api/loans/create-manager-loan')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        branchId,
        enquiryId: createdEnquiryId,
        customerName: 'Lakshmi Self Help Group',
        customerPhone: '9876543210',
        area: 'Pollachi Town Market',
        smartCardNumber: '33/G/1234567',
        aadharNumber: '999988887777',
        voterIdNumber: 'TN/12/345/678901',
        panNumber: 'ABCDE1234F',
        groupNo: '14',
        groupName: 'LAKSHMI SHG',
        collectionDay: 'MONDAY',
        loanCategory: 'REGULAR',
        frequency: 'WEEKLY',
        year: 2026,
        month: 'October',
        loanDate: '2026-10-27',
        loanAmount: 20000,
        interest: 3800,
        documentCharge: 1200,
        savingsAmount: 1200,
        noOfWeeks: 32,
        weeksAmountSplit: []
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.loan.principal).toBe(20000);
    expect(res.body.loan.customerName).toBe('Lakshmi Self Help Group');

    // Verify enquiry was marked as converted to loan
    const enq = await Enquiry.findById(createdEnquiryId);
    expect(enq?.convertedToLoanId).toBeDefined();
  });

  it('7. Individual member field visit KYC: only after all members are updated does status become KYC_SUBMITTED', async () => {
    // A. Create an enquiry with 2 members
    const createRes = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${staff1Token}`)
      .send({
        place: 'Kinathukadavu West',
        membersCount: 2,
        name: 'Devi SHG Group',
        phone: '9876543210',
        amount: 40000,
        remarks: '2 members group for poultry farming'
      });

    expect(createRes.status).toBe(201);
    const multiMemberEnquiryId = createRes.body.enquiry._id;

    // B. Manager visits and approves
    const reviewRes = await request(app)
      .put(`/api/enquiries/${multiMemberEnquiryId}/review`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        status: 'APPROVED',
        managerRemarks: 'Visited location. Residence verified for 2 members.'
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.enquiry.status).toBe('APPROVED');

    // C. Staff visits Member 1: saves Member 1 KYC
    const mem1Res = await request(app)
      .post(`/api/enquiries/${multiMemberEnquiryId}/member-kyc`)
      .set('Authorization', `Bearer ${staff1Token}`)
      .send({
        memberIndex: 1,
        memberName: 'Devi M',
        spouseName: 'Murugan K',
        nomineeName: 'Kavitha M',
        nomineeRelationship: 'Daughter',
        phone: '9876543210',
        smartCardNumber: '33/G/1122334',
        aadharNumber: '987612345678',
        voterIdNumber: 'TN/42/123/456789',
        panNumber: 'ABCDE1234F',
        totalGroupMembers: 2
      });

    expect(mem1Res.status).toBe(200);
    expect(mem1Res.body.success).toBe(true);
    expect(mem1Res.body.verifiedCount).toBe(1);
    expect(mem1Res.body.targetCount).toBe(2);
    expect(mem1Res.body.isAllCompleted).toBe(false);
    // Crucial requirement: enquiry must NOT be marked verified yet!
    expect(mem1Res.body.enquiry.status).toBe('APPROVED');

    // D. Staff visits Member 2: saves Member 2 KYC
    const mem2Res = await request(app)
      .post(`/api/enquiries/${multiMemberEnquiryId}/member-kyc`)
      .set('Authorization', `Bearer ${staff1Token}`)
      .send({
        memberIndex: 2,
        memberName: 'Lakshmi S',
        spouseName: 'Senthil P',
        nomineeName: 'Arun S',
        nomineeRelationship: 'Son',
        phone: '9876543211',
        smartCardNumber: '33/G/1122335',
        aadharNumber: '987612345679',
        voterIdNumber: 'TN/42/123/456790',
        panNumber: 'ABCDE1235G',
        totalGroupMembers: 2
      });

    expect(mem2Res.status).toBe(200);
    expect(mem2Res.body.success).toBe(true);
    expect(mem2Res.body.verifiedCount).toBe(2);
    expect(mem2Res.body.targetCount).toBe(2);
    expect(mem2Res.body.isAllCompleted).toBe(true);
    // Now that all members are updated, it should show KYC_SUBMITTED (verified)!
    expect(mem2Res.body.enquiry.status).toBe('KYC_SUBMITTED');
    expect(mem2Res.body.enquiry.kyc.members.length).toBe(2);
  });

  it('8. Removing/deleting member updates membersCount and completes KYC for remaining members only', async () => {
    // A. Create an enquiry with 4 members
    const createRes = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${staff1Token}`)
      .send({
        place: 'Kottur Village',
        membersCount: 4,
        name: 'Kottur Women Group',
        phone: '9876543222',
        amount: 80000,
        remarks: '4 members group originally'
      });

    expect(createRes.status).toBe(201);
    const enquiryId = createRes.body.enquiry._id;

    // B. Manager approves
    await request(app)
      .put(`/api/enquiries/${enquiryId}/review`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'APPROVED', managerRemarks: 'Visit approved for group' });

    // C. Save KYC for 3 members (member 1, 2, 3)
    for (let i = 1; i <= 3; i++) {
      await request(app)
        .post(`/api/enquiries/${enquiryId}/member-kyc`)
        .set('Authorization', `Bearer ${staff1Token}`)
        .send({
          memberIndex: i,
          memberName: `Member ${i}`,
          spouseName: `Spouse ${i}`,
          nomineeName: `Nominee ${i}`,
          nomineeRelationship: 'Spouse',
          smartCardNumber: `33/G/112233${i}`,
          aadharNumber: `98761234567${i}`,
          voterIdNumber: `TN/42/123/45679${i}`,
          panNumber: `ABCDE123${i}F`,
          totalGroupMembers: 4
        });
    }

    // Enquiry status should still be APPROVED because 3 of 4 are saved
    let check = await Enquiry.findById(enquiryId);
    expect(check?.status).toBe('APPROVED');
    expect(check?.membersCount).toBe(4);

    // D. Member 4 dropped out / deleted by staff
    const delRes = await request(app)
      .delete(`/api/enquiries/${enquiryId}/member/4`)
      .set('Authorization', `Bearer ${staff1Token}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.remainingCount).toBe(3);
    expect(delRes.body.isAllCompleted).toBe(true);

    // After deleting member 4, all 3 remaining members are verified, so status must be KYC_SUBMITTED!
    check = await Enquiry.findById(enquiryId);
    expect(check?.membersCount).toBe(3);
    expect(check?.status).toBe('KYC_SUBMITTED');
  });
});
