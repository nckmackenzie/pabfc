import Big from "big.js";
import { getEmployee } from "@/features/employees/services/employees.api";
import {
  getEffectiveBalanceCheck,
  getEntitlementByLeaveType,
  getExistingOneOffRequest,
  getHolidayDatesInRange,
  getOverlappingRequests,
  LeaveBalanceRow,
  LeaveEntitlementRow,
  LeaveRequestPayload,
} from "../services/leave.api";
import { failure, success } from "@/lib/result";
import { dateFormat } from "@/lib/helpers";
import {
  addDays,
  differenceInCalendarDays,
  differenceInMonths,
  endOfYear,
  getYear,
  isAfter,
  isWeekend,
  parseISO,
  startOfDay,
  startOfYear,
} from "date-fns";
import { LeaveType } from "@/drizzle/schema";

type NumericValue = string | number | Big | null | undefined;

export function toBig(value: NumericValue) {
  return new Big(value ?? 0);
}

export function todayIsoDate() {
  return dateFormat(new Date());
}

export function parseDateString(value: string) {
  return startOfDay(parseISO(value));
}

export function toDecimalString(value: NumericValue, decimals = 2) {
  return toBig(value).round(decimals).toFixed(decimals);
}

export function toDecimalNumber(value: NumericValue, decimals = 2) {
  return Number(toDecimalString(value, decimals));
}

export function formatLeaveDays(value: NumericValue) {
  const normalized = toDecimalString(value);
  return normalized.endsWith(".00")
    ? normalized.slice(0, -3)
    : normalized.endsWith("0")
      ? normalized.slice(0, -1)
      : normalized;
}

export function calculateWorkingDaysInclusive(
  startDate: string,
  endDate: string,
  holidayDates: Set<string>
) {
  let currentDate = parseDateString(startDate);
  const finalDate = parseDateString(endDate);
  let total = 0;

  while (!isAfter(currentDate, finalDate)) {
    const isoDate = dateFormat(currentDate);
    if (!isWeekend(currentDate) && !holidayDates.has(isoDate)) {
      total += 1;
    }

    currentDate = addDays(currentDate, 1);
  }

  return total;
}

export function calculateDateSpanDaysInclusive(startDate: string, endDate: string) {
  return differenceInCalendarDays(parseDateString(endDate), parseDateString(startDate)) + 1;
}

export function calculateServiceMonths(hireDate: string, startDate: string) {
  return Math.max(0, differenceInMonths(parseDateString(startDate), parseDateString(hireDate)));
}

function calculateSickLeavePayrollImpact({
  priorSickDaysUsed,
  requestedDays,
  fullPayThreshold,
}: {
  priorSickDaysUsed: NumericValue;
  requestedDays: NumericValue;
  fullPayThreshold: NumericValue;
}) {
  const previousDays = toBig(priorSickDaysUsed);
  const requestDays = toBig(requestedDays);
  const threshold = toBig(fullPayThreshold);

  if (previousDays.plus(requestDays).lte(threshold)) {
    return {
      affectsPayroll: false,
      payrollImpactNotes: null,
      fullPayDays: toDecimalString(requestDays),
      halfPayDays: toDecimalString(0),
    };
  }

  const remainingFullPayDays = threshold.minus(previousDays);
  const nonNegativeRemainingFullPayDays = remainingFullPayDays.gt(0)
    ? remainingFullPayDays
    : toBig(0);
  const fullPayDays = nonNegativeRemainingFullPayDays.gt(requestDays)
    ? requestDays
    : nonNegativeRemainingFullPayDays;
  const halfPayDays = requestDays.minus(fullPayDays);

  return {
    affectsPayroll: true,
    payrollImpactNotes: `${formatLeaveDays(fullPayDays)} days full pay, ${formatLeaveDays(halfPayDays)} days half pay`,
    fullPayDays: toDecimalString(fullPayDays),
    halfPayDays: toDecimalString(halfPayDays),
  };
}

function buildPayrollImpact({
  entitlement,
  leaveType,
  workingDaysRequested,
  balanceRow,
  pendingDays,
}: {
  entitlement: LeaveEntitlementRow;
  leaveType: LeaveType;
  workingDaysRequested: string;
  balanceRow: LeaveBalanceRow | null;
  pendingDays: string;
}) {
  if (leaveType === "unpaid") {
    return {
      affectsPayroll: true,
      payrollImpactNotes: "Unpaid leave — salary deduction required",
    };
  }

  if (leaveType !== "sick") {
    return {
      affectsPayroll: false,
      payrollImpactNotes: null,
    };
  }

  const priorUsed = toBig(balanceRow?.takenDays).plus(pendingDays).toFixed(2);

  const impact = calculateSickLeavePayrollImpact({
    priorSickDaysUsed: priorUsed,
    requestedDays: workingDaysRequested,
    fullPayThreshold: entitlement.fullPayDays,
  });

  return {
    affectsPayroll: impact.affectsPayroll,
    payrollImpactNotes: impact.payrollImpactNotes,
  };
}

export function calculateAvailableBalance({
  entitledDays,
  carriedForwardDays,
  adjustmentDays,
  takenDays,
  pendingDays = 0,
}: {
  entitledDays: NumericValue;
  carriedForwardDays: NumericValue;
  adjustmentDays: NumericValue;
  takenDays: NumericValue;
  pendingDays?: NumericValue;
}) {
  return toBig(entitledDays)
    .plus(carriedForwardDays ?? 0)
    .plus(adjustmentDays ?? 0)
    .minus(takenDays ?? 0)
    .minus(pendingDays ?? 0);
}

export async function validateLeaveRequestSubmission(
  payload: LeaveRequestPayload,
  options?: {
    excludePendingRequestId?: string;
    skipOverlapCheck?: boolean;
  }
) {
  const employee = await getEmployee({ data: payload.employeeId });
  if (!employee || employee.status !== "active") {
    return failure({
      type: "ValidationError",
      message: "Employee does not exist or is not active",
    });
  }

  const entitlement = await getEntitlementByLeaveType({ data: payload.leaveType });
  if (!entitlement) {
    return failure({
      type: "ValidationError",
      message: "Leave type configuration was not found",
    });
  }

  if (entitlement.applicableGender === "female" && employee.gender !== "female") {
    return failure({
      type: "ValidationError",
      message: "This leave type is only available to female employees",
    });
  }

  if (entitlement.applicableGender === "male" && employee.gender !== "male") {
    return failure({
      type: "ValidationError",
      message: "This leave type is only available to male employees",
    });
  }

  if (payload.startDate > payload.endDate) {
    return failure({
      type: "ValidationError",
      message: "Start date cannot be after end date",
    });
  }

  if (payload.startDate < todayIsoDate()) {
    return failure({
      type: "ValidationError",
      message: "Start date cannot be in the past",
    });
  }

  if (calculateDateSpanDaysInclusive(payload.startDate, payload.endDate) > 365) {
    return failure({
      type: "ValidationError",
      message: "Leave requests cannot span more than 365 days",
    });
  }

  const holidayDates = await getHolidayDatesInRange({
    data: { startDate: payload.startDate, endDate: payload.endDate },
  });
  const workingDaysRequested = calculateWorkingDaysInclusive(
    payload.startDate,
    payload.endDate,
    holidayDates
  );

  if (workingDaysRequested <= 0) {
    return failure({
      type: "ValidationError",
      message: "The selected date range does not contain any working days",
    });
  }

  if (!employee.hireDate && entitlement.minServiceMonthsRequired > 0) {
    return failure({
      type: "ValidationError",
      message: "Employee hire date is required before this leave type can be requested",
    });
  }

  if (employee.hireDate) {
    const serviceMonths = calculateServiceMonths(employee.hireDate, payload.startDate);
    if (serviceMonths < entitlement.minServiceMonthsRequired) {
      const remaining = entitlement.minServiceMonthsRequired - serviceMonths;
      return failure({
        type: "ValidationError",
        message: `Employee needs ${remaining} more month(s) of service before requesting this leave`,
      });
    }
  }

  if (entitlement.isOneOffEntitlement) {
    const existingRequest = await getExistingOneOffRequest({
      data: { employeeId: payload.employeeId, leaveType: payload.leaveType },
    });

    if (existingRequest && existingRequest.id !== options?.excludePendingRequestId) {
      return failure({
        type: "ValidationError",
        message: "A pending or approved request already exists for this one-off leave type",
      });
    }
  }

  const leaveYear = Number.parseInt(payload.startDate.slice(0, 4), 10);
  const effectiveBalance = await getEffectiveBalanceCheck({
    data: {
      employeeId: payload.employeeId,
      leaveType: payload.leaveType,
      leaveYear,
      excludeRequestId: options?.excludePendingRequestId,
    },
  });

  if (!entitlement.isOneOffEntitlement && payload.leaveType !== "unpaid") {
    if (!effectiveBalance) {
      return failure({
        type: "ValidationError",
        message: "Leave balance has not been initialized for this employee",
      });
    }

    const available = calculateAvailableBalance({
      entitledDays: effectiveBalance.balanceRow.entitledDays,
      carriedForwardDays: effectiveBalance.balanceRow.carriedForwardDays,
      adjustmentDays: effectiveBalance.balanceRow.adjustmentDays,
      takenDays: effectiveBalance.balanceRow.takenDays,
      pendingDays: effectiveBalance.pendingDays,
    });

    const requested = toBig(workingDaysRequested);
    if (requested.gt(available)) {
      const shortfall = requested.minus(available);
      return failure({
        type: "ValidationError",
        message: `Insufficient leave balance. Shortfall: ${formatLeaveDays(shortfall)} day(s)`,
      });
    }
  }

  if (!options?.skipOverlapCheck) {
    const conflicts = await getOverlappingRequests({
      data: {
        employeeId: payload.employeeId,
        startDate: payload.startDate,
        endDate: payload.endDate,
        excludeRequestId: options?.excludePendingRequestId,
      },
    });

    if (conflicts.length) {
      const conflictDates = conflicts
        .map((conflict) => `${conflict.startDate} to ${conflict.endDate}`)
        .join(", ");

      return failure({
        type: "ValidationError",
        message: `Leave request overlaps with existing request(s): ${conflictDates}`,
      });
    }
  }

  const payrollImpact = await buildPayrollImpact({
    entitlement,
    leaveType: payload.leaveType,
    workingDaysRequested: toDecimalString(workingDaysRequested),
    balanceRow: effectiveBalance?.balanceRow ?? null,
    pendingDays: effectiveBalance?.pendingDays ?? "0",
  });

  return success({
    employee,
    entitlement,
    leaveYear,
    workingDaysRequested: toDecimalString(workingDaysRequested),
    medicalCertificateRequired: entitlement.requiresMedicalCert,
    affectsPayroll: payrollImpact.affectsPayroll,
    payrollImpactNotes: payrollImpact.payrollImpactNotes,
  });
}

export function calculateFullMonthsRemainingInLeaveYear(hireDate: string, leaveYear: number) {
  const hire = parseDateString(hireDate);
  if (getYear(hire) > leaveYear) {
    return 0;
  }

  if (getYear(hire) < leaveYear) {
    return 12;
  }

  return 12 - hire.getMonth();
}

export function calculateInitialEntitledDays({
  annualDaysEntitled,
  accrualRatePerMonth,
  hireDate,
  leaveYear,
}: {
  annualDaysEntitled: NumericValue;
  accrualRatePerMonth: NumericValue;
  hireDate: string | null;
  leaveYear: number;
}) {
  if (!hireDate) {
    return toDecimalString(annualDaysEntitled);
  }

  if (!accrualRatePerMonth) {
    return toDecimalString(annualDaysEntitled);
  }

  const hire = parseDateString(hireDate);
  const yearStart = startOfYear(new Date(leaveYear, 0, 1));
  const yearEnd = endOfYear(new Date(leaveYear, 0, 1));

  if (hire > yearEnd) {
    return toDecimalString(0);
  }

  if (hire < yearStart) {
    return toDecimalString(annualDaysEntitled);
  }

  const monthsRemaining = calculateFullMonthsRemainingInLeaveYear(hireDate, leaveYear);

  return toDecimalString(toBig(accrualRatePerMonth).times(monthsRemaining));
}

export function inArrayValue<T extends string>(value: T, list: Array<T>) {
  return list.includes(value);
}
