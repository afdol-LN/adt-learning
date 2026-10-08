import { of, throwError } from 'rxjs';
import { ktService } from './kt.service';

const dto = {
  pLCurrent: 0.3,
  pT: 0.1,
  pG: 0.2,
  pS: 0.1,
  isCorrect: true,
  responseTime: 10,
  expectTime: 20,
} as any;

const ok = of({
  data: {
    p_l_prior: 0.3,
    p_l_posterior: 0.65,
    p_l_next: 0.69,
    predicted_correct_prob_next: 0.68,
    mastered: false,
  },
});
const httpError = (status: number) =>
  throwError(() => ({ response: { status }, message: `status ${status}` }));

describe('ktService.submitAttempt', () => {
  let post: jest.Mock;
  let service: ktService;

  beforeEach(() => {
    // skip the real back-off waits
    jest
      .spyOn(global, 'setTimeout')
      .mockImplementation(((fn: () => void) => {
        fn();
        return 0;
      }) as any);
    post = jest.fn();
    service = new ktService(
      { post } as any,
      { get: () => 'http://engine' } as any,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('retries while Render answers 502 and returns the result once the engine is up', async () => {
    post
      .mockReturnValueOnce(httpError(502))
      .mockReturnValueOnce(httpError(503))
      .mockReturnValueOnce(ok);

    const res = await service.submitAttempt(dto);

    expect(post).toHaveBeenCalledTimes(3);
    expect(res.isError).toBe(false);
    expect(res.data?.pLNext).toBe(0.69);
  });

  it('does not retry a 400 from the engine', async () => {
    post.mockReturnValue(httpError(400));

    const res = await service.submitAttempt(dto);

    expect(post).toHaveBeenCalledTimes(1);
    expect(res.isError).toBe(true);
  });

  it('gives up after the retry budget and reports the error', async () => {
    post.mockReturnValue(httpError(502));

    const res = await service.submitAttempt(dto);

    expect(post).toHaveBeenCalledTimes(7);
    expect(res.isError).toBe(true);
    expect(res.errorMessage).toBe('status 502');
  });
});
