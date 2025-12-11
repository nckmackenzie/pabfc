import { InfoIcon } from "lucide-react";
import type { ComponentProps } from "react";
import {
	Alert,
	AlertContent,
	AlertDescription,
	AlertIcon,
	AlertTitle,
} from "@/components/ui/alert";

interface CustomAlertProps {
	title: string;
	description: string | React.ReactNode;
	icon?: React.ReactNode;
}

export function CustomAlert({
	title,
	description,
	icon,
	...props
}: CustomAlertProps & ComponentProps<typeof Alert>) {
	return (
		<Alert {...props} appearance="light">
			<AlertIcon>{icon || <InfoIcon />}</AlertIcon>
			<AlertContent>
				<AlertTitle>{title}</AlertTitle>
				<AlertDescription>{description}</AlertDescription>
			</AlertContent>
		</Alert>
	);
}
