import { format } from "date-fns";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { MemberInfo } from "@/features/members/components/member-profile";
import type { getRemittance } from "@/features/wht-remittances/services/wht-remittances.api";
import { currencyFormatter, roundDecimal, toNumber } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

const LINE_COLUMNS = [
	"Vendor",
	"PIN",
	"Bill #",
	"Bill Date",
	"WHT Withheld",
	"Balance Before",
	"Amount Remitted",
	"Certificate No",
];

export function RemittanceDetails({
	remittance,
}: {
	remittance: Awaited<ReturnType<typeof getRemittance>>;
}) {
	const totalRemitted = roundDecimal(
		remittance.lines.reduce((acc, line) => acc + toNumber(line.amount), 0),
	);

	return (
		<div className="space-y-6">
			<PageHeader
				title="WHT Remittance Details"
				description={`Remittance #${remittance.remittanceNo} details`}
			/>
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Remittance Information</CardTitle>
				</CardHeader>
				<CardContent className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 md:gap-x-12">
					<MemberInfo
						label="Remittance No"
						value={remittance.remittanceNo.toString()}
					/>
					<MemberInfo
						label="Remittance Date"
						value={format(new Date(remittance.remittanceDate), "dd/MM/yyyy")}
					/>
					<MemberInfo
						label="Reference"
						value={remittance.reference?.toUpperCase() ?? "-"}
					/>
					<MemberInfo
						label="Created On"
						value={format(new Date(remittance.createdAt), "dd/MM/yyyy")}
					/>
					<MemberInfo
						label="Bank"
						value={
							remittance.bank?.bankName
								? toTitleCase(remittance.bank.bankName)
								: "-"
						}
					/>
					<MemberInfo
						label="Amount Remitted"
						value={currencyFormatter(totalRemitted)}
					/>
					<MemberInfo
						label="Bills Covered"
						value={remittance.lines.length.toString()}
					/>
				</CardContent>
			</Card>
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Bills Covered</CardTitle>
					<CardDescription>
						Each bill whose withheld tax this remittance paid over to KRA
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									{LINE_COLUMNS.map((column, index) => (
										<TableHead
											key={column}
											className={index >= 4 && index <= 6 ? "text-right" : ""}
										>
											{column}
										</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{remittance.lines.map((line) => (
									<TableRow key={line.id}>
										<TableCell>{toTitleCase(line.bill.vendor.name)}</TableCell>
										<TableCell>
											{line.bill.vendor.taxPin?.toUpperCase() ?? "-"}
										</TableCell>
										<TableCell>{line.bill.invoiceNo}</TableCell>
										<TableCell>
											{format(new Date(line.bill.invoiceDate), "dd/MM/yyyy")}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{currencyFormatter(line.bill.whtAmount, false)}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{currencyFormatter(line.currentBalance, false)}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{currencyFormatter(line.amount, false)}
										</TableCell>
										<TableCell>
											{line.bill.whtCertificateNo?.toUpperCase() ?? "-"}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
							<TableFooter>
								<TableRow>
									<TableCell colSpan={6} className="text-right font-bold">
										Total Remitted
									</TableCell>
									<TableCell className="text-right font-bold tabular-nums">
										{currencyFormatter(totalRemitted, false)}
									</TableCell>
									<TableCell />
								</TableRow>
							</TableFooter>
						</Table>
					</div>
				</CardContent>
			</Card>
			<Card className="shadow-none">
				<CardHeader className="pb-0">
					<CardTitle>Notes</CardTitle>
					<CardDescription>
						{toTitleCase(remittance.memo || "-")}
					</CardDescription>
				</CardHeader>
			</Card>
		</div>
	);
}

export function RemittanceDetailsSkeleton() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="WHT Remittance Details"
				description="Loading remittance details..."
			/>
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Remittance Information</CardTitle>
				</CardHeader>
				<CardContent className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 md:gap-x-12">
					{Array.from({ length: 7 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
							key={i}
							className="space-y-2"
						>
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-32" />
						</div>
					))}
				</CardContent>
			</Card>
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Bills Covered</CardTitle>
					<CardDescription>
						Each bill whose withheld tax this remittance paid over to KRA
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{Array.from({ length: 4 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
						<Skeleton key={i} className="h-10 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}
