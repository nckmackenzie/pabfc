import type { InferInsertModel } from "drizzle-orm";
import { loginAttempts, users } from "@/drizzle/schemas/auth";
import { db } from "../db";

export const usersData: InferInsertModel<typeof users>[] = [
	{
		id: "jg4aBFUx7i6S6voJzs9cM",
		name: "Kevin Mwangi",
		email: "kmwangi@example.com",
		username: "kmwangi",
		contact: "+254712345001",
		role: "staff",
		emailVerified: true,
		active: true,
	},
	{
		id: "mAqDragA_QbkTaP72HkYv",
		name: "Aisha Abdalla",
		email: "aabdalla@example.com",
		username: "aabdalla",
		contact: "+254712345002",
		role: "member",
		emailVerified: true,
		active: true,
	},
	{
		id: "epVWwfvr1aid9pR-QUJZl",
		name: "Brian Otieno",
		email: "botieno@example.com",
		username: "botieno",
		contact: "+254712345003",
		role: "member",
		emailVerified: true,
		active: true,
	},
	{
		id: "xjWIS0zgWVHYE4SRCJmzB",
		name: "Grace Wambui",
		email: "gwambui@example.com",
		username: "gwambui",
		contact: "+254712345004",
		role: "admin",
		emailVerified: true,
		active: true,
	},
	{
		id: "Y31ZpIZdci9t0q6LpGkTK",
		name: "John Kihara",
		email: "jkihara@example.com",
		username: "jkihara",
		contact: "+254712345005",
		role: "admin",
		emailVerified: true,
		active: true,
	},
	{
		id: "FFbml4pkyAiwCfM_ostbI",
		name: "Linet Akinyi",
		email: "lakinyi@example.com",
		username: "lakinyi",
		contact: "+254712345006",
		role: "member",
		emailVerified: true,
		active: true,
	},
	{
		id: "npEVnr9aMN6bhuNzpLvgQ",
		name: "Peter Kiptoo",
		email: "pkiptoo@example.com",
		username: "pkiptoo",
		contact: "+254712345007",
		role: "staff",
		emailVerified: true,
		active: true,
	},
	{
		id: "uv25MQ9ia9YF7-IogeMY9",
		name: "Mercy Njeri",
		email: "mnjeri@example.com",
		username: "mnjeri",
		contact: "+254712345008",
		role: "staff",
		emailVerified: true,
		active: true,
	},
	{
		id: "82UCRf2nm4FJnkpiD9PmJ",
		name: "Samuel Mutua",
		email: "smutua@example.com",
		username: "smutua",
		contact: "+254712345009",
		role: "member",
		emailVerified: true,
		active: true,
	},
	{
		id: "3MTagDgzNapnu5xLqJi7Y",
		name: "Diana Chebet",
		email: "dchebet@example.com",
		username: "dchebet",
		contact: "+254712345010",
		role: "member",
		emailVerified: true,
		active: true,
	},
	{
		id: "YoYwImjelQcoCX-tm6q9V",
		name: "Collins Barasa",
		email: "cbarasa@example.com",
		username: "cbarasa",
		contact: "+254712345011",
		role: "staff",
		emailVerified: true,
		active: true,
	},
	{
		id: "bXVG04P95cdgK4e7i1Rt0",
		name: "Ruth Mumo",
		email: "rmumo@example.com",
		username: "rmumo",
		contact: "+254712345012",
		role: "admin",
		emailVerified: true,
		active: true,
	},
	{
		id: "TwFaRPr1ksU1mUj34dEqb",
		name: "Jonathan Oduor",
		email: "joduor@example.com",
		username: "joduor",
		contact: "+254712345013",
		role: "member",
		emailVerified: true,
		active: true,
	},
	{
		id: "h34rMoJYFYX_O-iLTvwkI",
		name: "Faith Nduta",
		email: "fnduta@example.com",
		username: "fnduta",
		contact: "+254712345014",
		role: "admin",
		emailVerified: true,
		active: true,
	},
	{
		id: "_bTzyujnQvjcuonDMGaQg",
		name: "Robert Wekesa",
		email: "rwekesa@example.com",
		username: "rwekesa",
		contact: "+254712345015",
		role: "admin",
		emailVerified: true,
		active: true,
	},
	{
		id: "ywQTbmZ6er1CgHauoVO4x",
		name: "Janet Wanjiru",
		email: "jwanjiru@example.com",
		username: "jwanjiru",
		contact: "+254712345016",
		role: "staff",
		emailVerified: true,
		active: true,
	},
	{
		id: "HH0g9Huv4ZIxlSEWylEZk",
		name: "Victor Cheruiyot",
		email: "vcheruiyot@example.com",
		username: "vcheruiyot",
		contact: "+254712345017",
		role: "admin",
		emailVerified: true,
		active: true,
	},
	{
		id: "59vNr5gwyiFGYYKhPp3J6",
		name: "Elizabeth Kendi",
		email: "ekendi@example.com",
		username: "ekendi",
		contact: "+254712345018",
		role: "member",
		emailVerified: true,
		active: true,
	},
	{
		id: "__sYIwY95ZlD2QuC6zVml",
		name: "George Kariuki",
		email: "gkariuki@example.com",
		username: "gkariuki",
		contact: "+254712345019",
		role: "member",
		emailVerified: true,
		active: true,
	},
	{
		id: "QWxxZCcM9fviOybsvOMI5",
		name: "Ann Muthoni",
		email: "amuthoni@example.com",
		username: "amuthoni",
		contact: "+254712345020",
		role: "admin",
		emailVerified: true,
		active: true,
	},
	{
		id: "rvD7I-fFWVSgbYyz7NXHT",
		name: "Stephen Ndichu",
		email: "sndichu@example.com",
		username: "sndichu",
		contact: "+254712345021",
		role: "admin",
		emailVerified: true,
		active: true,
	},
	{
		id: "taKS5tKon6dx1yu1vSJ2j",
		name: "Lucy Wanja",
		email: "lwanja@example.com",
		username: "lwanja",
		contact: "+254712345022",
		role: "staff",
		emailVerified: true,
		active: true,
	},
];

export const loginAttemptsData: InferInsertModel<typeof loginAttempts>[] = [
	{
		userId: "jg4aBFUx7i6S6voJzs9cM", // Kevin Mwangi
		ipAddress: "102.67.12.10",
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
		success: true,
	},
	{
		userId: "mAqDragA_QbkTaP72HkYv", // Aisha Abdalla
		ipAddress: "102.67.12.11",
		userAgent:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
		success: true,
	},
	{
		userId: "epVWwfvr1aid9pR-QUJZl", // Brian Otieno
		ipAddress: "102.67.12.12",
		userAgent:
			"Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
		success: true,
	},
	{
		userId: "xjWIS0zgWVHYE4SRCJmzB", // Grace Wambui
		ipAddress: "102.67.12.13",
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
		success: true,
	},
	{
		userId: "Y31ZpIZdci9t0q6LpGkTK", // John Kihara
		ipAddress: "102.67.12.14",
		userAgent:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
		success: true,
	},
	{
		userId: "FFbml4pkyAiwCfM_ostbI", // Linet Akinyi
		ipAddress: "102.67.12.15",
		userAgent:
			"Mozilla/5.0 (Linux; Android 14; SM-A146P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
		success: true,
	},
	{
		userId: "npEVnr9aMN6bhuNzpLvgQ", // Peter Kiptoo
		ipAddress: "102.67.12.16",
		userAgent:
			"Mozilla/5.0 (Linux; Android 13; Infinix X6835) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
		success: true,
	},
	{
		userId: "uv25MQ9ia9YF7-IogeMY9", // Mercy Njeri
		ipAddress: "102.67.12.17",
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
		success: true,
	},
	{
		userId: "82UCRf2nm4FJnkpiD9PmJ", // Samuel Mutua
		ipAddress: "102.67.12.18",
		userAgent:
			"Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",
		success: true,
	},
	{
		userId: "3MTagDgzNapnu5xLqJi7Y", // Diana Chebet
		ipAddress: "102.67.12.19",
		userAgent:
			"Mozilla/5.0 (Linux; Android 13; TECNO CK7n) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
		success: true,
	},
	{
		userId: "YoYwImjelQcoCX-tm6q9V", // Collins Barasa
		ipAddress: "102.67.12.20",
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
		success: true,
	},
	{
		userId: "bXVG04P95cdgK4e7i1Rt0", // Ruth Mumo
		ipAddress: "102.67.12.21",
		userAgent:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
		success: true,
	},
	{
		userId: "TwFaRPr1ksU1mUj34dEqb", // Jonathan Oduor
		ipAddress: "102.67.12.22",
		userAgent:
			"Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
		success: true,
	},
	{
		userId: "h34rMoJYFYX_O-iLTvwkI", // Faith Nduta
		ipAddress: "102.67.12.23",
		userAgent:
			"Mozilla/5.0 (Linux; Android 12; Nokia C21) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
		success: true,
	},
	{
		userId: "_bTzyujnQvjcuonDMGaQg", // Robert Wekesa
		ipAddress: "102.67.12.24",
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
		success: true,
	},
	{
		userId: "ywQTbmZ6er1CgHauoVO4x", // Janet Wanjiru
		ipAddress: "102.67.12.25",
		userAgent:
			"Mozilla/5.0 (Linux; Android 14; SM-A346B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
		success: true,
	},
	{
		userId: "HH0g9Huv4ZIxlSEWylEZk", // Victor Cheruiyot
		ipAddress: "102.67.12.26",
		userAgent:
			"Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0",
		success: true,
	},
	{
		userId: "59vNr5gwyiFGYYKhPp3J6", // Elizabeth Kendi
		ipAddress: "102.67.12.27",
		userAgent:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
		success: true,
	},
	{
		userId: "__sYIwY95ZlD2QuC6zVml", // George Kariuki
		ipAddress: "102.67.12.28",
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
		success: true,
	},
	{
		userId: "QWxxZCcM9fviOybsvOMI5", // Ann Muthoni
		ipAddress: "102.67.12.29",
		userAgent:
			"Mozilla/5.0 (Linux; Android 13; Infinix X688B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
		success: true,
	},
	{
		userId: "rvD7I-fFWVSgbYyz7NXHT", // Stephen Ndichu
		ipAddress: "102.67.12.30",
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
		success: true,
	},
	{
		userId: "taKS5tKon6dx1yu1vSJ2j", // Lucy Wanja
		ipAddress: "102.67.12.31",
		userAgent:
			"Mozilla/5.0 (Linux; Android 12; TECNO KF6k) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
		success: true,
	},
];

export async function seedUsers() {
	try {
		console.log("🌱 Seeding users...");
		await db.transaction(async (tx) => {
			await tx.insert(users).values(usersData).onConflictDoNothing();
			await tx
				.insert(loginAttempts)
				.values(loginAttemptsData)
				.onConflictDoNothing();
		});
		console.log("✅ Users seeded successfully!");
	} catch (error) {
		console.error("❌ Error seeding users:", error);
		throw error;
	}
}
