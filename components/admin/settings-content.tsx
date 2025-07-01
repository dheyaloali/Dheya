"use client";

import { useState, useEffect, useRef, useCallback } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import useSWR, { mutate } from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import type { ControllerRenderProps, FieldValues } from "react-hook-form";
import { useAdminSocket } from "@/hooks/useAdminSocket";
import { useEmployeeSocket } from "@/hooks/useEmployeeSocket";
import { adminFetcher, fetchWithCSRF } from "@/lib/admin-api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PasswordChangeDialog } from "@/components/admin/password-change-dialog";
import { Eye, EyeOff } from "lucide-react";

const generalFormSchema = z.object({
  adminName: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be less than 50 characters"),
  adminEmail: z.string().email("Please enter a valid email address"),
  timezone: z.string().min(1, "Please select a timezone"),
  dateFormat: z.string().min(1, "Please select a date format"),
  timeFormat: z.string().min(1, "Please select a time format"),
})

type BooleanSettingField = 
  | "adminRealtimeEnabled" 
  | "employeeRealtimeEnabled" 
  | "stationaryAlertsEnabled" 
  | "lowBatteryAlertsEnabled" 
  | "offlineAlertsEnabled";

type NumericSettingField = 
  | "stationaryAlertThreshold" 
  | "lowBatteryThreshold" 
  | "offlineAlertThreshold";

type SettingField = BooleanSettingField | NumericSettingField;

const API_COOLDOWN = 1000;
const pendingRequests = new Map<string, number>();

export function SettingsContent() {
  const { toast } = useToast();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [adminSnapshot, setAdminSnapshot] = useState({
    adminName: "",
    adminEmail: "",
    timezone: "",
    dateFormat: "",
    timeFormat: "",
  })
  const [savingSettings, setSavingSettings] = useState<Record<string, boolean>>({});
  const [optimisticData, setOptimisticData] = useState<Record<string, any>>({});
  const [errorState, setErrorState] = useState<Record<string, boolean>>({});
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const [activeTab, setActiveTab] = useState("general");
  
  const { connect, disconnect } = useAdminSocket();
  const { connect: employeeConnect, disconnect: employeeDisconnect } = useEmployeeSocket();

  const { data, isLoading, error, mutate: mutateSettings } = useSWR(
    "/api/admin/settings", 
    adminFetcher, 
    {
      onError: (err) => {
        toast({
          title: "Error Loading Settings",
          description: "Failed to load settings. Please try refreshing the page.",
          variant: "destructive",
        });
        console.error("Settings fetch error:", err.message);
      },
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  );

  const generalForm = useForm<z.infer<typeof generalFormSchema>>({
    resolver: zodResolver(generalFormSchema),
    defaultValues: adminSnapshot,
    mode: "onChange",
  });

  useEffect(() => {
    if (data) {
      setAdminSnapshot({
        adminName: data.adminName || "",
        adminEmail: data.adminEmail || "",
        timezone: data.timezone || "",
        dateFormat: data.dateFormat || "",
        timeFormat: data.timeFormat || "",
      });
      generalForm.reset({
        adminName: data.adminName || "",
        adminEmail: data.adminEmail || "",
        timezone: data.timezone || "",
        dateFormat: data.dateFormat || "",
        timeFormat: data.timeFormat || "",
      });
    }
    // eslint-disable-next-line
  }, [data]);

  // Function to mask email
  const maskEmail = (email: string) => {
    if (!email) return '';
    
    try {
      const [username, domain] = email.split('@');
      if (!username || !domain) return email;
      
      const maskedUsername = username.charAt(0) + '*'.repeat(Math.max(1, username.length - 2)) + username.charAt(username.length - 1);
      
      const domainParts = domain.split('.');
      if (domainParts.length < 2) return `${maskedUsername}@${domain}`;
      
      const domainName = domainParts[0];
      const tld = domainParts.slice(1).join('.');
      
      const maskedDomain = domainName.charAt(0) + '*'.repeat(Math.max(1, domainName.length - 2)) + domainName.charAt(domainName.length - 1);
      
      return `${maskedUsername}@${maskedDomain}.${tld}`;
    } catch (error) {
      console.error("Error masking email:", error);
      return email; // Return original email if masking fails
    }
  };
  
  const handlePasswordChanged = useCallback(() => {
    toast({ 
      title: "Password Changed", 
      description: "Your password has been updated successfully." 
    });
    setPasswordDialogOpen(false);
  }, [toast]);

  const handleSettingChange = useCallback(async (field: SettingField, value: any) => {
    if (savingSettings[field]) return;
    
    const requestKey = `setting-${field}-${value}`;
    
    setOptimisticData(prev => ({ ...prev, [field]: value }));
    setErrorState(prev => ({ ...prev, [field]: false }));
    setSavingSettings(prev => ({ ...prev, [field]: true }));
    
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    
    debounceTimeout.current = setTimeout(async () => {
      try {
        const settingNames: Record<string, string> = {
          adminRealtimeEnabled: "admin real-time notifications",
          employeeRealtimeEnabled: "employee real-time notifications",
          stationaryAlertsEnabled: "stationary alerts",
          lowBatteryAlertsEnabled: "low battery alerts",
          offlineAlertsEnabled: "offline alerts",
          stationaryAlertThreshold: "stationary alert threshold",
          lowBatteryThreshold: "low battery threshold",
          offlineAlertThreshold: "offline alert threshold"
        };
        
        const settingName = settingNames[field] || field;
        
        console.log(`Updating setting: ${field} = ${value} (${settingName})`);
        
        const res = await fetchWithCSRF("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to update setting");
        }
        
        const updatedData = await res.json();
        
        await mutateSettings(updatedData, false);
        
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('admin-settings-changed', {
            detail: { setting: field, value }
          }));
        }
        
        // Handle socket connections based on settings
        if (field === "adminRealtimeEnabled") {
          if (value) {
            connect();
            toast({
              title: "WebSocket Server Connected",
              description: "Admin real-time notification server is now active. You will receive live updates.",
              variant: "default",
            });
          } else {
            disconnect();
            toast({
              title: "WebSocket Server Disconnected",
              description: "Admin real-time notification server has been disconnected. You will not receive live updates.",
              variant: "default",
            });
          }
        } else if (field === "employeeRealtimeEnabled") {
          if (value) {
            employeeConnect();
            toast({
              title: "Employee WebSocket Enabled",
              description: "Employees will now receive real-time notifications on their devices.",
              variant: "default",
            });
          } else {
            employeeDisconnect();
            toast({
              title: "Employee WebSocket Disabled",
              description: "Employees will no longer receive real-time notifications.",
              variant: "default",
            });
          }
        } else {
          let detailMessage = "";
          
          if (field === "stationaryAlertThreshold") {
            const minutes = Math.floor(value / 60);
            detailMessage = `Threshold set to ${minutes} minute${minutes !== 1 ? 's' : ''}`;
          } else if (field === "lowBatteryThreshold") {
            detailMessage = `Threshold set to ${value}%`;
          } else if (field === "offlineAlertThreshold") {
            const minutes = Math.floor(value / 60);
            detailMessage = `Threshold set to ${minutes} minute${minutes !== 1 ? 's' : ''}`;
          } else if (field.includes("Enabled")) {
            detailMessage = value ? "Feature enabled" : "Feature disabled";
          }
          
          toast({
            title: `${settingName.charAt(0).toUpperCase() + settingName.slice(1)} Updated`,
            description: detailMessage,
          });
        }
        
        console.log(`Successfully updated setting: ${field} = ${value} (${settingName})`);
      } catch (error) {
        console.error(`Failed to update setting ${field}:`, error instanceof Error ? error.message : "Unknown error");
        
        setOptimisticData(prev => ({ ...prev, [field]: data?.[field] }));
        setErrorState(prev => ({ ...prev, [field]: true }));
        
        toast({
          title: "Error",
          description: `Failed to update ${field}. Please try again.`,
          variant: "destructive",
        });
      } finally {
        setSavingSettings(prev => ({ ...prev, [field]: false }));
      }
    }, 300);
  }, [connect, data, disconnect, employeeConnect, employeeDisconnect, mutateSettings, savingSettings, toast]);

  const handleToggle = useCallback((field: BooleanSettingField, value: boolean) => {
    handleSettingChange(field, value);
  }, [handleSettingChange]);

  const handleThresholdChange = useCallback((field: NumericSettingField, value: number) => {
    handleSettingChange(field, value);
  }, [handleSettingChange]);

  return (
    <div className="flex flex-col ml-6 pr-4 h-[calc(100vh-80px)] overflow-hidden max-w-[calc(100vw-240px)]">
      <div className="sticky top-0 z-10 bg-white pt-4 pb-2">
        <h1 className="text-2xl font-semibold mb-3">Admin Settings</h1>
        <div className="w-full bg-gray-100 p-1 rounded-md flex">
          <button 
            onClick={() => setActiveTab("general")} 
            className={`flex-1 py-1.5 px-4 rounded-sm text-sm ${activeTab === "general" ? "bg-white shadow-sm" : "hover:bg-gray-200"}`}
          >
            General
          </button>
          <button 
            onClick={() => setActiveTab("security")} 
            className={`flex-1 py-1.5 px-4 rounded-sm text-sm ${activeTab === "security" ? "bg-white shadow-sm" : "hover:bg-gray-200"}`}
          >
            Security
          </button>
          <button 
            onClick={() => setActiveTab("notifications")} 
            className={`flex-1 py-1.5 px-4 rounded-sm text-sm ${activeTab === "notifications" ? "bg-white shadow-sm" : "hover:bg-gray-200"}`}
          >
            Notifications
          </button>
          <button 
            onClick={() => setActiveTab("attendance")} 
            className={`flex-1 py-1.5 px-4 rounded-sm text-sm ${activeTab === "attendance" ? "bg-white shadow-sm" : "hover:bg-gray-200"}`}
          >
            Attendance Time
          </button>
        </div>
      </div>
      
      <div className="overflow-y-auto overflow-x-hidden mt-4 pb-8 flex-grow pr-2 text-sm">
        {activeTab === "general" && (
          <div className="w-full">
          {isLoading ? (
            <div className="py-12 flex flex-col gap-4">
              <Skeleton className="h-8 w-1/3 mx-auto" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
            ) : error ? (
              <div className="py-12 text-center text-red-500">
                <p>Failed to load settings. Please try refreshing the page.</p>
            </div>
          ) : (
            <div className="w-full grid gap-6">
                    <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block font-medium text-sm mb-1">Admin Name</label>
                  <Input value={data?.adminName || ""} readOnly className="bg-muted" />
                </div>
                <div>
                  <label className="block font-medium text-sm mb-1">Admin Email</label>
                  <div className="relative">
                    <Input 
                      value={showEmail ? data?.adminEmail || '' : maskEmail(data?.adminEmail || '')} 
                      readOnly 
                      className="bg-muted pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2"
                      onMouseDown={() => setShowEmail(true)}
                      onMouseUp={() => setShowEmail(false)}
                      onMouseLeave={() => setShowEmail(false)}
                      onTouchStart={() => setShowEmail(true)}
                      onTouchEnd={() => setShowEmail(false)}
                      onTouchCancel={() => setShowEmail(false)}
                      tabIndex={-1}
                    >
                      {showEmail ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">Admin Password</div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setPasswordDialogOpen(true)}
                    >
                      Change Password
                    </Button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Use the Change Password button to update your password securely
                  </div>
                </div>
                  </div>
                    <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block font-medium text-sm mb-1">Timezone</label>
                  <Select disabled value={data?.timezone || ""}>
                    <SelectTrigger className="bg-muted">
                                  <SelectValue placeholder="Select timezone" />
                                </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="UTC-12">UTC-12:00</SelectItem>
                                <SelectItem value="UTC-11">UTC-11:00</SelectItem>
                                <SelectItem value="UTC-10">UTC-10:00</SelectItem>
                                <SelectItem value="UTC-9">UTC-09:00</SelectItem>
                                <SelectItem value="UTC-8">UTC-08:00</SelectItem>
                                <SelectItem value="UTC-7">UTC-07:00</SelectItem>
                                <SelectItem value="UTC-6">UTC-06:00</SelectItem>
                                <SelectItem value="UTC-5">UTC-05:00</SelectItem>
                                <SelectItem value="UTC-4">UTC-04:00</SelectItem>
                                <SelectItem value="UTC-3">UTC-03:00</SelectItem>
                                <SelectItem value="UTC-2">UTC-02:00</SelectItem>
                                <SelectItem value="UTC-1">UTC-01:00</SelectItem>
                                <SelectItem value="UTC">UTC+00:00</SelectItem>
                                <SelectItem value="UTC+1">UTC+01:00</SelectItem>
                                <SelectItem value="UTC+2">UTC+02:00</SelectItem>
                                <SelectItem value="UTC+3">UTC+03:00</SelectItem>
                                <SelectItem value="UTC+4">UTC+04:00</SelectItem>
                                <SelectItem value="UTC+5">UTC+05:00</SelectItem>
                                <SelectItem value="UTC+6">UTC+06:00</SelectItem>
                                <SelectItem value="UTC+7">UTC+07:00</SelectItem>
                                <SelectItem value="UTC+8">UTC+08:00</SelectItem>
                                <SelectItem value="UTC+9">UTC+09:00</SelectItem>
                                <SelectItem value="UTC+10">UTC+10:00</SelectItem>
                                <SelectItem value="UTC+11">UTC+11:00</SelectItem>
                                <SelectItem value="UTC+12">UTC+12:00</SelectItem>
                              </SelectContent>
                            </Select>
                </div>
                <div>
                  <label className="block font-medium text-sm mb-1">Date Format</label>
                  <Select disabled value={data?.dateFormat || ""}>
                    <SelectTrigger className="bg-muted">
                                  <SelectValue placeholder="Select date format" />
                                </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                                <SelectItem value="YYYY/MM/DD">YYYY/MM/DD</SelectItem>
                                <SelectItem value="DD-MMM-YYYY">DD-MMM-YYYY</SelectItem>
                              </SelectContent>
                            </Select>
                </div>
                <div>
                  <label className="block font-medium text-sm mb-1">Time Format</label>
                  <Select disabled value={data?.timeFormat || ""}>
                    <SelectTrigger className="bg-muted">
                                  <SelectValue placeholder="Select time format" />
                                </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                                <SelectItem value="24h">24-hour</SelectItem>
                              </SelectContent>
                            </Select>
                </div>
              </div>
            </div>
          )}
          </div>
        )}
        
        {activeTab === "security" && (
          <div className="w-full grid gap-6">
            <div className="grid gap-4 md:grid-cols-2">
              <SecurityTabDemo />
            </div>
          </div>
        )}
        
        {activeTab === "notifications" && (
          <div className="w-full grid gap-6">
                    <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block font-medium text-sm mb-1">Real-time Notifications for Admin</label>
                <div className="flex items-center h-8">
                  <Switch 
                    checked={optimisticData.adminRealtimeEnabled ?? data?.adminRealtimeEnabled ?? true} 
                    disabled={savingSettings.adminRealtimeEnabled || isLoading} 
                    onCheckedChange={(checked: boolean) => handleToggle("adminRealtimeEnabled", checked)} 
                    className={data?.adminRealtimeEnabled ? "data-[state=checked]:bg-blue-500" : "bg-gray-300"} 
                  />
                  <span className="ml-2 text-sm">
                    {optimisticData.adminRealtimeEnabled ?? data?.adminRealtimeEnabled ? "Enabled" : "Disabled"}
                  </span>
                  {savingSettings.adminRealtimeEnabled && <span className="text-xs text-blue-500 ml-2">Saving...</span>}
                  {errorState.adminRealtimeEnabled && <span className="text-xs text-red-500 ml-2">Update failed</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">Controls real-time notifications for the admin user.</p>
              </div>
              <div className="md:col-span-2">
                <label className="block font-medium text-sm mb-1">Real-time Notifications for Employees</label>
                <div className="flex items-center h-8">
                  <Switch 
                    checked={optimisticData.employeeRealtimeEnabled ?? data?.employeeRealtimeEnabled ?? true} 
                    disabled={savingSettings.employeeRealtimeEnabled || isLoading} 
                    onCheckedChange={(checked: boolean) => handleToggle("employeeRealtimeEnabled", checked)} 
                    className={data?.employeeRealtimeEnabled ? "data-[state=checked]:bg-blue-500" : "bg-gray-300"} 
                  />
                  <span className="ml-2 text-sm">
                    {optimisticData.employeeRealtimeEnabled ?? data?.employeeRealtimeEnabled ? "Enabled" : "Disabled"}
                  </span>
                  {savingSettings.employeeRealtimeEnabled && <span className="text-xs text-blue-500 ml-2">Saving...</span>}
                  {errorState.employeeRealtimeEnabled && <span className="text-xs text-red-500 ml-2">Update failed</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">Controls real-time notifications for employees.</p>
              </div>
            </div>
            <div className="mt-6 border-t pt-4">
              <h3 className="text-base font-medium mb-3">Employee Status Monitoring</h3>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-3">
              <div>
                    <label className="block font-medium text-sm mb-1">Stationary Employee Alerts</label>
                    <div className="flex items-center h-8">
                      <Switch 
                        checked={optimisticData.stationaryAlertsEnabled ?? data?.stationaryAlertsEnabled ?? true} 
                        disabled={savingSettings.stationaryAlertsEnabled || isLoading}
                        onCheckedChange={(checked) => handleToggle("stationaryAlertsEnabled", checked)} 
                        className={data?.stationaryAlertsEnabled ? "data-[state=checked]:bg-blue-500" : "bg-gray-300"} 
                      />
                      <span className="ml-2 text-sm">
                        {optimisticData.stationaryAlertsEnabled ?? data?.stationaryAlertsEnabled ? "Enabled" : "Disabled"}
                      </span>
                      {savingSettings.stationaryAlertsEnabled && <span className="text-xs text-blue-500 ml-2">Saving...</span>}
                      {errorState.stationaryAlertsEnabled && <span className="text-xs text-red-500 ml-2">Update failed</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Alert when employees are not moving for an extended period
                    </p>
              </div>
                  
              <div>
                    <label className="block font-medium text-sm mb-1">Stationary Alert Threshold (minutes)</label>
                    <Select 
                      value={String(Math.floor((optimisticData.stationaryAlertThreshold ?? data?.stationaryAlertThreshold ?? 600) / 60))} 
                      onValueChange={(value) => handleThresholdChange("stationaryAlertThreshold", parseInt(value) * 60)}
                      disabled={savingSettings.stationaryAlertThreshold || isLoading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select threshold" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 minutes</SelectItem>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="20">20 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="45">45 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="90">1.5 hours</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    {savingSettings.stationaryAlertThreshold && <span className="text-xs text-blue-500 ml-2">Saving...</span>}
                    {errorState.stationaryAlertThreshold && <span className="text-xs text-red-500">Update failed</span>}
                    <p className="text-xs text-gray-500 mt-1">
                      Time before alerting for stationary employees
                    </p>
                  </div>
              </div>
                
                <div className="space-y-3">
              <div>
                    <label className="block font-medium text-sm mb-1">Low Battery Alerts</label>
                    <div className="flex items-center h-8">
                      <Switch 
                        checked={optimisticData.lowBatteryAlertsEnabled ?? data?.lowBatteryAlertsEnabled ?? true} 
                        disabled={savingSettings.lowBatteryAlertsEnabled || isLoading}
                        onCheckedChange={(checked) => handleToggle("lowBatteryAlertsEnabled", checked)} 
                        className={data?.lowBatteryAlertsEnabled ? "data-[state=checked]:bg-blue-500" : "bg-gray-300"} 
                      />
                      <span className="ml-2 text-sm">
                        {optimisticData.lowBatteryAlertsEnabled ?? data?.lowBatteryAlertsEnabled ? "Enabled" : "Disabled"}
                      </span>
                      {savingSettings.lowBatteryAlertsEnabled && <span className="text-xs text-blue-500 ml-2">Saving...</span>}
                      {errorState.lowBatteryAlertsEnabled && <span className="text-xs text-red-500 ml-2">Update failed</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Alert when employee device battery is low
                    </p>
              </div>
                  
              <div>
                    <label className="block font-medium text-sm mb-1">Low Battery Threshold (%)</label>
                    <Select 
                      value={String(optimisticData.lowBatteryThreshold ?? data?.lowBatteryThreshold || 20)} 
                      onValueChange={(value) => handleThresholdChange("lowBatteryThreshold", parseInt(value))}
                      disabled={savingSettings.lowBatteryThreshold || isLoading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select threshold" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5%</SelectItem>
                        <SelectItem value="10">10%</SelectItem>
                        <SelectItem value="15">15%</SelectItem>
                        <SelectItem value="20">20%</SelectItem>
                        <SelectItem value="25">25%</SelectItem>
                        <SelectItem value="30">30%</SelectItem>
                        <SelectItem value="35">35%</SelectItem>
                        <SelectItem value="40">40%</SelectItem>
                        <SelectItem value="50">50%</SelectItem>
                      </SelectContent>
                    </Select>
                    {savingSettings.lowBatteryThreshold && <span className="text-xs text-blue-500 ml-2">Saving...</span>}
                    {errorState.lowBatteryThreshold && <span className="text-xs text-red-500">Update failed</span>}
                    <p className="text-xs text-gray-500 mt-1">
                      Battery percentage to trigger low battery alerts
                    </p>
                  </div>
              </div>
                
                <div className="space-y-3">
              <div>
                    <label className="block font-medium text-sm mb-1">Offline Employee Alerts</label>
                    <div className="flex items-center h-8">
                      <Switch 
                        checked={optimisticData.offlineAlertsEnabled ?? data?.offlineAlertsEnabled ?? true} 
                        disabled={savingSettings.offlineAlertsEnabled || isLoading}
                        onCheckedChange={(checked) => handleToggle("offlineAlertsEnabled", checked)} 
                        className={data?.offlineAlertsEnabled ? "data-[state=checked]:bg-blue-500" : "bg-gray-300"} 
                      />
                      <span className="ml-2 text-sm">
                        {optimisticData.offlineAlertsEnabled ?? data?.offlineAlertsEnabled ? "Enabled" : "Disabled"}
                      </span>
                      {savingSettings.offlineAlertsEnabled && <span className="text-xs text-blue-500 ml-2">Saving...</span>}
                      {errorState.offlineAlertsEnabled && <span className="text-xs text-red-500 ml-2">Update failed</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Alert when employees go offline for an extended period
                    </p>
              </div>
                  
              <div>
                    <label className="block font-medium text-sm mb-1">Offline Alert Threshold (minutes)</label>
                    <Select 
                      value={String(Math.floor((optimisticData.offlineAlertThreshold ?? data?.offlineAlertThreshold ?? 300) / 60))} 
                      onValueChange={(value) => handleThresholdChange("offlineAlertThreshold", parseInt(value) * 60)}
                      disabled={savingSettings.offlineAlertThreshold || isLoading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select threshold" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 minute</SelectItem>
                        <SelectItem value="2">2 minutes</SelectItem>
                        <SelectItem value="3">3 minutes</SelectItem>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="8">8 minutes</SelectItem>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="20">20 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="45">45 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                      </SelectContent>
                    </Select>
                    {savingSettings.offlineAlertThreshold && <span className="text-xs text-blue-500 ml-2">Saving...</span>}
                    {errorState.offlineAlertThreshold && <span className="text-xs text-red-500">Update failed</span>}
                    <p className="text-xs text-gray-500 mt-1">
                      Time before alerting for offline employees
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === "attendance" && (
          <div className="w-full grid gap-6">
            <AttendanceTimeSettingsForm />
          </div>
        )}
      </div>
      
      {/* Password Change Dialog */}
      <PasswordChangeDialog 
        open={passwordDialogOpen} 
        onOpenChange={setPasswordDialogOpen}
        onPasswordChanged={handlePasswordChanged}
      />
    </div>
  )
}

function SecurityTabDemo() {
  const [passwordPolicy, setPasswordPolicy] = useState("strong");
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("30m");
  const [loginAttempts, setLoginAttempts] = useState("5");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // Import session manager functions
  const { setSessionTimeout: saveSessionTimeout, convertTimeoutToMs } = require("@/lib/session-manager");

  // Fetch settings from API
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/admin/settings');
        if (response.ok) {
          const data = await response.json();
          setPasswordPolicy(data.passwordPolicy || "strong");
          setMfaEnabled(data.mfaEnabled !== undefined ? data.mfaEnabled : true);
          setSessionTimeout(data.sessionTimeout || "30m");
          setLoginAttempts(data.maxLoginAttempts || "5");
          
          // Also save to localStorage as backup
          localStorage.setItem('password_policy', data.passwordPolicy || "strong");
          localStorage.setItem('mfa_enabled', (data.mfaEnabled !== undefined ? data.mfaEnabled : true).toString());
          localStorage.setItem('max_login_attempts', data.maxLoginAttempts || "5");
          
          // Save session timeout to localStorage for immediate effect
          const timeoutMs = convertTimeoutToMs(data.sessionTimeout || "30m");
          saveSessionTimeout(timeoutMs / (60 * 1000));
        }
      } catch (error) {
        console.error("Failed to fetch security settings:", error);
        // Load from localStorage as fallback
        loadFromLocalStorage();
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSettings();
  }, []);
  
  // Load settings from localStorage (fallback)
  const loadFromLocalStorage = () => {
    const savedPolicy = localStorage.getItem('password_policy');
    if (savedPolicy) {
      setPasswordPolicy(savedPolicy);
    }
    
    const savedMfa = localStorage.getItem('mfa_enabled');
    if (savedMfa !== null) {
      setMfaEnabled(savedMfa === 'true');
    }
    
    const savedTimeout = localStorage.getItem('session_timeout');
    if (savedTimeout) {
      const timeoutMinutes = parseInt(savedTimeout, 10) / (60 * 1000);
      if (timeoutMinutes === 15) setSessionTimeout("15m");
      else if (timeoutMinutes === 30) setSessionTimeout("30m");
      else if (timeoutMinutes === 60) setSessionTimeout("1h");
      else if (timeoutMinutes === 120) setSessionTimeout("2h");
      else if (timeoutMinutes === 240) setSessionTimeout("4h");
      else if (timeoutMinutes === 480) setSessionTimeout("8h");
    }
    
    const savedAttempts = localStorage.getItem('max_login_attempts');
    if (savedAttempts) {
      setLoginAttempts(savedAttempts);
    }
  };

  // Save settings to API and localStorage
  const saveSettings = async (updates) => {
    try {
      // Get current settings first
      const response = await fetch('/api/admin/settings');
      const currentSettings = await response.json();
      
      // Merge with updates
      const updatedSettings = { ...currentSettings, ...updates };
      
      // Save to API
      const saveResponse = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSettings),
      });
      
      if (!saveResponse.ok) {
        throw new Error('Failed to save settings');
      }
      
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  };

  // Handle setting changes with debounce
  const handlePasswordPolicyChange = (value) => {
    if (isSaving) return;
    setIsSaving(true);
    setPasswordPolicy(value);
    
    // Save to localStorage for immediate effect
    localStorage.setItem('password_policy', value);
    
    // Save to API
    saveSettings({ passwordPolicy: value })
      .then(success => {
        // Show toast notification
        toast({
          title: success ? "Password Policy Updated" : "Update Failed",
          description: success ? `Password policy set to ${value}` : "Failed to update password policy. Using local storage as fallback.",
          variant: success ? "success" : "destructive",
        });
      })
      .finally(() => {
        setTimeout(() => {
          setIsSaving(false);
        }, 500);
      });
  };

  const handleMfaEnabledChange = (value) => {
    if (isSaving) return;
    setIsSaving(true);
    setMfaEnabled(value);
    
    // Save to localStorage for immediate effect
    localStorage.setItem('mfa_enabled', value.toString());
    
    // Save to API
    saveSettings({ mfaEnabled: value })
      .then(success => {
        // Show toast notification
        toast({
          title: success ? "MFA Setting Updated" : "Update Failed",
          description: success ? (value ? "Multi-factor authentication enabled" : "Multi-factor authentication disabled") : "Failed to update MFA setting. Using local storage as fallback.",
          variant: success ? "success" : "destructive",
        });
      })
      .finally(() => {
        setTimeout(() => {
          setIsSaving(false);
        }, 500);
      });
  };

  const handleSessionTimeoutChange = (value) => {
    if (isSaving) return;
    setIsSaving(true);
    setSessionTimeout(value);
    
    // Save to localStorage for immediate effect
    const timeoutMs = convertTimeoutToMs(value);
    saveSessionTimeout(timeoutMs / (60 * 1000));
    
    // Save to API
    saveSettings({ sessionTimeout: value })
      .then(success => {
        // Show toast notification
        toast({
          title: success ? "Session Timeout Updated" : "Update Failed",
          description: success ? `Session timeout set to ${value}` : "Failed to update session timeout. Using local storage as fallback.",
          variant: success ? "success" : "destructive",
        });
      })
      .finally(() => {
        setTimeout(() => {
          setIsSaving(false);
        }, 500);
      });
  };

  const handleLoginAttemptsChange = (value) => {
    if (isSaving) return;
    setIsSaving(true);
    setLoginAttempts(value);
    
    // Save to localStorage for immediate effect
    localStorage.setItem('max_login_attempts', value);
    
    // Save to API
    saveSettings({ maxLoginAttempts: value })
      .then(success => {
        // Show toast notification with success variant
        toast({
          title: success ? "Login Attempts Updated" : "Update Failed",
          description: success ? `Maximum login attempts set to ${value}` : "Failed to update login attempts. Using local storage as fallback.",
          variant: success ? "success" : "destructive",
        });
      })
      .finally(() => {
        setTimeout(() => {
          setIsSaving(false);
        }, 500);
      });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-full bg-gray-200 animate-pulse rounded"></div>
        <div className="h-8 w-full bg-gray-200 animate-pulse rounded"></div>
        <div className="h-8 w-full bg-gray-200 animate-pulse rounded"></div>
        <div className="h-8 w-full bg-gray-200 animate-pulse rounded"></div>
      </div>
    );
  }

  return (
    <>
      <div>
        <label className="block font-medium mb-1">Password Policy</label>
        <Select 
          value={passwordPolicy} 
          onValueChange={handlePasswordPolicyChange}
          disabled={isSaving}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select password policy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="basic">Basic (8+ characters)</SelectItem>
            <SelectItem value="medium">Medium (8+ chars, 1 number)</SelectItem>
            <SelectItem value="strong">Strong (8+ chars, number, special char)</SelectItem>
            <SelectItem value="very-strong">Very Strong (12+ chars, number, special, mixed case)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          Sets the minimum password requirements for all users
        </p>
      </div>
      <div>
        <label className="block font-medium mb-1">Multi-Factor Authentication</label>
        <div className="flex items-center h-10">
          <Switch 
            checked={mfaEnabled} 
            onCheckedChange={handleMfaEnabledChange} 
            className={mfaEnabled ? "data-[state=checked]:bg-blue-500" : "bg-gray-300"}
            disabled={isSaving}
          />
          <span className="ml-2">{mfaEnabled ? "Enabled" : "Disabled"}</span>
          {isSaving && <span className="ml-2 text-xs text-blue-500 animate-pulse">Saving...</span>}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Require MFA for admin accounts
        </p>
      </div>
      <div>
        <label className="block font-medium mb-1">Session Timeout</label>
        <Select 
          value={sessionTimeout} 
          onValueChange={handleSessionTimeoutChange}
          disabled={isSaving}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select session timeout" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15m">15 minutes</SelectItem>
            <SelectItem value="30m">30 minutes</SelectItem>
            <SelectItem value="1h">1 hour</SelectItem>
            <SelectItem value="2h">2 hours</SelectItem>
            <SelectItem value="4h">4 hours</SelectItem>
            <SelectItem value="8h">8 hours</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          Time before inactive users are logged out
        </p>
      </div>
      <div>
        <label className="block font-medium mb-1">Maximum Login Attempts</label>
        <Select 
          value={loginAttempts} 
          onValueChange={handleLoginAttemptsChange}
          disabled={isSaving}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select maximum attempts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3 attempts</SelectItem>
            <SelectItem value="5">5 attempts</SelectItem>
            <SelectItem value="10">10 attempts</SelectItem>
            <SelectItem value="unlimited">Unlimited</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          Number of failed login attempts before account lockout
        </p>
      </div>
    </>
  );
}

function AttendanceTimeSettingsForm() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    workStartTime: "09:00",
    workEndTime: "17:00",
    lateThreshold: 15,
    gracePeriod: 5,
    checkInWindowStart: "07:00",
    checkInWindowEnd: "20:00",
    checkOutWindowStart: "16:00",
    checkOutWindowEnd: "23:59",
    autoMarkAbsent: true,
    weekendWorkEnabled: false,
    holidayWorkEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load current settings
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/attendance-time');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        toast({
          title: "Error",
          description: "Failed to load attendance settings",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load attendance settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const validateSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate time formats
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const timeFields = [
      { name: 'workStartTime', value: settings.workStartTime },
      { name: 'workEndTime', value: settings.workEndTime },
      { name: 'checkInWindowStart', value: settings.checkInWindowStart },
      { name: 'checkInWindowEnd', value: settings.checkInWindowEnd },
      { name: 'checkOutWindowStart', value: settings.checkOutWindowStart },
      { name: 'checkOutWindowEnd', value: settings.checkOutWindowEnd },
    ];

    for (const field of timeFields) {
      if (!timeRegex.test(field.value)) {
        newErrors[field.name] = `Invalid time format. Use HH:MM (e.g., 09:00)`;
      }
    }

    // Validate numeric fields
    if (settings.lateThreshold < 0 || settings.lateThreshold > 120) {
      newErrors.lateThreshold = "Late threshold must be between 0 and 120 minutes";
    }

    if (settings.gracePeriod < 0 || settings.gracePeriod > 60) {
      newErrors.gracePeriod = "Grace period must be between 0 and 60 minutes";
    }

    // Validate logical relationships
    if (settings.workStartTime && settings.workEndTime) {
      const start = new Date(`2000-01-01T${settings.workStartTime}`);
      const end = new Date(`2000-01-01T${settings.workEndTime}`);
      if (start >= end) {
        newErrors.workEndTime = "Work end time must be after work start time";
      }
    }

    if (settings.checkInWindowStart && settings.checkInWindowEnd) {
      const start = new Date(`2000-01-01T${settings.checkInWindowStart}`);
      const end = new Date(`2000-01-01T${settings.checkInWindowEnd}`);
      if (start >= end) {
        newErrors.checkInWindowEnd = "Check-in window end must be after check-in window start";
      }
    }

    if (settings.checkOutWindowStart && settings.checkOutWindowEnd) {
      const start = new Date(`2000-01-01T${settings.checkOutWindowStart}`);
      const end = new Date(`2000-01-01T${settings.checkOutWindowEnd}`);
      if (start >= end) {
        newErrors.checkOutWindowEnd = "Check-out window end must be after check-out window start";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings/attendance-time', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Attendance settings saved successfully",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to save settings",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // Clear error for this field
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: "" }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Work Hours Skeleton */}
        <div className="bg-white p-6 rounded-lg border">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
        {/* Check-in/Check-out Window Skeleton */}
        <div className="bg-white p-6 rounded-lg border">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
        {/* Advanced Settings Skeleton */}
        <div className="bg-white p-6 rounded-lg border">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
        {/* Preview Skeleton */}
        <div className="bg-gray-50 p-6 rounded-lg border">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
        {/* Save Button Skeleton */}
        <div className="flex justify-end">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Work Hours */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Work Hours</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-sm mb-1">Work Start Time</label>
            <Input
              type="time"
              value={settings.workStartTime}
              onChange={(e) => updateSetting('workStartTime', e.target.value)}
              className={errors.workStartTime ? "border-red-500" : ""}
            />
            {errors.workStartTime && (
              <p className="text-red-500 text-sm mt-1">{errors.workStartTime}</p>
            )}
          </div>
          <div>
            <label className="block font-medium text-sm mb-1">Work End Time</label>
            <Input
              type="time"
              value={settings.workEndTime}
              onChange={(e) => updateSetting('workEndTime', e.target.value)}
              className={errors.workEndTime ? "border-red-500" : ""}
            />
            {errors.workEndTime && (
              <p className="text-red-500 text-sm mt-1">{errors.workEndTime}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block font-medium text-sm mb-1">Late Threshold (minutes)</label>
            <Input
              type="number"
              min="0"
              max="120"
              value={settings.lateThreshold}
              onChange={(e) => updateSetting('lateThreshold', parseInt(e.target.value) || 0)}
              className={errors.lateThreshold ? "border-red-500" : ""}
            />
            {errors.lateThreshold && (
              <p className="text-red-500 text-sm mt-1">{errors.lateThreshold}</p>
            )}
          </div>
          <div>
            <label className="block font-medium text-sm mb-1">Grace Period (minutes)</label>
            <Input
              type="number"
              min="0"
              max="60"
              value={settings.gracePeriod}
              onChange={(e) => updateSetting('gracePeriod', parseInt(e.target.value) || 0)}
              className={errors.gracePeriod ? "border-red-500" : ""}
            />
            {errors.gracePeriod && (
              <p className="text-red-500 text-sm mt-1">{errors.gracePeriod}</p>
            )}
          </div>
        </div>
      </div>

      {/* Check-in Window */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Check-in Window</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-sm mb-1">Window Start</label>
            <Input
              type="time"
              value={settings.checkInWindowStart}
              onChange={(e) => updateSetting('checkInWindowStart', e.target.value)}
              className={errors.checkInWindowStart ? "border-red-500" : ""}
            />
            {errors.checkInWindowStart && (
              <p className="text-red-500 text-sm mt-1">{errors.checkInWindowStart}</p>
            )}
          </div>
          <div>
            <label className="block font-medium text-sm mb-1">Window End</label>
            <Input
              type="time"
              value={settings.checkInWindowEnd}
              onChange={(e) => updateSetting('checkInWindowEnd', e.target.value)}
              className={errors.checkInWindowEnd ? "border-red-500" : ""}
            />
            {errors.checkInWindowEnd && (
              <p className="text-red-500 text-sm mt-1">{errors.checkInWindowEnd}</p>
            )}
          </div>
        </div>
      </div>

      {/* Check-out Window */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Check-out Window</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-sm mb-1">Window Start</label>
            <Input
              type="time"
              value={settings.checkOutWindowStart}
              onChange={(e) => updateSetting('checkOutWindowStart', e.target.value)}
              className={errors.checkOutWindowStart ? "border-red-500" : ""}
            />
            {errors.checkOutWindowStart && (
              <p className="text-red-500 text-sm mt-1">{errors.checkOutWindowStart}</p>
            )}
          </div>
          <div>
            <label className="block font-medium text-sm mb-1">Window End</label>
            <Input
              type="time"
              value={settings.checkOutWindowEnd}
              onChange={(e) => updateSetting('checkOutWindowEnd', e.target.value)}
              className={errors.checkOutWindowEnd ? "border-red-500" : ""}
            />
            {errors.checkOutWindowEnd && (
              <p className="text-red-500 text-sm mt-1">{errors.checkOutWindowEnd}</p>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Advanced Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block font-medium text-sm mb-1">Auto-mark Absent</label>
              <p className="text-xs text-gray-500">Automatically mark employees as absent after work end time</p>
            </div>
            <Switch
              checked={settings.autoMarkAbsent}
              onCheckedChange={(checked) => updateSetting('autoMarkAbsent', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="block font-medium text-sm mb-1">Allow Weekend Work</label>
              <p className="text-xs text-gray-500">Allow employees to check in on weekends</p>
            </div>
            <Switch
              checked={settings.weekendWorkEnabled}
              onCheckedChange={(checked) => updateSetting('weekendWorkEnabled', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="block font-medium text-sm mb-1">Allow Holiday Work</label>
              <p className="text-xs text-gray-500">Allow employees to check in on holidays</p>
            </div>
            <Switch
              checked={settings.holidayWorkEnabled}
              onCheckedChange={(checked) => updateSetting('holidayWorkEnabled', checked)}
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-gray-50 p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Settings Preview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div className="p-3 bg-white rounded-md">
            <strong>Work Hours:</strong> {settings.workStartTime} - {settings.workEndTime}
          </div>
          <div className="p-3 bg-white rounded-md">
            <strong>Late Threshold:</strong> {settings.lateThreshold} minutes
          </div>
          <div className="p-3 bg-white rounded-md">
            <strong>Grace Period:</strong> {settings.gracePeriod} minutes
          </div>
          <div className="p-3 bg-white rounded-md">
            <strong>Check-in Window:</strong> {settings.checkInWindowStart} - {settings.checkInWindowEnd}
          </div>
          <div className="p-3 bg-white rounded-md">
            <strong>Check-out Window:</strong> {settings.checkOutWindowStart} - {settings.checkOutWindowEnd}
          </div>
          <div className="p-3 bg-white rounded-md">
            <strong>Auto-mark Absent:</strong> {settings.autoMarkAbsent ? "Enabled" : "Disabled"}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
} 