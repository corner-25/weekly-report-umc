import { CHATBOT_SCHEMA_PROMPT } from '../lib/chatbot/schema-context';
import { CHATBOT_EVAL_CASES } from '../lib/chatbot/eval-cases';
import { deepseekComplete, extractSql } from '../lib/chatbot/deepseek';
import { GENERAL_CHATBOT_VIEWS, PERSONNEL_CHATBOT_VIEWS, guardSql } from '../lib/chatbot/sql-guard';

async function main() {
  const allowed = [...GENERAL_CHATBOT_VIEWS, ...PERSONNEL_CHATBOT_VIEWS];
  let passed = 0;
  for (const item of CHATBOT_EVAL_CASES) {
    const completion = await deepseekComplete([{ role: 'system', content: CHATBOT_SCHEMA_PROMPT }, { role: 'user', content: item.question }], { maxTokens: 500, temperature: 0 });
    const sql = extractSql(completion.content);
    const guarded = sql ? guardSql(sql, allowed) : { ok: false, sql: '', error: 'No SQL' };
    const correctView = guarded.ok && guarded.sql.includes(item.expectedView);
    if (correctView) passed += 1;
    console.log(`${correctView ? 'PASS' : 'FAIL'} ${item.id}: ${guarded.error || guarded.sql}`);
  }
  console.log(`\n${passed}/${CHATBOT_EVAL_CASES.length} cases passed`);
  if (passed !== CHATBOT_EVAL_CASES.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
