import type { InferInsertModel } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { leaveEntitlements } from "@/drizzle/schema";

const leaveEntitlementSeedData: Array<
	InferInsertModel<typeof leaveEntitlements>
> = [
	{
		leaveType: "annual",
		annualDaysEntitled: "21",
		accrualRatePerMonth: "1.75",
		isPaid: true,
		fullPayDays: "21",
		halfPayDays: "0",
		carryForwardAllowed: true,
		carryForwardCapDays: null,
		carryForwardExpiryMonths: 6,
		minServiceMonthsRequired: 12,
		requiresMedicalCert: false,
		applicableGender: null,
		isOneOffEntitlement: false,
	},
	{
		leaveType: "sick",
		annualDaysEntitled: "14",
		accrualRatePerMonth: null,
		isPaid: true,
		fullPayDays: "7",
		halfPayDays: "7",
		carryForwardAllowed: false,
		carryForwardCapDays: null,
		carryForwardExpiryMonths: null,
		minServiceMonthsRequired: 2,
		requiresMedicalCert: true,
		applicableGender: null,
		isOneOffEntitlement: false,
	},
	{
		leaveType: "maternity",
		annualDaysEntitled: "90",
		accrualRatePerMonth: null,
		isPaid: true,
		fullPayDays: "90",
		halfPayDays: "0",
		carryForwardAllowed: false,
		carryForwardCapDays: null,
		carryForwardExpiryMonths: null,
		minServiceMonthsRequired: 0,
		requiresMedicalCert: false,
		applicableGender: "female",
		isOneOffEntitlement: true,
	},
	{
		leaveType: "paternity",
		annualDaysEntitled: "14",
		accrualRatePerMonth: null,
		isPaid: true,
		fullPayDays: "14",
		halfPayDays: "0",
		carryForwardAllowed: false,
		carryForwardCapDays: null,
		carryForwardExpiryMonths: null,
		minServiceMonthsRequired: 0,
		requiresMedicalCert: false,
		applicableGender: "male",
		isOneOffEntitlement: true,
	},
	{
		leaveType: "pre_adoptive",
		annualDaysEntitled: "14",
		accrualRatePerMonth: null,
		isPaid: true,
		fullPayDays: "14",
		halfPayDays: "0",
		carryForwardAllowed: false,
		carryForwardCapDays: null,
		carryForwardExpiryMonths: null,
		minServiceMonthsRequired: 0,
		requiresMedicalCert: false,
		applicableGender: null,
		isOneOffEntitlement: true,
	},
	{
		leaveType: "compassionate",
		annualDaysEntitled: "3",
		accrualRatePerMonth: null,
		isPaid: true,
		fullPayDays: "3",
		halfPayDays: "0",
		carryForwardAllowed: false,
		carryForwardCapDays: null,
		carryForwardExpiryMonths: null,
		minServiceMonthsRequired: 0,
		requiresMedicalCert: false,
		applicableGender: null,
		isOneOffEntitlement: false,
	},
	{
		leaveType: "study",
		annualDaysEntitled: "0",
		accrualRatePerMonth: null,
		isPaid: true,
		fullPayDays: "0",
		halfPayDays: "0",
		carryForwardAllowed: false,
		carryForwardCapDays: null,
		carryForwardExpiryMonths: null,
		minServiceMonthsRequired: 0,
		requiresMedicalCert: false,
		applicableGender: null,
		isOneOffEntitlement: false,
	},
	{
		leaveType: "unpaid",
		annualDaysEntitled: "0",
		accrualRatePerMonth: null,
		isPaid: false,
		fullPayDays: "0",
		halfPayDays: "0",
		carryForwardAllowed: false,
		carryForwardCapDays: null,
		carryForwardExpiryMonths: null,
		minServiceMonthsRequired: 0,
		requiresMedicalCert: false,
		applicableGender: null,
		isOneOffEntitlement: false,
	},
];

export async function seedLeaveEntitlements() {
	try {
		console.log("🌱 Seeding leave entitlements...");
		await db
			.insert(leaveEntitlements)
			.values(leaveEntitlementSeedData)
			.onConflictDoNothing();
		console.log("✅ Leave entitlements seeded successfully!");
	} catch (error) {
		console.error("❌ Error seeding leave entitlements:", error);
		throw error;
	}
}
