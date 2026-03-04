import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
	page: {
		padding: 40,
		fontFamily: "Helvetica",
		fontSize: 10,
		color: "#333",
		lineHeight: 1.5,
	},
	header: {
		flexDirection: "column",
		alignItems: "center",
		marginBottom: 30,
	},
	companyNameTitle: {
		textTransform: "uppercase",
		letterSpacing: 2,
		fontSize: 16,
		fontWeight: "bold",
		marginBottom: 5,
		color: "#000",
	},
	companyDetail: {
		fontSize: 10,
		color: "#555",
		marginBottom: 2,
	},
	reportTitleContainer: {
		alignItems: "center",
		marginTop: 20,
		marginBottom: 30,
	},
	reportTitle: {
		fontSize: 14,
		fontWeight: "bold",
		textTransform: "uppercase",
		letterSpacing: 1,
		color: "#000",
	},
	reportSubtitle: {
		fontSize: 10,
		color: "#555",
		marginTop: 4,
	},
	section: {
		marginBottom: 20,
	},
	sectionTitle: {
		fontSize: 10,
		fontWeight: "bold",
		textTransform: "uppercase",
		color: "#555",
		marginBottom: 8,
		letterSpacing: 1,
	},
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 5,
	},
	rowLabel: {
		fontSize: 10,
	},
	rowValue: {
		fontSize: 10,
	},
	totalRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 8,
		marginTop: 4,
		borderTopWidth: 1,
		borderTopColor: "#CCC",
	},
	totalLabel: {
		fontSize: 10,
		fontWeight: "bold",
		paddingLeft: 20,
	},
	totalValue: {
		fontSize: 10,
		fontWeight: "bold",
		borderBottomWidth: 1,
		borderBottomColor: "#555",
	},
	netIncomeRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 10,
		marginTop: 10,
		borderTopWidth: 2,
		borderTopColor: "#333",
		borderBottomWidth: 3,
		borderBottomColor: "#333", // Simulate double line
	},
	netIncomeLabel: {
		fontSize: 12,
		fontWeight: "bold",
		color: "#000",
	},
	netIncomeValue: {
		fontSize: 12,
		fontWeight: "bold",
		color: "#000",
	},
	negativeValue: {
		color: "#D32F2F", // Red for negative net income
	},
});

export interface IncomeStatementPdfProps {
	fromDate: string;
	toDate: string;
	revenueRows: Array<{ label: string; amount: string }>;
	expenseRows: Array<{ label: string; amount: string }>;
	totalRevenue: string;
	totalExpenses: string;
	netIncome: string;
	isNegativeNetIncome: boolean;
}

export function IncomeStatementPdf({
	data,
}: {
	data: IncomeStatementPdfProps;
}) {
	return (
		<Document>
			<Page size="A4" style={styles.page}>
				<View style={styles.header}>
					<Text style={styles.companyNameTitle}>
						Prime Age Beauty &amp; Fitness Center
					</Text>
					<Text style={styles.companyDetail}>P.O Box 6009-00200, Nairobi</Text>
					<Text style={styles.companyDetail}>
						Nairobi, Kenya | +254 700 000 000 | primeagebeauty@gmail.com
					</Text>
				</View>

				<View style={styles.reportTitleContainer}>
					<Text style={styles.reportTitle}>Income Statement</Text>
					{data.fromDate && data.toDate && (
						<Text style={styles.reportSubtitle}>
							For the period {data.fromDate} to {data.toDate}
						</Text>
					)}
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Revenue</Text>
					{data.revenueRows.map((row, index) => (
						<View style={styles.row} key={`rev-${index.toString()}`}>
							<Text style={styles.rowLabel}>{row.label}</Text>
							<Text style={styles.rowValue}>{row.amount}</Text>
						</View>
					))}
					<View style={styles.totalRow}>
						<Text style={styles.totalLabel}>TOTAL REVENUE</Text>
						<Text style={styles.totalValue}>{data.totalRevenue}</Text>
					</View>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Expenses</Text>
					{data.expenseRows.map((row, index) => (
						<View style={styles.row} key={`exp-${index.toString()}`}>
							<Text style={styles.rowLabel}>{row.label}</Text>
							<Text style={styles.rowValue}>{row.amount}</Text>
						</View>
					))}
					<View style={styles.totalRow}>
						<Text style={styles.totalLabel}>TOTAL EXPENSES</Text>
						<Text style={styles.totalValue}>{data.totalExpenses}</Text>
					</View>
				</View>

				<View style={styles.netIncomeRow}>
					<Text style={styles.netIncomeLabel}>NET INCOME</Text>
					<Text
						style={[
							styles.netIncomeValue,
							data.isNegativeNetIncome ? styles.negativeValue : {},
						]}
					>
						{data.netIncome}
					</Text>
				</View>
			</Page>
		</Document>
	);
}
