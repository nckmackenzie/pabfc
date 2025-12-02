import type { InferInsertModel } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { accounts, users } from "@/drizzle/schemas/auth";
import {
	memberMemberships,
	members,
	membershipPlans,
} from "@/drizzle/schemas/member";

export const seedMembershipPlans: InferInsertModel<typeof membershipPlans>[] = [
	{
		id: "plan_monthly_gym",
		name: "Monthly Gym Access",
		description: "Unlimited access to the gym facilities for one month.",
		duration: 30, // days
		isSessionBased: false,
		sessionCount: 0,
		active: true,
		price: 4500,
	},
	{
		id: "plan_quarterly_gym",
		name: "Quarterly Gym Access",
		description: "Unlimited gym access for three months at a discounted rate.",
		duration: 90,
		isSessionBased: false,
		sessionCount: 0,
		active: true,
		price: 12000,
	},
	{
		id: "plan_annual_gym_pool",
		name: "Annual Gym + Pool",
		description:
			"Full access to gym and swimming pool facilities for one year.",
		duration: 365,
		isSessionBased: false,
		sessionCount: 0,
		active: true,
		price: 27000,
	},
	{
		id: "plan_pt_10_sessions",
		name: "10-Session PT Pack",
		description:
			"Personal training package with 10 one-on-one sessions. Sessions must be used within 3 months.",
		duration: 90,
		isSessionBased: true,
		sessionCount: 10,
		active: true,
		price: 15000,
	},
];

export const seedMembers: InferInsertModel<typeof members>[] = [
	{
		id: "mem_kevin_mwangi",
		memberNo: 1001,
		firstName: "Kevin",
		lastName: "Mwangi",
		dateOfBirth: "1990-05-12",
		gender: "male",
		email: "kevin.mwangi@example.com",
		contact: "0712000001",
		idType: "National ID",
		idNumber: "29547812",
		memberStatus: "active",
		address: "Apartment 3B, Ngong Road",
		city: "Nairobi",
		state: "Nairobi County",
		zipCode: "00100",
		country: "Kenya",
		emergencyContactName: "Mary Wanjiku",
		emergencyContactNo: "0722000101",
		emergencyContactRelationship: "Spouse",
		deviceId: "device-kevin-001",
		notes: "Prefers morning sessions.",
	},
	{
		id: "mem_aisha_abdalla",
		memberNo: 1002,
		firstName: "Aisha",
		lastName: "Abdalla",
		dateOfBirth: "1993-11-03",
		gender: "female",
		email: "aisha.abdalla@example.com",
		contact: "0712000002",
		idType: "National ID",
		idNumber: "31678945",
		memberStatus: "active",
		address: "Nyali, Links Road",
		city: "Mombasa",
		state: "Mombasa County",
		zipCode: "80100",
		country: "Kenya",
		emergencyContactName: "Yusuf Abdalla",
		emergencyContactNo: "0722000102",
		emergencyContactRelationship: "Brother",
		deviceId: "device-aisha-001",
		notes: "Travels frequently between Mombasa and Nairobi.",
	},
	{
		id: "mem_brian_otieno",
		memberNo: 1003,
		firstName: "Brian",
		lastName: "Otieno",
		dateOfBirth: "1988-02-21",
		gender: "male",
		email: "brian.otieno@example.com",
		contact: "0712000003",
		idType: "National ID",
		idNumber: "28456973",
		memberStatus: "frozen",
		address: "Milimani Estate",
		city: "Kisumu",
		state: "Kisumu County",
		zipCode: "40100",
		country: "Kenya",
		emergencyContactName: "Lucy Akinyi",
		emergencyContactNo: "0722000103",
		emergencyContactRelationship: "Sister",
		deviceId: "device-brian-001",
		notes: "Membership currently frozen due to travel.",
	},
	{
		id: "mem_grace_wambui",
		memberNo: 1004,
		firstName: "Grace",
		lastName: "Wambui",
		dateOfBirth: "1995-07-09",
		gender: "female",
		email: "grace.wambui@example.com",
		contact: "0712000004",
		idType: "National ID",
		idNumber: "32789461",
		memberStatus: "inactive",
		address: "Thika Road, Roysambu",
		city: "Nairobi",
		state: "Nairobi County",
		zipCode: "00232",
		country: "Kenya",
		emergencyContactName: "Jane Wanjiru",
		emergencyContactNo: "0722000104",
		emergencyContactRelationship: "Mother",
		deviceId: "device-grace-001",
		notes: "Stopped attending after relocation.",
	},
	{
		id: "mem_john_kihara",
		memberNo: 1005,
		firstName: "John",
		lastName: "Kihara",
		dateOfBirth: "1985-09-15",
		gender: "male",
		email: "john.kihara@example.com",
		contact: "0712000005",
		idType: "National ID",
		idNumber: "25678194",
		memberStatus: "terminated",
		address: "Ruiru Bypass",
		city: "Ruiru",
		state: "Kiambu County",
		zipCode: "00900",
		country: "Kenya",
		emergencyContactName: "Peter Kihara",
		emergencyContactNo: "0722000105",
		emergencyContactRelationship: "Brother",
		deviceId: "device-john-001",
		notes: "Membership terminated due to non-payment.",
	},
	{
		id: "mem_linet_akinyi",
		memberNo: 1006,
		firstName: "Linet",
		lastName: "Akinyi",
		dateOfBirth: "1998-01-30",
		gender: "female",
		email: "linet.akinyi@example.com",
		contact: "0712000006",
		idType: "National ID",
		idNumber: "34781925",
		memberStatus: "active",
		address: "Kisumu Road Estate",
		city: "Eldoret",
		state: "Uasin Gishu County",
		zipCode: "30100",
		country: "Kenya",
		emergencyContactName: "Mary Akinyi",
		emergencyContactNo: "0722000106",
		emergencyContactRelationship: "Mother",
		deviceId: "device-linet-001",
		notes: "Interested in personal training sessions.",
	},
];

export const seedMemberMemberships: InferInsertModel<
	typeof memberMemberships
>[] = [
	{
		id: "mm_kevin_monthly",
		memberId: "mem_kevin_mwangi",
		membershipPlanId: "plan_monthly_gym",
		startDate: "2025-01-01",
		endDate: "2025-01-30",
		status: "active",
		autoRenew: true,
	},
	{
		id: "mm_aisha_quarterly",
		memberId: "mem_aisha_abdalla",
		membershipPlanId: "plan_quarterly_gym",
		startDate: "2024-12-01",
		endDate: "2025-02-28",
		status: "active",
		autoRenew: false,
	},
	{
		id: "mm_brian_frozen",
		memberId: "mem_brian_otieno",
		membershipPlanId: "plan_annual_gym_pool",
		startDate: "2024-06-01",
		endDate: "2025-05-31",
		status: "frozen",
		autoRenew: false,
		freezeStartDate: "2024-11-01",
		freezeEndDate: "2025-01-31",
		freezeReason: "Out of the country for work.",
	},
	{
		id: "mm_grace_expired",
		memberId: "mem_grace_wambui",
		membershipPlanId: "plan_monthly_gym",
		startDate: "2024-03-01",
		endDate: "2024-03-30",
		status: "expired",
		autoRenew: false,
	},
	{
		id: "mm_john_terminated",
		memberId: "mem_john_kihara",
		membershipPlanId: "plan_annual_gym_pool",
		startDate: "2023-05-01",
		endDate: "2024-04-30",
		status: "terminated",
		autoRenew: false,
		terminatedAt: "2023-10-15",
		terminatedReason: "Repeated missed payments.",
	},
	{
		id: "mm_linet_pt_pending",
		memberId: "mem_linet_akinyi",
		membershipPlanId: "plan_pt_10_sessions",
		startDate: "2025-02-01",
		// endDate left null – could be calculated in app logic
		status: "pending",
		autoRenew: false,
	},
];

const usersData: InferInsertModel<typeof users>[] = seedMembers.map(
	(member) => ({
		id: member.id,
		memberId: member.id,
		name: `${member.firstName} ${member.lastName}`,
		email: member.email,
		// Generate a simple username from email or name
		username: member.contact as string,
		contact: member.contact as string,
		role: "member",
		emailVerified: true,
		active: member.memberStatus === "active",
		createdAt: new Date(),
		updatedAt: new Date(),
	}),
);

// Generate accounts for each user
export const accountsData: InferInsertModel<typeof accounts>[] =
	seedMembers.map((member) => ({
		id: `acc_${member.id}`, // specific ID for the account
		userId: member.id as string,
		accountId: member.id as string,
		providerId: "credential",
		password: "$2b$12$QJcycob/UcPlsGmiODPhhOXTS.iYPIoI0zwT7XHv7YEXq3FUZjqCy", // Default password for seeded users
		createdAt: new Date(),
		updatedAt: new Date(),
	}));

export async function seedMemberData() {
	try {
		console.log("🌱 Seeding member data...");
		await db.transaction(async (tx) => {
			await tx
				.insert(membershipPlans)
				.values(seedMembershipPlans)
				.onConflictDoNothing();

			await tx.insert(members).values(seedMembers).onConflictDoNothing();
			await tx.insert(users).values(usersData).onConflictDoNothing();
			await tx.insert(accounts).values(accountsData).onConflictDoNothing();
			await tx
				.insert(memberMemberships)
				.values(seedMemberMemberships)
				.onConflictDoNothing();
		});
		console.log("✅ Member Data seeded successfully!");
	} catch (error) {
		console.error("❌ Error seeding users:", error);
		throw error;
	}
}
