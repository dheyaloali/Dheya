"use client";

import { useState, useEffect, useRef } from "react"
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

const generalFormSchema = z.object({
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6),
  timezone: z.string(),
  dateFormat: z.string(),
  timeFormat: z.string(),
})

export function SettingsContent() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [adminSnapshot, setAdminSnapshot] = useState({
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    timezone: "",
    dateFormat: "",
    timeFormat: "",
  })
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [optimisticData, setOptimisticData] = useState<{ adminRealtimeEnabled?: boolean; employeeRealtimeEnabled?: boolean }>({});
  const [errorState, setErrorState] = useState<{ admin?: boolean; employee?: boolean }>({});
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Get socket connection functions
  const { connect, disconnect } = useAdminSocket();
  const { connect: employeeConnect, disconnect: employeeDisconnect } = useEmployeeSocket();

  // Use SWR for fetching settings
  const { data, isLoading, error } = useSWR("/api/admin/settings", url => fetch(url).then(r => r.json()));

  const generalForm = useForm<z.infer<typeof generalFormSchema>>({
    resolver: zodResolver(generalFormSchema),
    defaultValues: adminSnapshot,
  })

  useEffect(() => {
    if (data) {
      setAdminSnapshot(data);
      generalForm.reset(data);
    }
    // eslint-disable-next-line
  }, [data]);

  function onEdit() {
    setIsEditing(true)
    setAdminSnapshot(generalForm.getValues())
  }

  function onCancel() {
    generalForm.reset(adminSnapshot)
    setIsEditing(false)
  }

  async function onSaveGeneral(data: z.infer<typeof generalFormSchema>) {
    setIsSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to save settings")
      const updated = await res.json()
      setAdminSnapshot(updated)
      generalForm.reset(updated)
      setIsEditing(false)
      mutate("/api/admin/settings", updated, false); // Optimistically update SWR cache
      toast({ title: "Settings Saved", description: "Settings have been updated successfully." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggle = (field: "adminRealtimeEnabled" | "employeeRealtimeEnabled", value: boolean) => {
    if ((field === "adminRealtimeEnabled" && savingAdmin) || (field === "employeeRealtimeEnabled" && savingEmployee)) return;
    
    // Optimistically update UI
    setOptimisticData(prev => ({ ...prev, [field]: value }));
    setErrorState(prev => ({ ...prev, [field === "adminRealtimeEnabled" ? "admin" : "employee"]: false }));
    
    if (field === "adminRealtimeEnabled") setSavingAdmin(true);
    if (field === "employeeRealtimeEnabled") setSavingEmployee(true);
    
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    
    // Then update the server setting (debounced)
    debounceTimeout.current = setTimeout(async () => {
      try {
        // Update the setting in the database
        const res = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        
        if (!res.ok) throw new Error("Failed to update setting");
        
        const updatedData = await res.json();
        
        // Update the SWR cache with the new data
        await mutate("/api/admin/settings", updatedData, false);
        
        // Emit a custom event to notify other components about the setting change
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('admin-settings-changed', {
            detail: { setting: field, value }
          }));
        }
        
        // Update connection state based on the new setting
        if (field === "adminRealtimeEnabled") {
          if (value) {
            connect();
          } else {
            disconnect();
          }
        }
        
        toast({
          title: "Settings Saved",
          description: `Real-time notifications for ${field === "adminRealtimeEnabled" ? "admin" : "employees"} ${value ? "enabled" : "disabled"}.`,
        });
      } catch (error) {
        console.error("Failed to update setting:", error);
        // Revert optimistic update
        setOptimisticData(prev => ({ ...prev, [field]: data?.[field] }));
        setErrorState(prev => ({ ...prev, [field === "adminRealtimeEnabled" ? "admin" : "employee"]: true }));
        
        toast({
          title: "Error",
          description: "Failed to update real-time notifications setting.",
          variant: "destructive",
        });
      } finally {
        if (field === "adminRealtimeEnabled") setSavingAdmin(false);
        if (field === "employeeRealtimeEnabled") setSavingEmployee(false);
      }
    }, 300);
  };

  return (
    <div className="w-full h-full flex flex-col gap-8">
      <h1 className="text-3xl font-bold mb-4">Admin Settings</h1>
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="w-full">
          {isLoading ? (
            <div className="py-12 flex flex-col gap-4">
              <Skeleton className="h-8 w-1/3 mx-auto" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Form {...generalForm}>
              <form onSubmit={generalForm.handleSubmit(onSaveGeneral)} className="w-full grid gap-8">
                    <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={generalForm.control} name="adminName" render={({ field }: { field: ControllerRenderProps<FieldValues, string> }) => (
                          <FormItem>
                      <FormLabel>Admin Name</FormLabel>
                            <FormControl>
                        <Input {...field} readOnly={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                  )} />
                  <FormField control={generalForm.control} name="adminEmail" render={({ field }: { field: ControllerRenderProps<FieldValues, string> }) => (
                          <FormItem>
                      <FormLabel>Admin Email</FormLabel>
                            <FormControl>
                        <Input {...field} readOnly={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                  )} />
                  <FormField control={generalForm.control} name="adminPassword" render={({ field }: { field: ControllerRenderProps<FieldValues, string> }) => (
                          <FormItem>
                      <FormLabel>Admin Password</FormLabel>
                            <FormControl>
                        <Input {...field} type="password" readOnly={!isEditing} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                  )} />
                  </div>
                    <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={generalForm.control} name="timezone" render={({ field }: { field: ControllerRenderProps<FieldValues, string> }) => (
                          <FormItem>
                            <FormLabel>Timezone</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!isEditing}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select timezone" />
                                </SelectTrigger>
                              </FormControl>
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
                            <FormMessage />
                          </FormItem>
                  )} />
                  <FormField control={generalForm.control} name="dateFormat" render={({ field }: { field: ControllerRenderProps<FieldValues, string> }) => (
                          <FormItem>
                            <FormLabel>Date Format</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!isEditing}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select date format" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                                <SelectItem value="YYYY/MM/DD">YYYY/MM/DD</SelectItem>
                                <SelectItem value="DD-MMM-YYYY">DD-MMM-YYYY</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                  )} />
                  <FormField control={generalForm.control} name="timeFormat" render={({ field }: { field: ControllerRenderProps<FieldValues, string> }) => (
                          <FormItem>
                            <FormLabel>Time Format</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!isEditing}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select time format" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                                <SelectItem value="24h">24-hour</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                  )} />
                    </div>
                {isEditing && (
                  <div className="flex gap-4 mt-8">
                    <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</Button>
                    <Button type="button" onClick={onCancel} variant="outline">Cancel</Button>
                  </div>
                )}
              </form>
              {!isEditing && (
                <div className="flex gap-4 mt-8">
                  <Button type="button" onClick={onEdit} className="bg-blue-100 text-blue-700 hover:bg-blue-200">Edit</Button>
                </div>
              )}
            </Form>
          )}
        </TabsContent>
        <TabsContent value="security" className="w-full">
          <div className="w-full grid gap-8">
            <div className="grid gap-4 md:grid-cols-2">
              <SecurityTabDemo />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="notifications" className="w-full">
          <div className="w-full grid gap-8">
                    <div className="grid gap-4 md:grid-cols-2">
              {/* Real-time Notifications for Admin Toggle */}
              <div className="md:col-span-2">
                <label className="block font-medium mb-1">Real-time Notifications for Admin</label>
                <div className="flex items-center h-10">
                  <Switch checked={optimisticData.adminRealtimeEnabled ?? data?.adminRealtimeEnabled ?? true} disabled={savingAdmin || isLoading} onCheckedChange={(checked: boolean) => handleToggle("adminRealtimeEnabled", checked)} className={data?.adminRealtimeEnabled ? "data-[state=checked]:bg-blue-500" : "bg-gray-300"} />
                  <span className="ml-2">{optimisticData.adminRealtimeEnabled ?? data?.adminRealtimeEnabled ? "Enabled" : "Disabled"}</span>
                  {errorState.admin && <span className="text-xs text-red-500 ml-2">Update failed</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">Controls real-time notifications for the admin user.</p>
              </div>
              {/* Real-time Notifications for Employees Toggle */}
              <div className="md:col-span-2">
                <label className="block font-medium mb-1">Real-time Notifications for Employees</label>
                <div className="flex items-center h-10">
                  <Switch checked={optimisticData.employeeRealtimeEnabled ?? data?.employeeRealtimeEnabled ?? true} disabled={savingEmployee || isLoading} onCheckedChange={(checked: boolean) => handleToggle("employeeRealtimeEnabled", checked)} className={data?.employeeRealtimeEnabled ? "data-[state=checked]:bg-blue-500" : "bg-gray-300"} />
                  <span className="ml-2">{optimisticData.employeeRealtimeEnabled ?? data?.employeeRealtimeEnabled ? "Enabled" : "Disabled"}</span>
                  {errorState.employee && <span className="text-xs text-red-500 ml-2">Update failed</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">Controls real-time notifications for all employees.</p>
              </div>
              {/* Existing notification settings */}
              <div>
                <label className="block font-medium mb-1">Email Notifications</label>
                <input className="w-full rounded border px-3 py-2" value="Enabled" readOnly />
              </div>
              <div>
                <label className="block font-medium mb-1">SMS Notifications</label>
                <input className="w-full rounded border px-3 py-2" value="Disabled" readOnly />
              </div>
              <div>
                <label className="block font-medium mb-1">Push Notifications</label>
                <input className="w-full rounded border px-3 py-2" value="Enabled" readOnly />
              </div>
              <div>
                <label className="block font-medium mb-1">Login Activity</label>
                <input className="w-full rounded border px-3 py-2" value="Enabled" readOnly />
              </div>
              <div>
                <label className="block font-medium mb-1">Document Uploads</label>
                <input className="w-full rounded border px-3 py-2" value="Enabled" readOnly />
              </div>
              <div>
                <label className="block font-medium mb-1">Leave Requests</label>
                <input className="w-full rounded border px-3 py-2" value="Enabled" readOnly />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SecurityTabDemo() {
  const [passwordPolicy, setPasswordPolicy] = useState("strong");
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("30m");
  const [loginAttempts, setLoginAttempts] = useState("5");

  return (
    <>
      <div>
        <label className="block font-medium mb-1">Password Policy</label>
        <Select value={passwordPolicy} onValueChange={setPasswordPolicy}>
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
      </div>
      <div>
        <label className="block font-medium mb-1">Multi-Factor Authentication</label>
        <div className="flex items-center h-10">
          <Switch checked={mfaEnabled} onCheckedChange={setMfaEnabled} className={mfaEnabled ? "data-[state=checked]:bg-blue-500" : "bg-gray-300"} />
          <span className="ml-2">{mfaEnabled ? "Enabled" : "Disabled"}</span>
        </div>
                            </div>
      <div>
        <label className="block font-medium mb-1">Session Timeout</label>
        <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
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
      </div>
      <div>
        <label className="block font-medium mb-1">Maximum Login Attempts</label>
        <Select value={loginAttempts} onValueChange={setLoginAttempts}>
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
                  </div>
    </>
  );
} 