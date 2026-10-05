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

  it('dẫn tới đúng trang chi tiết công việc chỉ đạo và trang tiến độ của phòng', () => {
    const work = addRecordSources(sourcesFromSql('SELECT * FROM v_chatbot_work_items'), [{ record_id: 'w1', title: 'Rà soát hội đồng' }]);
    expect(work[0].href).toBe('/dashboard/work');
    expect(work[1]).toMatchObject({ href: '/dashboard/work/items/w1', title: 'Rà soát hội đồng' });

    const updates = addRecordSources(sourcesFromSql('SELECT * FROM v_chatbot_work_updates'), [{ record_id: 'u1', work_item_id: 'w1', work_title: 'Rà soát hội đồng' }]);
    expect(updates[1]).toMatchObject({ href: '/dashboard/work/items/w1', title: 'Rà soát hội đồng' });

    const threads = addRecordSources(sourcesFromSql('SELECT * FROM v_chatbot_task_threads'), [{ record_id: 't1', title: 'Mua sắm', department_name: 'Phòng Hành chính' }]);
    expect(threads[1].href).toBe('/dashboard/tasks/progress?phong=Ph%C3%B2ng%20H%C3%A0nh%20ch%C3%ADnh');
  });
});
