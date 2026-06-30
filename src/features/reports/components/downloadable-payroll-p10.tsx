import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PayrollP10ReportResponse } from "@/features/reports/services/payroll-p10.api";

const MONTH_NAMES = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
] as const;

function f(value: number | null): string {
	if (value === null) return "";
	return new Intl.NumberFormat("en-KE", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

// Column widths (pt). A4 landscape usable ≈ 802pt (841.89 − 40 padding).
const W = {
	name: 90,
	pin: 60,
	a: 46,
	d: 46,
	e1: 38,
	e2: 38,
	e3: 40,
	f: 34,
	g: 34,
	h: 34,
	i: 38,
	j: 44,
	k: 44,
	l: 38,
	m: 34,
	n: 34,
	o: 38,
} as const;

const styles = StyleSheet.create({
	page: {
		paddingHorizontal: 20,
		paddingVertical: 18,
		fontFamily: "Helvetica",
		fontSize: 6.5,
		color: "#111",
	},
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
	p10Label: {
		fontSize: 10,
		fontFamily: "Helvetica-Bold",
		marginTop: 2,
	},
	divider: {
		borderBottomWidth: 1,
		borderBottomColor: "#333",
		marginBottom: 4,
	},
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
	tableWrap: {
		borderWidth: 0.5,
		borderColor: "#555",
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
	cellR: { textAlign: "right" },
	cellC: { textAlign: "center" },
	cellB: { fontFamily: "Helvetica-Bold" },
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

export function PayrollP10Pdf({ data }: { data: PayrollP10ReportResponse }) {
	const { period, employer, rows, totals } = data;
	const monthName = MONTH_NAMES[period.periodMonth - 1];

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
							MONTHLY PAYE RETURN — {monthName?.toUpperCase()} {period.periodYear}
						</Text>
					</View>
					<View style={styles.headerRight}>
						<Text>ISO 9001:2015 CERTIFIED</Text>
						<Text>P10 RETURN</Text>
						<Text style={styles.p10Label}>P10</Text>
					</View>
				</View>
				<View style={styles.divider} />

				{/* ── Employer info ───────────────────────────── */}
				<View style={styles.infoSection}>
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>Employer's Name</Text>
						<Text style={styles.infoValue}>{employer.name}</Text>
						<Text style={styles.infoLabelRight}>Employer's PIN</Text>
						<Text style={styles.infoValueRight}>{employer.kraPin}</Text>
					</View>
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>Period</Text>
						<Text style={styles.infoValue}>
							{monthName} {period.periodYear}
						</Text>
						<Text style={styles.infoLabelRight}>Pay Date</Text>
						<Text style={styles.infoValueRight}>{period.payDate}</Text>
					</View>
				</View>

				{/* ── Table ──────────────────────────────────── */}
				<View style={styles.tableWrap}>
					{/* Header row 1 — column letters */}
					<View style={[styles.thRow, { backgroundColor: "#e8e8e8" }]}>
						<HCell w={W.name} center bold>
							EMPLOYEE
						</HCell>
						<HCell w={W.pin} center>
							PIN
						</HCell>
						<HCell w={W.a} center>
							A
						</HCell>
						<HCell w={W.d} center>
							D
						</HCell>
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
						<HCell w={W.name} center />
						<HCell w={W.pin} center />
						<HCell w={W.a} center>
							Basic Salary
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
							AHL
						</HCell>
						<HCell w={W.g} center>
							SHIF
						</HCell>
						<HCell w={W.h} center>
							PRMF
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
								W.name,
								W.pin,
								W.a,
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
								{idx < 2 ? "" : "Kshs."}
							</HCell>
						))}
					</View>

					{/* Data rows */}
					{rows.map((row) => (
						<View key={row.employeeNo} style={styles.dataRow}>
							<DCell w={W.name} left bold>
								{row.employeeName}
							</DCell>
							<DCell w={W.pin} left>
								{row.kraPin ?? ""}
							</DCell>
							<DCell w={W.a}>{f(row.basicSalary)}</DCell>
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

					{/* Totals row */}
					<View style={styles.totalRow}>
						<DCell w={W.name} left bold>
							TOTAL
						</DCell>
						<DCell w={W.pin} left />
						<DCell w={W.a} bold>
							{f(totals.basicSalary)}
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

				{/* ── Footer summary ─────────────────────────── */}
				<View style={[styles.footerSection, { marginTop: 6 }]}>
					<View style={styles.footerBlock}>
						<Text style={styles.footerLabel}>TOTAL CHARGEABLE PAY (COL. K) Kshs.</Text>
						<Text style={styles.footerValue}>{f(totals.chargeablePay)}</Text>
					</View>
					<View style={styles.footerBlock}>
						<Text style={styles.footerLabel}>TOTAL PAYE TAX (COL. O) Kshs.</Text>
						<Text style={styles.footerValue}>{f(totals.payeTax)}</Text>
					</View>
					<View style={styles.footerBlock}>
						<Text style={styles.footerLabel}>NUMBER OF EMPLOYEES</Text>
						<Text style={styles.footerValue}>{rows.length}</Text>
					</View>
				</View>
			</Page>
		</Document>
	);
}
