import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LockOpenIcon, UserIcon } from "@/components/ui/icons";
import { ProfileDetailsForm } from "@/features/profile/components/profile-details-form";
import { ProfileSecurityForm } from "@/features/profile/components/profile-security-form";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/auth";

const tabs = [
	{ id: "details", label: "User Details", icon: UserIcon },
	{ id: "security", label: "Security", icon: LockOpenIcon },
];

export function ProfileForm({ user }: { user?: User }) {
	const [activeTab, setActiveTab] = useState("details");

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
			{activeTab === "details" && <ProfileDetailsForm user={user} />}
			{activeTab === "security" && <ProfileSecurityForm />}
		</div>
	);
}
