// Defense-in-depth: scrub PII from text the chatbot is about to show the user.
// The readonly views already exclude phone/email columns, but a future schema
// change could re-expose them — keep this filter as a backstop.

const PHONE_RE = /\b0\d{9,10}\b/g;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// CMND (9 digits) / CCCD (12 digits)
const ID_RE = /\b\d{9,12}\b/g;

export function scrubPii(text: string): string {
  return text
    .replace(PHONE_RE, '[số ĐT đã ẩn]')
    .replace(EMAIL_RE, '[email đã ẩn]')
    .replace(ID_RE, (match) => {
      // Only mask plausible ID numbers; leave plain "1234567890" style stats alone
      // by requiring no thousand separator nearby.
      return match.length === 9 || match.length === 12 ? '[CMND/CCCD đã ẩn]' : match;
    });
}
