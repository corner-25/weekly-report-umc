-- Chatbot đọc sổ tiếp đoàn (CRM): mỗi lượt tiếp đoàn một dòng. Không đưa tên người
-- (thành phần đoàn, người tiếp) vào view — cùng nguyên tắc với các view CRM khác.
DROP VIEW IF EXISTS v_chatbot_delegations;
CREATE VIEW v_chatbot_delegations AS
SELECT
  i.id AS record_id,
  i."externalCode" AS code,
  (i."occurredAt" + interval '7 hours')::date AS visit_date,
  (i."endAt" + interval '7 hours')::date AS end_date,
  extract(year FROM i."occurredAt" + interval '7 hours')::int AS visit_year,
  extract(month FROM i."occurredAt" + interval '7 hours')::int AS visit_month,
  i."dateUnknown" AS date_unknown,
  i.status::text AS status,
  CASE i.status WHEN 'DONE' THEN 'Đã thực hiện' WHEN 'PLANNED' THEN 'Dự kiến' WHEN 'POSTPONED' THEN 'Hoãn' WHEN 'CANCELLED' THEN 'Huỷ' END AS status_label,
  i.purpose AS visit_form,
  i."purposeInferred" AS visit_form_inferred,
  coalesce(o.name, 'Không rõ đơn vị') AS organization_name,
  o.category AS organization_category,
  o.scope AS organization_scope,
  i.title AS delegation_name,
  i.content,
  array_to_string(i.topics, '; ') AS topics,
  coalesce(d.name, i."hostUnit") AS host_unit,
  i."guestCount" AS guest_count,
  i.destination AS location,
  i."giftsGiven" AS gifts_given,
  i."giftsReceived" AS gifts_received,
  i."cashReceived" AS cash_received_vnd,
  i."giftBudget" AS gift_budget_vnd,
  i."giftActualCost" AS gift_actual_cost_vnd,
  i."incomingDocNo" AS incoming_doc_no,
  i."needsReview" AS needs_review
FROM crm_interactions i
LEFT JOIN crm_organizations o ON o.id = i."organizationId"
LEFT JOIN departments d ON d.id = i."hostDepartmentId"
WHERE i.type = 'DELEGATION';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chatbot_readonly') THEN
    GRANT SELECT ON v_chatbot_delegations TO chatbot_readonly;
  END IF;
END $$;
