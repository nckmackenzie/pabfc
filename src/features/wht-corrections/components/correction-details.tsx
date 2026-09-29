import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { getCorrection } from "@/features/wht-corrections/services/wht-corrections.api";
import { currencyFormatter, roundDecimal, toNumber } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

const LINE_COLUMNS = ["Vendor", "Bill #", "Bill Date", "Rate %", "Amount"];

const STATUS_LABEL = {
	already_remitted: "Already remitted to KRA",
	pending: "Not yet remitted",
} as const;

export function CorrectionDetails({
	correction,
}: {
	correction: Awaited<ReturnType<typeof getCorrection>>;
}) {
	const total = roundDecimal(
		correction.lines.reduce((acc, line) => acc + toNumber(line.amount), 0)
	);

	return (
		<div className="space-y-6">
			<PageHeader
				title="WHT Correction Details"
				description={`Correction #${correction.correctionNo} details`}
			/>
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Correction Information</CardTitle>
				</CardHeader>
				<CardContent className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 md:gap-x-12">
					<MemberInfo label="Correction No" value={correction.correctionNo.toString()} />
					<MemberInfo
						label="Correction Date"
						value={format(new Date(correction.correctionDate), "dd/MM/yyyy")}
					/>
					<MemberInfo label="Status" value={STATUS_LABEL[correction.remittanceStatus]} />
					{correction.remittanceStatus === "already_remitted" && (
						<>
							<MemberInfo
								label="Remittance Date"
								value={
									correction.remittanceDate
										? format(new Date(correction.remittanceDate), "dd/MM/yyyy")
										: "-"
								}
							/>
							<MemberInfo
								label="Bank"
								value={
									correction.bank?.bankName
										? toTitleCase(correction.bank.bankName)
										: "Cash / Mobile money"
								}
							/>
						</>
					)}
					<MemberInfo label="Amount" value={currencyFormatter(total)} />
					<MemberInfo label="Bills Covered" value={correction.lines.length.toString()} />
				</CardContent>
			</Card>
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Bills Covered</CardTitle>
					<CardDescription>Each bill this correction retroactively adjusts</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									{LINE_COLUMNS.map((column, index) => (
										<TableHead key={column} className={index >= 3 ? "text-right" : ""}>
											{column}
										</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{correction.lines.map((line) => (
									<TableRow key={line.id}>
										<TableCell>{toTitleCase(line.bill.vendor.name)}</TableCell>
										<TableCell>{line.bill.invoiceNo}</TableCell>
										<TableCell>{format(new Date(line.bill.invoiceDate), "dd/MM/yyyy")}</TableCell>
										<TableCell className="text-right tabular-nums">{line.whtRate}</TableCell>
										<TableCell className="text-right tabular-nums">
											{currencyFormatter(line.amount, false)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
							<TableFooter>
								<TableRow>
									<TableCell colSpan={4} className="text-right font-bold">
										Total
									</TableCell>
									<TableCell className="text-right font-bold tabular-nums">
										{currencyFormatter(total, false)}
									</TableCell>
								</TableRow>
							</TableFooter>
						</Table>
					</div>
				</CardContent>
			</Card>
			<Card className="shadow-none">
				<CardHeader className="pb-0">
					<CardTitle>Notes</CardTitle>
					<CardDescription>{toTitleCase(correction.memo || "-")}</CardDescription>
				</CardHeader>
			</Card>
		</div>
	);
}

export function CorrectionDetailsSkeleton() {
	return (
		<div className="space-y-6">
			<PageHeader title="WHT Correction Details" description="Loading correction details..." />
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Correction Information</CardTitle>
				</CardHeader>
				<CardContent className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 md:gap-x-12">
					{Array.from({ length: 6 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
						<div key={i} className="space-y-2">
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-32" />
						</div>
					))}
				</CardContent>
			</Card>
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Bills Covered</CardTitle>
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
