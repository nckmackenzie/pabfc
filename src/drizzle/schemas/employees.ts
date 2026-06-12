import {
	boolean,
	date,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "../schema-helpers";
import { genderEnum } from "./member";

export const EMPLOYMENT_TYPES = [
	"full_time",
	"part_time",
	"contract",
	"temporary",
] as const;
export const EMPLOYEMENT_TYPES = EMPLOYMENT_TYPES;
export const EMPLOYMENT_STATUSES = [
	"active",
	"on_leave",
	"terminated",
	"resigned",
] as const;

export const employmentTypeEnum = pgEnum("employment_type", EMPLOYMENT_TYPES);
export const employmentStatusEnum = pgEnum(
	"employment_status",
	EMPLOYMENT_STATUSES,
);

export const departments = pgTable("departments", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 100 }).notNull(),
	managerId: varchar("manager_id", { length: 255 }),
	createdAt,
	updatedAt,
});

export const employees = pgTable(
	"employees",
	{
		id,
		employeeNo: varchar("employee_no", { length: 20 }).notNull().unique(),
		firstName: varchar("first_name", { length: 100 }).notNull(),
		lastName: varchar("last_name", { length: 100 }).notNull(),
		gender: genderEnum("gender").notNull(),
		nationalId: varchar("national_id", { length: 20 }).unique(),
		dateOfBirth: date("date_of_birth"),
		kraPin: varchar("kra_pin", { length: 20 }).unique(),
		nssfNo: varchar("nssf_no", { length: 30 }).unique(),
		shifNo: varchar("shif_no", { length: 30 }).unique(),
		helbRef: varchar("helb_ref", { length: 30 }).unique(),
		phone: varchar("phone", { length: 20 }).notNull().unique(),
		email: varchar("email", { length: 255 }).unique(),
		emergencyContact: varchar("emergency_contact", { length: 20 }),
		nextOfKin: varchar("next_of_kin", { length: 20 }),
		jobTitle: varchar("job_title", { length: 150 }),
		departmentId: integer("department_id").references(() => departments.id),
		employmentType: employmentTypeEnum("employment_type")
			.notNull()
			.default("full_time"),
		status: employmentStatusEnum("status").notNull().default("active"),
		hireDate: date("hire_date"),
		terminationDate: date("termination_date"),
		bankName: varchar("bank_name", { length: 100 }),
		bankAccountNo: varchar("bank_account_no", { length: 30 }),
		bankBranch: varchar("bank_branch", { length: 100 }),
		isResident: boolean("is_resident").notNull().default(true),
		deletedAt: timestamp("deleted_at"),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_employees_email").on(table.email),
		index("idx_employees_phone").on(table.phone),
		index("idx_first_name_last_name").on(table.firstName, table.lastName),
	],
);
