import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { membersReportFormSchema } from "@/features/reports/services/schema";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export type MembersReportRow = {
	id: string;
	memberNo: number;
	fullName: string;
	contact: string;
	gender: "male" | "female" | "unspecified" | "other";
	memberStatus: "active" | "inactive" | "frozen" | "terminated";
	dateJoined: Date;
	lastVisit: Date | null;
	lastAttendance: Date | null;
	activePlanName: string | null;
	lastPlanName: string | null;
	nextRenewalDate: string | null;
	notes: string | null;
	emergencyContactName: string | null;
	emergencyContactNo: string | null;
	banned: boolean;
	completedRegistration: boolean;
	totalPayments: string;
};

export const getMembersReport = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(membersReportFormSchema)
	.handler(async ({ data }) => {
		await requirePermission("members:view");
		const { asOfDate, reportType, status } = data;

		const response = await db.execute<MembersReportRow>(sql`
			WITH latest_attendance AS (
				SELECT
					al.member_id,
					MAX(al.check_in_time) AS last_attendance
				FROM attendance_logs al
				GROUP BY al.member_id
			),
			latest_plan AS (
				SELECT DISTINCT ON (mm.member_id)
					mm.member_id,
					mp.name AS last_plan_name
				FROM member_memberships mm
				JOIN membership_plans mp
					ON mp.id = mm.membership_plan_id
				ORDER BY
					mm.member_id,
					COALESCE(mm.end_date, mm.start_date) DESC NULLS LAST,
					mm.created_at DESC
			),
			payment_totals AS (
				SELECT
					p.member_id,
					COALESCE(SUM(p.total_amount), 0) AS total_payments
				FROM payments p
				WHERE DATE(p.payment_date) <= ${asOfDate}
				GROUP BY p.member_id
			)
			SELECT
				m.id,
				m.member_no AS "memberNo",
				COALESCE(mo.full_name, CONCAT(m.first_name, ' ', m.last_name)) AS "fullName",
				m.contact,
				m.gender,
				m.member_status AS "memberStatus",
				m.created_at AS "dateJoined",
				mo.last_visit AS "lastVisit",
				la.last_attendance AS "lastAttendance",
				mo.active_plan_name AS "activePlanName",
				lp.last_plan_name AS "lastPlanName",
				mo.next_renewal_date AS "nextRenewalDate",
				mo.notes,
				mo.emergency_contact_name AS "emergencyContactName",
				mo.emergency_contact_no AS "emergencyContactNo",
				COALESCE(mo.banned, false) AS banned,
				COALESCE(mo.completed_registration, false) AS "completedRegistration",
				COALESCE(pt.total_payments, 0)::text AS "totalPayments"
			FROM members m
			LEFT JOIN vw_member_overview mo
				ON mo.id = m.id
			LEFT JOIN latest_attendance la
				ON la.member_id = m.id
			LEFT JOIN latest_plan lp
				ON lp.member_id = m.id
			LEFT JOIN payment_totals pt
				ON pt.member_id = m.id
			WHERE DATE(m.created_at) <= ${asOfDate}
			${
				reportType === "by-status" && status
					? sql`AND m.member_status = ${status}`
					: sql``
			}
			ORDER BY m.member_no DESC;
		`);

		return response.rows;
	});
