import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { generateRandomId } from "@/lib/utils";

const styles = StyleSheet.create({
	page: {
		padding: 40,
		fontFamily: "Helvetica",
		fontSize: 10,
		color: "#333",
		lineHeight: 1.5,
	},
	// --- Header Section ---
	header: {
		flexDirection: "row",
		marginBottom: 40,
		alignItems: "center",
	},
	headerLeft: {
		width: "40%",
		flexDirection: "column",
		alignItems: "center", // Centered logo like the image
	},
	logoPlaceholder: {
		width: 80,
		height: 80,
		backgroundColor: "#333", // Placeholder for the round logo
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

	// --- Info Bar (Date, Payment, Bill To) ---
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
	colDesc: { width: "50%" },
	colQty: { width: "15%", textAlign: "center" },
	colPrice: { width: "15%", textAlign: "right" },
	colTotal: { width: "20%", textAlign: "right" },

	bold: { fontWeight: "bold" },

	// --- Totals Section ---
	totalsSection: {
		flexDirection: "column",
		alignItems: "flex-end",
		marginTop: 20,
		marginRight: 0,
	},
	totalRow: {
		flexDirection: "row",
		justifyContent: "flex-end",
		marginBottom: 5,
		width: "50%",
	},
	totalLabel: {
		width: "50%",
		textAlign: "right",
		paddingRight: 10,
		color: "#555",
	},
	totalValue: {
		width: "50%",
		textAlign: "right",
	},
	grandTotal: {
		flexDirection: "row",
		justifyContent: "flex-end",
		borderTopWidth: 2,
		borderTopColor: "#333",
		paddingTop: 5,
		marginTop: 5,
		width: "50%",
	},
	grandTotalText: {
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

interface ReceiptProps {
	receiptNo: string;
	date: string;
	member: {
		name: string;
		id: string;
		address?: string;
	};
	paymentMethod: string;
	lineItems: Array<{
		description: string;
		qty: number;
		price: number;
		amount: number;
	}>;
	subtotal: number;
	discount: number;
	tax: number;
	total: number;
}

export const GymReceiptPdf = ({ data }: { data: ReceiptProps }) => (
	<Document>
		<Page size="A4" style={styles.page}>
			<View style={styles.header}>
				<View style={styles.headerLeft}>
					<View style={styles.logoPlaceholder}>
						<Text style={styles.logoText}>LOGO</Text>
					</View>
					<Text style={styles.companyNameTitle}>PABFC</Text>
				</View>

				<View style={styles.headerRight}>
					<Text style={styles.companyHeader}>
						Prime Age Beauty & Fitness Center
					</Text>
					<Text style={styles.companyDetail}>P.O Box 6009-00200, Nairobi</Text>
					<Text style={styles.companyDetail}>Nairobi, Kenya</Text>
					<Text style={styles.companyDetail}>+254 700 000 000</Text>
					<Text style={styles.companyDetail}>primeagebeauty@gmail.com</Text>
				</View>
			</View>

			<View style={styles.infoBar}>
				<View style={styles.infoCol}>
					<Text style={styles.infoLabel}>DATE:</Text>
					<Text style={styles.infoValue}>{data.date}</Text>

					<Text style={[styles.infoLabel, { marginTop: 10 }]}>RECEIPT #:</Text>
					<Text style={styles.infoValue}>{data.receiptNo}</Text>
				</View>

				<View style={styles.infoCol}>
					<Text style={styles.infoLabel}>PAYMENT:</Text>
					<Text style={styles.infoValue}>{data.paymentMethod}</Text>
					<Text style={styles.infoValue}>Status: Paid</Text>
				</View>

				<View style={styles.infoCol}>
					<Text style={styles.infoLabel}>BILL TO:</Text>
					<Text style={[styles.infoValue, styles.bold]}>
						{data.member.name}
					</Text>
					<Text style={styles.infoValue}>Member No: {data.member.id}</Text>
				</View>
			</View>

			<View style={styles.tableHeader}>
				<Text style={[styles.colDesc, styles.infoLabel]}>DESCRIPTION</Text>
				<Text style={[styles.colQty, styles.infoLabel]}>QTY</Text>
				<Text style={[styles.colPrice, styles.infoLabel]}>PRICE</Text>
				<Text style={[styles.colTotal, styles.infoLabel]}>ITEM TOTAL</Text>
			</View>

			{data.lineItems.map((item, index) => (
				<View
					style={styles.tableRow}
					key={generateRandomId(`receipt-row-${index}`)}
				>
					<Text style={styles.colDesc}>{item.description}</Text>
					<Text style={styles.colQty}>{item.qty}</Text>
					<Text style={styles.colPrice}>{item.price.toFixed(2)}</Text>
					<Text style={styles.colTotal}>{item.amount.toFixed(2)}</Text>
				</View>
			))}

			<View style={styles.totalsSection}>
				<View style={styles.totalRow}>
					<Text style={styles.totalLabel}>SUBTOTAL</Text>
					<Text style={styles.totalValue}>Ksh {data.subtotal.toFixed(2)}</Text>
				</View>
				<View style={styles.totalRow}>
					<Text style={styles.totalLabel}>DISCOUNT</Text>
					<Text style={styles.totalValue}>Ksh {data.discount.toFixed(2)}</Text>
				</View>

				{data.tax > 0 && (
					<View style={styles.totalRow}>
						<Text style={styles.totalLabel}>TAX</Text>
						<Text style={styles.totalValue}>Ksh {data.tax.toFixed(2)}</Text>
					</View>
				)}

				<View style={styles.grandTotal}>
					<Text style={[styles.totalLabel, styles.grandTotalText]}>TOTAL</Text>
					<Text style={[styles.totalValue, styles.grandTotalText]}>
						Ksh {data.total.toFixed(2)}
					</Text>
				</View>
			</View>

			<View style={styles.footer}>
				<View style={styles.notesSection}>
					<Text style={styles.infoLabel}>NOTE:</Text>
					<Text style={{ fontSize: 9, color: "#777", fontStyle: "italic" }}>
						This receipt is automatically generated. Thank you for your
						continued membership.
					</Text>
				</View>
				<Text style={styles.thankYouMsg}>THANK YOU FOR YOUR BUSINESS</Text>
			</View>
		</Page>
	</Document>
);
