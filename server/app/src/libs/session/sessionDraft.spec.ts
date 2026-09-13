import { pickDraft } from './sessionDraft';

describe('pickDraft', () => {
  it('returns null when no session is open', () => {
    expect(pickDraft([])).toBeNull();
  });

  it('prefers the newest session with answers over a newer empty visit', () => {
    const draft = pickDraft([
      { id: 9, answeredCount: 2 },
      { id: 10, answeredCount: 3 },
      { id: 11, answeredCount: 0 },
    ]);
    expect(draft?.id).toBe(10);
  });

  it('falls back to the newest open session when none has answers', () => {
    const draft = pickDraft([
      { id: 4, answeredCount: 0 },
      { id: 7, answeredCount: 0 },
    ]);
    expect(draft?.id).toBe(7);
  });
});
