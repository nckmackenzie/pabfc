import { useStore } from "@tanstack/react-form";
import { nanoid } from "nanoid";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
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
import { vatTypes } from "@/drizzle/schema";
import { useWhtLineDefaults } from "@/features/bills/hooks/use-wht-line-defaults";
import {
	billLineAmounts,
	sumBillLineAmounts,
} from "@/features/bills/lib/bill-totals";
import {
	billFormOpts,
	createDefaultBillLine,
} from "@/features/bills/lib/form-options";
import { withForm } from "@/lib/form";
import { currencyFormatter } from "@/lib/helpers";
import type { Option } from "@/types/index.types";
import { toTitleCase } from "@/lib/utils";

/**
 * The line editor for a bill: expense account, amount, VAT treatment, and the
 * withholding tax deducted on the line.
 *
 * Every figure in the footer comes from the same `bill-totals` helpers the server
 * uses when it posts the bill, so the preview cannot disagree with what is stored.
 * The per-line WHT amount is display only — the server recomputes it from the rate.
 */
export const BillLinesTable = withForm({
	...billFormOpts,
	props: {
		accounts: [] as Array<Option>,
		isPending: false,
	},
	// Named rather than anonymous so react-hooks/rules-of-hooks recognises this as a
	// component and can analyse the hooks called inside it.
	render: function BillLinesTableFields({ form, accounts, isPending }) {
		const lines = useStore(form.store, (state) => state.values.lines);

		const setLineWhtRate = useCallback(
			(index: number, values: { whtRate: number | null }) => {
				form.setFieldValue(`lines[${index}].whtRate`, values.whtRate);
			},
			[form],
		);

		useWhtLineDefaults(lines, setLineWhtRate);

		const lineAmounts = lines.map(billLineAmounts);
		const totals = sumBillLineAmounts(lineAmounts);

		return (
			<form.Field name="lines" mode="array">
				{(field) => (
					<div className="space-y-4">
						<div className="flex md:items-center md:justify-end md:flex-row flex-col gap-4">
							<ButtonGroup>
								<Button
									type="button"
									variant="secondary"
									onClick={() =>
										field.pushValue({ ...createDefaultBillLine(), id: nanoid() })
									}
									disabled={isPending}
								>
									<PlusIcon className="size-4" aria-hidden="true" />
									Add Line
								</Button>
								<Button
									type="button"
									variant="ghost"
									onClick={() => field.clearValues()}
									className="bg-destructive/10 text-destructive hover:bg-destructive/40"
									disabled={isPending}
								>
									<MinusIcon className="size-4" aria-hidden="true" />
									Clear Lines
								</Button>
							</ButtonGroup>
						</div>
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-[240px]">Account</TableHead>
										<TableHead className="min-w-[220px]">Description</TableHead>
										<TableHead className="w-[200px]">Amount</TableHead>
										<TableHead className="w-[150px]">Tax</TableHead>
										<TableHead className="w-16 text-center">WHT</TableHead>
										<TableHead className="w-[120px]">Rate %</TableHead>
										<TableHead className="w-[150px] text-right">
											WHT Amount
										</TableHead>
										<TableHead className="w-16" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{field.state.value.map((line, index) => (
										<TableRow key={line.id}>
											<TableCell>
												<form.AppField name={`lines[${index}].accountId`}>
													{(field) => (
														<field.Select label="">
															{accounts.map((account) => (
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
												<form.AppField name={`lines[${index}].description`}>
													{(field) => <field.Input label="" />}
												</form.AppField>
											</TableCell>
											<TableCell>
												<form.AppField name={`lines[${index}].amount`}>
													{(field) => (
														<field.Input
															type="number"
															value={
																field.state.value === 0 ? "" : field.state.value
															}
															label=""
															step="0.01"
														/>
													)}
												</form.AppField>
											</TableCell>
											<TableCell>
												<form.AppField name={`lines[${index}].vatType`}>
													{(field) => (
														<field.Select label="">
															{vatTypes.map((vatType) => (
																<SelectItem key={vatType} value={vatType}>
																	{toTitleCase(vatType)}
																</SelectItem>
															))}
														</field.Select>
													)}
												</form.AppField>
											</TableCell>
											<TableCell className="text-center">
												<form.AppField name={`lines[${index}].whtApplicable`}>
													{(field) => <field.Checkbox label="" />}
												</form.AppField>
											</TableCell>
											<TableCell>
												{line.whtApplicable ? (
													<form.AppField name={`lines[${index}].whtRate`}>
														{(field) => (
															<field.Input
																type="number"
																label=""
																step="0.01"
																min={0}
																max={100}
															/>
														)}
													</form.AppField>
												) : (
													<span className="text-muted-foreground text-sm">—</span>
												)}
											</TableCell>
											<TableCell className="text-right tabular-nums">
												{currencyFormatter(
													lineAmounts[index]?.whtAmount ?? 0,
													false,
												)}
											</TableCell>
											<TableCell>
												<Button
													type="button"
													variant="ghost"
													onClick={() => field.removeValue(index)}
													disabled={isPending}
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
								{lines.length > 0 && (
									<TableFooter>
										<SummaryRow
											label="Subtotal (excl. VAT)"
											value={totals.subTotal}
										/>
										<SummaryRow label="VAT" value={totals.taxAmount} />
										<SummaryRow label="Total" value={totals.total} emphasis />
										<SummaryRow label="WHT Withheld" value={totals.whtAmount} />
										{/* The vendor is only ever owed this figure. The withheld
										    portion is owed to KRA and is settled by a remittance. */}
										<SummaryRow
											label="Net Payable to Vendor"
											value={totals.netPayable}
											emphasis
										/>
									</TableFooter>
								)}
							</Table>
						</div>
					</div>
				)}
			</form.Field>
		);
	},
});

function SummaryRow({
	label,
	value,
	emphasis,
}: {
	label: string;
	value: number;
	emphasis?: boolean;
}) {
	return (
		<TableRow>
			<TableCell
				colSpan={6}
				className={emphasis ? "text-right font-bold" : "text-right font-medium"}
			>
				{label}
			</TableCell>
			<TableCell
				className={`text-right tabular-nums ${emphasis ? "font-bold" : "font-medium"}`}
			>
				{currencyFormatter(Number.isNaN(value) ? 0 : value, false)}
			</TableCell>
			<TableCell />
		</TableRow>
	);
}
