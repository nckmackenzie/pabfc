import { ShieldAlertIcon } from "@/components/ui/icons";

import { BackLink } from "@/components/ui/links";

export function Unauthorized() {
	return (
		<div className="h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
			<div className="max-w-md w-full bg-card rounded-lg shadow-md p-8 text-center">
				<div className="flex justify-center mb-6">
					<ShieldAlertIcon className="h-16 w-16 text-destructive" />
				</div>

				<h1 className="text-2xl font-bold text-foreground mb-2">
					403! Hold up!
				</h1>

				<p className="text-muted-foreground mb-6">
					Sorry, but you are not authorized to view this page.
				</p>

				<div className="border-t border-gray-200 pt-6">
					<BackLink variant="outline" size="lg" className="w-full">
						Go Back
					</BackLink>
				</div>
			</div>
		</div>
	);
}
