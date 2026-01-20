import { useQueries } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";
import { smsTemplateQueries } from "@/features/communication/services/queries";
import { planQueries } from "@/features/plans/services/queries";
import { toTitleCase } from "@/lib/utils";

export function useFormData() {
	const { templates: loaderTemplates, plans: loaderPlans } = getRouteApi(
		"/app/communication/",
	).useLoaderData();
	const [{ data: freshTemplates }, { data: freshPlans }] = useQueries({
		queries: [smsTemplateQueries.list(), planQueries.active()],
	});
	const { templates, plans } = useMemo(() => {
		return {
			templates: (freshTemplates || loaderTemplates).map((template) => ({
				value: template.id,
				label: toTitleCase(template.name.toLowerCase()),
			})),
			plans: (freshPlans || loaderPlans).map((plan) => ({
				value: plan.value,
				label: toTitleCase(plan.label.toLowerCase()),
			})),
		};
	}, [loaderTemplates, freshTemplates, loaderPlans, freshPlans]);

	return { templates, plans, freshTemplates, freshPlans };
}
