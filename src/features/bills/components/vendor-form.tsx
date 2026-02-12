import { useNavigate, useRouter } from "@tanstack/react-router";
import { FieldGroup } from "@/components/ui/field";
import type { vendors } from "@/drizzle/schema";
import {
	type SupplierSchema,
	supplierSchema,
} from "@/features/bills/services/schemas";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useModal } from "@/integrations/modal-provider";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";
import { upsertSupplier } from "../services/suppliers.api";

export function VendorForm({
	vendor,
	fromModal,
}: {
	vendor?: typeof vendors.$inferSelect;
	fromModal?: boolean;
}) {
	const { setClose } = useModal();
	const navigate = useNavigate();
	const router = useRouter();
	const { isPending, mutate } = useFormUpsert({
		entityName: "Vendor",
		upsertFn: (values: SupplierSchema) => upsertSupplier({ data: values }),
		queryKey: ["vendors"],
	});
	const form = useAppForm({
		defaultValues: {
			name: vendor?.name ? toTitleCase(vendor.name.toLowerCase()) : "",
			email: vendor?.email || null,
			phone: vendor?.phone || null,
			address: vendor?.address || null,
			taxPin: vendor?.taxPin?.toUpperCase() || null,
			active: vendor?.active ?? true,
		} as SupplierSchema,
		validators: {
			onSubmit: supplierSchema,
		},
		onSubmit: ({ value }) => {
			mutate(
				{ ...value, id: vendor?.id },
				{
					onSuccess: async () => {
						handleReset();
						if (vendor?.id) {
							await router.invalidate({ sync: true });
						}
						if (!fromModal) navigate({ to: "/app/suppliers" });
					},
				},
			);
		},
	});

	function handleReset() {
		form.reset();
		if (fromModal) setClose();
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
						buttonText={vendor?.id ? "Update Supplier" : "Create Supplier"}
						withReset
						isLoading={isPending}
					/>
				</form.AppForm>
			</FieldGroup>
		</form>
	);
}
