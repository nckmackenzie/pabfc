type PaymentPostCommitTask = {
	name: string;
	run: () => void | Promise<void>;
};

type ReportPostCommitError = (message: string, error: unknown) => void | Promise<void>;

export async function runPaymentPostCommitTasks(
	tasks: readonly PaymentPostCommitTask[],
	reportError: ReportPostCommitError = console.error
) {
	const results = await Promise.allSettled(tasks.map(({ run }) => Promise.resolve().then(run)));

	await Promise.allSettled(
		results.map((result, index) => {
			if (result.status === "rejected") {
				return Promise.resolve().then(() =>
					reportError(`Post-commit payment ${tasks[index]!.name} failed`, result.reason)
				);
			}
		})
	);
}
