import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type PayslipPdfData = {
	employeeName: string;
	employeeNo: string;
	departmentName: string | null;
	periodName: string;
	payDate: string;
	basicSalary: number;
	houseAllowance: number;
	transportAllowance: number;
	commuterAllowance: number;
	mealAllowance: number;
	airtimeAllowance: number;
	otherAllowances: number;
	overtimePay: number;
	bonuses: number;
	grossPay: number;
	netPaye: number;
	nssfEmployee: number;
	shifEmployee: number;
	ahlEmployee: number;
	pensionEmployeeDeduction: number;
	helbDeduction: number;
	totalLoanDeductions: number;
	totalAdvanceRecoveries: number;
	totalOtherDeductions: number;
	totalDeductions: number;
	netPay: number;
};

const fmt = (n: number) =>
	new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(n);

const styles = StyleSheet.create({
	page: {
		padding: 40,
		fontFamily: "Helvetica",
		fontSize: 9,
		color: "#333",
		lineHeight: 1.5,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 24,
		borderBottomWidth: 2,
		borderBottomColor: "#333",
		paddingBottom: 16,
	},
	companyBlock: {
		flexDirection: "column",
	},
	companyName: {
		fontSize: 14,
		fontWeight: "bold",
		textTransform: "uppercase",
		letterSpacing: 1,
		color: "#000",
	},
	companyDetail: {
		fontSize: 8,
		color: "#666",
		marginTop: 2,
	},
	slipTitle: {
		fontSize: 16,
		fontWeight: "bold",
		textAlign: "right",
		color: "#000",
	},
	slipSubtitle: {
		fontSize: 9,
		textAlign: "right",
		color: "#666",
		marginTop: 2,
	},
	infoGrid: {
		flexDirection: "row",
		gap: 16,
		marginBottom: 20,
		backgroundColor: "#f7f7f7",
		padding: 10,
		borderRadius: 4,
	},
	infoCol: {
		flex: 1,
	},
	infoLabel: {
		fontSize: 7,
		fontWeight: "bold",
		textTransform: "uppercase",
		color: "#888",
		marginBottom: 2,
	},
	infoValue: {
		fontSize: 9,
		color: "#222",
		fontWeight: "bold",
	},
	section: {
		marginBottom: 16,
	},
	sectionTitle: {
		fontSize: 9,
		fontWeight: "bold",
		textTransform: "uppercase",
		color: "#555",
		borderBottomWidth: 1,
		borderBottomColor: "#ddd",
		paddingBottom: 4,
		marginBottom: 6,
	},
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 3,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
	},
	rowLabel: {
		fontSize: 9,
		color: "#444",
	},
	rowValue: {
		fontSize: 9,
		color: "#222",
		textAlign: "right",
	},
	subtotalRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 5,
		borderTopWidth: 1,
		borderTopColor: "#ccc",
		marginTop: 2,
	},
	subtotalLabel: {
		fontSize: 9,
		fontWeight: "bold",
		color: "#222",
	},
	subtotalValue: {
		fontSize: 9,
		fontWeight: "bold",
		color: "#222",
		textAlign: "right",
	},
	twoCol: {
		flexDirection: "row",
		gap: 16,
	},
	col: {
		flex: 1,
	},
	netPayBox: {
		marginTop: 16,
		backgroundColor: "#1a1a1a",
		padding: 12,
		borderRadius: 4,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	netPayLabel: {
		fontSize: 11,
		fontWeight: "bold",
		color: "#fff",
		textTransform: "uppercase",
	},
	netPayValue: {
		fontSize: 14,
		fontWeight: "bold",
		color: "#fff",
	},
	footer: {
		position: "absolute",
		bottom: 30,
		left: 40,
		right: 40,
		borderTopWidth: 1,
		borderTopColor: "#ddd",
		paddingTop: 8,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	footerText: {
		fontSize: 7,
		color: "#aaa",
	},
});

function EarningsRow({ label, value }: { label: string; value: number }) {
	if (value === 0) return null;
	return (
		<View style={styles.row}>
			<Text style={styles.rowLabel}>{label}</Text>
			<Text style={styles.rowValue}>{fmt(value)}</Text>
		</View>
	);
}

function DeductionRow({ label, value }: { label: string; value: number }) {
	if (value === 0) return null;
	return (
		<View style={styles.row}>
			<Text style={styles.rowLabel}>{label}</Text>
			<Text style={styles.rowValue}>{fmt(value)}</Text>
		</View>
	);
}

export function PayslipPdf({ data }: { data: PayslipPdfData }) {
	return (
		<Document>
			<Page size="A4" style={styles.page}>
				{/* Header */}
				<View style={styles.header}>
					<View style={styles.companyBlock}>
						<Text style={styles.companyName}>Prime Age Beauty &amp; Fitness Center</Text>
						<Text style={styles.companyDetail}>P.O Box 6009-00200, Nairobi, Kenya</Text>
						<Text style={styles.companyDetail}>primeagebeauty@gmail.com</Text>
					</View>
					<View>
						<Text style={styles.slipTitle}>PAYSLIP</Text>
						<Text style={styles.slipSubtitle}>{data.periodName}</Text>
						<Text style={styles.slipSubtitle}>Pay Date: {data.payDate}</Text>
					</View>
				</View>

				{/* Employee Info */}
				<View style={styles.infoGrid}>
					<View style={styles.infoCol}>
						<Text style={styles.infoLabel}>Employee Name</Text>
						<Text style={styles.infoValue}>{data.employeeName}</Text>
					</View>
					<View style={styles.infoCol}>
						<Text style={styles.infoLabel}>Employee No</Text>
						<Text style={styles.infoValue}>{data.employeeNo}</Text>
					</View>
					<View style={styles.infoCol}>
						<Text style={styles.infoLabel}>Department</Text>
						<Text style={styles.infoValue}>{data.departmentName ?? "—"}</Text>
					</View>
				</View>

				{/* Earnings & Deductions side by side */}
				<View style={styles.twoCol}>
					{/* Earnings */}
					<View style={styles.col}>
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Earnings</Text>
							<EarningsRow label="Basic Salary" value={data.basicSalary} />
							<EarningsRow label="House Allowance" value={data.houseAllowance} />
							<EarningsRow label="Transport Allowance" value={data.transportAllowance} />
							<EarningsRow label="Commuter Allowance" value={data.commuterAllowance} />
							<EarningsRow label="Meal Allowance" value={data.mealAllowance} />
							<EarningsRow label="Airtime Allowance" value={data.airtimeAllowance} />
							<EarningsRow label="Other Allowances" value={data.otherAllowances} />
							<EarningsRow label="Overtime Pay" value={data.overtimePay} />
							<EarningsRow label="Bonuses" value={data.bonuses} />
							<View style={styles.subtotalRow}>
								<Text style={styles.subtotalLabel}>Gross Pay</Text>
								<Text style={styles.subtotalValue}>{fmt(data.grossPay)}</Text>
							</View>
						</View>
					</View>

					{/* Deductions */}
					<View style={styles.col}>
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Deductions</Text>
							<DeductionRow label="PAYE" value={data.netPaye} />
							<DeductionRow label="NSSF (Employee)" value={data.nssfEmployee} />
							<DeductionRow label="SHIF (Employee)" value={data.shifEmployee} />
							<DeductionRow label="AHL (Employee)" value={data.ahlEmployee} />
							<DeductionRow label="Pension" value={data.pensionEmployeeDeduction} />
							<DeductionRow label="HELB" value={data.helbDeduction} />
							<DeductionRow label="Loan Repayments" value={data.totalLoanDeductions} />
							<DeductionRow label="Advance Recoveries" value={data.totalAdvanceRecoveries} />
							<DeductionRow label="Other Deductions" value={data.totalOtherDeductions} />
							<View style={styles.subtotalRow}>
								<Text style={styles.subtotalLabel}>Total Deductions</Text>
								<Text style={styles.subtotalValue}>{fmt(data.totalDeductions)}</Text>
							</View>
						</View>
					</View>
				</View>

				{/* Net Pay */}
				<View style={styles.netPayBox}>
					<Text style={styles.netPayLabel}>Net Pay</Text>
					<Text style={styles.netPayValue}>{fmt(data.netPay)}</Text>
				</View>

				{/* Footer */}
				<View style={styles.footer}>
					<Text style={styles.footerText}>
						This is a computer-generated payslip and does not require a signature.
					</Text>
					<Text style={styles.footerText}>PABFC — Confidential</Text>
				</View>
			</Page>
		</Document>
	);
}
