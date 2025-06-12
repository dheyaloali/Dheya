import { create } from 'zustand';

// Define our own Employee interface to avoid circular dependencies
export interface Employee {
  id: string;
  name: string;
  city?: string;
  department?: string;
  location: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  batteryLevel?: number;
  user?: { name?: string };
  locations?: Array<{
    latitude: number;
    longitude: number;
    timestamp: string;
    batteryLevel?: number;
  }>;
}

interface Notification {
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp?: string;
  id?: string;
}

interface EmployeeState {
  employees: Employee[];
  onlineMap: Record<string, boolean>;
  notifications: Notification[];
  connected: boolean;
  lastConnectionTime: number;
  lastDisconnectTime: number;
  
  // Actions
  setEmployees: (employees: Employee[]) => void;
  updateEmployee: (update: any) => void;
  setOnline: (id: string, isOnline: boolean) => void;
  addNotification: (notification: Notification) => void;
  clearNotifications: () => void;
  setConnected: (connected: boolean) => void;
}

export const useEmployeeStore = create<EmployeeState>((set, get) => ({
  employees: [],
  onlineMap: {},
  notifications: [],
  connected: false,
  lastConnectionTime: 0,
  lastDisconnectTime: 0,
  
  setEmployees: (employees) => set({ employees }),
  
  updateEmployee: (update) => set((state) => {
    // Find the employee to update
    const index = state.employees.findIndex(e => e.id === update.id);
    
    if (index === -1) {
      // If employee not found, no update needed
      return state;
    }
    
    // Create a copy of the employees array
    const updatedEmployees = [...state.employees];
    
    // Update the employee at the found index
    updatedEmployees[index] = {
      ...updatedEmployees[index],
      ...update,
      // If location is provided, update it
      ...(update.location && { location: update.location }),
    };
    
    return { employees: updatedEmployees };
  }),
  
  setOnline: (id, isOnline) => set((state) => ({
    onlineMap: { ...state.onlineMap, [id]: isOnline }
  })),
  
  addNotification: (notification) => set((state) => ({
    notifications: [
      {
        ...notification,
        id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: notification.timestamp || new Date().toISOString(),
      },
      ...state.notifications.slice(0, 49), // Keep last 50 notifications
    ]
  })),
  
  clearNotifications: () => set({ notifications: [] }),
  
  setConnected: (connected) => set((state) => {
    const now = Date.now();
    
    if (connected && !state.connected) {
      // Just connected - record the time
      return { 
        connected, 
        lastConnectionTime: now 
      };
    } else if (!connected && state.connected) {
      // Just disconnected - record the time
      return { 
        connected, 
        lastDisconnectTime: now 
      };
    }
    
    return { connected };
  }),
})); 