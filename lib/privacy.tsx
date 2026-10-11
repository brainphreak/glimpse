"use client";
import { createContext, useContext, type ReactNode } from "react";
import { FIRST_NAMES } from "./first-names";

// Privacy mode: display-only masking for screen sharing / shoulder surfing. The underlying
// data is untouched (and still reaches the browser) — widgets just render masked text.
//   phones → (XXX) XXX-XXXX
//   emails → jXXXXXy@gmail.com      (first + last letter of the name; domain kept)
//   names  → Jackie F.              (name fields, plus "First Last" spotted in free text)

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

// Full names already shortened in a name field (e.g. Gmail senders) → their masked form,
// so the same person is also masked when mentioned in free text.
const knownNames = new Map<string, string>();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Capitalized word; allows O'Neil and García-López but not a trailing possessive ('s).
const CAP = "\\p{Lu}\\p{Ll}+(?:['’]\\p{Lu}\\p{Ll}+)?(?:-\\p{Lu}\\p{Ll}+)?";
// A capitalized word, an optional second one, then a capitalized surname.
const NAME_IN_TEXT_RE = new RegExp(`(?<!\\p{L})(${CAP})(?:\\s+(${CAP}))?\\s+(${CAP})(?!\\p{L})`, "gu");

// "Lunch with Jackie Friday" → "Lunch with Jackie F.". Only triggers when the first word is a
// common first name; a second first name stays whole ("Mary Ann Smith" → "Mary Ann S.").
export function maskNamesInText(s: string): string {
  // Pattern pass first, then known names — the other order re-masks "Mary Ann S." into "Mary A. S.".
  s = s.replace(NAME_IN_TEXT_RE, (m, first: string, mid: string | undefined, last: string) => {
    if (!FIRST_NAMES.has(first.toLowerCase())) return m;
    if (!mid) return `${first} ${last[0]}.`;
    if (FIRST_NAMES.has(mid.toLowerCase())) return `${first} ${mid} ${last[0]}.`;
    return `${first} ${mid[0]}. ${last}`;   // "Jackie Friday Meeting" → "Jackie F. Meeting"
  });
  for (const [full, masked] of knownNames) {
    if (s.includes(full)) s = s.replace(new RegExp(`(?<!\\p{L})${escapeRe(full)}(?!\\p{L})`, "gu"), masked);
  }
  return s;
}

// Phones, emails and names anywhere in free text (subjects, previews, briefings…).
export function maskText(s: string): string {
  return maskNamesInText(maskEmails(maskPhones(s)));
}

// Sender/display names that are clearly organizations or services, not people.
const ORG_RE = /\b(of|the|and|for|inc|llc|ltd|corp|co|company|team|support|service|services|notifications?|alerts?|no-?reply|news|newsletter|bank|store|shop|calendar|account|accounts|billing|security|info|help|admin|google|amazon|apple|microsoft|paypal|github|linkedin|facebook|meta)\b|&|\.(com|net|org|io)\b/i;

// "Jackie Friday" → "Jackie F.", "Mary Ann Smith" → "Mary Ann S.", "Friday, Jackie" → "Jackie F.".
// Values that are really emails/phones are masked as such.
export function maskName(s: string): string {
  const t = s.trim();
  if (!t || /@|\d{3}/.test(t)) return maskText(t);
  if (ORG_RE.test(t)) return maskText(t);   // "Google Calendar", "Bank of America" aren't people
  const comma = t.match(/^([^,]+),\s*(.+)$/);
  const [first, last] = comma ? [comma[2], comma[1]] : (() => {
    const parts = t.split(/\s+/);
    return parts.length < 2 ? [t, ""] : [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
  })();
  if (!last) return first;
  const initial = last.replace(/^[^\p{L}]+/u, "")[0];
  if (!initial) return first;
  const masked = `${first} ${initial.toUpperCase()}.`;
  if (t.includes(" ") && !comma) knownNames.set(t, masked);
  return masked;
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
