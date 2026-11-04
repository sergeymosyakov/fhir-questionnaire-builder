// FHIRPath has no date-difference operator, so day counts are built from calendar arithmetic:
// a day number per date (365y + leap-year terms + days before the month + day of month, with
// January/February counted in the previous year), whose subtraction is exact across leap years.
// Not a pattern — shared by days-between-dates.js and gestational-age-weeks.js.
export function dayNumber(ref) {
  const part = (start, len) => `(${ref}.toString().substring(${start},${len}).toInteger())`;
  const month = part(5, 2);
  const y = `(${part(0, 4)} - iif(${month} <= 2, 1, 0))`;
  return `(365 * ${y} + (${y} div 4) - (${y} div 100) + (${y} div 400) + ((153 * ((${month} + 9) mod 12) + 2) div 5) + ${part(8, 2)})`;
}
