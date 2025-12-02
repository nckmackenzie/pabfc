import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

interface ModalProviderProps {
	children: React.ReactNode;
}

interface ModalContextType {
	isOpen: boolean;
	setOpen: (modal: ReactNode) => void;
	setClose: () => void;
}

const ModalContext = createContext<ModalContextType>({
	isOpen: false,
	setClose: () => {},
	setOpen: (_modal: ReactNode) => {},
});

export const ModalProvider = ({ children }: ModalProviderProps) => {
	const [isOpen, setIsOpen] = useState(false);
	const [showingModal, setShowingModal] = useState<ReactNode>(null);
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	const setOpen = async (modal: ReactNode) => {
		if (modal) {
			setShowingModal(modal);
			setIsOpen(true);
		}
	};

	const setClose = () => {
		setIsOpen(false);
	};

	if (!isMounted) return null;

	return (
		<ModalContext.Provider value={{ setClose, setOpen, isOpen }}>
			{children}
			{showingModal}
		</ModalContext.Provider>
	);
};

export const useModal = () => {
	const context = useContext(ModalContext);
	if (context === undefined)
		throw new Error("useModal used outside its provider.");

	return context;
};
