import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
	page: {
		padding: 40,
		fontFamily: "Helvetica",
		fontSize: 10,
		color: "#333",
		lineHeight: 1.5,
	},
	// --- Header ---
	header: {
		flexDirection: "row",
		marginBottom: 40,
		alignItems: "center",
	},
	headerLeft: {
		width: "40%",
		flexDirection: "column",
		alignItems: "center",
	},
	logoPlaceholder: {
		width: 80,
		height: 80,
		backgroundColor: "#333",
		borderRadius: 40,
		marginBottom: 10,
		justifyContent: "center",
		alignItems: "center",
	},
	logoText: {
		color: "#FFF",
		fontWeight: "bold",
		fontSize: 18,
	},
	companyNameTitle: {
		textTransform: "uppercase",
		letterSpacing: 2,
		fontSize: 12,
		marginTop: 5,
	},
	headerRight: {
		width: "60%",
		borderLeftWidth: 3,
		borderLeftColor: "#333",
		paddingLeft: 20,
		marginLeft: 20,
		justifyContent: "center",
	},
	companyDetail: {
		fontSize: 9,
		color: "#555",
		marginBottom: 2,
	},
	companyHeader: {
		fontSize: 11,
		fontWeight: "bold",
		marginBottom: 5,
		color: "#000",
	},

	// --- Info Bar ---
	infoBar: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 30,
	},
	infoCol: {
		width: "30%",
	},
	infoLabel: {
		fontSize: 9,
		fontWeight: "bold",
		textTransform: "uppercase",
		color: "#555",
		marginBottom: 5,
	},
	infoValue: {
		fontSize: 10,
		marginBottom: 2,
	},
	bold: { fontWeight: "bold" },

	// --- Table ---
	tableHeader: {
		flexDirection: "row",
		borderBottomWidth: 2,
		borderBottomColor: "#333",
		borderTopWidth: 2,
		borderTopColor: "#333",
		paddingVertical: 5,
		marginTop: 10,
		marginBottom: 5,
	},
	tableRow: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#EEE",
		paddingVertical: 8,
	},
	colBillNo: { width: "16%" },
	colBillDate: { width: "16%" },
	colDueDate: { width: "16%" },
	colAmount: { width: "18%", textAlign: "right" },
	colBalance: { width: "17%", textAlign: "right" },
	colPaid: { width: "17%", textAlign: "right" },

	// --- Totals ---
	totalsSection: {
		flexDirection: "column",
		alignItems: "flex-end",
		marginTop: 20,
	},
	grandTotal: {
		flexDirection: "row",
		justifyContent: "flex-end",
		borderTopWidth: 2,
		borderTopColor: "#333",
		paddingTop: 5,
		marginTop: 5,
		width: "35%",
	},
	grandTotalLabel: {
		width: "50%",
		textAlign: "right",
		paddingRight: 10,
		fontWeight: "bold",
		fontSize: 12,
	},
	grandTotalValue: {
		width: "50%",
		textAlign: "right",
		fontWeight: "bold",
		fontSize: 12,
	},

	// --- Footer ---
	footer: {
		position: "absolute",
		bottom: 40,
		left: 40,
		right: 40,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-end",
	},
	notesSection: {
		width: "60%",
	},
	thankYouMsg: {
		fontSize: 10,
		textTransform: "uppercase",
		color: "#555",
	},
});

interface PaymentPdfProps {
	paymentNo: number;
	paymentDate: string;
	vendor: string;
	paymentMethod: string;
	reference?: string;
	bank?: string;
	memo?: string;
	lines: Array<{
		billNo: string;
		billDate: string;
		dueDate?: string;
		billAmount: string;
		balance: string;
		amountPaid: string;
	}>;
	totalPaid: string;
}

export function PaymentPdf({ data }: { data: PaymentPdfProps }) {
	return (
		<Document>
			<Page size="A4" style={styles.page}>
				{/* Header */}
				<View style={styles.header}>
					<View style={styles.headerLeft}>
						<View style={styles.logoPlaceholder}>
							<Text style={styles.logoText}>LOGO</Text>
						</View>
						<Text style={styles.companyNameTitle}>PABFC</Text>
					</View>
					<View style={styles.headerRight}>
						<Text style={styles.companyHeader}>
							Prime Age Beauty &amp; Fitness Center
						</Text>
						<Text style={styles.companyDetail}>
							P.O Box 6009-00200, Nairobi
						</Text>
						<Text style={styles.companyDetail}>Nairobi, Kenya</Text>
						<Text style={styles.companyDetail}>+254 700 000 000</Text>
						<Text style={styles.companyDetail}>primeagebeauty@gmail.com</Text>
					</View>
				</View>

				{/* Info Bar */}
				<View style={styles.infoBar}>
					<View style={styles.infoCol}>
						<Text style={styles.infoLabel}>Payment No:</Text>
						<Text style={styles.infoValue}>{data.paymentNo}</Text>

						<Text style={[styles.infoLabel, { marginTop: 10 }]}>
							Payment Date:
						</Text>
						<Text style={styles.infoValue}>{data.paymentDate}</Text>
					</View>

					<View style={styles.infoCol}>
						<Text style={styles.infoLabel}>Payment Method:</Text>
						<Text style={[styles.infoValue, { textTransform: "capitalize" }]}>
							{data.paymentMethod}
						</Text>
						{data.reference && (
							<>
								<Text style={[styles.infoLabel, { marginTop: 10 }]}>
									Reference:
								</Text>
								<Text style={styles.infoValue}>
									{data.reference.toUpperCase()}
								</Text>
							</>
						)}
					</View>

					<View style={styles.infoCol}>
						<Text style={styles.infoLabel}>Vendor:</Text>
						<Text style={[styles.infoValue, styles.bold]}>{data.vendor}</Text>
						{data.bank && (
							<>
								<Text style={[styles.infoLabel, { marginTop: 10 }]}>Bank:</Text>
								<Text style={styles.infoValue}>{data.bank}</Text>
							</>
						)}
					</View>
				</View>

				{/* Table Header */}
				<View style={styles.tableHeader}>
					<Text style={[styles.colBillNo, styles.infoLabel]}>Bill #</Text>
					<Text style={[styles.colBillDate, styles.infoLabel]}>Bill Date</Text>
					<Text style={[styles.colDueDate, styles.infoLabel]}>Due Date</Text>
					<Text style={[styles.colAmount, styles.infoLabel]}>Amount</Text>
					<Text style={[styles.colBalance, styles.infoLabel]}>Balance</Text>
					<Text style={[styles.colPaid, styles.infoLabel]}>Amount Paid</Text>
				</View>

				{/* Table Rows */}
				{data.lines.map((line, index) => (
					<View
						style={styles.tableRow}
						key={`payment-line-${index.toString()}`}
					>
						<Text style={styles.colBillNo}>{line.billNo}</Text>
						<Text style={styles.colBillDate}>{line.billDate}</Text>
						<Text style={styles.colDueDate}>{line.dueDate || "-"}</Text>
						<Text style={styles.colAmount}>{line.billAmount}</Text>
						<Text style={styles.colBalance}>{line.balance}</Text>
						<Text style={styles.colPaid}>{line.amountPaid}</Text>
					</View>
				))}

				{/* Total */}
				<View style={styles.totalsSection}>
					<View style={styles.grandTotal}>
						<Text style={styles.grandTotalLabel}>TOTAL PAID</Text>
						<Text style={styles.grandTotalValue}>{data.totalPaid}</Text>
					</View>
				</View>

				{/* Footer */}
				<View style={styles.footer}>
					<View style={styles.notesSection}>
						{data.memo && (
							<>
								<Text style={styles.infoLabel}>Notes:</Text>
								<Text
									style={{ fontSize: 9, color: "#777", fontStyle: "italic" }}
								>
									{data.memo}
								</Text>
							</>
						)}
					</View>
					<Text style={styles.thankYouMsg}>PAYMENT VOUCHER</Text>
				</View>
			</Page>
		</Document>
	);
}
