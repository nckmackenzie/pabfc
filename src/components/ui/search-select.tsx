/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
import * as React from "react";
import type { Props } from "react-select";
import SelectComponent from "react-select";
import {
	ClearIndicator,
	DropdownIndicator,
	MultiValueRemove,
	Option,
} from "@/lib/react-select/components";
import { defaultClassNames, defaultStyles } from "@/lib/react-select/helpers";

const SearchSelect = React.forwardRef<
	React.ElementRef<typeof SelectComponent>,
	React.ComponentPropsWithoutRef<typeof SelectComponent>
>((props: Props, ref) => {
	const {
		value,
		onChange,
		options = [],
		styles = defaultStyles,
		classNames = defaultClassNames,
		components = {},
		...rest
	} = props;

	const id = React.useId();
	const selected = options.find((o: any) => o.value === value) ?? null;

	const handleChange = (selectedOption: any) => {
		onChange?.(selectedOption?.value ?? "", selectedOption);
	};

	return (
		<SelectComponent
			instanceId={id}
			ref={ref}
			value={selected}
			onChange={handleChange}
			options={options}
			unstyled
			components={{
				DropdownIndicator,
				ClearIndicator,
				MultiValueRemove,
				Option,
				// Menu,
				// MenuList,
				...components,
			}}
			styles={styles}
			classNames={classNames}
			{...rest}
		/>
	);
});
SearchSelect.displayName = "SearchSelect";
export { SearchSelect };
