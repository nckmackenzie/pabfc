import { formOptions } from "@tanstack/react-form";
import { normalizeText } from "@/lib/helpers";
import { type EmployeeSchema, employeeSchema } from "./schemas";

export const EMPLOYEE_NO_MINIMUM_LENGTH = 4;

export function formatText(text: string): string {
	return text
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export function formatEmployeeNumber(
	sequence: number,
	minimumLength = EMPLOYEE_NO_MINIMUM_LENGTH,
): string {
	const normalizedSequence =
		Number.isFinite(sequence) && sequence > 0 ? Math.trunc(sequence) : 1;

	return String(normalizedSequence).padStart(minimumLength, "0");
}

export function extractEmployeeNumberSequence(
	employeeNo: string | null | undefined,
): number {
	if (!employeeNo) {
		return 0;
	}

	const digits = employeeNo.match(/\d+/g)?.join("");

	if (!digits) {
		return 0;
	}

	const sequence = Number.parseInt(digits, 10);

	return Number.isFinite(sequence) ? sequence : 0;
}

export function getNextEmployeeNumber(
	existingEmployeeNumbers: Array<string | null | undefined>,
	minimumLength = EMPLOYEE_NO_MINIMUM_LENGTH,
): string {
	const nextSequence =
		existingEmployeeNumbers.reduce(
			(highestSequence, employeeNo) =>
				Math.max(highestSequence, extractEmployeeNumberSequence(employeeNo)),
			0,
		) + 1;

	return formatEmployeeNumber(nextSequence, minimumLength);
}

export function createEmployeeDefaultValues(
	employeeNo = formatEmployeeNumber(1),
): EmployeeSchema {
	return {
		id: undefined,
		employeeNo: `E${employeeNo}`,
		firstName: "",
		lastName: "",
		gender: "unspecified",
		nationalId: null,
		dateOfBirth: null,
		emergencyContact: null,
		nextOfKin: null,
		kraPin: null,
		nssfNo: null,
		shifNo: null,
		helbRef: null,
		phone: "",
		email: null,
		jobTitle: null,
		departmentId: null,
		employmentType: "full_time",
		status: "active",
		hireDate: null,
		terminationDate: null,
		bankName: null,
		bankAccountNo: null,
		bankBranch: null,
		isResident: true,
	};
}

export function normalizeEmployeeFormValues(
	values: EmployeeSchema,
): EmployeeSchema {
	return {
		...values,
		employeeNo: values.employeeNo.trim(),
		firstName: values.firstName.trim(),
		lastName: values.lastName.trim(),
		nationalId: normalizeText(values.nationalId),
		dateOfBirth: normalizeText(values.dateOfBirth),
		emergencyContact: normalizeText(values.emergencyContact),
		nextOfKin: normalizeText(values.nextOfKin),
		kraPin: normalizeText(values.kraPin),
		nssfNo: normalizeText(values.nssfNo),
		shifNo: normalizeText(values.shifNo),
		helbRef: normalizeText(values.helbRef),
		phone: values.phone.trim(),
		email: normalizeText(values.email),
		jobTitle: normalizeText(values.jobTitle),
		departmentId: values.departmentId ?? null,
		hireDate: normalizeText(values.hireDate),
		terminationDate: normalizeText(values.terminationDate),
		bankName: normalizeText(values.bankName),
		bankAccountNo: normalizeText(values.bankAccountNo),
		bankBranch: normalizeText(values.bankBranch),
		isResident: values.isResident,
	};
}

export const employeeFormOpts = formOptions({
	defaultValues: createEmployeeDefaultValues(),
	validators: {
		onSubmit: employeeSchema,
	},
});
