import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	PhoneIcon,
	SirenIcon,
	UserIcon,
} from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import {
	EMERGENCY_CONTACT_RELATIONSHIPS,
	GENDER,
	ID_TYPES,
} from "@/features/members/lib/constants";
import { cn, generateRandomId } from "@/lib/utils";
import {
	type MemberFormInstance,
	useMemberForm,
} from "../hooks/use-member-form";

const tabs = [
	{ id: "personal", label: "Personal Info", icon: UserIcon },
	{ id: "contact", label: "Contact Info", icon: PhoneIcon },
	{ id: "emergency", label: "Emergency Info", icon: SirenIcon },
];

export function MemberForm() {
	const [activeTab, setActiveTab] = useState("personal");

	const currentTabIndex = tabs.findIndex((t) => t.id === activeTab);

	const goToNextTab = () => {
		if (currentTabIndex < tabs.length - 1) {
			setActiveTab(tabs[currentTabIndex + 1].id);
		}
	};

	const goToPrevTab = () => {
		if (currentTabIndex > 0) {
			setActiveTab(tabs[currentTabIndex - 1].id);
		}
	};

	const form = useMemberForm();

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		e.stopPropagation();
		form.handleSubmit();
	};

	return (
		<>
			<PageHeader
				title="New Member"
				description="Complete all sections to register a new member."
			/>
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

			<form onSubmit={handleSubmit} className="space-y-4 mt-6">
				{activeTab === "personal" && <PersonalInformation form={form} />}
				{activeTab === "contact" && <ContactInformation form={form} />}
				{activeTab === "emergency" && <EmergencyInformation form={form} />}

				<form.AppForm>
					<div className={cn("flex items-center justify-between", {})}>
						<Button
							type="button"
							variant="outline"
							onClick={goToPrevTab}
							disabled={currentTabIndex === 0}
						>
							<ChevronLeftIcon />
							Previous
						</Button>
						{currentTabIndex < tabs.length - 1 ? (
							<Button
								type="button"
								variant="outline"
								onClick={goToNextTab}
								disabled={currentTabIndex === tabs.length - 1}
							>
								Next
								<ChevronRightIcon />
							</Button>
						) : (
							<form.Subscribe selector={(state) => state.isSubmitting}>
								{(state) => (
									<Button type="submit" variant="default" disabled={state}>
										<CheckIcon />
										Submit
									</Button>
								)}
							</form.Subscribe>
						)}
					</div>
				</form.AppForm>
			</form>
		</>
	);
}

function PersonalInformation({ form }: { form: MemberFormInstance }) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			<form.AppField name="firstName">
				{(field) => (
					<field.Input
						label="First Name"
						placeholder="Enter first name"
						required
					/>
				)}
			</form.AppField>
			<form.AppField name="lastName">
				{(field) => (
					<field.Input
						label="Last Name"
						placeholder="Enter last name"
						required
					/>
				)}
			</form.AppField>
			<form.AppField name="dateOfBirth">
				{(field) => (
					<field.Input
						label="Date of Birth"
						placeholder="Enter date of birth"
						type="date"
					/>
				)}
			</form.AppField>
			<form.AppField name="gender">
				{(field) => (
					<field.Select label="Gender" placeholder="Select a gender">
						{GENDER.map((gender) => (
							<SelectItem key={gender.value} value={gender.value}>
								{gender.label}
							</SelectItem>
						))}
					</field.Select>
				)}
			</form.AppField>
			<form.AppField name="idType">
				{(field) => (
					<field.Select label="ID Type" placeholder="Select an ID type">
						{ID_TYPES.map((idType) => (
							<SelectItem key={idType.value} value={idType.value}>
								{idType.label}
							</SelectItem>
						))}
					</field.Select>
				)}
			</form.AppField>
			<form.AppField name="idNumber">
				{(field) => (
					<field.Input
						label="ID Number"
						placeholder="Enter ID number"
						maxLength={15}
					/>
				)}
			</form.AppField>
		</div>
	);
}

function ContactInformation({ form }: { form: MemberFormInstance }) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			<form.AppField name="contact">
				{(field) => (
					<field.Input
						label="Contact Number"
						placeholder="Enter contact number"
						required
						maxLength={15}
					/>
				)}
			</form.AppField>
			<form.AppField name="email">
				{(field) => (
					<field.Input label="Email" placeholder="Enter email" type="email" />
				)}
			</form.AppField>
			<div className="col-span-full">
				<form.AppField name="address">
					{(field) => (
						<field.Input label="Address" placeholder="Enter address" />
					)}
				</form.AppField>
			</div>
		</div>
	);
}

function EmergencyInformation({ form }: { form: MemberFormInstance }) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
			<form.AppField name="emergencyContactName">
				{(field) => (
					<field.Input
						label="Emergency Contact Name"
						placeholder="Enter emergency contact name"
					/>
				)}
			</form.AppField>
			<form.AppField name="emergencyContactNo">
				{(field) => (
					<field.Input
						label="Emergency Contact Number"
						placeholder="Enter emergency contact number"
						maxLength={15}
					/>
				)}
			</form.AppField>
			<form.AppField name="emergencyContactRelationship">
				{(field) => (
					<field.Select
						label="Emergency Contact Relationship"
						placeholder="Select an emergency contact relationship"
					>
						{EMERGENCY_CONTACT_RELATIONSHIPS.map((relationship) => (
							<SelectItem key={relationship.value} value={relationship.value}>
								{relationship.label}
							</SelectItem>
						))}
					</field.Select>
				)}
			</form.AppField>
			<div className="col-span-full">
				<form.AppField name="notes">
					{(field) => (
						<field.Textarea
							className="resize-none"
							label="Notes"
							placeholder="Enter notes"
						/>
					)}
				</form.AppField>
				<form.Subscribe selector={(state) => state.errors}>
					{(state) => {
						if (!state.length) return null;
						const messages = Object.values(state[0] || {})
							.flat()
							.map((error) => error.message);
						return (
							<div className="space-y-2 p-4 bg-danger mt-4 text-danger-foreground rounded-md">
								{messages.map((m, i) => (
									<p className="text-sm" key={generateRandomId(`error-${i}`)}>
										👉 {m}
									</p>
								))}
							</div>
						);
					}}
				</form.Subscribe>
			</div>
		</div>
	);
}
