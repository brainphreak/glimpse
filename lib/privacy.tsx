"use client";
import { createContext, useContext, type ReactNode } from "react";

// Privacy mode: display-only masking for screen sharing / shoulder surfing. The underlying
// data is untouched (and still reaches the browser) — widgets just render masked text.
//   phones → (XXX) XXX-XXXX
//   emails → jXXXXXy@gmail.com      (first + last letter of the name; domain kept)
//   names  → Jackie F.              (only where a widget knows the field is a person's name)

// US-style numbers: 555-123-4567, (555) 123-4567, 555.123.4567, +1 555 123 4567, 5551234567.
const PHONE_RE = /(?<![\w])(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;
const EMAIL_RE = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;

// Fixed-width filler so the masked form doesn't leak the name's length.
const maskLocal = (s: string) => (s.length <= 1 ? `${s}XXXXX` : `${s[0]}XXXXX${s[s.length - 1]}`);

export function maskPhones(s: string): string {
  return s.replace(PHONE_RE, "(XXX) XXX-XXXX");
}

export function maskEmails(s: string): string {
  return s.replace(EMAIL_RE, (_, local: string, domain: string) => `${maskLocal(local)}@${domain}`);
}

// Phones and emails anywhere in free text (subjects, previews, notes…).
export function maskText(s: string): string {
  return maskEmails(maskPhones(s));
}

// "Jackie Friday" → "Jackie F.", "Mary Ann Smith" → "Mary Ann S.", "Friday, Jackie" → "Jackie F.".
// Values that are really emails/phones are masked as such.
export function maskName(s: string): string {
  const t = s.trim();
  if (!t || /@|\d{3}/.test(t)) return maskText(t);
  const comma = t.match(/^([^,]+),\s*(.+)$/);
  const [first, last] = comma ? [comma[2], comma[1]] : (() => {
    const parts = t.split(/\s+/);
    return parts.length < 2 ? [t, ""] : [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
  })();
  if (!last) return first;
  const initial = last.replace(/^[^\p{L}]+/u, "")[0];
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

const PrivacyCtx = createContext(false);

export function PrivacyProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <PrivacyCtx.Provider value={enabled}>{children}</PrivacyCtx.Provider>;
}

// Returns maskers that are no-ops when privacy mode is off.
export function usePrivacy() {
  const on = useContext(PrivacyCtx);
  const id = (s: string) => s;
  return {
    on,
    text: on ? maskText : id,
    name: on ? maskName : id,
  };
}
