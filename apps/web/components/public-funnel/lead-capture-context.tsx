"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type LeadCaptureContextValue = {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
};

const LeadCaptureContext = createContext<LeadCaptureContextValue | null>(null);

type LeadCaptureProviderProps = {
  children: ReactNode;
};

export function LeadCaptureProvider({
  children,
}: LeadCaptureProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo<LeadCaptureContextValue>(
    () => ({
      isOpen,
      openModal,
      closeModal,
    }),
    [isOpen, openModal, closeModal],
  );

  return (
    <LeadCaptureContext.Provider value={value}>
      {children}
    </LeadCaptureContext.Provider>
  );
}

export const useLeadCaptureModal = () => useContext(LeadCaptureContext);
