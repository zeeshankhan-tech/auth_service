const request = require('supertest');
const { createApp } = require('../app');

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('does not expose legacy /health/health path', async () => {
    const app = createApp();
    const res = await request(app).get('/health/health');
    expect(res.status).toBe(404);
  });
});
