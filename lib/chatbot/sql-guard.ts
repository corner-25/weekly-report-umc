// Defense-in-depth SQL guard for AI-generated queries.
// Last line of defense is the readonly Postgres role + statement_timeout.
// These checks block obviously hostile queries before they hit the database.

const DANGEROUS_TOKENS = [
  // DML write ops
  /\bDELETE\b/i,
  /\bUPDATE\b/i,
  /\bINSERT\b/i,
  /\bMERGE\b/i,
  // DDL
  /\bDROP\b/i,
  /\bALTER\b/i,
  /\bCREATE\b/i,
  /\bTRUNCATE\b/i,
  /\bRENAME\b/i,
  // Grants and security
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bSET\s+ROLE\b/i,
  /\bRESET\s+ROLE\b/i,
  // Server-side execution / file IO
  /\bCOPY\b/i,
  /\bpg_read_file\b/i,
  /\bpg_ls_dir\b/i,
  /\bpg_sleep\b/i,
  /\bpg_terminate_backend\b/i,
  /\bdblink\b/i,
  // Catalog probing (we already only expose views)
  /\bpg_user\b/i,
  /\bpg_shadow\b/i,
  /\bpg_authid\b/i,
];

const ALLOWED_VIEWS = [
  'v_chatbot_metrics',
  'v_chatbot_tasks',
  'v_chatbot_mou',
  'v_chatbot_licenses',
  'v_chatbot_events',
  'v_chatbot_secretaries',
];

export interface SqlGuardResult {
  ok: boolean;
  sql: string;
  error?: string;
}

/**
 * Validate and normalize an AI-generated SQL query.
 * - Strip trailing semicolons / comments.
 * - Require the query to start with SELECT or WITH.
 * - Reject queries containing more than one statement.
 * - Reject queries that touch tables outside the v_chatbot_* allowlist.
 * - Reject queries containing dangerous tokens.
 * - Ensure a LIMIT clause is present (cap 200).
 */
export function guardSql(rawSql: string): SqlGuardResult {
  if (!rawSql || typeof rawSql !== 'string') {
    return { ok: false, sql: '', error: 'Empty SQL' };
  }

  // Drop SQL comments to make subsequent checks easier.
  let sql = rawSql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();

  // Strip a single trailing semicolon (we will not allow multiple statements).
  sql = sql.replace(/;\s*$/g, '').trim();

  if (sql.length === 0) {
    return { ok: false, sql: '', error: 'Empty SQL after sanitization' };
  }

  if (sql.includes(';')) {
    return { ok: false, sql, error: 'Multiple statements are not allowed' };
  }

  if (!/^\s*(SELECT|WITH)\b/i.test(sql)) {
    return { ok: false, sql, error: 'Only SELECT and WITH queries are allowed' };
  }

  for (const token of DANGEROUS_TOKENS) {
    if (token.test(sql)) {
      return { ok: false, sql, error: `Query contains a disallowed token: ${token.source}` };
    }
  }

  // Make sure the query only references whitelisted views.
  // Match `FROM <name>` and `JOIN <name>` clauses. Skip Postgres datetime
  // keywords that legitimately follow FROM in expressions like
  // EXTRACT(WEEK FROM CURRENT_DATE) — those are not table references.
  const SQL_DATETIME_FROM_KEYWORDS = new Set([
    'current_date',
    'current_time',
    'current_timestamp',
    'now',
    'localtime',
    'localtimestamp',
  ]);
  const referencedTables = Array.from(
    sql.matchAll(/\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi),
    (m) => m[1].toLowerCase(),
  );
  for (const ref of referencedTables) {
    if (SQL_DATETIME_FROM_KEYWORDS.has(ref)) continue;
    if (!ALLOWED_VIEWS.includes(ref)) {
      return { ok: false, sql, error: `Table "${ref}" is not allowed. Use one of: ${ALLOWED_VIEWS.join(', ')}` };
    }
  }

  // Force a LIMIT clause if missing, cap at 200 if present.
  if (!/\bLIMIT\b\s+\d+/i.test(sql)) {
    sql = `${sql} LIMIT 50`;
  } else {
    sql = sql.replace(/\bLIMIT\b\s+(\d+)/gi, (_m, n) => {
      const cap = Math.min(parseInt(n, 10) || 50, 200);
      return `LIMIT ${cap}`;
    });
  }

  return { ok: true, sql };
}
