import { FieldGroup } from "@/components/ui/field";
import type { vendors } from "@/drizzle/schema";
import {
	type SupplierSchema,
	supplierSchema,
} from "@/features/bills/services/schemas";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useModal } from "@/integrations/modal-provider";
import { useAppForm } from "@/lib/form";
import { upsertSupplier } from "../services/suppliers.api";

export function VendorForm({
	vendor,
}: {
	vendor?: typeof vendors.$inferSelect;
}) {
	const { setClose } = useModal();
	const { isPending, mutate } = useFormUpsert({
		entityName: "Vendor",
		upsertFn: (values: SupplierSchema) => upsertSupplier({ data: values }),
		queryKey: ["vendors"],
	});
	const form = useAppForm({
		defaultValues: {
			name: vendor?.name || "",
			email: vendor?.email || "",
			phone: vendor?.phone || "",
			address: vendor?.address || "",
			taxPin: vendor?.taxPin || "",
			active: vendor?.active || true,
		} as SupplierSchema,
		validators: {
			onSubmit: supplierSchema,
		},
		onSubmit: ({ value }) => {
			mutate(
				{ ...value, id: vendor?.id },
				{
					onSuccess: () => {
						handleReset();
					},
				},
			);
		},
	});

	function handleReset() {
		form.reset();
		setClose();
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<FieldGroup className="grid md:grid-cols-2 gap-4">
				<form.AppField name="name">
					{(field) => <field.Input label="Name" required />}
				</form.AppField>
				<form.AppField name="email">
					{(field) => <field.Input label="Email" type="email" />}
				</form.AppField>
				<form.AppField name="phone">
					{(field) => <field.Input label="Phone" />}
				</form.AppField>
				<form.AppField name="taxPin">
					{(field) => <field.Input label="Tax Pin" />}
				</form.AppField>
				<form.AppField name="address">
					{(field) => (
						<field.Input label="Address" fieldClassName="col-span-full" />
					)}
				</form.AppField>
				<form.AppField name="active">
					{(field) => <field.Switch label="Active" />}
				</form.AppField>
			</FieldGroup>
			<FieldGroup>
				<form.AppForm>
					<form.SubmitButton
						onReset={handleReset}
						buttonText="Save Vendor"
						withReset
						isLoading={isPending}
					/>
				</form.AppForm>
			</FieldGroup>
		</form>
	);
}
