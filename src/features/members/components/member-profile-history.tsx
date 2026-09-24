import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { isToday } from "date-fns";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, DollarSignIcon } from "@/components/ui/icons";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { memberQueries } from "@/features/members/services/queries";
import { PaymentStatusBadge } from "@/features/receipts/components/payment-status-badge";
import { currencyFormatter, dateFormat, formatMinutesDuration } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

export function MemberPaymentHistory({ memberId }: { memberId: string }) {
	const { data, isLoading, isError } = useQuery(memberQueries.paymentHistory(memberId));

	return (
		<HistorySection title="Payment History">
			{isLoading ? (
				<HistorySkeleton />
			) : isError ? (
				<HistoryMessage
					icon={<DollarSignIcon className="size-12" />}
					message="Unable to load payment history."
				/>
			) : !data?.length ? (
				<HistoryMessage
					icon={<DollarSignIcon className="size-12" />}
					message="No payment history found."
				/>
			) : (
				<ul className="divide-y">
					{data.map((payment) => (
						<li
							key={`${payment.type}-${payment.id}`}
							className="flex items-center justify-between gap-4 py-2"
						>
							<div className="grid gap-0.5">
								<div className="flex items-center gap-2 text-sm font-medium">
									<PaymentNumber payment={payment} />
									{payment.type === "addon" ? (
										<Badge variant="secondary">Addon only</Badge>
									) : (
										<span className="text-muted-foreground font-normal">
											{toTitleCase(payment.plan ?? "")}
										</span>
									)}
								</div>
								<span className="text-xs text-muted-foreground">
									{dateFormat(payment.paymentDate, "long")}
								</span>
							</div>
							<div className="flex flex-col items-end gap-1">
								<span className="text-sm font-medium">{currencyFormatter(payment.amount)}</span>
								<PaymentStatusBadge status={payment.status} />
							</div>
						</li>
					))}
				</ul>
			)}
		</HistorySection>
	);
}

function PaymentNumber({
	payment,
}: {
	payment: { id: string; type: "membership" | "addon"; paymentNo: string };
}) {
	return (
		<PermissionGate
			permission="receipts:view"
			fallback={<span>#{payment.paymentNo}</span>}
			loadingComponent={<span>#{payment.paymentNo}</span>}
		>
			{payment.type === "addon" ? (
				<Link
					to="/app/receipts/addons/$addonInvoiceId/details"
					params={{ addonInvoiceId: payment.id }}
					className="text-primary hover:underline"
				>
					#{payment.paymentNo}
				</Link>
			) : (
				<Link
					to="/app/receipts/$receiptId/details"
					params={{ receiptId: payment.id }}
					className="text-primary hover:underline"
				>
					#{payment.paymentNo}
				</Link>
			)}
		</PermissionGate>
	);
}

export function MemberAttendanceHistory({ memberId }: { memberId: string }) {
	const { data, isLoading, isError } = useQuery(memberQueries.attendanceHistory(memberId));

	return (
		<HistorySection title="Attendance History">
			{isLoading ? (
				<HistorySkeleton />
			) : isError ? (
				<HistoryMessage
					icon={<CalendarIcon className="size-12" />}
					message="Unable to load attendance history."
				/>
			) : !data?.length ? (
				<HistoryMessage
					icon={<CalendarIcon className="size-12" />}
					message="No attendance history found."
				/>
			) : (
				<ul className="divide-y">
					{data.map((attendance) => (
						<li key={attendance.id} className="flex items-center justify-between gap-4 py-2">
							<div className="grid gap-0.5">
								<span className="text-sm font-medium">
									{dateFormat(attendance.checkInTime, "long")}
								</span>
								<span className="text-xs text-muted-foreground">
									In {formatTime(attendance.checkInTime)}
									{attendance.checkOutTime ? ` • Out ${formatTime(attendance.checkOutTime)}` : ""}
								</span>
							</div>
							{attendance.duration === null ? (
								isToday(attendance.checkInTime) ? (
									<Badge variant="info">In session</Badge>
								) : (
									<Badge variant="secondary">No check-out</Badge>
								)
							) : (
								<Badge variant="outline">{formatMinutesDuration(attendance.duration)}</Badge>
							)}
						</li>
					))}
				</ul>
			)}
		</HistorySection>
	);
}

function formatTime(value: Date | string) {
	return new Date(value).toLocaleTimeString("en-KE", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function HistorySection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="rounded-md border border-gray-200 p-4 self-start">
			<h2 className="text-base font-bold font-display mb-2">{title}</h2>
			{children}
		</div>
	);
}

function HistoryMessage({ icon, message }: { icon: ReactNode; message: string }) {
	return (
		<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
			{icon}
			<p className="text-sm mt-2">{message}</p>
		</div>
	);
}

function HistorySkeleton() {
	return (
		<div className="space-y-3 py-2">
			{Array.from({ length: 3 }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
				<Skeleton key={i} className="h-10 w-full" />
			))}
		</div>
	);
}
