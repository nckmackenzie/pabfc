import { useQueries } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";
import { smsTemplateQueries } from "@/features/communication/services/queries";
import { memberQueries } from "@/features/members/services/queries";
import { planQueries } from "@/features/plans/services/queries";
import { toTitleCase } from "@/lib/utils";

export function useFormData() {
	const {
		templates: loaderTemplates,
		plans: loaderPlans,
		members: loaderMembers,
	} = getRouteApi("/app/communication/").useLoaderData();
	const [
		{ data: freshTemplates },
		{ data: freshPlans },
		{ data: freshMembers },
	] = useQueries({
		queries: [
			smsTemplateQueries.list(),
			planQueries.active(),
			memberQueries.list({}),
		],
	});
	const { templates, plans, members } = useMemo(() => {
		return {
			templates: (freshTemplates || loaderTemplates).map((template) => ({
				value: template.id,
				label: toTitleCase(template.name.toLowerCase()),
			})),
			plans: (freshPlans || loaderPlans).map((plan) => ({
				value: plan.value,
				label: toTitleCase(plan.label.toLowerCase()),
			})),
			members: (freshMembers || loaderMembers).map(({ id, fullName }) => ({
				value: id,
				label: toTitleCase(fullName.toLowerCase()),
			})),
		};
	}, [
		loaderTemplates,
		freshTemplates,
		loaderPlans,
		freshPlans,
		loaderMembers,
		freshMembers,
	]);

	return { templates, plans, freshTemplates, freshPlans, members };
}
