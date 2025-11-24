import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, GaugeIcon } from "@/components/ui/icons";
import { usePreviousLocation } from "@/hooks/use-previous-location";

export function NotFoundComponent() {
	const previousLocation = usePreviousLocation();
	return (
		<div className="flex items-center justify-center px-4 sm:px-6 lg:px-8 min-h-screen bg-accent">
			<div className="animate-slide-up">
				<div className="mb-8 text-center animate-fade-in animation-delay-100">
					<h1 className="text-xl sm:text-4xl lg:text-8xl font-bold text-slate-200 select-none animate-float leading-none">
						404
					</h1>
				</div>

				<div className="mb-8 animate-fade-in animation-delay-200 text-center">
					<h2 className="text-xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
						Oops! Page not found
					</h2>
					<p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
						The page you're looking for doesn't exist. It might have been moved,
						deleted, or you entered the wrong URL.
					</p>
				</div>

				<div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 animate-fade-in animation-delay-600">
					<Button asChild size="lg">
						<Link to="/app/dashboard">
							<GaugeIcon className="w-5 h-5" />
							Go Home
						</Link>
					</Button>
					<Button asChild variant={"outline"} size="lg">
						<Link to={previousLocation}>
							<ArrowLeftIcon className="w-5 h-5" />
							Go Back
						</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
