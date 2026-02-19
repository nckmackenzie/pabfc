import { boolean, date, index, pgTable, text } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/drizzle/schema-helpers";

export const financialYears = pgTable(
	"financial_years",
	{
		id,
		name: text("name").notNull(),
		startDate: date("start_date").notNull(),
		endDate: date("end_date").notNull(),
		closed: boolean("closed").notNull().default(false),
		closedDate: date("closed_date"),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("financial_years_name_idx").on(table.name),
		index("financial_years_start_date_idx").on(table.startDate),
	],
);
