import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
	page: {
		padding: 30,
		fontFamily: "Helvetica",
		fontSize: 9,
		color: "#333",
		lineHeight: 1.5,
	},
	header: {
		flexDirection: "column",
		alignItems: "center",
		marginBottom: 20,
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
		fontSize: 9,
		color: "#555",
		marginBottom: 2,
	},
	reportTitleContainer: {
		alignItems: "center",
		marginTop: 12,
		marginBottom: 20,
	},
	reportTitle: {
		fontSize: 13,
		fontWeight: "bold",
		textTransform: "uppercase",
		letterSpacing: 1,
		color: "#000",
	},
	reportSubtitle: {
		fontSize: 9,
		color: "#555",
		marginTop: 4,
	},
	groupHeading: {
		fontSize: 10,
		fontWeight: "bold",
		color: "#000",
		marginTop: 12,
		marginBottom: 4,
	},
	tableHeader: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#000",
		paddingBottom: 3,
		marginBottom: 4,
	},
	row: {
		flexDirection: "row",
		paddingVertical: 3,
	},
	subtotalRow: {
		flexDirection: "row",
		paddingVertical: 5,
		borderTopWidth: 1,
		borderTopColor: "#999",
	},
	totalsRow: {
		flexDirection: "row",
		paddingVertical: 8,
		marginTop: 10,
		borderTopWidth: 2,
		borderTopColor: "#333",
		borderBottomWidth: 3,
		borderBottomColor: "#333",
	},
	colVendor: { flex: 2.4, fontSize: 9 },
	colPin: { flex: 1.3, fontSize: 9 },
	colRef: { flex: 1.3, fontSize: 9 },
	colDate: { flex: 1.2, fontSize: 9 },
	colGross: { flex: 1.5, fontSize: 9, textAlign: "right" },
	colRate: { flex: 0.7, fontSize: 9, textAlign: "right" },
	colWht: { flex: 1.5, fontSize: 9, textAlign: "right" },
	colCert: { flex: 1.4, fontSize: 9 },
	bold: { fontWeight: "bold", color: "#000" },
});

export type WhtSchedulePdfRow = {
	vendor: string;
	taxPin: string;
	invoiceNo: string;
	invoiceDate: string;
	grossAmount: string;
	rate: string;
	whtAmount: string;
	certificateNo: string;
};

export type WhtSchedulePdfGroup = {
	label: string;
	rows: Array<WhtSchedulePdfRow>;
	grossAmount: string;
	whtAmount: string;
};

export interface WhtSchedulePdfProps {
	period: string;
	groups: Array<WhtSchedulePdfGroup>;
	totalGrossAmount: string;
	totalWhtAmount: string;
}

/**
 * The WHT schedule as filed: deductions grouped by nature of expense, with a
 * subtotal per category and an overall total.
 */
export function WhtSchedulePdf({ data }: { data: WhtSchedulePdfProps }) {
	return (
		<Document>
			<Page size="A4" orientation="landscape" style={styles.page}>
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
					<Text style={styles.reportTitle}>Withholding Tax Schedule</Text>
					{data.period && (
						<Text style={styles.reportSubtitle}>{data.period}</Text>
					)}
				</View>

				<View style={styles.tableHeader}>
					<Text style={[styles.colVendor, styles.bold]}>Vendor</Text>
					<Text style={[styles.colPin, styles.bold]}>PIN</Text>
					<Text style={[styles.colRef, styles.bold]}>Bill Ref</Text>
					<Text style={[styles.colDate, styles.bold]}>Bill Date</Text>
					<Text style={[styles.colGross, styles.bold]}>Gross (excl. VAT)</Text>
					<Text style={[styles.colRate, styles.bold]}>Rate %</Text>
					<Text style={[styles.colWht, styles.bold]}>WHT Amount</Text>
					<Text style={[styles.colCert, styles.bold]}>Certificate No</Text>
				</View>

				{data.groups.map((group) => (
					<View key={group.label}>
						<Text style={styles.groupHeading}>Withheld at {group.label}</Text>
						{group.rows.map((row, index) => (
							<View style={styles.row} key={`${group.label}-${index.toString()}`}>
								<Text style={styles.colVendor}>{row.vendor}</Text>
								<Text style={styles.colPin}>{row.taxPin}</Text>
								<Text style={styles.colRef}>{row.invoiceNo}</Text>
								<Text style={styles.colDate}>{row.invoiceDate}</Text>
								<Text style={styles.colGross}>{row.grossAmount}</Text>
								<Text style={styles.colRate}>{row.rate}</Text>
								<Text style={styles.colWht}>{row.whtAmount}</Text>
								<Text style={styles.colCert}>{row.certificateNo}</Text>
							</View>
						))}
						<View style={styles.subtotalRow}>
							<Text style={[styles.colVendor, styles.bold]}>
								Subtotal at {group.label}
							</Text>
							<Text style={styles.colPin} />
							<Text style={styles.colRef} />
							<Text style={styles.colDate} />
							<Text style={[styles.colGross, styles.bold]}>
								{group.grossAmount}
							</Text>
							<Text style={styles.colRate} />
							<Text style={[styles.colWht, styles.bold]}>{group.whtAmount}</Text>
							<Text style={styles.colCert} />
						</View>
					</View>
				))}

				<View style={styles.totalsRow}>
					<Text style={[styles.colVendor, styles.bold]}>TOTAL</Text>
					<Text style={styles.colPin} />
					<Text style={styles.colRef} />
					<Text style={styles.colDate} />
					<Text style={[styles.colGross, styles.bold]}>
						{data.totalGrossAmount}
					</Text>
					<Text style={styles.colRate} />
					<Text style={[styles.colWht, styles.bold]}>{data.totalWhtAmount}</Text>
					<Text style={styles.colCert} />
				</View>
			</Page>
		</Document>
	);
}
