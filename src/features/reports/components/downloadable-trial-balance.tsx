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
	tableHeader: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#000",
		paddingBottom: 4,
		marginBottom: 8,
	},
	colAccount: {
		flex: 3,
		fontSize: 10,
		fontWeight: "bold",
	},
	colDebit: {
		flex: 1,
		fontSize: 10,
		fontWeight: "bold",
		textAlign: "right",
	},
	colCredit: {
		flex: 1,
		fontSize: 10,
		fontWeight: "bold",
		textAlign: "right",
	},
	row: {
		flexDirection: "row",
		paddingVertical: 4,
	},
	rowAccount: {
		flex: 3,
		fontSize: 10,
	},
	rowDebit: {
		flex: 1,
		fontSize: 10,
		textAlign: "right",
	},
	rowCredit: {
		flex: 1,
		fontSize: 10,
		textAlign: "right",
	},
	totalsRow: {
		flexDirection: "row",
		paddingVertical: 10,
		marginTop: 10,
		borderTopWidth: 2,
		borderTopColor: "#333",
		borderBottomWidth: 3,
		borderBottomColor: "#333", // Simulate double line
	},
	totalsLabel: {
		flex: 3,
		fontSize: 11,
		fontWeight: "bold",
		color: "#000",
		textAlign: "right",
		paddingRight: 15,
	},
	totalDebit: {
		flex: 1,
		fontSize: 11,
		fontWeight: "bold",
		color: "#000",
		textAlign: "right",
	},
	totalCredit: {
		flex: 1,
		fontSize: 11,
		fontWeight: "bold",
		color: "#000",
		textAlign: "right",
	},
});

export interface TrialBalancePdfProps {
	asOfDate: string;
	rows: Array<{ label: string; debit: string; credit: string }>;
	totalDebits: string;
	totalCredits: string;
}

export function TrialBalancePdf({ data }: { data: TrialBalancePdfProps }) {
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
					<Text style={styles.reportTitle}>Trial Balance</Text>
					{data.asOfDate && (
						<Text style={styles.reportSubtitle}>As of {data.asOfDate}</Text>
					)}
				</View>

				<View style={styles.tableHeader}>
					<Text style={styles.colAccount}>Account</Text>
					<Text style={styles.colDebit}>Debit</Text>
					<Text style={styles.colCredit}>Credit</Text>
				</View>

				{data.rows.map((row, index) => (
					<View style={styles.row} key={index.toString()}>
						<Text style={styles.rowAccount}>{row.label}</Text>
						<Text style={styles.rowDebit}>{row.debit}</Text>
						<Text style={styles.rowCredit}>{row.credit}</Text>
					</View>
				))}

				<View style={styles.totalsRow}>
					<Text style={styles.totalsLabel}>TOTAL</Text>
					<Text style={styles.totalDebit}>{data.totalDebits}</Text>
					<Text style={styles.totalCredit}>{data.totalCredits}</Text>
				</View>
			</Page>
		</Document>
	);
}
