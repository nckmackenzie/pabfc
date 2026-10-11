export const NAIROBI_TZ = "Africa/Nairobi";

// en-CA renders Intl.DateTimeFormat's numeric/2-digit y/m/d as "YYYY-MM-DD" —
// using the IANA zone directly means this is correct regardless of the
// server/runtime's own TZ setting, unlike dateFormat/new Date() elsewhere in
// this codebase.
const nairobiDateFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: NAIROBI_TZ,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

export function toNairobiDateString(instant: Date): string {
	return nairobiDateFormatter.format(instant);
}

export function nairobiToday(now: Date = new Date()): string {
	return toNairobiDateString(now);
}
