import { describe, expect, it } from 'vitest';
import { followupsFor } from './followups';
import { GENERAL_CHATBOT_VIEWS, PERSONNEL_CHATBOT_VIEWS } from './sql-guard';

describe('followupsFor', () => {
  it('gợi ý theo view vừa tra, tối đa 2 câu', () => {
    const out = followupsFor('SELECT * FROM v_chatbot_vehicles LIMIT 50', 'Xe nào sắp hết đăng kiểm?');
    expect(out).toEqual(['Xe nào sắp hết hạn bảo hiểm?', 'Xe nào lâu chưa bảo dưỡng?']);
  });

  it('không gợi ý lại đúng câu vừa hỏi', () => {
    const out = followupsFor('SELECT * FROM v_chatbot_vehicles', 'xe nào sắp hết hạn bảo hiểm');
    expect(out).not.toContain('Xe nào sắp hết hạn bảo hiểm?');
    expect(out).toHaveLength(2);
  });

  it('v_chatbot_mou không bắt nhầm v_chatbot_mou_details', () => {
    const out = followupsFor('SELECT * FROM v_chatbot_mou_details', 'x');
    expect(out).toEqual(['MOU nào sắp hết hạn trong 90 ngày?', 'Điều khoản nào sắp đến hạn?']);
  });

  it('SQL không khớp view nào thì không gợi ý', () => {
    expect(followupsFor('SELECT 1', 'x')).toEqual([]);
  });

  it('mọi view được phép đều có gợi ý', () => {
    const missing = [...GENERAL_CHATBOT_VIEWS, ...PERSONNEL_CHATBOT_VIEWS]
      .filter((v) => followupsFor(`SELECT * FROM ${v}`, '').length === 0);
    expect(missing).toEqual([]);
  });
});
