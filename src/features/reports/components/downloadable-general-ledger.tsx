import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

type GeneralLedgerPdfProps = {
	data: {
		accountLabel: string;
		period: string;
		openingBalanceLabel: string;
		openingBalance: string;
		rows: Array<{
			key: string | number;
			date: string;
			description: string;
			source: string;
			reference: string;
			debit: string;
			credit: string;
			runningBalance: string;
		}>;
		totalDebits: string;
		totalCredits: string;
		closingBalance: string;
	};
};

const styles = StyleSheet.create({
	page: {
		padding: 24,
		fontFamily: "Helvetica",
		fontSize: 9,
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
	summary: {
		flexDirection: "row",
		gap: 8,
		marginBottom: 12,
	},
	summaryItem: {
		flex: 1,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		padding: 8,
	},
	summaryLabel: {
		fontSize: 8,
		color: "#6B7280",
		marginBottom: 3,
		textTransform: "uppercase",
	},
	summaryValue: {
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
	tableFooter: {
		flexDirection: "row",
		backgroundColor: "#F3F4F6",
	},
	cell: {
		paddingHorizontal: 5,
		paddingVertical: 4,
		fontSize: 8,
		borderRightWidth: 1,
		borderRightColor: "#E5E7EB",
	},
	bold: {
		fontWeight: 700,
	},
	right: {
		textAlign: "right",
	},
});

const columnWidths = [10, 28, 11, 11, 13, 13, 14];

function Cell({
	align = "left",
	bold = false,
	children,
	index,
	span = 1,
}: {
	align?: "left" | "right";
	bold?: boolean;
	children: React.ReactNode;
	index: number;
	span?: number;
}) {
	const width = columnWidths.slice(index, index + span).reduce((sum, value) => sum + value, 0);

	return (
		<Text
			style={[
				styles.cell,
				{ width: `${width}%` },
				...(align === "right" ? [styles.right] : []),
				...(bold ? [styles.bold] : []),
				...(index + span === columnWidths.length ? [{ borderRightWidth: 0 }] : []),
			]}
		>
			{children}
		</Text>
	);
}

function SummaryItem({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.summaryItem}>
			<Text style={styles.summaryLabel}>{label}</Text>
			<Text style={styles.summaryValue}>{value}</Text>
		</View>
	);
}

export function GeneralLedgerPdf({ data }: GeneralLedgerPdfProps) {
	return (
		<Document>
			<Page size="A4" orientation="landscape" style={styles.page}>
				<View style={styles.header}>
					<Text style={styles.title}>General Ledger</Text>
					<Text style={styles.subtitle}>Prime Age Beauty & Fitness Center</Text>
				</View>

				<View style={styles.summary}>
					<SummaryItem label="Account" value={data.accountLabel} />
					<SummaryItem label="Period" value={data.period} />
					<SummaryItem label={data.openingBalanceLabel} value={data.openingBalance} />
					<SummaryItem label="Closing Balance" value={data.closingBalance} />
				</View>

				<View style={styles.table}>
					<View style={styles.tableHeader} fixed>
						<Cell index={0} bold>
							Date
						</Cell>
						<Cell index={1} bold>
							Description
						</Cell>
						<Cell index={2} bold>
							Source
						</Cell>
						<Cell index={3} bold>
							Reference
						</Cell>
						<Cell index={4} align="right" bold>
							Debit
						</Cell>
						<Cell index={5} align="right" bold>
							Credit
						</Cell>
						<Cell index={6} align="right" bold>
							Balance
						</Cell>
					</View>
					{data.rows.map((row) => (
						<View key={row.key} style={styles.tableRow} wrap={false}>
							<Cell index={0}>{row.date}</Cell>
							<Cell index={1}>{row.description}</Cell>
							<Cell index={2}>{row.source}</Cell>
							<Cell index={3}>{row.reference}</Cell>
							<Cell index={4} align="right">
								{row.debit}
							</Cell>
							<Cell index={5} align="right">
								{row.credit}
							</Cell>
							<Cell index={6} align="right">
								{row.runningBalance}
							</Cell>
						</View>
					))}
					<View style={styles.tableFooter} wrap={false}>
						<Cell index={0} span={4} bold>
							Totals
						</Cell>
						<Cell index={4} align="right" bold>
							{data.totalDebits}
						</Cell>
						<Cell index={5} align="right" bold>
							{data.totalCredits}
						</Cell>
						<Cell index={6} align="right" bold>
							{data.closingBalance}
						</Cell>
					</View>
				</View>
			</Page>
		</Document>
	);
}
