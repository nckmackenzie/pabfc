import { useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Field, FieldGroup } from "@/components/ui/field";
import {
	CheckIcon,
	MinusIcon,
	PlusIcon,
	TrashIcon,
} from "@/components/ui/icons";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { PageHeader } from "@/components/ui/page-header";
import { PermissionGate } from "@/components/ui/permission-gate";
import { SelectItem } from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	deleteJournalEntry,
	upsertJournalEntries,
} from "@/features/journal-entries/services/journal-entry.api";
import { journalQueries } from "@/features/journal-entries/services/queries";
import {
	type JournalEntry,
	journalEntrySchema,
} from "@/features/journal-entries/services/schemas";
import { useFilters } from "@/hooks/use-filters";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useAppForm } from "@/lib/form";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { SearchForm } from "@/routes/app/journal-entries";

export function JournalEntryForm({ journal }: { journal?: JournalEntry }) {
	const route = getRouteApi("/app/journal-entries");
	const queryClient = useQueryClient();
	const { resetFilters } = useFilters(route.id);
	const { activeAccounts, journalNo: loaderJournalNo } = route.useLoaderData();
	const { data: freshJournalNo } = useQuery(journalQueries.journalNo());
	const journalNo = freshJournalNo ?? loaderJournalNo;

	const { mutate, isPending } = useFormUpsert({
		upsertFn: (data: JournalEntry) => upsertJournalEntries({ data }),
		entityName: "Journal entry",
		queryKey: ["journal-no"],
	});

	const form = useAppForm({
		defaultValues:
			journal ??
			({
				journalLines: [],
				date: dateFormat(new Date(), "regular"),
				journalNo,
			} as JournalEntry),
		validators: {
			onSubmit: journalEntrySchema,
		},
		onSubmit: ({ value }) => {
			mutate(
				{ ...value, id: journal?.id },
				{
					onSuccess: () => {
						resetFilters();
						form.reset();
						if (journal) {
							queryClient.invalidateQueries({
								queryKey: ["journal", journal.journalNo],
							});
						}
					},
				},
			);
		},
	});
	const [journalLines] = useStore(form.store, (state) => [
		state.values.journalLines,
	]);
	const { totalDebits, totalCredits } = journalLines.reduce(
		(acc, line) => {
			acc.totalDebits += line.debit || 0;
			acc.totalCredits += line.credit || 0;
			return acc;
		},
		{ totalDebits: 0, totalCredits: 0 },
	);

	async function handleDelete(journalId: string) {
		const res = await deleteJournalEntry({ data: journalId });
		form.reset();
		resetFilters();
		queryClient.invalidateQueries({ queryKey: ["journal-no"] });
		queryClient.invalidateQueries({
			queryKey: ["journal", journal?.journalNo],
		});
		return res;
	}

	return (
		<div className="space-y-6">
			<PageHeader
				title="Journal Entry"
				description="Create a new journal entry"
				content={<SearchForm />}
			/>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
				className="space-y-4"
			>
				<FieldGroup className="grid md:grid-cols-2 gap-4">
					<form.AppField name="date">
						{(field) => <field.Input type="date" label="Date" required />}
					</form.AppField>
					<form.AppField name="journalNo">
						{(field) => (
							<field.Input type="number" label="Journal No" required />
						)}
					</form.AppField>
				</FieldGroup>
				<form.Field name="journalLines" mode="array">
					{(field) => (
						<div className="space-y-4">
							<div className="flex md:items-center md:justify-end md:flex-row flex-col gap-4">
								<ButtonGroup>
									<Button
										type="button"
										variant="secondary"
										onClick={() =>
											field.pushValue({
												accountId: "",
												debit: 0,
												credit: 0,
												id: nanoid(),
											})
										}
									>
										<PlusIcon className="size-4" aria-hidden="true" />
										Add Line
									</Button>
									<Button
										type="button"
										variant="ghost"
										onClick={() => field.clearValues()}
										className="bg-destructive/10 text-destructive hover:bg-destructive/40"
									>
										<MinusIcon className="size-4" aria-hidden="true" />
										Clear Lines
									</Button>
								</ButtonGroup>
							</div>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-[300px]">Account</TableHead>
										<TableHead className="w-[180px]">Debit</TableHead>
										<TableHead className="w-[180px]">Credit</TableHead>
										<TableHead>Description</TableHead>
										<TableHead className="w-24"></TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{field.state.value.map((line, index) => (
										<TableRow key={line.id}>
											<TableCell>
												<form.AppField
													name={`journalLines[${index}].accountId`}
												>
													{(field) => (
														<field.Select label="">
															{activeAccounts.map((account) => (
																<SelectItem
																	key={account.value}
																	value={account.value}
																>
																	{account.label}
																</SelectItem>
															))}
														</field.Select>
													)}
												</form.AppField>
											</TableCell>
											<TableCell>
												<form.AppField name={`journalLines[${index}].debit`}>
													{(field) => (
														<field.Input
															type="number"
															value={
																field.state.value === 0 ? "" : field.state.value
															}
															label=""
														/>
													)}
												</form.AppField>
											</TableCell>
											<TableCell>
												<form.AppField name={`journalLines[${index}].credit`}>
													{(field) => (
														<field.Input
															type="number"
															value={
																field.state.value === 0 ? "" : field.state.value
															}
															label=""
														/>
													)}
												</form.AppField>
											</TableCell>
											<TableCell>
												<form.AppField
													name={`journalLines[${index}].description`}
												>
													{(field) => <field.Input type="text" label="" />}
												</form.AppField>
											</TableCell>
											<TableCell>
												<Button
													type="button"
													variant="ghost"
													onClick={() => field.removeValue(index)}
												>
													<TrashIcon
														className="size-4 text-destructive"
														aria-hidden="true"
													/>
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
								{journalLines.length > 0 && (
									<TableFooter>
										<TableRow>
											<TableCell className="text-right font-bold">
												Total
											</TableCell>
											<TableCell className="text-right font-bold">
												{currencyFormatter(totalDebits, false)}
											</TableCell>
											<TableCell className="text-right font-bold">
												{currencyFormatter(totalCredits, false)}
											</TableCell>
											<TableCell colSpan={2}></TableCell>
										</TableRow>
									</TableFooter>
								)}
							</Table>
						</div>
					)}
				</form.Field>
				<form.Subscribe selector={(state) => [state.isSubmitting]}>
					{([isSubmitting]) => (
						<Field orientation={"horizontal"}>
							<PermissionGate
								permission={
									journal ? "journal-entries:update" : "journal-entries:create"
								}
							>
								<Button
									type="submit"
									className="flex"
									disabled={isSubmitting || isPending}
								>
									<LoadingSwap isLoading={isSubmitting || isPending}>
										<CheckIcon />
										{journal ? "Update" : "Submit"}
									</LoadingSwap>
								</Button>
							</PermissionGate>
							<Button
								type="button"
								disabled={isSubmitting}
								variant="outline"
								onClick={() => form.reset()}
							>
								Cancel
							</Button>
							{journal && (
								<PermissionGate permission="journal-entries:delete">
									<ActionButton
										requireAreYouSure
										isDestructive
										action={() => handleDelete(journal.id as string)}
										variant="destructive"
									>
										<TrashIcon className="size-4" aria-hidden="true" />
										Delete
									</ActionButton>
								</PermissionGate>
							)}
						</Field>
					)}
				</form.Subscribe>
			</form>
		</div>
	);
}
