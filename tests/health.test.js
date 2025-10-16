const request = require('supertest');
const express = require('express');
let server;
let app;

beforeAll((done) => {
  app = require('../server');
  server = app.listen(0, done); // Start server on random port
});

afterAll((done) => {
  if (server) {
    server.close(done);
  } else {
    done();
  }
});

describe('Health Check API', () => {
  describe('GET /api/health', () => {
    it('should return API status and health information', async () => {
      const response = await request(server)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.status).toBe('OK');
      expect(response.body.message).toBe('RealtyFlow API is running');
    });

    it('should return JSON content type', async () => {
      const response = await request(server)
        .get('/api/health')
        .expect(200)
        .expect('Content-Type', /json/);
    });
  });
});