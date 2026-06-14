import { useStore } from "@tanstack/react-form";
import { SelectItem } from "@/components/ui/select";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { usePreventUnsavedChanges } from "@/hooks/use-prevent-navigation";
import { useAppForm } from "@/lib/form";
import { submitLeaveRequestFn } from "../services/leave.api";
import { LEAVE_TYPES } from "@/drizzle/schema";
import { formatText } from "@/features/employees/utils/helpers";
import { useLoaderData } from "@tanstack/react-router";
import { toTitleCase } from "@/lib/utils";
import { LeaveRequestFormValues, leaveRequestSchema } from "../utils/schemas";
import { PageHeader } from "@/components/ui/page-header";

const defaultValues = {
  id: undefined,
  employeeId: "",
  leaveType: "annual",
  startDate: "",
  endDate: "",
  reason: "",
} as LeaveRequestFormValues;

export function LeaveRequestForm() {
  const employees = useLoaderData({ from: "/app/leaves/new" });

  const mutation = useFormUpsert({
    upsertFn: (data: LeaveRequestFormValues) => submitLeaveRequestFn({ data }),
    entityName: "Leave request",
    navigateTo: "/app/leaves",
    queryKey: ["leaves"],
    successMessage: {
      create: "Leave request submitted successfully.",
    },
    onReset: () => form.reset(),
  });

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: leaveRequestSchema,
    },
    onSubmit: ({ value }) => {
      mutation.mutate(value);
    },
  });

  const isDirty = useStore(form.store, (state) => state.isDirty);
  usePreventUnsavedChanges(isDirty);

  return (
    <div className="bg-card border rounded-md p-6 max-w-3xl space-y-6">
      <PageHeader
        title="Submit Leave Request"
        description="Create a new leave request for an active employee."
      />
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <form.AppField name="employeeId">
            {(field) => (
              <field.Select label="Employee" required>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {toTitleCase(employee.fullName)}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>
          <form.AppField name="leaveType">
            {(field) => (
              <field.Select label="Leave Type" required>
                {LEAVE_TYPES.map((leaveType) => (
                  <SelectItem key={leaveType} value={leaveType}>
                    {formatText(leaveType)}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>
          <form.AppField name="startDate">
            {(field) => <field.Input label="Start Date" type="date" required />}
          </form.AppField>
          <form.AppField name="endDate">
            {(field) => <field.Input label="End Date" type="date" required />}
          </form.AppField>
        </div>
        <form.AppField name="reason">
          {(field) => (
            <field.Textarea
              label="Reason"
              placeholder="Add any supporting context for this request"
              rows={5}
            />
          )}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton
            buttonText="Submit Leave Request"
            isLoading={mutation.isPending}
            withReset
          />
        </form.AppForm>
      </form>
    </div>
  );
}
