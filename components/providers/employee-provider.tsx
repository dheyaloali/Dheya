'use client';

import { EmployeeWithRelations } from "@/lib/prisma";
import React, { createContext, useContext } from "react";

type EmployeeContextType = {
  employee: EmployeeWithRelations;
};

const EmployeeContext = createContext<EmployeeContextType | undefined>(
  undefined
);

export const EmployeeProvider = ({
  children,
  employee,
}: {
  children: React.ReactNode;
  employee: EmployeeWithRelations;
}) => {
  return (
    <EmployeeContext.Provider value={{ employee }}>
      {children}
    </EmployeeContext.Provider>
  );
};

export const useEmployee = () => {
  const context = useContext(EmployeeContext);
  if (context === undefined) {
    throw new Error("useEmployee must be used within an EmployeeProvider");
  }
  return context;
}; 