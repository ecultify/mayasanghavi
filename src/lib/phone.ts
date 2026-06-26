// Normalize an Indian mobile number to E.164 (without the leading +, as the
// WhatsApp Cloud API wants just digits). Rules:
//   - strip every non-digit
//   - if 10 digits, prefix country code 91
//   - if it already starts with 91 and is 12 digits, keep it
//   - the final value must match ^91[6-9]\d{9}$ (valid Indian mobile), else null
const VALID_E164 = /^91[6-9]\d{9}$/;

export function normalizeMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");

  // Drop a leading 0 (common local-dialing prefix) before length checks.
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  // Handle a leading 0091 / 00 91 international prefix.
  if (digits.length === 14 && digits.startsWith("0091")) {
    digits = digits.slice(2);
  }

  return VALID_E164.test(digits) ? digits : null;
}
