import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { currencyFormatter, dateFormat } from "@/lib/helpers";

type SalaryAdvanceStatementPdfProps = {
	data: {
		currentPosition: {
			outstandingBalance: number;
			recoveriesProcessed: number;
			recoveriesRemaining: number;
			status: string;
			totalRecovered: number;
		};
		header: {
			advanceReference: string;
			applicationDate: string;
			approvedAmount: number;
			approvedRecoveryMonths: number;
			disbursementAccountName: string | null;
			disbursementDate: string | null;
			employeeName: string;
			employeeNo: string;
			monthlyRecoveryAmount: number;
			recoveryStartMonth: number | null;
			recoveryStartYear: number | null;
			status: string;
		};
		rows: Array<{
			amount: number;
			balanceAfter: number;
			balanceBefore: number;
			date: string;
			index: number;
			isLastRecovery: boolean;
			periodMonth: number | null;
			periodYear: number | null;
		}>;
	};
};

const styles = StyleSheet.create({
	page: {
		padding: 24,
		fontFamily: "Helvetica",
		fontSize: 10,
		color: "#111827",
	},
	header: {
		marginBottom: 16,
	},
	title: {
		fontSize: 16,
		fontWeight: 700,
		marginBottom: 4,
	},
	subtitle: {
		fontSize: 10,
		color: "#6B7280",
	},
	section: {
		marginTop: 12,
	},
	sectionTitle: {
		fontSize: 11,
		fontWeight: 700,
		marginBottom: 8,
	},
	infoGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	infoItem: {
		width: "31%",
		borderWidth: 1,
		borderColor: "#E5E7EB",
		padding: 8,
	},
	infoLabel: {
		fontSize: 8,
		color: "#6B7280",
		marginBottom: 3,
		textTransform: "uppercase",
	},
	infoValue: {
		fontSize: 10,
		fontWeight: 700,
	},
	table: {
		borderWidth: 1,
		borderColor: "#E5E7EB",
	},
	tableHeader: {
		flexDirection: "row",
		backgroundColor: "#F3F4F6",
		borderBottomWidth: 1,
		borderBottomColor: "#E5E7EB",
	},
	tableRow: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#E5E7EB",
	},
	cell: {
		paddingHorizontal: 6,
		paddingVertical: 5,
		fontSize: 8,
		borderRightWidth: 1,
		borderRightColor: "#E5E7EB",
	},
	right: {
		textAlign: "right",
	},
	center: {
		textAlign: "center",
	},
});

const columnWidths = [7, 16, 16, 17, 17, 17, 10];

function monthLabel(month: number | null, year: number | null) {
	if (!month || !year) return "-";
	return `${month.toString().padStart(2, "0")}/${year}`;
}

function Cell({
	align = "left",
	children,
	index,
}: {
	align?: "center" | "left" | "right";
	children: React.ReactNode;
	index: number;
}) {
	return (
		<Text
			style={[
				styles.cell,
				{ width: `${columnWidths[index]}%` },
				...(align === "right" ? [styles.right] : []),
				...(align === "center" ? [styles.center] : []),
				...(index === columnWidths.length - 1 ? [{ borderRightWidth: 0 }] : []),
			]}
		>
			{children}
		</Text>
	);
}

function InfoItem({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.infoItem}>
			<Text style={styles.infoLabel}>{label}</Text>
			<Text style={styles.infoValue}>{value}</Text>
		</View>
	);
}

export function SalaryAdvanceStatementPdf({ data }: SalaryAdvanceStatementPdfProps) {
	return (
		<Document>
			<Page size="A4" style={styles.page}>
				<View style={styles.header}>
					<Text style={styles.title}>Salary Advance Statement</Text>
					<Text style={styles.subtitle}>Prime Age Beauty & Fitness Center</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Header</Text>
					<View style={styles.infoGrid}>
						<InfoItem label="Employee" value={data.header.employeeName} />
						<InfoItem label="Employee No" value={data.header.employeeNo} />
						<InfoItem label="Advance Reference" value={data.header.advanceReference} />
						<InfoItem
							label="Application Date"
							value={dateFormat(data.header.applicationDate, "long")}
						/>
						<InfoItem
							label="Disbursement Date"
							value={data.header.disbursementDate ? dateFormat(data.header.disbursementDate, "long") : "-"}
						/>
						<InfoItem
							label="Disbursement Account"
							value={data.header.disbursementAccountName ?? "-"}
						/>
						<InfoItem
							label="Approved Amount"
							value={currencyFormatter(data.header.approvedAmount, false)}
						/>
						<InfoItem
							label="Monthly Recovery Amount"
							value={currencyFormatter(data.header.monthlyRecoveryAmount, false)}
						/>
						<InfoItem
							label="Recovery Start"
							value={monthLabel(data.header.recoveryStartMonth, data.header.recoveryStartYear)}
						/>
						<InfoItem
							label="Approved Recovery Months"
							value={String(data.header.approvedRecoveryMonths)}
						/>
						<InfoItem label="Status" value={data.header.status} />
					</View>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Recovery History</Text>
					<View style={styles.table}>
						<View style={styles.tableHeader}>
							<Cell index={0} align="center">#</Cell>
							<Cell index={1}>Date</Cell>
							<Cell index={2}>Period</Cell>
							<Cell index={3} align="right">Amount</Cell>
							<Cell index={4} align="right">Before</Cell>
							<Cell index={5} align="right">After</Cell>
							<Cell index={6}>Final</Cell>
						</View>
						{data.rows.map((row) => (
							<View key={`${row.index}-${row.date}`} style={styles.tableRow}>
								<Cell index={0} align="center">{row.index}</Cell>
								<Cell index={1}>{dateFormat(row.date, "reporting")}</Cell>
								<Cell index={2}>{monthLabel(row.periodMonth, row.periodYear)}</Cell>
								<Cell index={3} align="right">{currencyFormatter(row.amount, false)}</Cell>
								<Cell index={4} align="right">{currencyFormatter(row.balanceBefore, false)}</Cell>
								<Cell index={5} align="right">{currencyFormatter(row.balanceAfter, false)}</Cell>
								<Cell index={6}>{row.isLastRecovery ? "Yes" : "No"}</Cell>
							</View>
						))}
					</View>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Current Position</Text>
					<View style={styles.infoGrid}>
						<InfoItem
							label="Outstanding Balance"
							value={currencyFormatter(data.currentPosition.outstandingBalance, false)}
						/>
						<InfoItem
							label="Recoveries Processed"
							value={String(data.currentPosition.recoveriesProcessed)}
						/>
						<InfoItem
							label="Recoveries Remaining"
							value={String(data.currentPosition.recoveriesRemaining)}
						/>
						<InfoItem
							label="Total Recovered"
							value={currencyFormatter(data.currentPosition.totalRecovered, false)}
						/>
						<InfoItem label="Status" value={data.currentPosition.status} />
					</View>
				</View>
			</Page>
		</Document>
	);
}
