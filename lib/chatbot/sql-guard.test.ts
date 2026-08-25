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
