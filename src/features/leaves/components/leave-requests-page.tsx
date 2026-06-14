import { BasePageComponent } from "@/components/ui/base-page";
import { LeaveRequestFilters } from "./leave-request-filters";
import { ButtonLink } from "@/components/ui/links";
import { CalculatorIcon } from "@/components/ui/icons";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { LeaveRequestsTable } from "@/features/leaves/components/leave-request-table";
import { useFilters } from "@/hooks/use-filters";
import { getRouteApi } from "@tanstack/react-router";
import { DatatableSkeleton } from "@/components/ui/loaders";

export function LeaveRequestsPage() {
  const { filters, setFilters } = useFilters(getRouteApi("/app/leaves/").id);
  return (
    <BasePageComponent
      pageTitle="Leave Management"
      pageDescription="Review requests, payroll impact, and supporting leave metadata."
      hasNewButtonLink
      newButtonLinkPath="/app/leaves/new"
      buttonText="Submit Leave Request"
      createPermissions={["leaves:create"]}
      defaultSearchValue={filters.q}
      searchPlaceholder="Search employee, reason, or leave type..."
      onSearch={(q) => setFilters({ q })}
      extraActionButtons={
        <>
          <ButtonLink path="/app/leaves/balances" variant="outline">
            <CalculatorIcon />
            Balances
          </ButtonLink>
        </>
      }
      customFilters={<LeaveRequestFilters filters={filters} setFilters={setFilters} />}
    >
      <ErrorBoundaryWithSuspense loader={<DatatableSkeleton />}>
        <LeaveRequestsTable filters={filters} />
      </ErrorBoundaryWithSuspense>
    </BasePageComponent>
  );
}
