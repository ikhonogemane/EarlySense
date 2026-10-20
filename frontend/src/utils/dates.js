// FR12: a referral's follow-up date defaults to one week from today (local
// date, YYYY-MM-DD for <input type="date">). The Grade Head or Wellness
// Office can change it when they manage the case (FR13).
export function defaultFollowUpDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
