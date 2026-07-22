import { useQuery } from "@tanstack/react-query";
import { Clock11Icon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { TableSkeleton } from "@/components/ui/loaders";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { dashboardQueries } from "@/features/dashboard/services/queries";
import { dateFormat } from "@/lib/helpers";

export function ExpiredMembershipsSheet() {
	const {
		data: expiredMemberships,
		isError,
		isLoading,
	} = useQuery(dashboardQueries.expiredMemberships());

	if (isLoading) {
		return (
			<div className="p-4">
				<TableSkeleton rowCount={5} columnWidths={["w-36", "w-28", "w-24"]} />
			</div>
		);
	}

	if (isError) {
		return (
			<EmptyState
				icon={<Clock11Icon />}
				title="Unable to load expired memberships"
				description="Close the sheet and try again."
			/>
		);
	}

	if (!expiredMemberships?.length) {
		return (
			<EmptyState
				icon={<Clock11Icon />}
				title="No expired memberships"
				description="No memberships expired in the last 30 days."
			/>
		);
	}

	return (
		<div className="p-4">
			<div className="overflow-hidden rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Member</TableHead>
							<TableHead>Previous plan</TableHead>
							<TableHead>Expired on</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{expiredMemberships.map((membership) => (
							<TableRow key={membership.id}>
								<TableCell className="font-medium capitalize">
									{membership.memberName}
								</TableCell>
								<TableCell className="capitalize">
									{membership.planName}
								</TableCell>
								<TableCell>
									{membership.endDate
										? dateFormat(membership.endDate, "long")
										: "—"}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
