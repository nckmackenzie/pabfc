type PaymentPostCommitTask = {
	name: string;
	run: () => void | Promise<void>;
};

type ReportPostCommitError = (message: string, error: unknown) => void;

export async function runPaymentPostCommitTasks(
	tasks: readonly PaymentPostCommitTask[],
	reportError: ReportPostCommitError = console.error
) {
	const results = await Promise.allSettled(tasks.map(({ run }) => Promise.resolve().then(run)));

	results.forEach((result, index) => {
		if (result.status === "rejected") {
			reportError(`Post-commit payment ${tasks[index]!.name} failed`, result.reason);
		}
	});
}
