import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { createPayee } from "@/features/expenses/services/payees.api";
import {
	type PayeeSchema,
	payeeSchema,
} from "@/features/expenses/services/schemas";
import { useFormMutation } from "@/hooks/use-form-mutation";
import { useAppForm } from "@/lib/form";

export function AddPayee() {
	const [open, setOpen] = useState(false);
	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="w-full justify-start font-normal px-1.5"
				>
					<PlusIcon className="size-4" aria-hidden="true" />
					Add Payee
				</Button>
			</SheetTrigger>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>Add Payee</SheetTitle>
					<SheetDescription>
						Add a new payee here. Click save when you&apos;re done.
					</SheetDescription>
				</SheetHeader>
				<div className="px-4">
					<PayeeForm setOpen={setOpen} />
				</div>
			</SheetContent>
		</Sheet>
	);
}

function PayeeForm({ setOpen }: { setOpen: (open: boolean) => void }) {
	const { mutate, isPending } = useFormMutation({
		createFn: (data: PayeeSchema) => createPayee({ data: { name: data.name } }),
		entityName: "Payee",
		queryKey: ["payees"],
	});
	const form = useAppForm({
		defaultValues: {
			name: "",
		},
		validators: {
			onSubmit: payeeSchema,
		},
		onSubmit: async ({ value }) => {
			mutate(
				{ data: { name: value.name } },
				{
					onSuccess: () => {
						form.reset();
						setOpen(false);
					},
				},
			);
		},
	});
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-8"
		>
			<form.AppField name="name">
				{(field) => (
					<field.Input label="Payee Name" placeholder="Enter Payee Name" />
				)}
			</form.AppField>
			<form.AppForm>
				<form.SubmitButton
					isLoading={isPending}
					buttonText="Save"
					withReset
					onReset={() => {
						form.reset();
						setOpen(false);
					}}
				/>
			</form.AppForm>
		</form>
	);
}
