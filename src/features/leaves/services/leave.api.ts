import { authMiddleware } from "@/middlewares/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import {
  employeeIdSchema,
  employeeLeaveTypeSchema,
  leaveBalanceAdjustmentSchema,
  leaveBalanceViewSchema,
  leaveRequestListFilterSchema,
  leaveRequestSchema,
  leaveTypeSchema,
  leaveYearSchema,
} from "../utils/schemas";
import { requirePermission } from "@/lib/permissions/permissions";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNull,
  lte,
  or,
  sql,
  type SQL,
  gte,
  inArray,
  ne,
} from "drizzle-orm";
import {
  employeeLeaveBalances,
  employees,
  leaveBalanceAdjustments,
  leaveEntitlements,
  leaveRequests,
  type LeaveType,
  publicHolidays,
} from "@/drizzle/schema";
import { db } from "@/drizzle/db";
import { normalizeText } from "@/lib/helpers";
import { failure, success } from "@/lib/result";
import { logActivity } from "@/services/activity-logger";
import {
  calculateAvailableBalance,
  calculateInitialEntitledDays,
  formatLeaveDays,
  inArrayValue,
  toBig,
  todayIsoDate,
  toDecimalString,
  validateLeaveRequestSubmission,
} from "../utils/helpers";
import { z } from "zod";
import { dateSchema } from "@/lib/schema-rules";

async function getBalanceRow({
  employeeId,
  leaveType,
  leaveYear,
}: {
  employeeId: string;
  leaveType: LeaveType;
  leaveYear: number;
}) {
  return db.query.employeeLeaveBalances.findFirst({
    where: and(
      eq(employeeLeaveBalances.employeeId, employeeId),
      eq(employeeLeaveBalances.leaveType, leaveType),
      eq(employeeLeaveBalances.leaveYear, leaveYear)
    ),
  });
}

async function buildLeaveBalanceSummary({
  employeeId,
  leaveYear,
}: {
  employeeId: string;
  leaveYear: number;
}) {
  const [entitlements, balances, pendingTotals] = await Promise.all([
    db.query.leaveEntitlements.findMany({
      orderBy: asc(leaveEntitlements.id),
    }),
    db
      .select()
      .from(employeeLeaveBalances)
      .where(
        and(
          eq(employeeLeaveBalances.employeeId, employeeId),
          eq(employeeLeaveBalances.leaveYear, leaveYear)
        )
      ),
    db
      .select({
        leaveType: leaveRequests.leaveType,
        total: sql<string>`coalesce(sum(${leaveRequests.workingDaysRequested}), '0')`,
      })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, employeeId),
          eq(leaveRequests.leaveYear, leaveYear),
          eq(leaveRequests.status, "pending")
        )
      )
      .groupBy(leaveRequests.leaveType),
  ]);

  const balanceMap = new Map(balances.map((balance) => [balance.leaveType, balance]));
  const pendingMap = new Map(pendingTotals.map((pending) => [pending.leaveType, pending.total]));

  return entitlements.map((entitlement) => {
    const balance = balanceMap.get(entitlement.leaveType);
    const pendingDays = pendingMap.get(entitlement.leaveType) ?? "0";
    const availableBalance = calculateAvailableBalance({
      entitledDays: balance?.entitledDays ?? 0,
      carriedForwardDays: balance?.carriedForwardDays ?? 0,
      adjustmentDays: balance?.adjustmentDays ?? 0,
      takenDays: balance?.takenDays ?? 0,
      pendingDays,
    });

    return {
      leaveType: entitlement.leaveType,
      entitledDays: balance?.entitledDays ?? "0",
      carriedForwardDays: balance?.carriedForwardDays ?? "0",
      adjustmentDays: balance?.adjustmentDays ?? "0",
      takenDays: balance?.takenDays ?? "0",
      pendingDays,
      availableBalance: toDecimalString(availableBalance),
      carryForwardExpiresAt: balance?.carryForwardExpiresAt ?? null,
      isOneOffEntitlement: entitlement.isOneOffEntitlement,
    };
  });
}

export const getExistingOneOffRequest = createServerFn()
  .middleware([authMiddleware])
  .validator(employeeLeaveTypeSchema)
  .handler(async ({ data }) => {
    return await db.query.leaveRequests.findFirst({
      where: and(
        eq(leaveRequests.employeeId, data.employeeId),
        eq(leaveRequests.leaveType, data.leaveType),
        inArray(leaveRequests.status, ["pending", "approved"])
      ),
    });
  });

export const getOverlappingRequests = createServerFn()
  .middleware([authMiddleware])
  .validator(
    z.object({
      employeeId: employeeIdSchema,
      startDate: z.string().trim().min(1, "Start date is required"),
      endDate: z.string().trim().min(1, "End date is required"),
      excludeRequestId: z.string().trim().optional(),
    })
  )
  .handler(async ({ data }) => {
    return db
      .select({
        id: leaveRequests.id,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        status: leaveRequests.status,
      })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, data.employeeId),
          inArray(leaveRequests.status, ["pending", "approved"]),
          lte(leaveRequests.startDate, data.endDate),
          gte(leaveRequests.endDate, data.startDate),
          data.excludeRequestId ? ne(leaveRequests.id, data.excludeRequestId) : undefined
        )
      );
  });

export const getEffectiveBalanceCheck = createServerFn()
  .middleware([authMiddleware])
  .validator(
    z.object({
      employeeId: employeeIdSchema,
      leaveType: leaveTypeSchema,
      leaveYear: leaveYearSchema,
      excludeRequestId: z.string().trim().optional(),
    })
  )
  .handler(async ({ data: { employeeId, leaveType, leaveYear, excludeRequestId } }) => {
    const balanceRow = await getBalanceRow({
      employeeId,
      leaveType,
      leaveYear,
    });

    if (!balanceRow) {
      return null;
    }

    const pendingDays = await db
      .select({
        total: sql<string>`coalesce(sum(${leaveRequests.workingDaysRequested}), '0')`,
      })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, employeeId),
          eq(leaveRequests.leaveType, leaveType),
          eq(leaveRequests.leaveYear, leaveYear),
          eq(leaveRequests.status, "pending"),
          excludeRequestId ? ne(leaveRequests.id, excludeRequestId) : undefined
        )
      )
      .then((result) => result[0]?.total ?? "0");

    return { balanceRow, pendingDays };
  });

export async function initialiseLeaveBalancesForEmployeeRows({
  employeeId,
  leaveYear,
}: {
  employeeId: string;
  leaveYear: number;
}) {
  const employee = await db.query.employees.findFirst({
    where: and(eq(employees.id, employeeId), isNull(employees.deletedAt)),
  });

  if (!employee) {
    return failure({
      type: "NotFoundError",
      message: "Employee not found",
    });
  }

  const entitlements = await db.query.leaveEntitlements.findMany({
    orderBy: asc(leaveEntitlements.id),
  });

  let createdCount = 0;
  let skippedCount = 0;

  for (const entitlement of entitlements) {
    if (entitlement.isOneOffEntitlement) {
      skippedCount += 1;
      continue;
    }

    const existing = await getBalanceRow({
      employeeId,
      leaveType: entitlement.leaveType,
      leaveYear,
    });

    if (existing) {
      skippedCount += 1;
      continue;
    }

    const entitledDays = calculateInitialEntitledDays({
      annualDaysEntitled: entitlement.annualDaysEntitled,
      accrualRatePerMonth: entitlement.accrualRatePerMonth,
      hireDate: employee.hireDate,
      leaveYear,
    });

    await db.insert(employeeLeaveBalances).values({
      employeeId,
      leaveType: entitlement.leaveType,
      leaveYear,
      entitledDays,
      carriedForwardDays: "0",
      adjustmentDays: "0",
      takenDays: "0",
      carryForwardExpiresAt: null,
    });

    createdCount += 1;
  }

  return success({ createdCount, skippedCount });
}

export const initialiseLeaveBalancesForEmployee = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      employeeId: employeeIdSchema,
      leaveYear: leaveYearSchema,
    })
  )
  .handler(async ({ data: { employeeId, leaveYear } }) => {
    await requirePermission("leaves:adjust-balances");
    return initialiseLeaveBalancesForEmployeeRows({ employeeId, leaveYear });
  });

export const getLeaveRequestsFn = createServerFn()
  .middleware([authMiddleware])
  .validator(leaveRequestListFilterSchema)
  .handler(async ({ data }) => {
    await requirePermission("leaves:view");
    const conditions: Array<SQL | undefined> = [];

    if (data.q) {
      const query = `%${data.q}%`;
      conditions.push(
        or(
          ilike(employees.firstName, query),
          ilike(employees.lastName, query),
          ilike(sql`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`, query),
          ilike(leaveRequests.reason, query),
          ilike(sql`cast(${leaveRequests.leaveType} as text)`, query)
        )
      );
    }

    if (data.status) {
      conditions.push(eq(leaveRequests.status, data.status));
    }

    if (data.leaveType) {
      conditions.push(eq(leaveRequests.leaveType, data.leaveType));
    }

    if (data.year) {
      conditions.push(eq(leaveRequests.leaveYear, data.year));
    }

    const requests = await db
      .select({
        id: leaveRequests.id,
        employeeId: employees.id,
        employeeName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
        employeeNo: employees.employeeNo,
        leaveType: leaveRequests.leaveType,
        leaveYear: leaveRequests.leaveYear,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        workingDaysRequested: leaveRequests.workingDaysRequested,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        createdAt: leaveRequests.createdAt,
      })
      .from(leaveRequests)
      .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(desc(leaveRequests.createdAt));

    const total = requests.length;
    const startIndex = (data.page - 1) * data.pageSize;
    const items = requests.slice(startIndex, startIndex + data.pageSize);

    return {
      items,
      total,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

export const getEmployeesForLeaveOptionsFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async () => {
    await requirePermission("leaves:view");
    return db
      .select({
        id: employees.id,
        fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
      })
      .from(employees)
      .where(and(eq(employees.status, "active"), isNull(employees.deletedAt)))
      .orderBy(asc(employees.firstName), asc(employees.lastName));
  });

export const getEntitlementByLeaveType = createServerFn()
  .middleware([authMiddleware])
  .validator(leaveTypeSchema)
  .handler(async ({ data }) => {
    const entitlement = await db.query.leaveEntitlements.findFirst({
      where: eq(leaveEntitlements.leaveType, data),
    });
    return entitlement;
  });

export const getHolidayDatesInRange = createServerFn()
  .middleware([authMiddleware])
  .validator(
    z.object({
      startDate: dateSchema("Start date is required"),
      endDate: dateSchema("End date is required"),
    })
  )
  .handler(async ({ data }) => {
    const holidays = await db
      .select({
        holidayDate: publicHolidays.holidayDate,
      })
      .from(publicHolidays)
      .where(
        and(
          lte(publicHolidays.holidayDate, data.endDate),
          gte(publicHolidays.holidayDate, data.startDate)
        )
      );

    return new Set(holidays.map((holiday) => holiday.holidayDate));
  });

export const submitLeaveRequestFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(leaveRequestSchema)
  .handler(async ({ data, context }) => {
    await requirePermission("leaves:create");

    try {
      const validation = await validateLeaveRequestSubmission(data);

      if (!validation.success) {
        return validation;
      }

      await db.transaction(async (tx) => {
        await tx
          .insert(leaveRequests)
          .values({
            employeeId: data.employeeId,
            leaveType: data.leaveType,
            leaveYear: validation.data.leaveYear,
            startDate: data.startDate,
            endDate: data.endDate,
            workingDaysRequested: validation.data.workingDaysRequested,
            reason: normalizeText(data.reason),
            status: "pending",
            medicalCertificateRequired: validation.data.medicalCertificateRequired,
            affectsPayroll: validation.data.affectsPayroll,
            payrollImpactNotes: validation.data.payrollImpactNotes,
          })
          .returning();

        await logActivity({
          data: {
            action: "submit leave request",
            description: `Submitted ${data.leaveType} leave request for employee ${data.employeeId} from ${data.startDate} to ${data.endDate}`,
            userId: context.user.id,
          },
        });
      });

      return success(undefined);
    } catch (error) {
      console.error("Error submitting leave request:", error);
      return failure({
        type: "ApplicationError",
        message: "An error occurred while submitting the leave request. Please try again later.",
      });
    }
  });

export const approveLeaveRequestFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ requestId: z.string().trim().min(1, "Request ID is required") }))
  .handler(
    async ({
      data: { requestId },
      context: {
        user: { id: userId },
      },
    }) => {
      await requirePermission("leaves:approve");

      const request = await db.query.leaveRequests.findFirst({
        where: eq(leaveRequests.id, requestId),
      });

      if (!request) {
        return failure({
          type: "NotFoundError",
          message: "Leave request not found",
        });
      }

      if (request.status !== "pending") {
        return failure({
          type: "ConflictError",
          message: "Only pending leave requests can be approved",
        });
      }

      const entitlement = await getEntitlementByLeaveType({ data: request.leaveType });
      if (!entitlement) {
        return failure({
          type: "ValidationError",
          message: "Leave type configuration was not found",
        });
      }

      if (!entitlement.isOneOffEntitlement) {
        const effectiveBalance = await getEffectiveBalanceCheck({
          data: {
            employeeId: request.employeeId,
            leaveType: request.leaveType,
            leaveYear: request.leaveYear,
            excludeRequestId: request.id,
          },
        });

        if (!effectiveBalance && request.leaveType !== "unpaid") {
          return failure({
            type: "ValidationError",
            message: "Leave balance has not been initialized for this employee",
          });
        }

        const available = calculateAvailableBalance({
          entitledDays: effectiveBalance?.balanceRow.entitledDays ?? "0",
          carriedForwardDays: effectiveBalance?.balanceRow.carriedForwardDays ?? "0",
          adjustmentDays: effectiveBalance?.balanceRow.adjustmentDays ?? "0",
          takenDays: effectiveBalance?.balanceRow.takenDays ?? "0",
          pendingDays: effectiveBalance?.pendingDays ?? "0",
        });

        if (
          effectiveBalance &&
          request.leaveType !== "unpaid" &&
          toBig(request.workingDaysRequested).gt(available)
        ) {
          const shortfall = toBig(request.workingDaysRequested).minus(available);
          return failure({
            type: "ValidationError",
            message: `Insufficient leave balance. Shortfall: ${formatLeaveDays(shortfall)} day(s)`,
          });
        }
      }

      try {
        const approvedRequest = await db.transaction(async (tx) => {
          const pendingRequest = await tx.query.leaveRequests.findFirst({
            where: eq(leaveRequests.id, requestId),
          });

          if (!pendingRequest || pendingRequest.status !== "pending") {
            return null;
          }

          if (!entitlement.isOneOffEntitlement) {
            await tx
              .update(employeeLeaveBalances)
              .set({
                takenDays: sql`${employeeLeaveBalances.takenDays} + ${pendingRequest.workingDaysRequested}`,
              })
              .where(
                and(
                  eq(employeeLeaveBalances.employeeId, pendingRequest.employeeId),
                  eq(employeeLeaveBalances.leaveType, pendingRequest.leaveType),
                  eq(employeeLeaveBalances.leaveYear, pendingRequest.leaveYear)
                )
              );
          }

          const [updatedRequest] = await tx
            .update(leaveRequests)
            .set({
              status: "approved",
              approvedBy: userId,
              approvedAt: new Date(),
              rejectionReason: null,
            })
            .where(eq(leaveRequests.id, requestId))
            .returning();

          return updatedRequest;
        });

        if (!approvedRequest) {
          return failure({
            type: "ConflictError",
            message: "Leave request has already been processed",
          });
        }

        return success(approvedRequest);
      } catch (error) {
        console.error("Error approving leave request:", error);
        return failure({
          type: "ApplicationError",
          message: "An error occurred while approving the leave request. Please try again later.",
        });
      }
    }
  );

export const rejectLeaveRequestFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      requestId: z.string().trim().min(1, "Request ID is required"),
      rejectionReason: z.string().trim().min(1, "Rejection reason is required"),
    })
  )
  .handler(
    async ({
      data: { rejectionReason, requestId },
      context: {
        user: { id: userId },
      },
    }) => {
      await requirePermission("leaves:approve");
      try {
        const request = await db.query.leaveRequests.findFirst({
          where: eq(leaveRequests.id, requestId),
        });

        if (!request) {
          return failure({
            type: "NotFoundError",
            message: "Leave request not found",
          });
        }

        if (request.status !== "pending") {
          return failure({
            type: "ConflictError",
            message: "Only pending leave requests can be rejected",
          });
        }

        const [updatedRequest] = await db
          .update(leaveRequests)
          .set({
            status: "rejected",
            approvedBy: userId,
            approvedAt: new Date(),
            rejectionReason: rejectionReason.trim(),
          })
          .where(eq(leaveRequests.id, requestId))
          .returning();

        return success(updatedRequest);
      } catch (error) {
        console.error("Error rejecting leave request:", error);
        return failure({
          type: "ApplicationError",
          message: "An error occurred while rejecting the leave request. Please try again later.",
        });
      }
    }
  );

export const cancelLeaveRequestFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      requestId: z.string().trim().min(1, "Request ID is required"),
    })
  )
  .handler(
    async ({
      data: { requestId },
      context: {
        user: { id: cancelledBy },
      },
    }) => {
      await requirePermission("leaves:approve");

      try {
        const request = await db.query.leaveRequests.findFirst({
          where: eq(leaveRequests.id, requestId),
        });

        if (!request) {
          return failure({
            type: "NotFoundError",
            message: "Leave request not found",
          });
        }

        if (!inArrayValue(request.status, ["pending", "approved"])) {
          return failure({
            type: "ConflictError",
            message: "Only pending or approved leave requests can be cancelled",
          });
        }

        if (request.status === "pending") {
          const [updatedRequest] = await db
            .update(leaveRequests)
            .set({
              status: "cancelled",
              cancelledBy,
              cancelledAt: new Date(),
            })
            .where(eq(leaveRequests.id, requestId))
            .returning();

          return success(updatedRequest);
        }

        if (request.startDate <= todayIsoDate()) {
          return failure({
            type: "ValidationError",
            message:
              "Approved leave that has already started cannot be cancelled. Handle it with a manual balance adjustment instead.",
          });
        }

        const entitlement = await getEntitlementByLeaveType({ data: request.leaveType });
        if (!entitlement) {
          return failure({
            type: "ValidationError",
            message: "Leave type configuration was not found",
          });
        }

        const cancelledRequest = await db.transaction(async (tx) => {
          if (!entitlement.isOneOffEntitlement) {
            await tx
              .update(employeeLeaveBalances)
              .set({
                takenDays: sql`${employeeLeaveBalances.takenDays} - ${request.workingDaysRequested}`,
              })
              .where(
                and(
                  eq(employeeLeaveBalances.employeeId, request.employeeId),
                  eq(employeeLeaveBalances.leaveType, request.leaveType),
                  eq(employeeLeaveBalances.leaveYear, request.leaveYear)
                )
              );
          }

          const [updatedRequest] = await tx
            .update(leaveRequests)
            .set({
              status: "cancelled",
              cancelledBy,
              cancelledAt: new Date(),
            })
            .where(eq(leaveRequests.id, requestId))
            .returning();

          return updatedRequest;
        });

        return success(cancelledRequest);
      } catch (error) {
        console.error("Error cancelling leave request:", error);
        return failure({
          type: "ApplicationError",
          message: "An error occurred while cancelling the leave request. Please try again later.",
        });
      }
    }
  );

export const getLeaveBalancesViewFn = createServerFn()
  .middleware([authMiddleware])
  .validator(leaveBalanceViewSchema)
  .handler(async ({ data }) => {
    await requirePermission("leaves:view");

    if (!data.employeeId) {
      return [];
    }

    return buildLeaveBalanceSummary({
      employeeId: data.employeeId,
      leaveYear: data.leaveYear ?? new Date().getFullYear(),
    });
  });

export const adjustLeaveBalanceFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(leaveBalanceAdjustmentSchema)
  .handler(
    async ({
      data: { adjustmentDays, employeeId, leaveType, leaveYear, reason },
      context: {
        user: { id: userId },
      },
    }) => {
      await requirePermission("leaves:adjust-balances");
      try {
        const balanceRow = await getBalanceRow({ employeeId, leaveType, leaveYear });

        if (!balanceRow) {
          return failure({
            type: "NotFoundError",
            message: "Leave balance row was not found",
          });
        }

        const newAdjustmentTotal = toBig(balanceRow.adjustmentDays).plus(adjustmentDays);
        const resultingBalance = calculateAvailableBalance({
          entitledDays: balanceRow.entitledDays,
          carriedForwardDays: balanceRow.carriedForwardDays,
          adjustmentDays: newAdjustmentTotal,
          takenDays: balanceRow.takenDays,
        });
        const allowsNegativeBalance = reason.toLowerCase().includes("correction");

        const warning = resultingBalance.lt(0)
          ? "Resulting effective balance is below zero because this was marked as a correction."
          : null;

        if (resultingBalance.lt(0) && !allowsNegativeBalance) {
          return failure({
            type: "ValidationError",
            message:
              "Adjustment would make the effective balance negative. Mark the reason as a correction to allow this.",
          });
        }

        const updatedBalance = await db.transaction(async (tx) => {
          const [updatedRow] = await tx
            .update(employeeLeaveBalances)
            .set({
              adjustmentDays: toDecimalString(newAdjustmentTotal),
            })
            .where(eq(employeeLeaveBalances.id, balanceRow.id))
            .returning();

          await tx.insert(leaveBalanceAdjustments).values({
            employeeId,
            leaveType,
            leaveYear,
            adjustmentDays: toDecimalString(adjustmentDays),
            reason: reason.trim(),
            performedBy: userId,
            appliedToBalanceAdjustmentTotal: true,
            warning,
          });

          return updatedRow;
        });

        return success(updatedBalance);
      } catch (error) {
        console.error(error);
        return failure({
          type: "ApplicationError",
          message: "An error occurred while adjusting the leave balance. Please try again later.",
        });
      }
    }
  );

export type LeaveRequestListResponse = Awaited<ReturnType<typeof getLeaveRequestsFn>>;
export type LeaveRequestListItem = LeaveRequestListResponse["items"][number];
export type LeaveRequestPayload = z.infer<typeof leaveRequestSchema>;
export type LeaveEntitlementRow = typeof leaveEntitlements.$inferSelect;
export type LeaveBalanceRow = typeof employeeLeaveBalances.$inferSelect;
export type LeaveBalanceSummaryItem = Awaited<ReturnType<typeof buildLeaveBalanceSummary>>[number];
