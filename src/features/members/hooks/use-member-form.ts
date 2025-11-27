import {
	type MemberFormSchema,
	memberFormSchema,
} from "@/features/members/services/schemas";
import { useAppForm } from "@/lib/form";
// import { useFormMutation } from "@/hooks/use-form-mutation";

// Export the hook
export function useMemberForm() {
	// const memberMutation = useFormMutation({})
	return useAppForm({
		defaultValues: {
			firstName: "",
			lastName: "",
			dateOfBirth: null,
			gender: "unspecified",
			email: null,
			contact: "",
			idType: null,
			idNumber: "",
			memberStatus: "active",
			address: "",
			emergencyContactName: "",
			emergencyContactNo: "",
			emergencyContactRelationship: null,
			notes: "",
		} as MemberFormSchema,
		validators: {
			onSubmit: memberFormSchema,
		},
		onSubmit: ({ value }) => {
			console.log(value);
			// memberMutation.mutate({ data: value });
		},
	});
}

// Export the type
export type MemberFormInstance = ReturnType<typeof useMemberForm>;
