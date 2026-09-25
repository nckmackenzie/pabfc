import { useRouter } from "@tanstack/react-router";
import { FieldGroup } from "@/components/ui/field";
import { updateBillWhtCertificate } from "@/features/bills/services/bills.api";
import {
	type WhtCertificateSchema,
	whtCertificateSchema,
} from "@/features/bills/services/schemas";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useModal } from "@/integrations/modal-provider";
import { useAppForm } from "@/lib/form";

type WhtCertificateFormProps = {
	billId: string;
	whtCertificateNo?: string | null;
	whtCertificateIssuedDate?: string | null;
};

/**
 * Records the iTax certificate for tax already withheld on a bill. Record-keeping
 * only: it moves no money and posts nothing to the ledger.
 */
export function WhtCertificateForm({
	billId,
	whtCertificateNo,
	whtCertificateIssuedDate,
}: WhtCertificateFormProps) {
	const { setClose } = useModal();
	const router = useRouter();

	const { isPending, mutate } = useFormUpsert({
		entityName: "WHT certificate",
		upsertFn: (values: WhtCertificateSchema) =>
			updateBillWhtCertificate({ data: values }),
		queryKey: ["bills"],
		successMessage: {
			create: "WHT certificate recorded successfully.",
			update: "WHT certificate recorded successfully.",
		},
		onSuccessCallback: async () => {
			setClose();
			await router.invalidate({ sync: true });
		},
	});

	const form = useAppForm({
		defaultValues: {
			billId,
			whtCertificateNo: whtCertificateNo?.toUpperCase() ?? "",
			whtCertificateIssuedDate: whtCertificateIssuedDate ?? "",
		} as WhtCertificateSchema,
		validators: {
			onSubmit: whtCertificateSchema,
		},
		onSubmit: ({ value }) => {
			mutate(value);
		},
	});

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
				<form.AppField name="whtCertificateNo">
					{(field) => (
						<field.Input
							label="Certificate No"
							placeholder="Certificate number from iTax"
							required
						/>
					)}
				</form.AppField>
				<form.AppField name="whtCertificateIssuedDate">
					{(field) => <field.Input type="date" label="Issued Date" required />}
				</form.AppField>
			</FieldGroup>
			<form.AppForm>
				<form.SubmitButton
					isLoading={isPending}
					buttonText="Save Certificate"
					withReset={false}
				/>
			</form.AppForm>
		</form>
	);
}
