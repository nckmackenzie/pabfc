import { createServerFn } from "@tanstack/react-start";
import { renderToBuffer } from "@react-pdf/renderer";
import { and, asc, eq, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { departments, employees, payrollPeriods, payrollSlips } from "@/drizzle/schema";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success } from "@/lib/result";
import { resend, FROM_EMAIL } from "@/services/email";
import { PayslipPdf } from "@/features/payroll/components/payslip-pdf";
import type { PayslipPdfData } from "@/features/payroll/components/payslip-pdf";
import { toNumber } from "@/lib/helpers";
import { dateFormat } from "@/lib/helpers";
import { sendPayslipEmailSchema, sendAllPayslipsEmailSchema } from "./payroll-slips.schemas";

async function requirePayslipEmailAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("payroll-periods:view");
}

async function getSlipWithEmployeeAndPeriod(slipId: string) {
	const row = await db
		.select({
			slip: payrollSlips,
			employeeName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
			employeeNo: employees.employeeNo,
			employeeEmail: employees.email,
			departmentName: departments.name,
			periodName: payrollPeriods.name,
			payDate: payrollPeriods.payDate,
		})
		.from(payrollSlips)
		.innerJoin(employees, eq(payrollSlips.employeeId, employees.id))
		.leftJoin(departments, eq(employees.departmentId, departments.id))
		.innerJoin(payrollPeriods, eq(payrollSlips.payrollPeriodId, payrollPeriods.id))
		.where(eq(payrollSlips.id, slipId))
		.then((rows) => rows[0] ?? null);

	return row;
}

function buildPdfData(
	row: Awaited<ReturnType<typeof getSlipWithEmployeeAndPeriod>> & object,
): PayslipPdfData {
	const s = row.slip;
	return {
		employeeName: row.employeeName,
		employeeNo: row.employeeNo,
		departmentName: row.departmentName,
		periodName: row.periodName,
		payDate: dateFormat(new Date(row.payDate), "long"),
		basicSalary: toNumber(s.basicSalary),
		houseAllowance: toNumber(s.houseAllowance),
		transportAllowance: toNumber(s.transportAllowance),
		commuterAllowance: toNumber(s.commuterAllowance),
		mealAllowance: toNumber(s.mealAllowance),
		airtimeAllowance: toNumber(s.airtimeAllowance),
		otherAllowances: toNumber(s.otherAllowances),
		overtimePay: toNumber(s.overtimePay),
		bonuses: toNumber(s.bonuses),
		grossPay: toNumber(s.grossPay),
		netPaye: toNumber(s.netPaye),
		nssfEmployee: toNumber(s.nssfEmployee),
		shifEmployee: toNumber(s.shifEmployee),
		ahlEmployee: toNumber(s.ahlEmployee),
		pensionEmployeeDeduction: toNumber(s.pensionEmployeeDeduction),
		helbDeduction: toNumber(s.helbDeduction),
		totalLoanDeductions: toNumber(s.totalLoanDeductions),
		totalAdvanceRecoveries: toNumber(s.totalAdvanceRecoveries),
		totalOtherDeductions: toNumber(s.totalOtherDeductions),
		totalDeductions: toNumber(s.totalDeductions),
		netPay: toNumber(s.netPay),
	};
}

async function generatePayslipPdf(pdfData: PayslipPdfData): Promise<Buffer> {
	return renderToBuffer(<PayslipPdf data={pdfData} />);
}

export const sendPayslipEmailFn = createServerFn()
	.middleware([authMiddleware])
	.validator(sendPayslipEmailSchema)
	.handler(async ({ data }) => {
		await requirePayslipEmailAccess();

		const row = await getSlipWithEmployeeAndPeriod(data.slipId);
		if (!row) {
			return failure({ type: "NotFoundError", message: "Payroll slip not found." });
		}

		const email = row.employeeEmail;
		if (!email) {
			return failure({
				type: "ValidationError",
				message: `${row.employeeName} does not have an email address on file.`,
			});
		}

		const pdfData = buildPdfData(row);
		const pdfBuffer = await generatePayslipPdf(pdfData);

		const { error } = await resend.emails.send({
			from: FROM_EMAIL,
			to: email,
			subject: `Your Payslip — ${pdfData.periodName}`,
			html: `<p>Dear ${pdfData.employeeName},</p>
<p>Please find attached your payslip for <strong>${pdfData.periodName}</strong> (Pay Date: ${pdfData.payDate}).</p>
<p>If you have any questions regarding your payslip, please contact HR.</p>
<p>Regards,<br/>Prime Age Beauty &amp; Fitness Center</p>`,
			attachments: [
				{
					filename: `payslip-${row.employeeNo}-${pdfData.periodName.replace(/\s+/g, "-")}.pdf`,
					content: pdfBuffer,
				},
			],
		});

		if (error) {
			return failure({ type: "ApplicationError", message: error.message });
		}

		return success({ sentTo: email, employeeName: row.employeeName });
	});

export const sendAllPayslipsEmailFn = createServerFn()
	.middleware([authMiddleware])
	.validator(sendAllPayslipsEmailSchema)
	.handler(async ({ data }) => {
		await requirePayslipEmailAccess();

		const slipRows = await db
			.select({
				slip: payrollSlips,
				employeeName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
				employeeNo: employees.employeeNo,
				employeeEmail: employees.email,
				departmentName: departments.name,
				periodName: payrollPeriods.name,
				payDate: payrollPeriods.payDate,
			})
			.from(payrollSlips)
			.innerJoin(employees, eq(payrollSlips.employeeId, employees.id))
			.leftJoin(departments, eq(employees.departmentId, departments.id))
			.innerJoin(payrollPeriods, eq(payrollSlips.payrollPeriodId, payrollPeriods.id))
			.where(
				and(
					eq(payrollSlips.payrollPeriodId, data.periodId),
					ne(payrollSlips.status, "cancelled"),
				),
			)
			.orderBy(asc(employees.lastName), asc(employees.firstName));

		const sent: string[] = [];
		const skipped: string[] = [];

		for (const row of slipRows) {
			if (!row.employeeEmail) {
				skipped.push(row.employeeName);
				continue;
			}

			try {
				const pdfData = buildPdfData(row);
				const pdfBuffer = await generatePayslipPdf(pdfData);

				const { error } = await resend.emails.send({
					from: FROM_EMAIL,
					to: row.employeeEmail,
					subject: `Your Payslip — ${pdfData.periodName}`,
					html: `<p>Dear ${pdfData.employeeName},</p>
<p>Please find attached your payslip for <strong>${pdfData.periodName}</strong> (Pay Date: ${pdfData.payDate}).</p>
<p>If you have any questions regarding your payslip, please contact HR.</p>
<p>Regards,<br/>Prime Age Beauty &amp; Fitness Center</p>`,
					attachments: [
						{
							filename: `payslip-${row.employeeNo}-${pdfData.periodName.replace(/\s+/g, "-")}.pdf`,
							content: pdfBuffer,
						},
					],
				});

				if (error) {
					skipped.push(row.employeeName);
				} else {
					sent.push(row.employeeName);
				}
			} catch {
				skipped.push(row.employeeName);
			}
		}

		return success({ sent, skipped, total: slipRows.length });
	});
