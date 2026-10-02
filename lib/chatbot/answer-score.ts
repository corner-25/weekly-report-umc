/**
 * Chấm câu trả lời chatbot: câu trả lời phải chứa đúng các con số (hoặc cụm chữ)
 * của đáp án. Đọc được cách viết số tiếng Việt lẫn tiếng Anh: "47.552.000",
 * "5.988,0", "1,120.5", "188,6 triệu", "1,2 tỷ".
 */

/** Mọi con số xuất hiện trong văn bản, đã quy về giá trị thật. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d[\d.,]*/g)) {
    const raw = m[0].replace(/[.,]+$/, '');
    let value: number | null;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
      // Kiểu Việt: dấu chấm ngăn nghìn, dấu phẩy thập phân.
      value = Number(raw.replace(/\./g, '').replace(',', '.'));
    } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
      // Kiểu Anh: dấu phẩy ngăn nghìn.
      value = Number(raw.replace(/,/g, ''));
    } else {
      value = (raw.match(/,/g) ?? []).length <= 1 ? Number(raw.replace(',', '.')) : null;
    }
    if (value === null || !Number.isFinite(value)) continue;
    const tail = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 8).toLowerCase();
    if (tail.includes('triệu')) value *= 1e6;
    else if (tail.includes('tỷ') || tail.includes('tỉ')) value *= 1e9;
    out.push(value);
  }
  return out;
}

/** Đáp án có trong câu trả lời không: số thì cho lệch 0,5% (làm tròn), chữ thì so không phân biệt hoa thường. */
export function answerHas(expected: number | string, answer: string): boolean {
  if (typeof expected === 'string') return answer.toLowerCase().includes(expected.toLowerCase());
  const tolerance = Math.max(0.5, Math.abs(expected) * 0.005);
  return numbersIn(answer).some((n) => Math.abs(n - expected) <= tolerance);
}
