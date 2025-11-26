import { useMemo, useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Utility function for conditional classnames
function cn(...classes: Array<string | boolean | undefined | null>) {
	return classes.filter(Boolean).join(" ");
}

export type Permission = {
	id: string;
	resource: string;
	action: string;
	key: string;
	description: string;
};

export type PermissionMatrixProps = {
	permissions: Array<Permission>;
	defaultSelectedIds?: Array<string>;
	onChange?: (selectedIds: Array<string>) => void;
	className?: string;
};

type PermissionNode = {
	id: string;
	key: string;
	description: string;
	isParent: boolean;
	children?: Array<PermissionNode>;
	permission?: Permission;
};

function buildHierarchy(perms: Array<Permission>) {
	const map = new Map<string, Array<Permission>>();

	// Group by resource
	for (const p of perms) {
		const list = map.get(p.resource) ?? [];
		list.push(p);
		map.set(p.resource, list);
	}

	// Build hierarchy for each resource
	const result: Array<[string, Array<PermissionNode>]> = [];

	for (const [resource, permissions] of Array.from(map.entries()).sort((a, b) =>
		a[0].localeCompare(b[0]),
	)) {
		const hierarchy = new Map<string, PermissionNode>();

		// Create nodes for all permissions
		for (const perm of permissions) {
			const parts = perm.key.split(":");
			const parentKey = parts.length > 1 ? parts[0] : null;

			if (!hierarchy.has(perm.key)) {
				hierarchy.set(perm.key, {
					id: perm.id,
					key: perm.key,
					description: perm.description,
					isParent: false,
					permission: perm,
				});
			}

			// If this has a parent, create parent node if needed
			if (parentKey && parts.length === 2) {
				if (!hierarchy.has(parentKey)) {
					// Find a permission with this parent key to get its description
					const parentPerm = permissions.find((p) => p.key === parentKey);
					hierarchy.set(parentKey, {
						id: parentKey,
						key: parentKey,
						description:
							parentPerm?.description || `Full control of ${parentKey}`,
						isParent: true,
						children: [],
						permission: parentPerm,
					});
				}

				const parent = hierarchy.get(parentKey);
				if (parent && !parent.children) {
					parent.children = [];
				}
				// biome-ignore lint/style/noNonNullAssertion: <>
				parent?.children?.push(hierarchy.get(perm.key)!);
			}
		}

		// Get top-level nodes (no parent or is a standalone permission)
		const topLevel = Array.from(hierarchy.values()).filter((node) => {
			const parts = node.key.split(":");
			return parts.length === 1 || !hierarchy.has(parts[0]);
		});

		// Sort children
		topLevel.forEach((node) => {
			if (node.children) {
				node.children.sort((a, b) => a.key.localeCompare(b.key));
			}
		});

		result.push([
			resource,
			topLevel.sort((a, b) => a.key.localeCompare(b.key)),
		]);
	}

	return result;
}

function getNodePermissions(node: PermissionNode): Array<string> {
	const ids: Array<string> = [];
	if (node.permission) {
		ids.push(node.id);
	}
	if (node.children) {
		for (const child of node.children) {
			ids.push(...getNodePermissions(child));
		}
	}
	return ids;
}

function getNodeState(node: PermissionNode, selected: Set<string>) {
	const allIds = getNodePermissions(node);
	const checkedCount = allIds.filter((id) => selected.has(id)).length;
	const total = allIds.length;

	return {
		all: checkedCount === total && total > 0,
		none: checkedCount === 0,
		partial: checkedCount > 0 && checkedCount < total,
	};
}

function getGroupStates(nodes: Array<PermissionNode>, selected: Set<string>) {
	const allIds = nodes.flatMap((node) => getNodePermissions(node));
	const checkedCount = allIds.filter((id) => selected.has(id)).length;
	const total = allIds.length;

	return {
		all: checkedCount === total && total > 0,
		none: checkedCount === 0,
		partial: checkedCount > 0 && checkedCount < total,
	};
}

function PermissionItem({
	node,
	selected,
	onToggle,
	indent = 0,
}: {
	node: PermissionNode;
	selected: Set<string>;
	onToggle: (node: PermissionNode, value: boolean) => void;
	indent?: number;
}) {
	const state = getNodeState(node, selected);
	const hasChildren = node.children && node.children.length > 0;

	return (
		<div className="space-y-1">
			<div className={cn("flex items-start gap-3 py-2", indent > 0 && "pl-8")}>
				<Checkbox
					checked={state.all}
					onCheckedChange={(v) => onToggle(node, Boolean(v))}
					aria-checked={state.partial ? "mixed" : state.all}
					className={cn(
						"mt-0.5",
						state.partial && "data-[state=indeterminate]:opacity-100",
					)}
				/>
				<div className="flex-1 space-y-0.5">
					<div className="flex items-center gap-2">
						<span
							className={cn(
								"font-medium text-sm",
								node.key.includes("delete") && "text-destructive",
							)}
						>
							{node.key}
						</span>
					</div>
					<p className="text-sm text-muted-foreground">{node.description}</p>
				</div>
			</div>

			{hasChildren && (
				<div className="space-y-1">
					{node.children?.map((child) => (
						<PermissionItem
							key={child.id}
							node={child}
							selected={selected}
							onToggle={onToggle}
							indent={indent + 1}
						/>
					))}
				</div>
			)}
		</div>
	);
}

export function PermissionMatrix({
	permissions,
	defaultSelectedIds = [],
	onChange,
	className,
}: PermissionMatrixProps) {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<Set<string>>(
		new Set(defaultSelectedIds),
	);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return permissions;
		return permissions.filter((p) =>
			[p.resource, p.action, p.key, p.description].some((v) =>
				v.toLowerCase().includes(q),
			),
		);
	}, [permissions, query]);

	const hierarchy = useMemo(() => buildHierarchy(filtered), [filtered]);

	const emit = (next: Set<string>) => {
		setSelected(new Set(next));
		onChange?.(Array.from(next));
	};

	const toggleNode = (node: PermissionNode, value: boolean) => {
		const next = new Set(selected);
		const ids = getNodePermissions(node);

		for (const id of ids) {
			if (value) next.add(id);
			else next.delete(id);
		}
		emit(next);
	};

	// const setGroup = (nodes: Array<PermissionNode>, value: boolean) => {
	// 	const next = new Set(selected);
	// 	for (const node of nodes) {
	// 		const ids = getNodePermissions(node);
	// 		for (const id of ids) {
	// 			if (value) next.add(id);
	// 			else next.delete(id);
	// 		}
	// 	}
	// 	emit(next);
	// };

	const headerState = useMemo(() => {
		const allNodes = hierarchy.flatMap(([_, nodes]) => nodes);
		return getGroupStates(allNodes, selected);
	}, [hierarchy, selected]);

	const setAll = (value: boolean) => {
		const next = new Set<string>();
		if (value) {
			for (const p of filtered) {
				next.add(p.id);
			}
		}
		emit(next);
	};

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader className="gap-2">
				<CardTitle>Assign permissions</CardTitle>
				<CardDescription>
					Toggle permissions for this role. Use the search to filter by
					resource/action.
				</CardDescription>
				<div className="flex items-center gap-3">
					<div className="flex items-center gap-2">
						<Checkbox
							checked={headerState.all}
							onCheckedChange={(v) => setAll(Boolean(v))}
							aria-checked={headerState.partial ? "mixed" : headerState.all}
							className={
								headerState.partial
									? "data-[state=indeterminate]:opacity-100"
									: undefined
							}
						/>
						<span className="text-sm text-muted-foreground">
							Select all (visible)
						</span>
					</div>
					<Separator orientation="vertical" className="h-6" />
					<Input
						placeholder="Search… (resource, action, key, description)"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						className="max-w-sm"
					/>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				<ScrollArea className="h-[60vh]">
					{hierarchy.length === 0 ? (
						<div className="text-center text-sm text-muted-foreground py-16">
							No permissions match your query.
						</div>
					) : (
						<div className="divide-y">
							{hierarchy.map(([resource, nodes]) => {
								// const s = getGroupStates(nodes, selected);

								return (
									<div key={resource}>
										{/* <div className="bg-muted/40 px-4 py-3 flex items-center justify-between">
											<div className="flex items-center gap-3">
												<Checkbox
													checked={s.all}
													onCheckedChange={(v) => setGroup(nodes, Boolean(v))}
													aria-checked={s.partial ? "mixed" : s.all}
													className={
														s.partial
															? "data-[state=indeterminate]:opacity-100"
															: undefined
													}
												/>
												<h3 className="text-base font-semibold capitalize">
													{resource}
												</h3>
											</div>
										</div> */}

										<div className="divide-y px-4">
											{nodes.map((node) => (
												<PermissionItem
													key={node.id}
													node={node}
													selected={selected}
													onToggle={toggleNode}
												/>
											))}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
