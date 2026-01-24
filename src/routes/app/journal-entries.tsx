import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { SearchIcon } from "@/components/ui/icons";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { ToastContent } from "@/components/ui/toast-content";
import { accountQueries } from "@/features/coa/services/queries";
import { JournalLoadingSkeleton } from "@/features/journal-entries/components/form-skeleton";
import { JournalEntryForm } from "@/features/journal-entries/components/journal-form";
import { journalQueries } from "@/features/journal-entries/services/queries";
import { journalEntryValidateSearch } from "@/features/journal-entries/services/schemas";
import { useFilters } from "@/hooks/use-filters";
import { toTitleCase } from "@/lib/utils";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/journal-entries")({
	beforeLoad: async () => {
		await requirePermission("journal-entries:create")
	},
	component: RouteComponent,
	validateSearch: journalEntryValidateSearch,
	head: () => ({
		meta: [{ title: "Journal Entries / Prime Age Beauty & Fitness Center" }],
	}),
	loaderDeps: ({ search: { journalNo } }) => ({ journalNo }),
	pendingComponent: JournalLoadingSkeleton,
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} />
	),
	loader: async ({
		context: { queryClient },
		deps: { journalNo: queryJournalNo },
	}) => {
		const [accounts, journalNo, journalEntry] = await Promise.all([
			queryClient.ensureQueryData(accountQueries.list({})),
			queryClient.ensureQueryData(journalQueries.journalNo()),
			queryJournalNo
				? queryClient.ensureQueryData(journalQueries.journal(queryJournalNo))
				: null,
		]);

		if (queryJournalNo && !journalEntry) {
			throw new Error("Journal entry not found");
		}

		const activeAccounts = accounts
			.filter((acc) => acc.isActive)
			.map(({ id, name }) => ({
				label: toTitleCase(name),
				value: id.toString(),
			}));
		return { activeAccounts, journalNo, journalEntry };
	},
});

function RouteComponent() {
	const { journalEntry: loaderJournalEntry } = Route.useLoaderData();
	const { journalNo } = Route.useSearch();
	const { data: journal } = useQuery({
		...journalQueries.journal(journalNo ?? 0),
		enabled: !!journalNo,
	});

	const journalEntry = journal || loaderJournalEntry;

	return (
		<ProtectedPageWithWrapper permissions={["journal-entries:create"]}>
			<JournalEntryForm
				journal={
					journalEntry
						? {
								id: journalEntry.id.toString(),
								date: journalEntry.entryDate,
								journalNo: journalEntry.journalNo as number,
								journalLines: journalEntry.lines.map((line) => ({
									id: line.id.toString(),
									accountId: line.accountId.toString(),
									debit: line.dc === "debit" ? +line.amount : 0,
									credit: line.dc === "credit" ? +line.amount : 0,
									description: line.memo?.toUpperCase(),
								})),
							}
						: undefined
				}
			/>
		</ProtectedPageWithWrapper>
	);
}

export function SearchForm() {
	const { filters, setFilters, resetFilters } = useFilters(Route.id);
	const [searchValue, setSearchValue] = useState(filters.journalNo?.toString());
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!searchValue) return;
		if (Number.isNaN(Number(searchValue))) {
			toast.error((t) => (
				<ToastContent t={t} message="Invalid journal number" title="Invalid" />
			));
			return;
		}
		setFilters({ journalNo: Number(searchValue) });
	};
	return (
		<form className="flex items-center gap-2" onSubmit={handleSubmit}>
			<div className="relative ">
				<label htmlFor="search" className="sr-only">
					Search
				</label>
				<input
					className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-none transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive pl-10"
					value={searchValue}
					onChange={(e) => {
						const value = e.target.value;
						if (Number.isNaN(Number(value))) {
							return;
						}
						if (!value) {
							resetFilters();
							setSearchValue(undefined);
						}
						setSearchValue(value);
					}}
					placeholder="Search by journal number"
					type="search"
				/>
				<SearchIcon className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
			</div>
			<Button type="submit">Search</Button>
		</form>
	);
}
