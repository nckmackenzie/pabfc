import { Skeleton } from "@/components/ui/skeleton";
import { Wrapper } from "@/components/ui/wrapper";

const personalInfoSkeletonFields = [
	"first-name",
	"last-name",
	"gender",
	"date-of-birth",
	"status",
	"employee-no",
];

const employeeTabs = ["contact", "identification", "employment", "payment"];

const contactInfoSkeletonFields = [
	"phone-number",
	"email-address",
	"emergency-contact",
	"next-of-kin",
];

export function EmployeeFormPendingComponent() {
	return (
		<div className="space-y-6">
			<Skeleton className="h-5 w-36" />
			<Wrapper size="full">
				<div className="space-y-6">
					<div className="space-y-2">
						<Skeleton className="h-8 w-56" />
						<Skeleton className="h-4 w-80 max-w-full" />
					</div>

					<div className="bg-card max-w-3xl space-y-6 rounded-md border p-6">
						<div className="space-y-4">
							<Skeleton className="h-5 w-32" />
							<div className="grid max-w-xl grid-cols-1 gap-4 md:grid-cols-2">
								{personalInfoSkeletonFields.map((fieldName) => (
									<div key={fieldName} className="space-y-2">
										<Skeleton className="h-4 w-28" />
										<Skeleton className="h-10 w-full" />
									</div>
								))}
							</div>
						</div>

						<div className="overflow-hidden rounded-md border">
							<div className="bg-muted/30 flex w-full gap-2 border-b p-2">
								{employeeTabs.map((tabName) => (
									<Skeleton
										key={tabName}
										className="h-10 flex-1 rounded-md"
									/>
								))}
							</div>
							<div className="p-4">
								<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
									{contactInfoSkeletonFields.map((fieldName) => (
										<div key={fieldName} className="space-y-2">
											<Skeleton className="h-4 w-32" />
											<Skeleton className="h-10 w-full" />
										</div>
									))}
								</div>
							</div>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
							<Skeleton className="h-10 w-28" />
							<Skeleton className="h-10 w-40" />
						</div>
					</div>
				</div>
			</Wrapper>
		</div>
	);
}
