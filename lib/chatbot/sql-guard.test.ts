import { describe, expect, it } from 'vitest';
import { guardSql } from './sql-guard';

describe('guardSql', () => {
  it.each(['v_chatbot_vehicles', 'v_chatbot_maintenance', 'v_chatbot_fleet_summary'])('allows the documented view %s', (view) => {
    expect(guardSql(`SELECT * FROM ${view}`).ok).toBe(true);
  });

  it('blocks writes and unknown tables', () => {
    expect(guardSql('DELETE FROM v_chatbot_tasks').ok).toBe(false);
    expect(guardSql('SELECT * FROM users').ok).toBe(false);
  });

  it('caps the row limit', () => {
    expect(guardSql('SELECT * FROM v_chatbot_tasks LIMIT 999').sql).toContain('LIMIT 200');
  });

  it('allows declared CTE aliases but blocks undeclared tables', () => {
    expect(guardSql('WITH s AS (SELECT * FROM v_chatbot_metrics) SELECT * FROM s').ok).toBe(true);
    expect(guardSql('SELECT * FROM made_up_alias').ok).toBe(false);
  });

  it('blocks metadata-only and schema-qualified queries', () => {
    expect(guardSql('SELECT current_user').ok).toBe(false);
    expect(guardSql('SELECT * FROM public.users').ok).toBe(false);
  });
});

describe('guardSql — FROM bên trong hàm không phải tên bảng', () => {
  const views = ['v_chatbot_secretary_transfers', 'v_chatbot_metrics'];

  it('cho phép EXTRACT(MONTH FROM cột)', () => {
    const r = guardSql(
      'SELECT SUM(transfer_count) FROM v_chatbot_secretary_transfers WHERE EXTRACT(MONTH FROM transfer_month) = 9',
      views,
    );
    expect(r.ok).toBe(true);
  });

  it('cho phép SUBSTRING và TRIM có FROM', () => {
    expect(guardSql("SELECT SUBSTRING(metric_name FROM 1 FOR 5) FROM v_chatbot_metrics", views).ok).toBe(true);
    expect(guardSql("SELECT TRIM(BOTH ' ' FROM metric_name) FROM v_chatbot_metrics", views).ok).toBe(true);
  });

  it('vẫn chặn bảng lạ giấu trong truy vấn con bên trong EXTRACT', () => {
    const r = guardSql(
      'SELECT EXTRACT(YEAR FROM (SELECT max(created_at) FROM users)) FROM v_chatbot_metrics',
      views,
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain('users');
  });

  it('vẫn chặn bảng lạ ở FROM chính', () => {
    expect(guardSql('SELECT EXTRACT(MONTH FROM created_at) FROM users', views).ok).toBe(false);
  });
});
