import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import type { Permission } from "@/features/users/services/roles.api";
import { cn } from "@/lib/utils";

export type PermissionMatrixProps = {
	permissions: Array<Permission>;
	defaultSelectedIds?: Array<string>;
	onChange?: (selectedIds: Array<string>) => void;
	className?: string;
};

function groupByResource(perms: Array<Permission>) {
	const map = new Map<string, Array<Permission>>();
	for (const p of perms) {
		const list = map.get(p.resource) ?? [];
		list.push(p);
		map.set(p.resource, list);
	}

	// biome-ignore lint/suspicious/useIterableCallbackReturn: <>
	map.forEach((list) => list.sort((a, b) => a.action.localeCompare(b.action)));
	return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function getGroupStates(group: Array<Permission>, selected: Set<string>) {
	const total = group.length;
	const checkedCount = group.reduce(
		(acc, p) => acc + (selected.has(p.id) ? 1 : 0),
		0,
	);
	return {
		all: checkedCount === total && total > 0,
		none: checkedCount === 0,
		partial: checkedCount > 0 && checkedCount < total,
	};
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

	const grouped = useMemo(() => groupByResource(filtered), [filtered]);

	const emit = (next: Set<string>) => {
		setSelected(new Set(next));
		onChange?.(Array.from(next));
	};

	const toggleOne = (id: string) => {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		emit(next);
	};

	const setGroup = (group: Array<Permission>, value: boolean) => {
		const next = new Set(selected);
		for (const p of group) {
			if (value) next.add(p.id);
			else next.delete(p.id);
		}
		emit(next);
	};

	const setAll = (value: boolean) => {
		const next = new Set<string>();
		if (value) for (const p of filtered) next.add(p.id);
		emit(value ? next : new Set());
	};

	const headerState = useMemo(
		() => getGroupStates(filtered, selected),
		[filtered, selected],
	);

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

			<CardContent>
				<ScrollArea className="h-[60vh] pr-4">
					<div className="space-y-6">
						{grouped.map(([resource, group]) => {
							const s = getGroupStates(group, selected);
							return (
								<div key={resource} className="rounded-2xl border p-4">
									<div className="mb-3 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Checkbox
												checked={s.all}
												onCheckedChange={(v) => setGroup(group, Boolean(v))}
												aria-checked={s.partial ? "mixed" : s.all}
											/>
											<h3 className="text-base font-semibold capitalize">
												{resource}
											</h3>
											{s.partial && (
												<Badge variant="outline" className="ml-1">
													partial
												</Badge>
											)}
										</div>
										<div className="text-xs text-muted-foreground">
											{group.length} action{group.length === 1 ? "" : "s"}
										</div>
									</div>

									<ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
										{group.map((p) => (
											<li
												key={p.id}
												className="flex items-start gap-3 rounded-xl border p-3"
											>
												<Checkbox
													checked={selected.has(p.id)}
													onCheckedChange={() => toggleOne(p.id)}
													aria-label={`Toggle ${p.key}`}
												/>
												<div className="space-y-1">
													<div className="flex flex-wrap items-center gap-2">
														<span
															className={cn("font-medium capitalize", {
																"text-destructive": p.action === "delete",
															})}
														>
															{p.action}
														</span>
														<Badge
															variant="secondary"
															className="font-mono text-[11px]"
														>
															{p.key}
														</Badge>
													</div>
													{p.description && (
														<p className="text-sm text-muted-foreground leading-snug capitalize">
															{p.description}
														</p>
													)}
												</div>
											</li>
										))}
									</ul>
								</div>
							);
						})}

						{grouped.length === 0 && (
							<div className="text-center text-sm text-muted-foreground py-16">
								No permissions match your query.
							</div>
						)}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
