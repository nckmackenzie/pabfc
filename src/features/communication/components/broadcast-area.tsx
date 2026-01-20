import { Wrapper } from "@/components/ui/wrapper";
import { BroadcastForm } from "@/features/communication/components/broadcast-form";

export function BroadcastArea() {
	return (
		<Wrapper className="col-span-2">
			<header className="flex items-center justify-between">
				<div className="space-y-0.5">
					<h2 className="text-lg font-semibold font-display">SMS Broadcast</h2>
					<p className="text-muted-foreground text-xs">
						Send a broadcast to your members
					</p>
				</div>
			</header>
			<BroadcastForm />
		</Wrapper>
	);
}
