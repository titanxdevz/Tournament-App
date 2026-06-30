import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../app';
import { AuthService } from '../services/authService';

vi.mock('../services/authService');
vi.mock('../config/db', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock('../config/redis', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    hset: vi.fn(),
    hdel: vi.fn(),
    del: vi.fn(),
    on: vi.fn(),
  },
  createRedisConnection: vi.fn(),
}));

describe('Authentication Endpoints', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  describe('POST /api/auth/register', () => {
    it('should return 400 Bad Request when email format is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'password123',
          name: 'Test Name',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toBe('Validation failed');
    });

    it('should successfully register a user and return JWT', async () => {
      const mockUser = {
        id: 'user-uuid-12345',
        email: 'test@example.com',
        name: 'Register User',
        referralCode: 'REG1234',
      };

      vi.spyOn(AuthService, 'registerUser').mockResolvedValue(mockUser as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'securePassword123',
          name: 'Register User',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.user.id).toBe(mockUser.id);
      expect(body.user.email).toBe(mockUser.email);
      expect(body.accessToken).toBeDefined();
    });
  });
});
