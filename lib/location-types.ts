// Define location update payload interface
export interface LocationUpdatePayload {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  batteryLevel?: number;
  isMoving?: boolean;
  timestamp?: number | Date;
  isActive?: boolean;
}