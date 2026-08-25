import { describe, expect, it } from 'vitest';
import { addRecordSources, sourcesFromSql } from './sources';

describe('sourcesFromSql', () => {
  it('maps and deduplicates chatbot views', () => {
    const sources = sourcesFromSql('SELECT * FROM v_chatbot_metrics m JOIN v_chatbot_tasks t ON true JOIN v_chatbot_metrics x ON true');
    expect(sources).toHaveLength(2);
    expect(sources.map((source) => source.id)).toEqual(['S1', 'S2']);
    expect(sources[0].href).toContain('/dashboard/');
  });

  it('links task evidence back to the week currently being viewed', () => {
    const sources = sourcesFromSql('SELECT * FROM v_chatbot_tasks', '/dashboard/weeks/week_123');
    expect(sources[0].href).toBe('/dashboard/weeks/week_123');
  });

  it('adds direct record links when the view exposes stable IDs', () => {
    const base = sourcesFromSql('SELECT * FROM v_chatbot_event_checklists');
    const result = addRecordSources(base, [{ record_id: 'item_1', event_id: 'event_1', event_name: 'Họp giao ban' }]);
    expect(result[1]).toMatchObject({ href: '/dashboard/hospital-events/event_1', title: 'Họp giao ban' });
  });
});
