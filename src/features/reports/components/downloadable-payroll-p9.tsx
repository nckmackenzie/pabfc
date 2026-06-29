import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PayrollP9ReportResponse } from "@/features/reports/services/payroll-p9.api";

const EMPLOYER_NAME = "Prime Age Beauty & Fitness Center";

const P9_NOTES = [
	"1. Use P9A",
	"   (a) For all liable employees and where director/employee received Benefits in addition to cash emoluments",
	"   (b) Where an employee is eligible to deduction on owner occupier interest.",
	"   (c) Where an employee contributes to a post retirement medical fund",
	"   c) Attach",
	"   (i) Photostat copy of interest certificate and statement of account from the Financial Institution",
	"   (ii) The DECLARATION duly signed by the employee.",
	"2. (a) Deductible interest in respect of any month prior to December 2024 must not exceed Kshs. 25,000/= and commencing December 2024 must not exceed 30,000/=",
	"   (b) Deductible pension contribution in respect of any month prior to December 2024 must not exceed Kshs. 20,000/= and commencing December 2024 must not exceed 30,000/=",
	"   (c) Deductible contribution to a post retirement medical fund in respect of any month is effective from December 2024, must not exceed Kshs. 15,000/=",
	"   (d) Deductible Contribution to the Social Health Insurance Fund (SHIF) and deductions made towards Affordable Housing Levy (AHL) are effective December 2024",
	"   (e) Personal Relief is Kshs. 2,400 per Month or 28,800 per year",
	"   (f) Insurance Relief is 15% of the Premium up to a Maximum of Kshs. 5,000 per month or Kshs. 60,000 per year",
] as const;

// Currency: no symbol, 2 decimal places, thousands separator
function f(value: number | null): string {
	if (value === null) return "";
	return new Intl.NumberFormat("en-KE", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

// Column pixel widths — must total ≤ usable page width (802pt for A4 landscape, pad 20)
const W = {
	month: 52,
	a: 46,
	b: 34,
	c: 34,
	d: 46,
	e1: 38,
	e2: 38,
	e3: 42,
	f: 36,
	g: 36,
	h: 36,
	i: 40,
	j: 46,
	k: 46,
	l: 40,
	m: 36,
	n: 36,
	o: 40,
} as const;

const styles = StyleSheet.create({
	page: {
		paddingHorizontal: 20,
		paddingVertical: 18,
		fontFamily: "Helvetica",
		fontSize: 6.5,
		color: "#111",
	},
	// ── Header ──────────────────────────────────────────────
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 4,
	},
	kraLogo: {
		width: 80,
		height: 30,
		objectFit: "contain",
	},
	headerCenter: {
		flex: 1,
		alignItems: "center",
	},
	headerTitle: {
		fontSize: 8.5,
		fontFamily: "Helvetica-Bold",
		letterSpacing: 0.5,
	},
	headerSub: {
		fontSize: 7,
		marginTop: 1,
	},
	headerRight: {
		alignItems: "flex-end",
		fontSize: 6,
	},
	p9aLabel: {
		fontSize: 10,
		fontFamily: "Helvetica-Bold",
		marginTop: 2,
	},
	divider: {
		borderBottomWidth: 1,
		borderBottomColor: "#333",
		marginBottom: 4,
	},
	// ── Info section ────────────────────────────────────────
	infoSection: {
		marginBottom: 5,
	},
	infoRow: {
		flexDirection: "row",
		marginBottom: 2,
	},
	infoLabel: {
		width: 110,
		fontFamily: "Helvetica-Bold",
		fontSize: 6.5,
	},
	infoValue: {
		flex: 1,
		borderBottomWidth: 0.5,
		borderBottomColor: "#999",
		fontSize: 6.5,
	},
	infoLabelRight: {
		width: 80,
		fontFamily: "Helvetica-Bold",
		fontSize: 6.5,
		marginLeft: 10,
	},
	infoValueRight: {
		width: 120,
		borderBottomWidth: 0.5,
		borderBottomColor: "#999",
		fontSize: 6.5,
	},
	// ── Table ───────────────────────────────────────────────
	tableWrap: {
		borderWidth: 0.5,
		borderColor: "#555",
	},
	th: {
		backgroundColor: "#f0f0f0",
		borderBottomWidth: 0.5,
		borderBottomColor: "#555",
	},
	thRow: {
		flexDirection: "row",
		borderBottomWidth: 0.5,
		borderBottomColor: "#555",
	},
	cell: {
		borderRightWidth: 0.5,
		borderRightColor: "#aaa",
		paddingHorizontal: 2,
		paddingVertical: 1.5,
		fontSize: 6,
	},
	cellR: {
		textAlign: "right",
	},
	cellC: {
		textAlign: "center",
	},
	cellB: {
		fontFamily: "Helvetica-Bold",
	},
	dataRow: {
		flexDirection: "row",
		borderBottomWidth: 0.3,
		borderBottomColor: "#ccc",
	},
	totalRow: {
		flexDirection: "row",
		borderTopWidth: 1,
		borderTopColor: "#333",
		backgroundColor: "#f7f7f7",
	},
	// ── Footer ──────────────────────────────────────────────
	footerSection: {
		marginTop: 6,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	footerBlock: {
		flexDirection: "row",
		alignItems: "flex-end",
		gap: 4,
	},
	footerLabel: {
		fontSize: 6.5,
		fontFamily: "Helvetica-Bold",
	},
	footerValue: {
		fontSize: 6.5,
		borderBottomWidth: 0.5,
		borderBottomColor: "#555",
		minWidth: 100,
	},
	// ── Notes ───────────────────────────────────────────────
	notesSection: {
		marginTop: 6,
		borderTopWidth: 0.5,
		borderTopColor: "#aaa",
		paddingTop: 3,
	},
	notesTitle: {
		fontSize: 6.5,
		fontFamily: "Helvetica-Bold",
		marginBottom: 2,
		textDecoration: "underline",
	},
	noteLine: {
		fontSize: 5.5,
		color: "#333",
		lineHeight: 1.4,
	},
});

function HCell({
	w,
	center,
	bold,
	children = "",
}: {
	w: number;
	center?: boolean;
	bold?: boolean;
	children?: React.ReactNode;
}) {
	return (
		<Text
			style={[
				styles.cell,
				{ width: w },
				center ? styles.cellC : styles.cellR,
				bold ? styles.cellB : {},
			]}
		>
			{children}
		</Text>
	);
}

function DCell({
	w,
	bold,
	left,
	children = "",
}: {
	w: number;
	bold?: boolean;
	left?: boolean;
	children?: React.ReactNode;
}) {
	return (
		<Text style={[styles.cell, { width: w }, left ? {} : styles.cellR, bold ? styles.cellB : {}]}>
			{children}
		</Text>
	);
}

export function PayrollP9Pdf({ data }: { data: PayrollP9ReportResponse }) {
	const { employee, taxYear, rows, totals } = data;

	return (
		<Document>
			<Page size="A4" orientation="landscape" style={styles.page}>
				{/* ── KRA Header ─────────────────────────────── */}
				<View style={styles.headerRow}>
					<Image src="/kra-logo.png" style={styles.kraLogo} />
					<View style={styles.headerCenter}>
						<Text style={styles.headerTitle}>KENYA REVENUE AUTHORITY</Text>
						<Text style={styles.headerSub}>DOMESTIC TAXES DEPARTMENT</Text>
						<Text style={styles.headerSub}>
							TAX DEDUCTION CARD YEAR 20{String(taxYear).slice(2)}
						</Text>
					</View>
					<View style={styles.headerRight}>
						<Text>ISO 9001:2015 CERTIFIED</Text>
						<Text>APPENDIX 2A</Text>
						<Text style={styles.p9aLabel}>P9A</Text>
					</View>
				</View>
				<View style={styles.divider} />

				{/* ── Employer / Employee info ────────────────── */}
				<View style={styles.infoSection}>
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>Employer's Name</Text>
						<Text style={styles.infoValue}>{EMPLOYER_NAME}</Text>
						<Text style={styles.infoLabelRight}>Employer's PIN</Text>
						<Text style={styles.infoValueRight}>P051457619H</Text>
					</View>
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>Employee's Main Name</Text>
						<Text style={styles.infoValue}>{employee.lastName}</Text>
						<Text style={styles.infoLabelRight}>Employee's PIN</Text>
						<Text style={styles.infoValueRight}>{employee.kraPin ?? ""}</Text>
					</View>
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>Employee's Other Names</Text>
						<Text style={styles.infoValue}>{employee.firstName}</Text>
					</View>
				</View>

				{/* ── Table ──────────────────────────────────── */}
				<View style={styles.tableWrap}>
					{/* Header row 1 — column letters */}
					<View style={[styles.thRow, { backgroundColor: "#e8e8e8" }]}>
						<HCell w={W.month} center bold>
							MONTH
						</HCell>
						<HCell w={W.a} center>
							A
						</HCell>
						<HCell w={W.b} center>
							B
						</HCell>
						<HCell w={W.c} center>
							C
						</HCell>
						<HCell w={W.d} center>
							D
						</HCell>
						{/* E spans E1/E2/E3 */}
						<HCell w={W.e1 + W.e2 + W.e3} center>
							E — Defined Contribution Retirement Scheme
						</HCell>
						<HCell w={W.f} center>
							F
						</HCell>
						<HCell w={W.g} center>
							G
						</HCell>
						<HCell w={W.h} center>
							H
						</HCell>
						<HCell w={W.i} center>
							I
						</HCell>
						<HCell w={W.j} center>
							J
						</HCell>
						<HCell w={W.k} center>
							K
						</HCell>
						<HCell w={W.l} center>
							L
						</HCell>
						<HCell w={W.m} center>
							M
						</HCell>
						<HCell w={W.n} center>
							N
						</HCell>
						<HCell w={W.o} center>
							O
						</HCell>
					</View>

					{/* Header row 2 — column names */}
					<View style={styles.thRow}>
						<HCell w={W.month} center />
						<HCell w={W.a} center>
							Basic Salary
						</HCell>
						<HCell w={W.b} center>
							Benefits Non-Cash
						</HCell>
						<HCell w={W.c} center>
							Value of Quarters
						</HCell>
						<HCell w={W.d} center>
							Total Gross Pay
						</HCell>
						<HCell w={W.e1} center>
							E1{"\n"}30% of A
						</HCell>
						<HCell w={W.e2} center>
							E2{"\n"}Actual
						</HCell>
						<HCell w={W.e3} center>
							E3 Fixed{"\n"}30,000 p.m.
						</HCell>
						<HCell w={W.f} center>
							Affordable Housing Levy (AHL)
						</HCell>
						<HCell w={W.g} center>
							Social Health Insurance Fund (SHIF)
						</HCell>
						<HCell w={W.h} center>
							Post Retirement Medical Fund (PRMF)
						</HCell>
						<HCell w={W.i} center>
							Owner-Occupied Interest
						</HCell>
						<HCell w={W.j} center>
							Total Deductions (Lower of E+F+G+H+I)
						</HCell>
						<HCell w={W.k} center>
							Chargeable Pay (D-J)
						</HCell>
						<HCell w={W.l} center>
							Tax Charged
						</HCell>
						<HCell w={W.m} center>
							Personal Relief
						</HCell>
						<HCell w={W.n} center>
							Insurance Relief
						</HCell>
						<HCell w={W.o} center>
							PAYE Tax (L-M-N)
						</HCell>
					</View>

					{/* Header row 3 — currency labels */}
					<View style={styles.thRow}>
						{(
							[
								W.month,
								W.a,
								W.b,
								W.c,
								W.d,
								W.e1,
								W.e2,
								W.e3,
								W.f,
								W.g,
								W.h,
								W.i,
								W.j,
								W.k,
								W.l,
								W.m,
								W.n,
								W.o,
							] as const
						).map((w, idx) => (
							<HCell key={idx} w={w} center>
								{idx === 0 ? "" : "Kshs."}
							</HCell>
						))}
					</View>

					{/* Data rows */}
					{rows.map((row) => (
						<View key={row.monthNumber} style={styles.dataRow}>
							<DCell w={W.month} left bold>
								{row.month}
							</DCell>
							<DCell w={W.a}>{f(row.basicSalary)}</DCell>
							<DCell w={W.b}>{f(row.benefitsNonCash)}</DCell>
							<DCell w={W.c}>{f(row.valueOfQuarters)}</DCell>
							<DCell w={W.d}>{f(row.totalGrossPay)}</DCell>
							<DCell w={W.e1}>{f(row.e1ThirtyPctBasic)}</DCell>
							<DCell w={W.e2}>{f(row.e2ActualPension)}</DCell>
							<DCell w={W.e3}>{f(row.e3Fixed)}</DCell>
							<DCell w={W.f}>{f(row.ahlEmployee)}</DCell>
							<DCell w={W.g}>{f(row.shifEmployee)}</DCell>
							<DCell w={W.h}>{f(row.prmf)}</DCell>
							<DCell w={W.i}>{f(row.ownerOccupiedInterest)}</DCell>
							<DCell w={W.j} bold>
								{f(row.totalDeductions)}
							</DCell>
							<DCell w={W.k} bold>
								{f(row.chargeablePay)}
							</DCell>
							<DCell w={W.l}>{f(row.taxCharged)}</DCell>
							<DCell w={W.m}>{f(row.personalRelief)}</DCell>
							<DCell w={W.n}>{f(row.insuranceRelief)}</DCell>
							<DCell w={W.o} bold>
								{f(row.payeTax)}
							</DCell>
						</View>
					))}

					{/* Total row */}
					<View style={styles.totalRow}>
						<DCell w={W.month} left bold>
							TOTAL
						</DCell>
						<DCell w={W.a} bold>
							{f(totals.basicSalary)}
						</DCell>
						<DCell w={W.b} bold>
							{f(totals.benefitsNonCash)}
						</DCell>
						<DCell w={W.c} bold>
							{f(totals.valueOfQuarters)}
						</DCell>
						<DCell w={W.d} bold>
							{f(totals.totalGrossPay)}
						</DCell>
						<DCell w={W.e1} bold>
							{f(totals.e1ThirtyPctBasic)}
						</DCell>
						<DCell w={W.e2} bold>
							{f(totals.e2ActualPension)}
						</DCell>
						<DCell w={W.e3} bold>
							{f(totals.e3Fixed)}
						</DCell>
						<DCell w={W.f} bold>
							{f(totals.ahlEmployee)}
						</DCell>
						<DCell w={W.g} bold>
							{f(totals.shifEmployee)}
						</DCell>
						<DCell w={W.h} bold>
							{f(totals.prmf)}
						</DCell>
						<DCell w={W.i} bold>
							{f(totals.ownerOccupiedInterest)}
						</DCell>
						<DCell w={W.j} bold>
							{f(totals.totalDeductions)}
						</DCell>
						<DCell w={W.k} bold>
							{f(totals.chargeablePay)}
						</DCell>
						<DCell w={W.l} bold>
							{f(totals.taxCharged)}
						</DCell>
						<DCell w={W.m} bold>
							{f(totals.personalRelief)}
						</DCell>
						<DCell w={W.n} bold>
							{f(totals.insuranceRelief)}
						</DCell>
						<DCell w={W.o} bold>
							{f(totals.payeTax)}
						</DCell>
					</View>
				</View>

				{/* ── To be completed by Employer at end of year ── */}
				<View style={styles.footerSection}>
					<Text style={[styles.noteLine, { fontSize: 6 }]}>
						To be completed by Employer at end of year
					</Text>
				</View>
				<View style={[styles.footerSection, { marginTop: 2 }]}>
					<View style={styles.footerBlock}>
						<Text style={styles.footerLabel}>TOTAL CHARGEABLE PAY (COL. K) Kshs.</Text>
						<Text style={styles.footerValue}>{f(totals.chargeablePay)}</Text>
					</View>
					<View style={styles.footerBlock}>
						<Text style={styles.footerLabel}>TOTAL TAX (COL. O) Kshs.</Text>
						<Text style={styles.footerValue}>{f(totals.payeTax)}</Text>
					</View>
				</View>

				{/* ── IMPORTANT notes ────────────────────────── */}
				<View style={styles.notesSection}>
					<Text style={styles.notesTitle}>IMPORTANT</Text>
					{P9_NOTES.map((line, idx) => (
						<Text key={idx} style={styles.noteLine}>
							{line}
						</Text>
					))}
				</View>
			</Page>
		</Document>
	);
}
