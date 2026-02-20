import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	BellIcon,
	DollarSignIcon,
	LockOpenIcon,
	ShieldAlertIcon,
} from "@/components/ui/icons";
import { BillingForm } from "@/features/settings/components/billing-form";
import { DataForm } from "@/features/settings/components/data-form";
import { NotificationsForm } from "@/features/settings/components/notifications-form";
import { SecurityForm } from "@/features/settings/components/security-form";
import { settingsQuery } from "@/features/settings/services/queries";
import { cn } from "@/lib/utils";

const tabs = [
	{ id: "data", label: "Data Retention & Privacy", icon: ShieldAlertIcon },
	{ id: "notification", label: "Notification Settings", icon: BellIcon },
	{ id: "security", label: "Security Settings", icon: LockOpenIcon },
	{ id: "billing", label: "Financial Settings", icon: DollarSignIcon },
];

export function SettingsForm() {
	const [activeTab, setActiveTab] = useState("data");
	const { settings: settingsLoaderData } =
		getRouteApi("/app/settings").useLoaderData();
	const { data: freshData } = useQuery(settingsQuery());
	const settingsData = freshData || settingsLoaderData;

	return (
		<div className="space-y-6">
			<div className="bg-muted text-muted-foreground inline-flex h-9 w-full items-center justify-between rounded-lg p-[3px]">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const isActive = tab.id === activeTab;
					return (
						<Button
							key={tab.id}
							size="icon-sm"
							onClick={() => setActiveTab(tab.id)}
							variant={isActive ? "default" : "ghost"}
							className={cn(
								"grow flex items-center gap-2 px-4 py-2 rounded-md whitespace-nowrap transition-all hover:bg-transparent hover:text-primary",
								{
									"bg-background text-primary": isActive,
								},
							)}
						>
							<Icon />
							<span className="hidden md:inline text-sm font-medium">
								{tab.label}
							</span>
						</Button>
					);
				})}
			</div>
			{activeTab === "data" && (
				<DataForm
					dataSettings={
						settingsData?.data
							? {
									id: settingsData.id,
									...settingsData.data,
									logRetentionDays: settingsData.data.logRetentionDays ?? 180,
								}
							: undefined
					}
				/>
			)}
			{activeTab === "notification" && (
				<NotificationsForm
					notificationSettings={
						settingsData?.notification
							? {
									id: settingsData.id,
									...settingsData.notification,
								}
							: undefined
					}
				/>
			)}
			{activeTab === "security" && (
				<SecurityForm
					securitySettings={
						settingsData?.security
							? {
									id: settingsData.id,
									...settingsData.security,
								}
							: undefined
					}
				/>
			)}
			{activeTab === "billing" && (
				<BillingForm
					billingSettings={
						settingsData?.billing
							? {
									id: settingsData.id,
									...settingsData.billing,
									vatAccountId: settingsData.billing.vatAccountId?.toString(),
								}
							: undefined
					}
				/>
			)}
		</div>
	);
}
