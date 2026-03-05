import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { attendanceReportFormSchema } from "@/features/reports/services/schema";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export type AttendanceReportRow = {
	id: bigint;
	memberId: string;
	memberNo: number;
	memberName: string;
	memberStatus: "active" | "inactive" | "frozen" | "terminated";
	contact: string;
	checkInTime: Date;
	checkOutTime: Date | null;
	sessionDuration: string | null;
	planName: string | null;
	dateJoined: Date;
	lastAttendance: Date | null;
	totalPayments: string;
};

export const getAttendanceReport = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(attendanceReportFormSchema)
	.handler(async ({ data }) => {
		await requirePermission("attendance:view");
		const { asOfDate, reportType, memberId } = data;

		const response = await db.execute<AttendanceReportRow>(sql`
			WITH latest_attendance AS (
				SELECT
					al.member_id,
					MAX(al.check_in_time) AS last_attendance
				FROM attendance_logs al
				GROUP BY al.member_id
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
				ao.id,
				al.member_id AS "memberId",
				mo.member_no AS "memberNo",
				mo.full_name AS "memberName",
				mo.member_status AS "memberStatus",
				mo.contact,
				ao.check_in_time AS "checkInTime",
				ao.check_out_time AS "checkOutTime",
				ao.duration::text AS "sessionDuration",
				ao.active_plan_name AS "planName",
				m.created_at AS "dateJoined",
				la.last_attendance AS "lastAttendance",
				COALESCE(pt.total_payments, 0)::text AS "totalPayments"
			FROM vw_attendance_details ao
			JOIN attendance_logs al
				ON al.id = ao.id
			JOIN members m
				ON m.id = al.member_id
			JOIN vw_member_overview mo
				ON mo.id = al.member_id
			LEFT JOIN latest_attendance la
				ON la.member_id = al.member_id
			LEFT JOIN payment_totals pt
				ON pt.member_id = al.member_id
			WHERE DATE(ao.check_in_time) <= ${asOfDate}
			${
				reportType === "by-member" && memberId
					? sql`AND al.member_id = ${memberId}`
					: sql``
			}
			ORDER BY ao.check_in_time DESC, ao.id DESC;
		`);

		return response.rows;
	});
