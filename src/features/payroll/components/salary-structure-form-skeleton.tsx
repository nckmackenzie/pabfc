import { Skeleton } from "@/components/ui/skeleton";

const topFields = ["employee", "effective-from", "effective-to", "pay-frequency"];

const earningsFields = [
	"basic-salary",
	"house-allowance",
	"transport-allowance",
	"commuter-allowance",
	"meal-allowance",
	"airtime-allowance",
	"other-allowances",
];

const reliefFields = [
	"pension-employee",
	"pension-employer",
	"mortgage-interest",
	"post-retirement-medical",
	"insurance-premiums",
	"pension-fund-name",
];

const workingFields = [
	"has-helb-loan",
	"helb-deduction",
	"normal-hours",
	"normal-days",
	"overtime-divisor",
];

export function SalaryStructureFormPendingComponent() {
	return (
		<div className="bg-card space-y-6 rounded-md border p-6">
			<div className="space-y-2">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-4 w-[min(100%,36rem)]" />
			</div>

			<div className="space-y-8">
				<div className="grid gap-4 md:grid-cols-3">
					{topFields.map((fieldName) => (
						<div key={fieldName} className="space-y-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-10 w-full" />
						</div>
					))}
				</div>

				<section className="space-y-4">
					<div className="space-y-2">
						<Skeleton className="h-5 w-28" />
						<Skeleton className="h-4 w-[min(100%,42rem)]" />
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						{earningsFields.map((fieldName) => (
							<div key={fieldName} className="space-y-2">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-10 w-full" />
							</div>
						))}
					</div>
					<div className="space-y-2">
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-24 w-full" />
					</div>
				</section>

				<section className="space-y-4">
					<div className="space-y-2">
						<Skeleton className="h-5 w-40" />
						<Skeleton className="h-4 w-[min(100%,44rem)]" />
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						{reliefFields.map((fieldName) => (
							<div key={fieldName} className="space-y-2">
								<Skeleton className="h-4 w-36" />
								<Skeleton className="h-10 w-full" />
							</div>
						))}
					</div>
				</section>

				<section className="space-y-4">
					<div className="space-y-2">
						<Skeleton className="h-5 w-52" />
						<Skeleton className="h-4 w-[min(100%,46rem)]" />
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						{workingFields.map((fieldName) => (
							<div key={fieldName} className="space-y-2">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-10 w-full" />
							</div>
						))}
					</div>
				</section>

				<div className="space-y-2">
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-28 w-full" />
				</div>

				<div className="flex justify-end">
					<Skeleton className="h-10 w-48" />
				</div>
			</div>
		</div>
	);
}
