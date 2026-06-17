import { useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { BasePageComponent } from "@/components/ui/base-page";
import { SelectItem } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionGate } from "@/components/ui/permission-gate";
import { ToastContent } from "@/components/ui/toast-content";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { useAppForm } from "@/lib/form";
import {
	STATUTORY_RATE_CATEGORY_KEYS,
	STATUTORY_RATE_CATEGORY_METADATA,
	type StatutoryRateCategory,
} from "@/features/payroll/lib/payroll-constants";
import {
	addStatutoryRateFn,
	previewPayrollCalculationFn,
	supersedeStatutoryRateFn,
	type PayrollCalculationPreview,
} from "@/features/payroll/services/statutory-rates.api";
import { statutoryRateQueries } from "@/features/payroll/services/queries";
import {
	previewPayrollCalculationSchema,
	statutoryRateCreateSchema,
	supersedeStatutoryRateSchema,
	type PayrollPreviewCalculationPayload,
	type StatutoryRateCreatePayload,
	type SupersedeStatutoryRatePayload,
} from "@/features/payroll/services/statutory-rates.schemas";

const defaultHistoryCategory: StatutoryRateCategory = "paye_band";

const addRateDefaults: StatutoryRateCreatePayload = {
	category: "personal_relief" as StatutoryRateCategory,
	label: "",
	effectiveFrom: dateFormat(new Date()),
	effectiveTo: null,
	lowerBound: null,
	upperBound: null,
	rate: null,
	fixedAmount: null,
	notes: null,
};

const supersedeDefaults: SupersedeStatutoryRatePayload = {
	rateId: "",
	effectiveTo: dateFormat(new Date()),
};

const previewDefaults: PayrollPreviewCalculationPayload = {
	grossPay: 0,
	computationDate: dateFormat(new Date()),
	salaryStructureComponents: {
		pensionEmployeeContribution: 0,
		pensionEmployerContribution: 0,
		mortgageInterestMonthly: 0,
		postRetirementMedicalMonthly: 0,
		insurancePremiumsMonthly: 0,
		mealAllowance: 0,
		airtimeAllowance: 0,
	},
};

function formatPercent(value: number | null) {
	if (value === null) {
		return "-";
	}

	return `${(value * 100).toFixed(2)}%`;
}

function formatAmount(value: number | null) {
	return value === null ? "-" : currencyFormatter(value);
}

function SourceBadge({ source }: { source: "database" | "constant" }) {
	return <Badge variant={source === "database" ? "success" : "secondary"}>{source}</Badge>;
}

function HistoryStatusBadge({ status }: { status: "active" | "future" | "superseded" }) {
	if (status === "active") {
		return <Badge variant="success">Active</Badge>;
	}

	if (status === "future") {
		return <Badge variant="warning">Future</Badge>;
	}

	return <Badge variant="secondary">Superseded</Badge>;
}

function ResolvedRatesPanel() {
	const { data } = useSuspenseQuery(statutoryRateQueries.current());
	const { resolvedRates } = data;

	const scalarRows = [
		{
			label: "Personal Relief",
			value: formatAmount(resolvedRates.personalRelief),
			source: resolvedRates.resolvedFrom.personalRelief,
		},
		{
			label: "Insurance Relief Rate",
			value: formatPercent(resolvedRates.insuranceReliefRate),
			source: resolvedRates.resolvedFrom.insuranceReliefRate,
		},
		{
			label: "Insurance Relief Max",
			value: formatAmount(resolvedRates.insuranceReliefMax),
			source: resolvedRates.resolvedFrom.insuranceReliefMax,
		},
		{
			label: "NSSF Tier I Upper Limit",
			value: formatAmount(resolvedRates.nssfTier1UpperLimit),
			source: resolvedRates.resolvedFrom.nssfTier1UpperLimit,
		},
		{
			label: "NSSF Tier II Upper Limit",
			value: formatAmount(resolvedRates.nssfTier2UpperLimit),
			source: resolvedRates.resolvedFrom.nssfTier2UpperLimit,
		},
		{
			label: "NSSF Contribution Rate",
			value: formatPercent(resolvedRates.nssfContributionRate),
			source: resolvedRates.resolvedFrom.nssfContributionRate,
		},
		{
			label: "NSSF Max Employee",
			value: formatAmount(resolvedRates.nssfMaxEmployee),
			source: resolvedRates.resolvedFrom.nssfMaxEmployee,
		},
		{
			label: "NSSF Max Employer",
			value: formatAmount(resolvedRates.nssfMaxEmployer),
			source: resolvedRates.resolvedFrom.nssfMaxEmployer,
		},
		{
			label: "SHIF Rate",
			value: formatPercent(resolvedRates.shifRate),
			source: resolvedRates.resolvedFrom.shifRate,
		},
		{
			label: "SHIF Minimum",
			value: formatAmount(resolvedRates.shifMinimum),
			source: resolvedRates.resolvedFrom.shifMinimum,
		},
		{
			label: "AHL Employee Rate",
			value: formatPercent(resolvedRates.ahlEmployeeRate),
			source: resolvedRates.resolvedFrom.ahlEmployeeRate,
		},
		{
			label: "AHL Employer Rate",
			value: formatPercent(resolvedRates.ahlEmployerRate),
			source: resolvedRates.resolvedFrom.ahlEmployerRate,
		},
		{
			label: "NITA Levy",
			value: formatAmount(resolvedRates.nitaLevyPerEmployee),
			source: resolvedRates.resolvedFrom.nitaLevyPerEmployee,
		},
		{
			label: "Pension Cap",
			value: formatAmount(resolvedRates.pensionAllowableMax),
			source: resolvedRates.resolvedFrom.pensionAllowableMax,
		},
		{
			label: "Mortgage Cap",
			value: formatAmount(resolvedRates.mortgageAllowableMax),
			source: resolvedRates.resolvedFrom.mortgageAllowableMax,
		},
		{
			label: "Post-retirement Medical Cap",
			value: formatAmount(resolvedRates.postRetirementMedicalMax),
			source: resolvedRates.resolvedFrom.postRetirementMedicalMax,
		},
		{
			label: "Non-cash Benefit Exempt",
			value: formatAmount(resolvedRates.nonCashBenefitExempt),
			source: resolvedRates.resolvedFrom.nonCashBenefitExempt,
		},
		{
			label: "Meal Allowance Exempt",
			value: formatAmount(resolvedRates.mealAllowanceExempt),
			source: resolvedRates.resolvedFrom.mealAllowanceExempt,
		},
	];

	return (
		<div className="space-y-6">
			<div className="rounded-md border bg-card p-5">
				<div className="flex items-center justify-between gap-4">
					<div>
						<h2 className="text-lg font-semibold">Resolved Rates In Use Today</h2>
						<p className="text-sm text-muted-foreground">
							These are the actual statutory values the payroll engine will resolve right now.
						</p>
					</div>
					<SourceBadge source={resolvedRates.resolvedFrom.payeBands} />
				</div>

				<div className="mt-4 overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="text-left text-muted-foreground">
							<tr>
								<th className="py-2 pr-4">PAYE Band</th>
								<th className="py-2 pr-4">Lower Bound</th>
								<th className="py-2 pr-4">Upper Bound</th>
								<th className="py-2 pr-4">Rate</th>
							</tr>
						</thead>
						<tbody>
							{resolvedRates.payeBands.map((band, index) => (
								<tr key={`${band.lowerBound}-${band.rate}`} className="border-t">
									<td className="py-2 pr-4 font-medium">{`Band ${index + 1}`}</td>
									<td className="py-2 pr-4">{formatAmount(band.lowerBound)}</td>
									<td className="py-2 pr-4">
										{band.upperBound === null ? "No upper limit" : formatAmount(band.upperBound)}
									</td>
									<td className="py-2 pr-4">{formatPercent(band.rate)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{scalarRows.map((row) => (
					<div key={row.label} className="rounded-md border bg-card p-4 space-y-2">
						<div className="flex items-center justify-between gap-3">
							<p className="text-sm font-medium">{row.label}</p>
							<SourceBadge source={row.source} />
						</div>
						<p className="text-xl font-semibold">{row.value}</p>
					</div>
				))}
			</div>
		</div>
	);
}

function ActiveRatesPanel() {
	const { data } = useSuspenseQuery(statutoryRateQueries.current());

	return (
		<div className="space-y-4">
			{data.groupedRates.map((group) => (
				<div key={group.category} className="rounded-md border bg-card p-5 space-y-4">
					<div>
						<h2 className="text-lg font-semibold">{group.label}</h2>
						<p className="text-sm text-muted-foreground">{group.description}</p>
					</div>
					{group.warnings.length > 0 ? (
						<div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
							{group.warnings.join(" ")}
						</div>
					) : null}
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="text-left text-muted-foreground">
								<tr>
									<th className="py-2 pr-4">Label</th>
									<th className="py-2 pr-4">Effective</th>
									<th className="py-2 pr-4">Bounds</th>
									<th className="py-2 pr-4">Rate</th>
									<th className="py-2 pr-4">Fixed Amount</th>
									<th className="py-2 pr-4">Notes</th>
								</tr>
							</thead>
							<tbody>
								{group.rows.map((row) => (
									<tr key={row.id} className="border-t align-top">
										<td className="py-2 pr-4 font-medium">{row.label}</td>
										<td className="py-2 pr-4">
											{row.effectiveFrom}
											{row.effectiveTo ? ` to ${row.effectiveTo}` : " onwards"}
										</td>
										<td className="py-2 pr-4">
											{row.lowerBound === null && row.upperBound === null
												? "-"
												: `${formatAmount(row.lowerBound)} to ${
														row.upperBound === null ? "No limit" : formatAmount(row.upperBound)
													}`}
										</td>
										<td className="py-2 pr-4">{formatPercent(row.rate)}</td>
										<td className="py-2 pr-4">{formatAmount(row.fixedAmount)}</td>
										<td className="py-2 pr-4">{row.notes ?? "-"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			))}
		</div>
	);
}

function ManageRatesPanel() {
	const { data } = useSuspenseQuery(statutoryRateQueries.current());
	const queryClient = useQueryClient();
	const activeRateOptions = data.groupedRates.flatMap((group) =>
		group.rows.map((row) => ({
			id: row.id,
			label: `${STATUTORY_RATE_CATEGORY_METADATA[row.category].label} • ${row.label} (${row.effectiveFrom})`,
		}))
	);

	const addMutation = useMutation({
		mutationFn: async ({ data }: { data: StatutoryRateCreatePayload }) => {
			const result = await addStatutoryRateFn({ data });
			if (!result.success) {
				throw new Error(result.error.message);
			}
			return result.data;
		},
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ["statutory-rates"] });
			toast.success((t) => (
				<ToastContent t={t} title="Success" message="Statutory rate added successfully." />
			));
			if (result.warnings.length > 0) {
				toast.error((t) => (
					<ToastContent t={t} title="Overlap warning" message={result.warnings.join(" ")} />
				));
			}
			addForm.reset();
		},
		onError: (error) => {
			const message = error instanceof Error ? error.message : "Failed to add statutory rate";
			toast.error((t) => <ToastContent t={t} title="Error" message={message} />);
		},
	});

	const addForm = useAppForm({
		defaultValues: addRateDefaults,
		validators: {
			onSubmit: statutoryRateCreateSchema,
		},
		onSubmit: ({ value }) => addMutation.mutate({ data: value }),
	});

	const supersedeMutation = useMutation({
		mutationFn: async ({ data }: { data: SupersedeStatutoryRatePayload }) => {
			const result = await supersedeStatutoryRateFn({ data });
			if (!result.success) {
				throw new Error(result.error.message);
			}
			return result.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["statutory-rates"] });
			toast.success((t) => (
				<ToastContent t={t} title="Success" message="Statutory rate closed successfully." />
			));
			supersedeForm.reset();
		},
		onError: (error) => {
			const message = error instanceof Error ? error.message : "Failed to close statutory rate";
			toast.error((t) => <ToastContent t={t} title="Error" message={message} />);
		},
	});

	const supersedeForm = useAppForm({
		defaultValues: supersedeDefaults,
		validators: {
			onSubmit: supersedeStatutoryRateSchema,
		},
		onSubmit: ({ value }) => supersedeMutation.mutate({ data: value }),
	});

	return (
		<PermissionGate permissions={["statutory-rates:manage"]}>
			<div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
				<div className="rounded-md border bg-card p-5 space-y-4">
					<div>
						<h2 className="text-lg font-semibold">Add Statutory Rate</h2>
						<p className="text-sm text-muted-foreground">
							Create a new effective-dated rate row. Existing rows are preserved for audit history.
						</p>
					</div>
					<form
						className="space-y-4"
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							addForm.handleSubmit();
						}}
					>
						<div className="grid gap-4 md:grid-cols-2">
							<addForm.AppField name="category">
								{(field) => (
									<field.Select label="Category" required>
										{STATUTORY_RATE_CATEGORY_KEYS.map((category) => (
											<SelectItem key={category} value={category}>
												{STATUTORY_RATE_CATEGORY_METADATA[category].label}
											</SelectItem>
										))}
									</field.Select>
								)}
							</addForm.AppField>
							<addForm.AppField name="label">
								{(field) => <field.Input label="Label" required />}
							</addForm.AppField>
							<addForm.AppField name="effectiveFrom">
								{(field) => <field.Input label="Effective From" type="date" required />}
							</addForm.AppField>
							<addForm.AppField name="effectiveTo">
								{(field) => <field.Input label="Effective To" type="date" />}
							</addForm.AppField>
							<addForm.AppField name="lowerBound">
								{(field) => <field.Input label="Lower Bound" type="number" min={0} step="0.01" />}
							</addForm.AppField>
							<addForm.AppField name="upperBound">
								{(field) => <field.Input label="Upper Bound" type="number" min={0} step="0.01" />}
							</addForm.AppField>
							<addForm.AppField name="rate">
								{(field) => <field.Input label="Rate" type="number" min={0} step="0.000001" />}
							</addForm.AppField>
							<addForm.AppField name="fixedAmount">
								{(field) => <field.Input label="Fixed Amount" type="number" min={0} step="0.01" />}
							</addForm.AppField>
						</div>
						<addForm.AppField name="notes">
							{(field) => (
								<field.Textarea
									label="Notes"
									rows={3}
									placeholder="Finance Act note, gazette reference, or implementation context"
								/>
							)}
						</addForm.AppField>
						<addForm.AppForm>
							<addForm.SubmitButton
								buttonText="Add Rate"
								isLoading={addMutation.isPending}
								withReset
							/>
						</addForm.AppForm>
					</form>
				</div>

				<div className="rounded-md border bg-card p-5 space-y-4">
					<div>
						<h2 className="text-lg font-semibold">Close Existing Rate</h2>
						<p className="text-sm text-muted-foreground">
							Set an end date on an active row before or after entering its replacement.
						</p>
					</div>
					<form
						className="space-y-4"
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							supersedeForm.handleSubmit();
						}}
					>
						<supersedeForm.AppField name="rateId">
							{(field) => (
								<field.Select label="Active Rate" required>
									{activeRateOptions.map((option) => (
										<SelectItem key={option.id} value={option.id}>
											{option.label}
										</SelectItem>
									))}
								</field.Select>
							)}
						</supersedeForm.AppField>
						<supersedeForm.AppField name="effectiveTo">
							{(field) => <field.Input label="Effective To" type="date" required />}
						</supersedeForm.AppField>
						<supersedeForm.AppForm>
							<supersedeForm.SubmitButton
								buttonText="Close Rate"
								isLoading={supersedeMutation.isPending}
								withReset
							/>
						</supersedeForm.AppForm>
					</form>
				</div>
			</div>
		</PermissionGate>
	);
}

function HistoryPanel() {
	const [selectedCategory, setSelectedCategory] =
		useState<StatutoryRateCategory>(defaultHistoryCategory);
	const { data } = useSuspenseQuery(statutoryRateQueries.history({ category: selectedCategory }));

	return (
		<div className="rounded-md border bg-card p-5 space-y-4">
			<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div>
					<h2 className="text-lg font-semibold">Rate History</h2>
					<p className="text-sm text-muted-foreground">
						Review the full effective-dated change history for any statutory category.
					</p>
				</div>
				<div className="w-full md:max-w-sm">
					<label className="mb-2 block text-sm font-medium">Category</label>
					<select
						className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
						value={selectedCategory}
						onChange={(event) => setSelectedCategory(event.target.value as StatutoryRateCategory)}
					>
						{STATUTORY_RATE_CATEGORY_KEYS.map((category) => (
							<option key={category} value={category}>
								{STATUTORY_RATE_CATEGORY_METADATA[category].label}
							</option>
						))}
					</select>
				</div>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead className="text-left text-muted-foreground">
						<tr>
							<th className="py-2 pr-4">Label</th>
							<th className="py-2 pr-4">Status</th>
							<th className="py-2 pr-4">Effective</th>
							<th className="py-2 pr-4">Rate</th>
							<th className="py-2 pr-4">Fixed Amount</th>
							<th className="py-2 pr-4">Notes</th>
						</tr>
					</thead>
					<tbody>
						{data.map((row) => (
							<tr key={row.id} className="border-t align-top">
								<td className="py-2 pr-4 font-medium">{row.label}</td>
								<td className="py-2 pr-4">
									<HistoryStatusBadge status={row.status} />
								</td>
								<td className="py-2 pr-4">
									{row.effectiveFrom}
									{row.effectiveTo ? ` to ${row.effectiveTo}` : " onwards"}
								</td>
								<td className="py-2 pr-4">{formatPercent(row.rate)}</td>
								<td className="py-2 pr-4">{formatAmount(row.fixedAmount)}</td>
								<td className="py-2 pr-4">{row.notes ?? "-"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function PreviewPanel() {
	const [preview, setPreview] = useState<PayrollCalculationPreview | null>(null);
	const mutation = useMutation({
		mutationFn: previewPayrollCalculationFn,
		onSuccess: setPreview,
		onError: (error) => {
			const message = error instanceof Error ? error.message : "Failed to generate payroll preview";
			toast.error((t) => <ToastContent t={t} title="Preview failed" message={message} />);
		},
	});

	const form = useAppForm({
		defaultValues: previewDefaults,
		validators: {
			onSubmit: previewPayrollCalculationSchema,
		},
		onSubmit: ({ value }) => mutation.mutate({ data: value }),
	});

	return (
		<div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
			<div className="rounded-md border bg-card p-5 space-y-4">
				<div>
					<h2 className="text-lg font-semibold">Preview Payroll Calculation</h2>
					<p className="text-sm text-muted-foreground">
						Resolve rates for a date and simulate employee-side statutory deductions without writing
						payroll records.
					</p>
				</div>
				<form
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						form.handleSubmit();
					}}
				>
					<div className="grid gap-4 md:grid-cols-2">
						<form.AppField name="grossPay">
							{(field) => (
								<field.Input label="Gross Pay" type="number" min={0} step="0.01" required />
							)}
						</form.AppField>
						<form.AppField name="computationDate">
							{(field) => <field.Input label="Computation Date" type="date" />}
						</form.AppField>
						<form.AppField name="salaryStructureComponents.pensionEmployeeContribution">
							{(field) => (
								<field.Input label="Employee Pension" type="number" min={0} step="0.01" />
							)}
						</form.AppField>
						<form.AppField name="salaryStructureComponents.pensionEmployerContribution">
							{(field) => (
								<field.Input label="Employer Pension" type="number" min={0} step="0.01" />
							)}
						</form.AppField>
						<form.AppField name="salaryStructureComponents.mortgageInterestMonthly">
							{(field) => (
								<field.Input label="Mortgage Interest" type="number" min={0} step="0.01" />
							)}
						</form.AppField>
						<form.AppField name="salaryStructureComponents.postRetirementMedicalMonthly">
							{(field) => (
								<field.Input label="Post-retirement Medical" type="number" min={0} step="0.01" />
							)}
						</form.AppField>
						<form.AppField name="salaryStructureComponents.insurancePremiumsMonthly">
							{(field) => (
								<field.Input label="Insurance Premiums" type="number" min={0} step="0.01" />
							)}
						</form.AppField>
						<form.AppField name="salaryStructureComponents.mealAllowance">
							{(field) => <field.Input label="Meal Allowance" type="number" min={0} step="0.01" />}
						</form.AppField>
						<form.AppField name="salaryStructureComponents.airtimeAllowance">
							{(field) => (
								<field.Input label="Airtime / Non-cash Benefit" type="number" min={0} step="0.01" />
							)}
						</form.AppField>
					</div>
					<form.AppForm>
						<form.SubmitButton buttonText="Run Preview" isLoading={mutation.isPending} withReset />
					</form.AppForm>
				</form>
			</div>

			<div className="rounded-md border bg-card p-5 space-y-4">
				<div>
					<h2 className="text-lg font-semibold">Preview Result</h2>
					<p className="text-sm text-muted-foreground">
						{preview
							? `Computed using rates effective on ${preview.computationDate}.`
							: "Run a preview to inspect the statutory deduction breakdown."}
					</p>
				</div>
				{preview ? (
					<div className="space-y-4">
						<div className="grid gap-4 md:grid-cols-2">
							<div className="rounded-md border p-4">
								<p className="text-sm text-muted-foreground">Net PAYE</p>
								<p className="text-2xl font-semibold">
									{currencyFormatter(preview.breakdown.netPAYE)}
								</p>
							</div>
							<div className="rounded-md border p-4">
								<p className="text-sm text-muted-foreground">Net Pay Before Voluntary</p>
								<p className="text-2xl font-semibold">
									{currencyFormatter(preview.breakdown.netPayBeforeVoluntary)}
								</p>
							</div>
						</div>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="rounded-md border p-4 space-y-2">
								<p className="font-medium">Employee Deductions</p>
								<p className="text-sm">NSSF: {currencyFormatter(preview.breakdown.nssfEmployee)}</p>
								<p className="text-sm">SHIF: {currencyFormatter(preview.breakdown.shifEmployee)}</p>
								<p className="text-sm">AHL: {currencyFormatter(preview.breakdown.ahlEmployee)}</p>
								<p className="text-sm">PAYE: {currencyFormatter(preview.breakdown.netPAYE)}</p>
								<p className="text-sm font-medium">
									Total: {currencyFormatter(preview.breakdown.totalStatutoryDeductions)}
								</p>
							</div>
							<div className="rounded-md border p-4 space-y-2">
								<p className="font-medium">Employer Cost</p>
								<p className="text-sm">NSSF: {currencyFormatter(preview.breakdown.nssfEmployer)}</p>
								<p className="text-sm">SHIF: {currencyFormatter(preview.breakdown.shifEmployer)}</p>
								<p className="text-sm">AHL: {currencyFormatter(preview.breakdown.ahlEmployer)}</p>
								<p className="text-sm">NITA: {currencyFormatter(preview.breakdown.nitaLevy)}</p>
								<p className="text-sm font-medium">
									Total: {currencyFormatter(preview.breakdown.totalEmployerCost)}
								</p>
							</div>
						</div>
						<div className="rounded-md border p-4 space-y-2">
							<p className="font-medium">PAYE Band Breakdown</p>
							{preview.breakdown.bandBreakdown.map((band) => (
								<div
									key={`${band.lowerBound}-${band.rate}`}
									className="flex items-center justify-between gap-4 text-sm"
								>
									<span>
										{currencyFormatter(band.lowerBound)} to{" "}
										{band.upperBound === null ? "No limit" : currencyFormatter(band.upperBound)} at{" "}
										{formatPercent(band.rate)}
									</span>
									<span>{currencyFormatter(band.taxAmount)}</span>
								</div>
							))}
						</div>
					</div>
				) : (
					<div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
						No preview generated yet.
					</div>
				)}
			</div>
		</div>
	);
}

export function StatutoryRatesPage() {
	return (
		<BasePageComponent
			pageTitle="Statutory Rates"
			pageDescription="Manage effective-dated payroll tax, levy, and contribution rates with database overrides and live payroll previews."
		>
			<Tabs defaultValue="resolved">
				<TabsList variant="line">
					<TabsTrigger value="resolved">Resolved Today</TabsTrigger>
					<TabsTrigger value="active">Active Rows</TabsTrigger>
					<TabsTrigger value="manage">Manage</TabsTrigger>
					<TabsTrigger value="history">History</TabsTrigger>
					<TabsTrigger value="preview">Preview</TabsTrigger>
				</TabsList>
				<TabsContent value="resolved">
					<ResolvedRatesPanel />
				</TabsContent>
				<TabsContent value="active">
					<ActiveRatesPanel />
				</TabsContent>
				<TabsContent value="manage">
					<ManageRatesPanel />
				</TabsContent>
				<TabsContent value="history">
					<HistoryPanel />
				</TabsContent>
				<TabsContent value="preview">
					<PreviewPanel />
				</TabsContent>
			</Tabs>
		</BasePageComponent>
	);
}
