import { deptReportOnedrive } from './sources/dept-report-onedrive';
import { fleetGoogleSheets } from './sources/fleet-google-sheets';
import { hospitalAiImport } from './sources/hospital-ai-import';
import { hospitalReportOnedrive } from './sources/hospital-report-onedrive';
import type { Connector } from './types';

/**
 * Nơi duy nhất đăng ký connector. Thêm nguồn mới = thêm một dòng vào đây.
 *
 * Các connector cụ thể được bổ sung ở Giai đoạn 2 trở đi (xem
 * docs/INGESTION-REFACTOR.md mục 8).
 */
const connectors: readonly Connector[] = [
  deptReportOnedrive,
  hospitalReportOnedrive,
  hospitalAiImport,
  fleetGoogleSheets,
  // Sắp tới: hcOfficeApi
];

const byId = new Map(connectors.map((c) => [c.id, c]));

export function getConnector(id: string): Connector | undefined {
  return byId.get(id);
}

export function listConnectors(): readonly Connector[] {
  return connectors;
}
