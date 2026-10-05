import { authService } from './auth.service';
import { Hash } from 'src/libs/hash';

describe('authService.accessRequest login log', () => {
  // JwtService reads the secret when authService is constructed
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const hash = new Hash();
  const token = 'tok';
  const user = {
    id: 5,
    username: 'alice',
    password: 'pw-hash',
    role: 'user',
    fullName: 'Alice',
    branches: [],
  };
  const signature = hash.hashSha256(user.username + user.password + token);

  const build = (insert: jest.Mock) => {
    const userRepo = { find: jest.fn().mockResolvedValue([user]) } as any;
    const loginRepo = { insert } as any;
    return new authService(userRepo, loginRepo);
  };

  it('records one loginLog row on a successful login', async () => {
    const insert = jest.fn().mockResolvedValue({});
    const res = await build(insert).accessRequest(token, signature);
    expect(res.isError).toBe(false);
    expect(insert).toHaveBeenCalledWith({ userId: 5 });
  });

  it('does not record anything on a failed login', async () => {
    const insert = jest.fn();
    const res = await build(insert).accessRequest(token, 'wrong');
    expect(res.isError).toBe(true);
    expect(insert).not.toHaveBeenCalled();
  });

  it('still logs the user in when the loginLog write fails', async () => {
    const insert = jest.fn().mockRejectedValue(new Error('db down'));
    const res = await build(insert).accessRequest(token, signature);
    expect(res.isError).toBe(false);
    expect(res.data.userId).toBe(5);
  });
});
