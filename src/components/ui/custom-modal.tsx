import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";

import { useModal } from "@/integrations/modal-provider";

interface CustomModalProps {
	children: React.ReactNode;
	title: string;
	subtitle?: string;
	defaultOpen?: boolean;
	className?: string;
}

export default function CustomModal({
	children,
	title,
	subtitle,
	defaultOpen,
	className,
}: CustomModalProps) {
	const { isOpen, setClose } = useModal();
	return (
		<Credenza open={isOpen || defaultOpen} onOpenChange={setClose}>
			<CredenzaContent className={className}>
				<CredenzaHeader>
					<CredenzaTitle>{title}</CredenzaTitle>
					{subtitle && <CredenzaDescription>{subtitle}</CredenzaDescription>}
				</CredenzaHeader>
				<CredenzaBody>{children}</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}
