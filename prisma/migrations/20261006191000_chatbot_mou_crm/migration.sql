-- Chatbot biết đối tác MOU là tổ chức nào trong CRM (để nối với sổ tiếp đoàn).
CREATE OR REPLACE VIEW v_chatbot_mou AS
SELECT m.title,
  m."mouNumber" AS mou_number,
  m."partnerName" AS partner_name,
  m."signedDate" AS signed_date,
  m."expiryDate" AS expiry_date,
  m.status,
  m.category,
  d.name AS department_name,
  CASE WHEN m."expiryDate" IS NULL THEN NULL::integer
       ELSE EXTRACT(day FROM m."expiryDate"::timestamp with time zone - now())::integer END AS days_until_expiry,
  m.id AS record_id,
  m."partnerCountry" AS partner_country,
  m."cooperationField" AS cooperation_field,
  CASE
    WHEN m.status = 'DRAFT' THEN 'Chờ ký'
    WHEN m.status = 'TERMINATED' THEN 'Đã kết thúc'
    WHEN m.status = 'EXPIRED' OR m."expiryDate" < now() THEN 'Hết hạn'
    WHEN m."expiryDate" <= now() + interval '90 days' THEN 'Sắp hết hạn'
    ELSE 'Hiệu lực'
  END AS lifecycle,
  m."externalStatus" AS office_status,
  m."progressPercent" AS office_progress,
  m."contactPerson" AS contact_person,
  m.purpose,
  (SELECT count(*)::int FROM mou_clauses c WHERE c."mouId" = m.id) AS aspect_count,
  (SELECT count(*)::int FROM mou_clauses c WHERE c."mouId" = m.id AND c."clauseStatus" = 'COMPLETED') AS aspects_completed,
  (SELECT count(*)::int FROM mou_clauses c WHERE c."mouId" = m.id AND c."clauseStatus" = 'IN_PROGRESS') AS aspects_in_progress,
  (SELECT string_agg(c.title, '; ' ORDER BY c."orderNumber") FROM mou_clauses c WHERE c."mouId" = m.id) AS aspect_titles,
  (SELECT count(*)::int FROM mou_documents doc WHERE doc."mouId" = m.id) AS document_count,
  CASE m.assessment->>'verdict'
    WHEN 'SUCCESS' THEN 'Thành công' WHEN 'ON_TRACK' THEN 'Đang tiến triển' WHEN 'AT_RISK' THEN 'Có nguy cơ'
    WHEN 'FAILED' THEN 'Không hiệu quả' WHEN 'TOO_EARLY' THEN 'Mới ký, chưa đánh giá' END AS ai_verdict,
  (m.assessment->>'implementationLevel')::int AS ai_implementation_level,
  m.assessment->>'rationale' AS ai_rationale,
  (m.assessment->>'lastActivityDate')::date AS last_activity_date,
  CASE m.evaluation
    WHEN 'SUCCESS' THEN 'Thành công' WHEN 'ON_TRACK' THEN 'Đang tiến triển' WHEN 'AT_RISK' THEN 'Có nguy cơ'
    WHEN 'FAILED' THEN 'Không hiệu quả' END AS leader_evaluation,
  m."evaluationNote" AS leader_evaluation_note,
  (SELECT string_agg((p->>'name') || COALESCE(' — ' || (p->>'representative'), '') || COALESCE(' (' || (p->>'position') || ')', ''), '; ')
     FROM jsonb_array_elements(COALESCE(m.extraction->'parties', '[]'::jsonb)) p) AS signatories,
  m.extraction->>'termText' AS term_text,
  o.name AS crm_organization,
  (SELECT count(*)::int FROM crm_interactions i WHERE i."organizationId" = o.id AND i.status = 'DONE') AS crm_interaction_count
FROM mous m
LEFT JOIN departments d ON d.id = m."departmentId"
LEFT JOIN crm_organizations o ON o.id = m."crmOrganizationId"
WHERE m."deletedAt" IS NULL;
