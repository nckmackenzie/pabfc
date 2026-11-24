import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import {
	getEnquiryConversionReport,
	getEnquiryDashboardSnapshot,
	getEnquiryReportStaffOptions,
} from "@/features/enquiries/services/enquiries.report.api";
import {
	getEnquirySmsHistory,
	getEnquirySmsTemplates,
	previewEnquirySmsRecipients,
} from "@/features/enquiries/services/enquiries.sms.api";
import {
	checkEnquiryDuplicates,
	getAssignableEmployees,
	getEnquiries,
	getEnquiry,
	getEnquiryPlanOptions,
} from "@/features/enquiries/services/enquiries.queries.api";
import type {
	EnquiryConversionFormSchema,
	EnquirySmsRecipientsSchema,
	EnquiryValidateSearch,
} from "@/features/enquiries/services/schemas";

export const enquiryQueries = {
	all: ["enquiries"] as const,
	list: (filters: EnquiryValidateSearch) =>
		queryOptions({
			queryKey: [...enquiryQueries.all, "list", filters] as const,
			queryFn: () => getEnquiries({ data: filters }),
			placeholderData: keepPreviousData,
		}),
	detail: (enquiryId: string) =>
		queryOptions({
			queryKey: [...enquiryQueries.all, "detail", enquiryId] as const,
			queryFn: () => getEnquiry({ data: enquiryId }),
		}),
	assignableEmployees: () =>
		queryOptions({
			queryKey: [...enquiryQueries.all, "assignable-employees"] as const,
			queryFn: () => getAssignableEmployees(),
			staleTime: 60 * 1000,
		}),
	planOptions: () =>
		queryOptions({
			queryKey: [...enquiryQueries.all, "plan-options"] as const,
			queryFn: () => getEnquiryPlanOptions(),
			staleTime: 60 * 1000,
		}),
	// Counts only (who will and won't be texted); never names or numbers.
	smsPreview: (input: EnquirySmsRecipientsSchema) =>
		queryOptions({
			queryKey: [...enquiryQueries.all, "sms-preview", input] as const,
			queryFn: () => previewEnquirySmsRecipients({ data: input }),
			staleTime: 0,
		}),
	smsTemplates: () =>
		queryOptions({
			queryKey: [...enquiryQueries.all, "sms-templates"] as const,
			queryFn: () => getEnquirySmsTemplates(),
			staleTime: 60 * 1000,
		}),
	smsHistory: (enquiryId: string) =>
		queryOptions({
			queryKey: [...enquiryQueries.all, "sms-history", enquiryId] as const,
			queryFn: () => getEnquirySmsHistory({ data: enquiryId }),
		}),
	conversionReport: (filters: EnquiryConversionFormSchema) =>
		queryOptions({
			queryKey: [...enquiryQueries.all, "conversion-report", filters] as const,
			queryFn: () => getEnquiryConversionReport({ data: filters }),
		}),
	reportStaffOptions: () =>
		queryOptions({
			queryKey: [...enquiryQueries.all, "report-staff-options"] as const,
			queryFn: () => getEnquiryReportStaffOptions(),
			staleTime: 5 * 60 * 1000,
		}),
	dashboardSnapshot: () =>
		queryOptions({
			queryKey: [...enquiryQueries.all, "dashboard-snapshot"] as const,
			queryFn: () => getEnquiryDashboardSnapshot(),
			staleTime: 60 * 1000,
		}),
	duplicates: (phone: string, excludeEnquiryId?: string) =>
		queryOptions({
			queryKey: [...enquiryQueries.all, "duplicates", phone, excludeEnquiryId] as const,
			queryFn: () => checkEnquiryDuplicates({ data: { phone, excludeEnquiryId } }),
			// A duplicate check must reflect the database right now.
			staleTime: 0,
		}),
};
