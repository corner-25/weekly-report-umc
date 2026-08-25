import { describe, expect, it } from 'vitest';
import { CHATBOT_EVAL_CASES } from './eval-cases';
import { GENERAL_CHATBOT_VIEWS, PERSONNEL_CHATBOT_VIEWS } from './sql-guard';

describe('chatbot eval catalog', () => {
  it('covers the main business domains with unique cases', () => {
    expect(CHATBOT_EVAL_CASES.length).toBeGreaterThanOrEqual(25);
    expect(new Set(CHATBOT_EVAL_CASES.map((item) => item.id)).size).toBe(CHATBOT_EVAL_CASES.length);
    expect(new Set(CHATBOT_EVAL_CASES.map((item) => item.category)).size).toBeGreaterThanOrEqual(8);
  });
  it('only expects views known by the role allowlists', () => {
    const allowed = new Set([...GENERAL_CHATBOT_VIEWS, ...PERSONNEL_CHATBOT_VIEWS]);
    expect(CHATBOT_EVAL_CASES.filter((item) => !allowed.has(item.expectedView))).toEqual([]);
  });
});
