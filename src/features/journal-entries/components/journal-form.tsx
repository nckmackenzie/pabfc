import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { FieldGroup } from "@/components/ui/field";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { Search } from "@/components/ui/search";
import { SelectItem } from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	type JournalEntry,
	journalEntrySchema,
} from "@/features/journal-entries/services/schemas";
import { useAppForm } from "@/lib/form";

export function JournalEntryForm() {
	const form = useAppForm({
		defaultValues: {
			journalLines: [],
			date: new Date().toISOString(),
			journalNo: 1,
		} as JournalEntry,
		validators: {
			onSubmit: journalEntrySchema,
		},
		onSubmit: ({ value }) => {
			console.log(value);
		},
	});
	return (
		<div className="space-y-6">
			<PageHeader
				title="Journal Entry"
				description="Create a new journal entry"
			/>
			<Search placeholder="Search by journal no..." onHandleSearch={() => {}} />
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
				className="space-y-4"
			>
				<FieldGroup className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
										<TableHead>Account</TableHead>
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
															<SelectItem value="2">2</SelectItem>
														</field.Select>
													)}
												</form.AppField>
											</TableCell>
											<TableCell>
												<form.AppField name={`journalLines[${index}].debit`}>
													{(field) => <field.Input type="number" label="" />}
												</form.AppField>
											</TableCell>
											<TableCell>
												<form.AppField name={`journalLines[${index}].credit`}>
													{(field) => <field.Input type="number" label="" />}
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
							</Table>
						</div>
					)}
				</form.Field>
			</form>
		</div>
	);
}
