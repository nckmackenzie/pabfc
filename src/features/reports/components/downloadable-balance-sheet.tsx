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
		paddingVertical: 4,
	},
	rowLabel: {
		fontSize: 10,
		flex: 3,
	},
	rowValue: {
		fontSize: 10,
		flex: 1,
		textAlign: "right",
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
		flex: 3,
	},
	totalValue: {
		fontSize: 10,
		fontWeight: "bold",
		borderBottomWidth: 1,
		borderBottomColor: "#555",
		flex: 1,
		textAlign: "right",
	},
	balanceRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 10,
		marginTop: 10,
		borderTopWidth: 2,
		borderTopColor: "#333",
		borderBottomWidth: 3,
		borderBottomColor: "#333",
	},
	balanceLabel: {
		fontSize: 11,
		fontWeight: "bold",
		color: "#000",
	},
	balanceValue: {
		fontSize: 11,
		fontWeight: "bold",
		color: "#000",
	},
});

type PdfRow = { label: string; amount: string };

export interface BalanceSheetPdfProps {
	asOfDate: string;
	assetRows: Array<PdfRow>;
	liabilityRows: Array<PdfRow>;
	equityRows: Array<PdfRow>;
	totalAssets: string;
	totalLiabilities: string;
	totalEquity: string;
	totalLiabilitiesAndEquity: string;
}

export function BalanceSheetPdf({ data }: { data: BalanceSheetPdfProps }) {
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
					<Text style={styles.reportTitle}>Balance Sheet</Text>
					{data.asOfDate && (
						<Text style={styles.reportSubtitle}>As of {data.asOfDate}</Text>
					)}
				</View>

				<Section
					title="Assets"
					rows={data.assetRows}
					totalLabel="TOTAL ASSETS"
					totalValue={data.totalAssets}
				/>
				<Section
					title="Liabilities"
					rows={data.liabilityRows}
					totalLabel="TOTAL LIABILITIES"
					totalValue={data.totalLiabilities}
				/>
				<Section
					title="Equity"
					rows={data.equityRows}
					totalLabel="TOTAL EQUITY"
					totalValue={data.totalEquity}
				/>

				<View style={styles.balanceRow}>
					<Text style={styles.balanceLabel}>
						TOTAL LIABILITIES &amp; EQUITY
					</Text>
					<Text style={styles.balanceValue}>
						{data.totalLiabilitiesAndEquity}
					</Text>
				</View>
			</Page>
		</Document>
	);
}

function Section({
	title,
	rows,
	totalLabel,
	totalValue,
}: {
	title: string;
	rows: Array<PdfRow>;
	totalLabel: string;
	totalValue: string;
}) {
	return (
		<View style={styles.section}>
			<Text style={styles.sectionTitle}>{title}</Text>
			{rows.map((row, index) => (
				<View style={styles.row} key={`${title}-${index.toString()}`}>
					<Text style={styles.rowLabel}>{row.label}</Text>
					<Text style={styles.rowValue}>{row.amount}</Text>
				</View>
			))}
			<View style={styles.totalRow}>
				<Text style={styles.totalLabel}>{totalLabel}</Text>
				<Text style={styles.totalValue}>{totalValue}</Text>
			</View>
		</View>
	);
}
