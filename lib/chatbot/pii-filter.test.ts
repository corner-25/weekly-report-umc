import { describe, expect, it } from 'vitest';
import { scrubPii } from './pii-filter';

describe('scrubPii', () => {
  it('masks contact, identity and birth-date patterns', () => {
    const safe = scrubPii('0901234567 test@example.com 012345678901 sinh 01/02/1990');
    expect(safe).not.toContain('0901234567');
    expect(safe).not.toContain('test@example.com');
    expect(safe).not.toContain('012345678901');
    expect(safe).not.toContain('01/02/1990');
  });
});
