import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
	ActivityIcon,
	AlertTriangleIcon,
	CheckCircle2Icon,
	Clock3Icon,
	RefreshCcwIcon,
	RotateCcwIcon,
	ShieldAlertIcon,
	ShieldCheckIcon,
	WifiIcon,
	WifiOffIcon,
	XCircleIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useDebounceCallback } from "usehooks-ts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DataTable } from "@/components/ui/datatable";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { EmptyState } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastContent } from "@/components/ui/toast-content";
import { KPICard } from "@/features/dashboard/components/stat-cards";
import {
	type AccessControlDashboardFilters,
	type AccessControlDashboardJobStatusFilter,
	accessControlDashboardJobStatusFilters,
	cancelAccessControlJob,
	type getAccessControlDashboard,
	retryAccessControlJob,
} from "@/features/dashboard/services/access-control.api";
import { dashboardQueries } from "@/features/dashboard/services/queries";
import { parseErrorMessage } from "@/lib/error-handling/error-handling";
import { cn } from "@/lib/utils";

type AccessControlDashboardData = Awaited<
	ReturnType<typeof getAccessControlDashboard>
>;
type AccessControlJob = AccessControlDashboardData["recentJobs"][number];
type AccessControlAttempt =
	AccessControlDashboardData["recentAttempts"][number];
type MemberSyncIssue = AccessControlDashboardData["membersWithIssues"][number];

interface AccessControlDashboardProps {
	filters: {
		syncJobStatus?: AccessControlDashboardJobStatusFilter;
		syncJobSearch?: string;
	};
	setFilters: (
		filters: Partial<{
			syncJobStatus?: AccessControlDashboardJobStatusFilter;
			syncJobSearch?: string;
		}>,
	) => void;
}

export function AccessControlDashboard({
	filters,
	setFilters,
}: AccessControlDashboardProps) {
	const queryClient = useQueryClient();
	const [localSearch, setLocalSearch] = useState(filters.syncJobSearch ?? "");

	useEffect(() => {
		setLocalSearch(filters.syncJobSearch ?? "");
	}, [filters.syncJobSearch]);

	const updateSearchFilter = useDebounceCallback((term: string) => {
		setFilters({
			syncJobSearch: term.trim().length > 0 ? term : undefined,
		});
	}, 500);

	const queryFilters: AccessControlDashboardFilters = {
		status: filters.syncJobStatus ?? "all",
		action: "all",
		q: filters.syncJobSearch?.trim() || undefined,
	};
	const { data, isRefetching, refetch } = useSuspenseQuery(
		dashboardQueries.accessControl(queryFilters),
	);

	const retryMutation = useMutation({
		mutationFn: async (jobId: string) => {
			return retryAccessControlJob({ data: { jobId } });
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: [...dashboardQueries.all, "access-control"],
			});
			toast.success((t) => (
				<ToastContent
					t={t}
					title="Job queued"
					message="The failed sync job was reset and returned to pending."
				/>
			));
		},
		onError: (error) => {
			const parsed = parseMutationError(error, "Failed to retry sync job");
			toast.error((t) => (
				<ToastContent t={t} title={parsed.title} message={parsed.message} />
			));
		},
	});

	const cancelMutation = useMutation({
		mutationFn: async (jobId: string) => {
			return cancelAccessControlJob({ data: { jobId } });
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: [...dashboardQueries.all, "access-control"],
			});
			toast.success((t) => (
				<ToastContent
					t={t}
					title="Job cancelled"
					message="The sync job was marked as cancelled."
				/>
			));
		},
		onError: (error) => {
			const parsed = parseMutationError(error, "Failed to cancel sync job");
			toast.error((t) => (
				<ToastContent t={t} title={parsed.title} message={parsed.message} />
			));
		},
	});

	const jobsColumns: Array<ColumnDef<AccessControlJob>> = [
		{
			id: "createdAt",
			accessorFn: (row) => new Date(row.createdAt).getTime(),
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Created" />
			),
			cell: ({ row }) => <TimestampCell date={row.original.createdAt} />,
		},
		{
			id: "member",
			accessorFn: (row) => row.memberName,
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Member" />
			),
			cell: ({ row }) => (
				<div className="min-w-[200px]">
					<div className="font-medium">{row.original.memberName}</div>
					<div className="text-xs text-muted-foreground">
						#{row.original.memberNo}
					</div>
				</div>
			),
		},
		{
			accessorKey: "action",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Action" />
			),
			cell: ({ row }) => <ActionBadge action={row.original.action} />,
		},
		{
			accessorKey: "status",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Status" />
			),
			cell: ({ row }) => <StatusBadge status={row.original.status} />,
		},
		{
			id: "completedAt",
			accessorFn: (row) =>
				row.completedAt ? new Date(row.completedAt).getTime() : 0,
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Completed" />
			),
			cell: ({ row }) =>
				row.original.completedAt ? (
					<TimestampCell date={row.original.completedAt} />
				) : (
					<span className="text-muted-foreground">-</span>
				),
		},
	];

	const issueColumns: Array<ColumnDef<MemberSyncIssue>> = [
		{
			accessorKey: "memberNo",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Member No" />
			),
		},
		{
			id: "memberName",
			accessorFn: (row) => row.memberName,
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Name" />
			),
			cell: ({ row }) => (
				<div>
					<div className="font-medium">{row.original.memberName}</div>
					<div className="text-xs text-muted-foreground">
						{row.original.biotimeEmployeeCode || "No employee code"}
					</div>
				</div>
			),
		},
		{
			accessorKey: "biotimeEmployeeId",
			header: "BioTime ID",
			cell: ({ row }) => row.original.biotimeEmployeeId ?? "-",
		},
		{
			accessorKey: "desiredAccessEnabled",
			header: "Desired access",
			cell: ({ row }) => (
				<Badge
					variant={row.original.desiredAccessEnabled ? "success" : "secondary"}
				>
					{row.original.desiredAccessEnabled ? "Enabled" : "Disabled"}
				</Badge>
			),
		},
		{
			accessorKey: "currentAreaId",
			header: "Current area",
			cell: ({ row }) => row.original.currentAreaId ?? "-",
		},
		{
			accessorKey: "accessControlStatus",
			header: "Sync status",
			cell: ({ row }) => (
				<StatusBadge status={row.original.accessControlStatus} />
			),
		},
		{
			accessorKey: "biometricEnrollmentStatus",
			header: "Biometric",
			cell: ({ row }) => (
				<Badge variant="outline">
					{humanizeEnumLabel(row.original.biometricEnrollmentStatus)}
				</Badge>
			),
		},
		{
			id: "lastSyncAttemptAt",
			accessorFn: (row) =>
				row.lastSyncAttemptAt ? new Date(row.lastSyncAttemptAt).getTime() : 0,
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Last attempt" />
			),
			cell: ({ row }) =>
				row.original.lastSyncAttemptAt ? (
					<TimestampCell date={row.original.lastSyncAttemptAt} />
				) : (
					<span className="text-muted-foreground">Never</span>
				),
		},
		{
			accessorKey: "lastSyncError",
			header: "Last error",
			cell: ({ row }) => (
				<div className="max-w-[320px] text-sm text-muted-foreground">
					{row.original.lastSyncError ? (
						<span className="line-clamp-2">{row.original.lastSyncError}</span>
					) : (
						<span className="text-muted-foreground/70">No error recorded</span>
					)}
				</div>
			),
		},
	];

	const agentHealth = resolveAgentHealth(data.agent);
	return (
		<div className="space-y-6 pb-6">
			<div className="flex items-center justify-end">
				<Button
					variant="outline"
					size="sm"
					onClick={() => refetch()}
					disabled={isRefetching}
				>
					<RefreshCcwIcon
						className={cn("size-4", {
							"animate-spin": isRefetching,
						})}
					/>
					Refresh dashboard
				</Button>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<KPICard
					title="Pending Jobs"
					value={data.kpis.pendingJobsCount}
					subtitle={`${data.kpis.processingJobsCount} currently processing`}
					icon={ActivityIcon}
					variant="default"
				/>
				<KPICard
					title="Failed Jobs"
					value={data.kpis.failedJobsCount}
					subtitle="Needs manual review or retry"
					icon={XCircleIcon}
					variant="destructive"
				/>
				<KPICard
					title="Successful Today"
					value={data.kpis.successfulJobsTodayCount}
					subtitle="Completed since midnight"
					icon={CheckCircle2Icon}
					variant="success"
					className="from-emerald-500/14 to-emerald-500/5 border-emerald-500/30"
				/>
				<KPICard
					title="Members Pending Sync"
					value={data.kpis.membersPendingSyncCount}
					subtitle="Profiles waiting to be reconciled"
					icon={ShieldAlertIcon}
					variant="default"
				/>
			</div>

			<div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
				<AgentStatusPanel agent={data.agent} health={agentHealth} />
				<RecentSuccessfulJobsCard jobs={data.recentSuccessfulJobs} />
			</div>

			<Card>
				<CardHeader className="gap-4">
					<div>
						<CardTitle>Sync Jobs</CardTitle>
						<CardDescription>
							Review the latest BioTime sync queue activity and take manual
							action on pending or failed jobs.
						</CardDescription>
					</div>
					<div className="grid max-w-lg gap-3 sm:grid-cols-2">
						<Input
							value={localSearch}
							onChange={(event) => {
								const value = event.target.value;
								setLocalSearch(value);
								updateSearchFilter(value);
							}}
							placeholder="Search member name"
							className="w-full"
						/>
						<Select
							value={filters.syncJobStatus ?? "all"}
							onValueChange={(value) =>
								setFilters({
									syncJobStatus: value as AccessControlDashboardJobStatusFilter,
								})
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								{accessControlDashboardJobStatusFilters.map((status) => (
									<SelectItem key={status} value={status}>
										{humanizeEnumLabel(status)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardHeader>
				<CardContent>
					{data.recentJobs.length > 0 ? (
						<DataTable
							data={data.recentJobs}
							columns={jobsColumns}
							exportToExcel
							exportFileName="access-control-sync-jobs.csv"
						/>
					) : (
						<EmptyState
							title="No sync jobs found"
							description="Try a different status or search term to find matching BioTime sync jobs."
							icon={<ActivityIcon />}
						/>
					)}
				</CardContent>
			</Card>

			<div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
				<FailedJobsCard
					jobs={data.failedJobs}
					onRetry={(jobId) => retryMutation.mutate(jobId)}
					onCancel={(jobId) => cancelMutation.mutate(jobId)}
					retryingJobId={
						retryMutation.isPending ? retryMutation.variables : undefined
					}
					cancellingJobId={
						cancelMutation.isPending ? cancelMutation.variables : undefined
					}
				/>
				<RecentAttemptsCard attempts={data.recentAttempts} />
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Members With Sync Issues</CardTitle>
					<CardDescription>
						Includes members in <span className="font-medium">sync_failed</span>
						, members stuck in <span className="font-medium">pending_sync</span>{" "}
						for more than {data.pendingSyncIssueThresholdMinutes} minutes, and
						profiles with a recorded sync error.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{data.membersWithIssues.length > 0 ? (
						<DataTable
							data={data.membersWithIssues}
							columns={issueColumns}
							exportToExcel
							exportFileName="access-control-sync-issues.csv"
						/>
					) : (
						<EmptyState
							title="No member sync issues"
							description="All visible member access profiles look healthy right now."
							icon={<ShieldCheckIcon />}
						/>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function AgentStatusPanel({
	agent,
	health,
}: {
	agent: AccessControlDashboardData["agent"];
	health: ReturnType<typeof resolveAgentHealth>;
}) {
	if (!agent) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Local Desktop Agent</CardTitle>
					<CardDescription>
						The dashboard will start showing heartbeat and machine details once
						a sync agent registers.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<EmptyState
						title="No agent heartbeat yet"
						description="No local BioTime desktop sync agent has reported into the server."
						icon={<WifiOffIcon />}
					/>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Local Desktop Agent</CardTitle>
				<CardDescription>
					Current heartbeat state for the desktop sync process.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap items-center gap-3">
					<Badge variant={health.badgeVariant}>{health.label}</Badge>
					<Badge variant={agent.isActive ? "success" : "secondary"}>
						{agent.isActive ? "Active" : "Inactive"}
					</Badge>
					{agent.lastError ? (
						<Badge variant="danger">Last heartbeat has an error</Badge>
					) : null}
				</div>
				<div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
					<DetailItem label="Name" value={agent.name} />
					<DetailItem
						label="Machine name"
						value={agent.machineName || "Unknown"}
					/>
					<DetailItem label="Status" value={humanizeEnumLabel(agent.status)} />
					<DetailItem
						label="Last seen at"
						value={formatDateTime(agent.lastSeenAt)}
						meta={formatRelativeTime(agent.lastSeenAt)}
					/>
					<DetailItem
						label="Last IP address"
						value={agent.lastIpAddress || "Unknown"}
					/>
					<DetailItem
						label="Created"
						value={formatDateTime(agent.createdAt)}
						meta={formatRelativeTime(agent.createdAt)}
					/>
				</div>
				<div className="rounded-lg border border-dashed p-4">
					<div className="text-sm font-medium">Last error</div>
					<p className="mt-2 text-sm text-muted-foreground">
						{agent.lastError || "No recent agent error has been reported."}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

function RecentSuccessfulJobsCard({
	jobs,
}: {
	jobs: AccessControlDashboardData["recentSuccessfulJobs"];
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Recent Successful Jobs</CardTitle>
				<CardDescription>
					The latest BioTime sync jobs completed successfully.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{jobs.length === 0 ? (
					<EmptyState
						title="No recent success yet"
						description="Completed sync jobs will appear here after the agent processes them."
						icon={<CheckCircle2Icon />}
					/>
				) : (
					<div className="space-y-3">
						{jobs.map((job) => (
							<div
								key={job.id}
								className="flex items-start justify-between gap-4 rounded-lg border p-4"
							>
								<div className="space-y-1">
									<div className="font-medium">{job.memberName}</div>
									<div className="text-xs text-muted-foreground">
										#{job.memberNo}
										{job.biotimeEmployeeCode
											? ` • ${job.biotimeEmployeeCode}`
											: ""}
									</div>
									<div className="flex flex-wrap gap-2 pt-1">
										<ActionBadge action={job.action} />
										<Badge variant="success">Succeeded</Badge>
									</div>
								</div>
								<div className="text-right text-sm text-muted-foreground">
									<div>{formatRelativeTime(job.completedAt)}</div>
									<div className="text-xs">
										{formatDateTime(job.completedAt)}
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function FailedJobsCard({
	jobs,
	onRetry,
	onCancel,
	retryingJobId,
	cancellingJobId,
}: {
	jobs: AccessControlDashboardData["failedJobs"];
	onRetry: (jobId: string) => void;
	onCancel: (jobId: string) => void;
	retryingJobId?: string;
	cancellingJobId?: string;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Failed Jobs</CardTitle>
				<CardDescription>
					Failures are surfaced here first so admins can retry or cancel without
					digging through the full queue.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{jobs.length === 0 ? (
					<EmptyState
						title="No failed jobs"
						description="Nothing currently needs manual recovery."
						icon={<CheckCircle2Icon />}
					/>
				) : (
					<div className="space-y-3">
						{jobs.map((job) => {
							const isRetrying = retryingJobId === job.id;
							const isCancelling = cancellingJobId === job.id;

							return (
								<div key={job.id} className="rounded-lg border p-4">
									<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
										<div className="space-y-2">
											<div className="flex flex-wrap items-center gap-2">
												<div className="font-medium">{job.memberName}</div>
												<ActionBadge action={job.action} />
												<StatusBadge status={job.status} />
											</div>
											<div className="text-sm text-muted-foreground">
												Member #{job.memberNo}
												{job.biotimeEmployeeCode
													? ` • ${job.biotimeEmployeeCode}`
													: ""}
											</div>
											<div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
												<span>
													Attempts: {job.attempts} / {job.maxAttempts}
												</span>
												<span>Created: {formatDateTime(job.createdAt)}</span>
											</div>
											<p className="text-sm text-destructive">
												{job.lastError || "No failure reason recorded."}
											</p>
										</div>
										<div className="flex flex-wrap gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => onRetry(job.id)}
												disabled={isRetrying || isCancelling}
											>
												<RotateCcwIcon
													className={cn("size-4", {
														"animate-spin": isRetrying,
													})}
												/>
												Retry
											</Button>
											<Button
												variant="destructive"
												size="sm"
												onClick={() => onCancel(job.id)}
												disabled={isRetrying || isCancelling}
											>
												<XCircleIcon className="size-4" />
												Cancel
											</Button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function RecentAttemptsCard({
	attempts,
}: {
	attempts: AccessControlDashboardData["recentAttempts"];
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Recent Sync Attempts</CardTitle>
				<CardDescription>
					The last 20 agent execution attempts. Expand a row to inspect request
					and response payloads.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{attempts.length === 0 ? (
					<EmptyState
						title="No sync attempts"
						description="Attempt history will appear here after the agent processes queue items."
						icon={<ActivityIcon />}
					/>
				) : (
					<div className="space-y-3">
						{attempts.map((attempt) => (
							<AttemptListItem key={attempt.id} attempt={attempt} />
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function AttemptListItem({ attempt }: { attempt: AccessControlAttempt }) {
	const hasPayloadDetails =
		attempt.requestPayload !== null || attempt.responsePayload !== null;

	return (
		<Collapsible className="rounded-lg border">
			<div className="space-y-3 p-4">
				<div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
					<div className="space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<ActionBadge action={attempt.jobAction} />
							<Badge variant={attempt.success ? "success" : "danger"}>
								{attempt.success ? "Success" : "Failure"}
							</Badge>
						</div>
						<div className="font-medium">{attempt.memberName}</div>
						<div className="text-xs text-muted-foreground">
							Member #{attempt.memberNo}
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2 xl:justify-end">
						<div className="text-right text-sm text-muted-foreground">
							<div>{formatRelativeTime(attempt.createdAt)}</div>
							<div className="text-xs">{formatDateTime(attempt.createdAt)}</div>
						</div>
						{hasPayloadDetails ? (
							<CollapsibleTrigger asChild>
								<Button variant="outline" size="sm">
									View details
								</Button>
							</CollapsibleTrigger>
						) : null}
					</div>
				</div>
				<div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
					{attempt.success
						? "Attempt completed successfully."
						: attempt.errorMessage ||
							"Attempt failed without an error message."}
				</div>
				{hasPayloadDetails ? (
					<CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
						<div className="grid gap-3 border-t pt-3 xl:grid-cols-2">
							<JsonPanel
								title="Request payload"
								payload={attempt.requestPayload}
								emptyLabel="No request payload recorded."
							/>
							<JsonPanel
								title="Response payload"
								payload={attempt.responsePayload}
								emptyLabel="No response payload recorded."
							/>
						</div>
					</CollapsibleContent>
				) : null}
			</div>
		</Collapsible>
	);
}

function JsonPanel({
	title,
	payload,
	emptyLabel,
}: {
	title: string;
	payload: unknown;
	emptyLabel: string;
}) {
	return (
		<div className="space-y-2 rounded-lg border bg-muted/20 p-3">
			<div className="text-sm font-medium">{title}</div>
			{payload === null || payload === undefined ? (
				<p className="text-sm text-muted-foreground">{emptyLabel}</p>
			) : (
				<pre className="max-h-72 overflow-auto rounded-md bg-background p-3 text-xs">
					{safeJsonStringify(payload)}
				</pre>
			)}
		</div>
	);
}

function ActionBadge({ action }: { action: string }) {
	return <Badge variant="outline">{humanizeEnumLabel(action)}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
	const variant =
		status === "succeeded" || status === "active"
			? "success"
			: status === "pending" ||
					status === "processing" ||
					status === "pending_sync"
				? "warning"
				: status === "cancelled" || status === "disabled"
					? "secondary"
					: status === "sync_failed" || status === "failed"
						? "danger"
						: "outline";

	return <Badge variant={variant}>{humanizeEnumLabel(status)}</Badge>;
}

function TimestampCell({ date }: { date: Date | string | null }) {
	if (!date) {
		return <span className="text-muted-foreground">-</span>;
	}

	return (
		<div className="min-w-[148px]">
			<div className="text-sm">{formatDateTime(date)}</div>
			<div className="text-xs text-muted-foreground">
				{formatRelativeTime(date)}
			</div>
		</div>
	);
}

function DetailItem({
	label,
	value,
	meta,
}: {
	label: string;
	value: string | number;
	meta?: string;
}) {
	return (
		<div className="space-y-1">
			<div className="text-xs uppercase tracking-wide text-muted-foreground">
				{label}
			</div>
			<div className="font-medium">{value}</div>
			{meta ? (
				<div className="text-xs text-muted-foreground">{meta}</div>
			) : null}
		</div>
	);
}

function resolveAgentHealth(agent: AccessControlDashboardData["agent"]) {
	if (!agent) {
		return {
			label: "Offline",
			description: "No heartbeat received yet",
			badgeVariant: "secondary" as const,
			kpiVariant: "warning" as const,
			icon: WifiOffIcon,
		};
	}

	if (!agent.isActive) {
		return {
			label: "Offline",
			description: "Agent is marked inactive",
			badgeVariant: "secondary" as const,
			kpiVariant: "destructive" as const,
			icon: WifiOffIcon,
		};
	}

	if (agent.status === "error") {
		return {
			label: "Error",
			description: agent.lastError || "Agent reported an error state",
			badgeVariant: "danger" as const,
			kpiVariant: "destructive" as const,
			icon: AlertTriangleIcon,
		};
	}

	if (!agent.lastSeenAt) {
		return {
			label: "Offline",
			description: "No heartbeat timestamp recorded",
			badgeVariant: "danger" as const,
			kpiVariant: "destructive" as const,
			icon: WifiOffIcon,
		};
	}

	const ageInMs = Date.now() - new Date(agent.lastSeenAt).getTime();
	const twoMinutes = 2 * 60 * 1000;
	const fiveMinutes = 5 * 60 * 1000;

	if (agent.status === "online" && ageInMs <= twoMinutes) {
		return {
			label: "Online",
			description: "Heartbeat is healthy",
			badgeVariant: "success" as const,
			kpiVariant: "success" as const,
			icon: WifiIcon,
		};
	}

	if (agent.status === "online" && ageInMs <= fiveMinutes) {
		return {
			label: "Stale",
			description: "Heartbeat is older than 2 minutes",
			badgeVariant: "warning" as const,
			kpiVariant: "warning" as const,
			icon: Clock3Icon,
		};
	}

	return {
		label: "Offline",
		description: "No heartbeat received in over 5 minutes",
		badgeVariant: "danger" as const,
		kpiVariant: "destructive" as const,
		icon: WifiOffIcon,
	};
}

function formatDateTime(date: Date | string | null) {
	if (!date) {
		return "N/A";
	}

	return format(new Date(date), "dd MMM yyyy, HH:mm");
}

function formatRelativeTime(date: Date | string | null) {
	if (!date) {
		return "Never";
	}

	return formatDistanceToNowStrict(new Date(date), {
		addSuffix: true,
	});
}

function humanizeEnumLabel(value: string) {
	return value
		.toLowerCase()
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function safeJsonStringify(value: unknown) {
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return "Unable to render JSON payload";
	}
}

function parseMutationError(error: unknown, fallbackMessage: string) {
	if (error instanceof Error) {
		return parseErrorMessage(error);
	}

	return {
		title: "Error",
		message: fallbackMessage,
	};
}

export function AccessControlDashboardSkeleton() {
	return (
		<div className="space-y-6 pb-6">
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{[
					"pending-jobs",
					"failed-jobs",
					"successful-today",
					"members-pending-sync",
				].map((key) => (
					<div key={key} className="rounded-xl border p-5">
						<Skeleton className="h-4 w-28" />
						<Skeleton className="mt-3 h-8 w-24" />
						<Skeleton className="mt-2 h-3 w-40" />
					</div>
				))}
			</div>

			<div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
				<Skeleton className="h-[320px] rounded-xl" />
				<Skeleton className="h-[320px] rounded-xl" />
			</div>

			<Skeleton className="h-[420px] rounded-xl" />

			<div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
				<Skeleton className="h-[340px] rounded-xl" />
				<Skeleton className="h-[340px] rounded-xl" />
			</div>

			<Skeleton className="h-[360px] rounded-xl" />
		</div>
	);
}
