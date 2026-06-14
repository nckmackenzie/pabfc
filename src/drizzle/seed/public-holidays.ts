import type { InferInsertModel } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { publicHolidays } from "@/drizzle/schema";

const currentYear = new Date().getFullYear();

const publicHolidaySeedData: Array<InferInsertModel<typeof publicHolidays>> = [
	{
		name: "New Year's Day",
		holidayDate: `${currentYear}-01-01`,
	},
	{
		name: "Idd-ul-Fitr",
		holidayDate: `${currentYear}-03-20`,
	},
	{
		name: "Good Friday",
		holidayDate: `${currentYear}-04-03`,
	},
	{
		name: "Easter Monday",
		holidayDate: `${currentYear}-04-06`,
	},
	{
		name: "Labour Day",
		holidayDate: `${currentYear}-05-01`,
	},
	{
		name: "Eid al-Adha",
		holidayDate: `${currentYear}-05-27`,
	},
	{
		name: "Madaraka Day",
		holidayDate: `${currentYear}-06-01`,
	},
	{
		name: "Mazingira Day",
		holidayDate: `${currentYear}-10-10`,
	},
	{
		name: "Mashujaa Day",
		holidayDate: `${currentYear}-10-20`,
	},
	{
		name: "Jamhuri Day",
		holidayDate: `${currentYear}-12-12`,
	},
	{
		name: "Christmas Day",
		holidayDate: `${currentYear}-12-25`,
	},
	{
		name: "Boxing Day",
		holidayDate: `${currentYear}-12-26`,
	},
];

export async function seedPublicHolidays() {
	try {
		console.log(`🌱 Seeding Kenyan public holidays for ${currentYear}...`);
		await db
			.insert(publicHolidays)
			.values(publicHolidaySeedData)
			.onConflictDoNothing();
		console.log("✅ Public holidays seeded successfully!");
	} catch (error) {
		console.error("❌ Error seeding public holidays:", error);
		throw error;
	}
}
