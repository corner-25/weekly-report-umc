export interface ChatbotSource {
  id: string;
  title: string;
  href: string;
  viewName?: string;
}

const VIEW_SOURCES: Record<string, Omit<ChatbotSource, 'id'>> = {
  v_chatbot_metrics: { title: 'Dữ liệu chỉ số báo cáo tuần', href: '/dashboard/reports/metrics-data' },
  v_chatbot_tasks: { title: 'Nhiệm vụ và nội dung báo cáo tuần', href: '/dashboard/tasks/overview' },
  v_chatbot_mou: { title: 'Danh sách MOU', href: '/dashboard/mous' },
  v_chatbot_licenses: { title: 'Giấy phép và chứng chỉ', href: '/dashboard/licenses' },
  v_chatbot_events: { title: 'Lịch sự kiện bệnh viện', href: '/dashboard/hospital-events-calendar' },
  v_chatbot_secretaries: { title: 'Danh sách thư ký', href: '/dashboard/secretaries' },
  v_chatbot_vehicles: { title: 'Hồ sơ phương tiện', href: '/dashboard/reports/phong-hc-native' },
  v_chatbot_maintenance: { title: 'Lịch sử bảo dưỡng phương tiện', href: '/dashboard/reports/phong-hc-native' },
  v_chatbot_fleet_summary: { title: 'Tổng hợp hoạt động tổ xe', href: '/dashboard/reports/phong-hc-native' },
  v_chatbot_meeting_rooms: { title: 'Danh sách phòng họp', href: '/dashboard/meeting-rooms' },
  v_chatbot_event_checklists: { title: 'Checklist sự kiện', href: '/dashboard/hospital-events' },
  v_chatbot_vip_summary: { title: 'Thống kê tiếp đón khách VIP', href: '/dashboard/vip-guests' },
  v_chatbot_mou_details: { title: 'Điều khoản và hoạt động MOU', href: '/dashboard/mous' },
  v_chatbot_license_renewals: { title: 'Lịch sử gia hạn giấy phép', href: '/dashboard/licenses' },
  v_chatbot_sync_health: { title: 'Tình trạng đồng bộ dữ liệu', href: '/dashboard/data-sync' },
  v_chatbot_import_health: { title: 'Tình trạng nhập báo cáo AI', href: '/dashboard/data-sync' },
  v_chatbot_extraction_quality: { title: 'Chất lượng trích xuất AI', href: '/dashboard/data-sync' },
  v_chatbot_hc_metrics: { title: 'Số liệu hành chính theo tuần', href: '/dashboard/metrics-data' },
  v_chatbot_secretary_qualifications: { title: 'Thống kê năng lực thư ký', href: '/dashboard/secretaries' },
  v_chatbot_secretary_transfers: { title: 'Thống kê điều chuyển thư ký', href: '/dashboard/secretaries/transfers' },
  v_chatbot_recruitment_summary: { title: 'Thống kê tuyển dụng thư ký', href: '/dashboard/secretaries/applications' },
};

export function sourcesFromSql(sql: string, contextPath?: string | null): ChatbotSource[] {
  const names = Array.from(sql.matchAll(/\b(?:FROM|JOIN)\s+(v_chatbot_[a-z_]+)/gi), (m) => m[1].toLowerCase());
  return [...new Set(names)].flatMap((name, index) => {
    const source = VIEW_SOURCES[name];
    if (!source) return [];
    const contextualHref = contextPath?.match(/^\/dashboard\/weeks\/[^/]+$/) && ['v_chatbot_metrics', 'v_chatbot_tasks'].includes(name)
      ? contextPath
      : source.href;
    return [{ id: `S${index + 1}`, ...source, href: contextualHref, viewName: name }];
  });
}

export function addRecordSources(sources: ChatbotSource[], rows: unknown[]): ChatbotSource[] {
  if (sources.length !== 1) return sources;
  const source = sources[0];
  const records = rows.slice(0, 5).flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const row = raw as Record<string, unknown>;
    const recordId = row.record_id;
    if (typeof recordId !== 'string') return [];
    const label = String(row.event_name || row.mou_title || row.license_name || row.name || row.title || row.task_name || `Bản ghi ${index + 1}`);
    let href = source.href;
    if (source.viewName === 'v_chatbot_event_checklists' && typeof row.event_id === 'string') href = `/dashboard/hospital-events/${row.event_id}`;
    else if (source.viewName === 'v_chatbot_vehicles') href = `/dashboard/vehicles/${recordId}`;
    else if (source.viewName === 'v_chatbot_mou_details' && typeof row.mou_id === 'string') href = `/dashboard/mous?selected=${row.mou_id}`;
    else if (source.viewName === 'v_chatbot_license_renewals' && typeof row.license_id === 'string') href = `/dashboard/licenses?selected=${row.license_id}`;
    else return [];
    return [{ id: `S${sources.length + index + 1}`, title: label, href, viewName: source.viewName }];
  });
  return [...sources, ...records];
}
