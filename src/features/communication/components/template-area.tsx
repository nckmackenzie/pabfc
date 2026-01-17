import { Button } from "@/components/ui/button";
import CustomModal from "@/components/ui/custom-modal";
import { PlusIcon } from "@/components/ui/icons";
import { Wrapper } from "@/components/ui/wrapper";
import { useModal } from "@/integrations/modal-provider";
import { TemplateForm } from "./template-form";

export function TemplateArea() {
	const { setOpen } = useModal();
	return (
		<Wrapper>
			<header className="flex items-center justify-between">
				<div className="space-y-0.5">
					<h2 className="text-lg font-semibold font-display">Templates</h2>
					<p className="text-muted-foreground text-xs">Manage your templates</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() =>
						setOpen(
							<CustomModal title="New Template">
								<TemplateForm />
							</CustomModal>,
						)
					}
				>
					<PlusIcon />
					New Template
				</Button>
			</header>
		</Wrapper>
	);
}
