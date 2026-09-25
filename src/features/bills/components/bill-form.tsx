import { useStore } from "@tanstack/react-form";
import { useQueries } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import CustomModal from "@/components/ui/custom-modal";
import { FieldGroup } from "@/components/ui/field";
import { PlusIcon } from "@/components/ui/icons";
import { SelectItem } from "@/components/ui/select";
import { BillLinesTable } from "@/features/bills/components/bill-lines-table";
import { VendorForm } from "@/features/bills/components/vendor-form";
import { billFormOpts } from "@/features/bills/lib/form-options";
import { upsertBill } from "@/features/bills/services/bills.api";
import { supplierQueries } from "@/features/bills/services/queries";
import type { BillSchema } from "@/features/bills/services/schemas";
import { accountQueries } from "@/features/coa/services/queries";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useModal } from "@/integrations/modal-provider";
import { useAppForm } from "@/lib/form";
import { dateFormat } from "@/lib/helpers";
import type { Option } from "@/types/index.types";

type BillForm = {
	loaderVendors: Array<Option>;
	loaderAccounts: Array<Option>;
	bill?: BillSchema;
	isEdit?: boolean;
};

export function BillForm({
	loaderVendors,
	loaderAccounts,
	bill,
	isEdit,
}: BillForm) {
	const [{ data: accounts }, { data: vendors }] = useQueries({
		queries: [
			accountQueries.activePostingAccountsByAccountType(["expense", "asset"]),
			supplierQueries.active(),
		],
	});

	const { isPending, mutate } = useFormUpsert({
		upsertFn: (values: BillSchema) => upsertBill({ data: values }),
		entityName: "Bill",
		queryKey: ["bills"],
		navigateTo: "/app/bills",
	});

	const form = useAppForm({
		...billFormOpts,
		defaultValues: bill || billFormOpts.defaultValues,
		onSubmit: async ({ value }) => {
			mutate({ ...value, id: bill?.id });
		},
	});

	const [terms, invoiceDate] = useStore(form.store, (state) => [
		state.values.terms,
		state.values.invoiceDate,
	]);
	const { setOpen } = useModal();

	const handleAddNewVendor = () => {
		setOpen(
			<CustomModal title="Add New Vendor" className="max-w-3xl! w-full!">
				<VendorForm fromModal={true} />
			</CustomModal>,
		);
	};

	useEffect(() => {
		if (!invoiceDate || !terms || bill) return;
		const dueDate = (daysToAdd: number) => {
			return dateFormat(addDays(new Date(invoiceDate), daysToAdd));
		};
		if (terms === "Net 30") {
			form.setFieldValue("dueDate", dueDate(30));
		} else if (terms === "Net 60") {
			form.setFieldValue("dueDate", dueDate(60));
		} else if (terms === "Net 90") {
			form.setFieldValue("dueDate", dueDate(90));
		} else if (terms === "Due on Receipt") {
			form.setFieldValue("dueDate", dateFormat(new Date()));
		}
	}, [terms, form, invoiceDate, bill]);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<FieldGroup className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
				<form.AppField name="vendorId">
					{(field) => (
						<field.Combobox
							label="Vendor"
							placeholder="Select vendor"
							addNew={
								<Button
									className="w-full"
									type="button"
									variant="ghost"
									onClick={handleAddNewVendor}
								>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add Vendor
								</Button>
							}
							items={vendors || loaderVendors}
							required
						/>
					)}
				</form.AppField>
				<form.AppField name="invoiceDate">
					{(field) => <field.Input type="date" label="Invoice Date" required />}
				</form.AppField>

				<form.AppField name="terms">
					{(field) => (
						<field.Select label="Terms" required>
							<SelectItem value="Net 30">Net 30</SelectItem>
							<SelectItem value="Net 60">Net 60</SelectItem>
							<SelectItem value="Net 90">Net 90</SelectItem>
							<SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
						</field.Select>
					)}
				</form.AppField>
				<form.AppField name="dueDate">
					{(field) => <field.Input type="date" label="Due Date" />}
				</form.AppField>
				<form.AppField name="invoiceNo">
					{(field) => <field.Input label="Invoice#" required />}
				</form.AppField>
			</FieldGroup>

			<BillLinesTable
				form={form}
				accounts={accounts || loaderAccounts}
				isPending={isPending}
			/>

			<form.AppForm>
				<form.SubmitButton
					isLoading={isPending}
					buttonText={isEdit ? "Update Bill" : "Create Bill"}
					withReset
				/>
			</form.AppForm>
		</form>
	);
}
