import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { currencyFormatter, dateFormat } from "@/lib/helpers";

type LoanStatementPdfProps = {
	data: {
		currentPosition: {
			instalmentsRemaining: number;
			outstandingBalance: number;
			status: string;
		};
		header: {
			annualInterestRate: number;
			approvedInstalments: number;
			disbursementAccountName: string | null;
			disbursementDate: string | null;
			employeeName: string;
			employeeNo: string;
			loanReference: string;
			originalApprovedAmount: number;
			repaymentStartMonth: number | null;
			repaymentStartYear: number | null;
		};
		rows: Array<{
			balanceAfter: number;
			balanceBefore: number;
			date: string;
			index: number;
			interestComponent: number;
			isEarlySettlement: boolean;
			periodMonth: number | null;
			periodYear: number | null;
			principalComponent: number;
			totalPayment: number;
		}>;
		totals: {
			totalInterestPaid: number;
			totalPaid: number;
			totalPrincipalPaid: number;
		};
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
	footerRow: {
		flexDirection: "row",
		backgroundColor: "#F9FAFB",
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

const columnWidths = [5, 11, 12, 12, 12, 12, 12, 12, 12];

function monthLabel(month: number | null, year: number | null) {
	if (!month || !year) return "-";
	return `${month.toString().padStart(2, "0")}/${year}`;
}

function interestRateLabel(rate: number) {
	if (rate === 0) return "Interest-free";
	return `${(rate * 100).toFixed(2)}%`;
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

export function LoanStatementPdf({ data }: LoanStatementPdfProps) {
	return (
		<Document>
			<Page size="A4" style={styles.page}>
				<View style={styles.header}>
					<Text style={styles.title}>Loan Statement</Text>
					<Text style={styles.subtitle}>Prime Age Beauty & Fitness Center</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Header</Text>
					<View style={styles.infoGrid}>
						<InfoItem label="Employee" value={data.header.employeeName} />
						<InfoItem label="Employee No" value={data.header.employeeNo} />
						<InfoItem label="Loan Reference" value={data.header.loanReference} />
						<InfoItem
							label="Disbursement Date"
							value={data.header.disbursementDate ? dateFormat(data.header.disbursementDate, "long") : "-"}
						/>
						<InfoItem
							label="Disbursement Account"
							value={data.header.disbursementAccountName ?? "-"}
						/>
						<InfoItem
							label="Original Approved Amount"
							value={currencyFormatter(data.header.originalApprovedAmount, false)}
						/>
						<InfoItem label="Annual Interest Rate" value={interestRateLabel(data.header.annualInterestRate)} />
						<InfoItem label="Approved Instalments" value={String(data.header.approvedInstalments)} />
						<InfoItem
							label="Repayment Start"
							value={monthLabel(data.header.repaymentStartMonth, data.header.repaymentStartYear)}
						/>
					</View>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Repayment Schedule</Text>
					<View style={styles.table}>
						<View style={styles.tableHeader}>
							<Cell index={0} align="center">#</Cell>
							<Cell index={1}>Date</Cell>
							<Cell index={2}>Period</Cell>
							<Cell index={3} align="right">Principal</Cell>
							<Cell index={4} align="right">Interest</Cell>
							<Cell index={5} align="right">Total</Cell>
							<Cell index={6} align="right">Before</Cell>
							<Cell index={7} align="right">After</Cell>
							<Cell index={8}>Type</Cell>
						</View>
						{data.rows.map((row) => (
							<View key={`${row.index}-${row.date}`} style={styles.tableRow}>
								<Cell index={0} align="center">{row.index}</Cell>
								<Cell index={1}>{dateFormat(row.date, "reporting")}</Cell>
								<Cell index={2}>{monthLabel(row.periodMonth, row.periodYear)}</Cell>
								<Cell index={3} align="right">{currencyFormatter(row.principalComponent, false)}</Cell>
								<Cell index={4} align="right">{currencyFormatter(row.interestComponent, false)}</Cell>
								<Cell index={5} align="right">{currencyFormatter(row.totalPayment, false)}</Cell>
								<Cell index={6} align="right">{currencyFormatter(row.balanceBefore, false)}</Cell>
								<Cell index={7} align="right">{currencyFormatter(row.balanceAfter, false)}</Cell>
								<Cell index={8}>{row.isEarlySettlement ? "Early Settlement" : "Regular"}</Cell>
							</View>
						))}
						<View style={styles.footerRow}>
							<Cell index={0}> </Cell>
							<Cell index={1}> </Cell>
							<Cell index={2}>Totals</Cell>
							<Cell index={3} align="right">{currencyFormatter(data.totals.totalPrincipalPaid, false)}</Cell>
							<Cell index={4} align="right">{currencyFormatter(data.totals.totalInterestPaid, false)}</Cell>
							<Cell index={5} align="right">{currencyFormatter(data.totals.totalPaid, false)}</Cell>
							<Cell index={6}> </Cell>
							<Cell index={7}> </Cell>
							<Cell index={8}> </Cell>
						</View>
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
							label="Instalments Remaining"
							value={String(data.currentPosition.instalmentsRemaining)}
						/>
						<InfoItem label="Status" value={data.currentPosition.status} />
					</View>
				</View>
			</Page>
		</Document>
	);
}
