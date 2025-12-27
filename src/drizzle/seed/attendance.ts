import { faker } from "@faker-js/faker";
import {
	addMinutes,
	eachDayOfInterval,
	endOfMonth,
	isFuture,
	set,
} from "date-fns";
import type { InferInsertModel } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { attendanceLogs } from "@/drizzle/schemas/attendance";
import { seedMembers } from "@/drizzle/seed/members";

export const seedAttendanceLogs: InferInsertModel<typeof attendanceLogs>[] = [];

function generateAttendanceLogs() {
	const startDate = new Date("2025-06-01");
	const endDate = endOfMonth(new Date());
	// const today = new Date();

	const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

	for (const date of dateRange) {
		// Skip future dates
		if (isFuture(date)) continue;

		for (const member of seedMembers) {
			// 60% chance of attendance per day for active members
			// Lower chance for others
			let attendanceChance = 0.6;
			if (member.memberStatus !== "active") {
				attendanceChance = 0.1;
			}

			if (Math.random() < attendanceChance) {
				// Generate check-in time between 6 AM and 9 PM
				const checkInHour = faker.number.int({ min: 6, max: 20 });
				const checkInMinute = faker.number.int({ min: 0, max: 59 });

				const checkInTime = set(date, {
					hours: checkInHour,
					minutes: checkInMinute,
					seconds: 0,
					milliseconds: 0,
				});

				// Duration between 30 mins and 120 mins
				const durationMinutes = faker.number.int({ min: 30, max: 120 });
				const checkOutTime = addMinutes(checkInTime, durationMinutes);

				// 5% chance of missing checkout (if not in future relative to now)
				// actually if date is today, check out might not have happened yet if it's recent
				// but for simplicity let's just use random null
				// if (Math.random() < 0.05) {
				// 	// @ts-expect-error - explicitly setting undefined/null for seed
				// 	checkOutTime = undefined;
				// }

				// If checkOutTime is in the future relative to "now" (real time), maybe keep it or null it?
				// Since we are seeding 2025 and it is Dec 2025, most dates are past.
				// We'll leave it simple.

				const source = faker.helpers.arrayElement([
					"reception",
					"turnstile",
					"kiosk",
					"mobile_app",
				]);

				const deviceId =
					source === "mobile_app"
						? member.deviceId
						: `term-${faker.number.int({ min: 1, max: 5 })}`;

				seedAttendanceLogs.push({
					memberId: member.id as string,
					checkInTime,
					checkOutTime: checkOutTime || null, // Ensure null if undefined
					source,
					deviceId,
					// Occasional notes
					notes: Math.random() < 0.05 ? faker.lorem.sentence() : null,
					createdAt: checkInTime,
				});
			}
		}
	}
}

// Generate the data immediately
generateAttendanceLogs();

export async function seedAttendance() {
	try {
		console.log("🌱 Seeding attendance logs...");
		// Chunking to avoid too large query if many logs
		const chunkSize = 1000;
		for (let i = 0; i < seedAttendanceLogs.length; i += chunkSize) {
			const chunk = seedAttendanceLogs.slice(i, i + chunkSize);
			await db.transaction(async (tx) => {
				await tx.insert(attendanceLogs).values(chunk).onConflictDoNothing();
			});
		}

		console.log(
			`✅ Attendance Logs seeded successfully! (${seedAttendanceLogs.length} records)`,
		);
	} catch (error) {
		console.error("❌ Error seeding attendance logs:", error);
		throw error;
	}
}
