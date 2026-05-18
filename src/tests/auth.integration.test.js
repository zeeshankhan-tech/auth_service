const request = require('supertest');
const mongoose = require('mongoose');
const { createApp } = require('../app');
const { connectMongo, disconnectMongo } = require('../db/mongoose');
const User = require('../models/user.model');
const { ROLES } = require('../constants/roles');
const { startTestMongo } = require('./mongoTestHelper');

describe('Auth service (integration)', () => {
  let app;
  let stopMongo;

  beforeAll(async () => {
    const { uri, stop } = await startTestMongo();
    stopMongo = stop;
    process.env.MONGODB_URI = uri;
    await connectMongo();
    app = createApp();
  }, 180000);

  afterAll(async () => {
    await disconnectMongo();
    if (stopMongo) await stopMongo();
  });

  afterEach(async () => {
    const cols = mongoose.connection.collections;
    await Promise.all(Object.values(cols).map((c) => c.deleteMany({})));
  });

  const strongPassword = 'Str0ngPass!';

  it('registers a user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Ada', email: 'ada@example.com', password: strongPassword });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('ada@example.com');
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('rejects weak passwords', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Bob', email: 'bob@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('logs in and returns tokens', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Carl', email: 'carl@example.com', password: strongPassword });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'carl@example.com', password: strongPassword });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Ivy', email: 'ivy@example.com', password: strongPassword });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ivy@example.com', password: 'WrongPass1!' });
    expect(res.status).toBe(401);
  });

  it('refreshes tokens with rotation', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Dee', email: 'dee@example.com', password: strongPassword });
    const { refreshToken } = reg.body.data;

    const first = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.data.accessToken).toBeDefined();
    expect(first.body.data.refreshToken).not.toEqual(refreshToken);

    const replay = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401);
  });

  it('validates access tokens', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Eve', email: 'eve@example.com', password: strongPassword });
    const { accessToken } = reg.body.data;

    const ok = await request(app).post('/api/v1/auth/validate').send({ token: accessToken });
    expect(ok.status).toBe(200);
    expect(ok.body.data.valid).toBe(true);

    const bad = await request(app)
      .post('/api/v1/auth/validate')
      .send({ token: 'not-a-valid-jwt-token' });
    expect(bad.status).toBe(401);
  });

  it('validate returns current roles from database', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Role', email: 'role@example.com', password: strongPassword });
    const userId = reg.body.data.user.id;
    const { accessToken } = reg.body.data;

    await User.findByIdAndUpdate(userId, { roles: [ROLES.ADMIN] });

    const res = await request(app).post('/api/v1/auth/validate').send({ token: accessToken });
    expect(res.status).toBe(200);
    expect(res.body.data.roles).toEqual([ROLES.ADMIN]);
  });

  it('protects /me', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Finn', email: 'finn@example.com', password: strongPassword });
    const { accessToken } = reg.body.data;

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('finn@example.com');
  });

  it('logout blacklists access token', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Gus', email: 'gus@example.com', password: strongPassword });
    const { accessToken, refreshToken } = reg.body.data;

    const out = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(out.status).toBe(200);

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(401);
  });

  it('enforces RBAC on admin route', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Hal', email: 'hal@example.com', password: strongPassword });
    const userId = reg.body.data.user.id;
    const { accessToken } = reg.body.data;

    const denied = await request(app)
      .get('/api/v1/admin/ping')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(denied.status).toBe(403);

    await User.findByIdAndUpdate(userId, { roles: [ROLES.ADMIN] });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'hal@example.com', password: strongPassword });
    const adminToken = login.body.data.accessToken;

    const allowed = await request(app)
      .get('/api/v1/admin/ping')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(allowed.status).toBe(200);
  });
});
