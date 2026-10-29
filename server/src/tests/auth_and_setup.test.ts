import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { app } from '../index';
import { User } from '../models/User';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('2. Authentication & Initial Database Setup Flow', () => {
  it('should report isInitialized: false when no admin exists', async () => {
    const res = await request(app).get('/api/auth/setup-status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isInitialized).toBe(false);
  });

  it('should allow creating the initial Main Admin with custom credentials', async () => {
    const res = await request(app).post('/api/auth/setup-initial').send({
      username: 'founder_admin',
      password: 'MySecretPassword2026',
      name: 'Founder Admin',
      phone: '+91 9999999999',
      branchCode: 'POLLACHI',
      branchName: 'Pollachi Main Branch'
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('founder_admin');
    expect(res.body.user.role).toBe('MAIN_ADMIN');

    // Verify stored in DB with bcrypt hash
    const userInDb = await User.findOne({ username: 'founder_admin' });
    expect(userInDb).toBeDefined();
    expect(userInDb?.passwordHash).not.toBe('MySecretPassword2026');
  });

  it('should report isInitialized: true after admin creation', async () => {
    const res = await request(app).get('/api/auth/setup-status');
    expect(res.status).toBe(200);
    expect(res.body.isInitialized).toBe(true);
  });

  it('should permanently reject subsequent setup-initial requests', async () => {
    const res = await request(app).post('/api/auth/setup-initial').send({
      username: 'hacker_admin',
      password: 'AnotherPassword',
      name: 'Intruder'
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should allow the newly created admin to log in', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: 'founder_admin',
      password: 'MySecretPassword2026'
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('MAIN_ADMIN');
  });
});
