"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { FormLabel } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useForm, FormProvider } from "react-hook-form"
import { Form, FormField, FormItem, FormControl, FormDescription, FormMessage } from "@/components/ui/form"
import { useToast } from "@/components/ui/use-toast"
import { sanitizeInput } from "@/lib/sanitizeInput"

const cities = [
  "Jakarta", "Surabaya", "Bandung"
];
const positions = [
  "Sales Representative", "Account Manager", "Sales Manager", "Account Executive",
  "Marketing Specialist", "Marketing Manager", "Content Creator", "SEO Specialist",
  "Financial Analyst", "Accountant", "Finance Manager", "Payroll Specialist",
  "HR Specialist", "HR Manager", "Recruiter", "Training Coordinator",
  "Software Developer", "Systems Administrator", "IT Support", "IT Manager",
  "Operations Coordinator", "Operations Manager", "Logistics Specialist", "Supply Chain Manager"
];

// List of valid Indonesian mobile prefixes (not exhaustive)
const validPrefixes = [
  '+62811', '+62812', '+62813', '+62821', '+62822', '+62823', // Telkomsel
  '+62851', '+62852', '+62853', // Telkomsel
  '+62814', '+62815', '+62816', '+62855', '+62856', '+62857', '+62858', // Indosat
  '+62817', '+62818', '+62819', '+62859', '+62877', '+62878', // XL
  '+62831', '+62832', '+62833', '+62838', // Axis
  '+62881', '+62882', '+62883', '+62884', '+62885', '+62886', '+62887', '+62888', '+62889', // Smartfren
  '+62895', '+62896', '+62897', '+62898', '+62899', // Three
];

function isValidIndonesianMobileNumber(number: string) {
  if (!/^\+62\d{9,13}$/.test(number)) return false;
  return validPrefixes.some(prefix => number.startsWith(prefix));
}

export function EmployeeForm({ onSuccess }: { onSuccess?: () => void | Promise<void> }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { toast } = useToast()

  const methods = useForm({
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
      city: "",
      position: "",
      startDate: "",
    },
  })

  const { handleSubmit, watch, setError, clearErrors } = methods

  const [uniqueStatus, setUniqueStatus] = useState({
    name: { loading: false, available: true, message: "" },
    email: { loading: false, available: true, message: "" }
  });

  // Add local state for validation errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Helper for name validation
  const validateName = (value: string) => {
    const sanitized = sanitizeInput(value);
    if (!sanitized) return "Name is required";
    if (!/^[A-Za-z\s]+$/.test(sanitized)) return "Name must contain only letters and spaces";
    return null;
  };

  // Helper for email validation
  const validateEmail = (value: string) => {
    if (!value) return "Email is required";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return "Invalid email format";
    return null;
  };

  // Helper to check uniqueness and return result
  const checkUnique = async (field: "name" | "email", value: string) => {
    // Clear previous errors
    clearErrors(field);
    
    // Set loading state
    setUniqueStatus(prev => ({
      ...prev,
      [field]: { ...prev[field], loading: true }
    }));
    
    // Skip check if value is empty
    if (!value || value.trim() === '') {
      setUniqueStatus(prev => ({
        ...prev,
        [field]: { ...prev[field], loading: false, available: true, message: "" }
      }));
      return true;
    }
    
    // Use trimmed value for API call
    const trimmedValue = value.trim();
    
    try {
      const res = await fetch("/api/check-unique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value: trimmedValue }),
      });
      
      const data = await res.json();
      
      setUniqueStatus(prev => ({
        ...prev,
        [field]: {
          loading: false,
          available: data.available,
          message: data.available ? "" : (field === "name" ? "Name already exists" : "Email already exists")
        }
      }));
      
      if (!data.available) {
        setError(field, { type: "manual", message: data.message || (field === "name" ? "Name already exists" : "Email already exists") });
        return false;
      } else {
        clearErrors(field);
        return true;
      }
    } catch (error) {
      console.error(`Error checking ${field} uniqueness:`, error);
      setUniqueStatus(prev => ({
        ...prev,
        [field]: { loading: false, available: true, message: "" }
      }));
      return true; // Allow form submission on API error
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true)
    setFormError(null)
    // Validate phone number format and real number
    const trimmedPhone = data.phoneNumber.replace(/\s+/g, '');
    if (!/^\+62\d{9,13}$/.test(trimmedPhone)) {
      setError("phoneNumber", { type: "manual", message: "Phone number must be in Indonesian format: +62xxxxxxxxxxx" });
      setLoading(false);
      return;
    }
    if (!isValidIndonesianMobileNumber(trimmedPhone)) {
      setError("phoneNumber", { type: "manual", message: "Invalid phone number. Please enter a real Indonesian mobile number, e.g., +628123456789" });
      setLoading(false);
      return;
    }
    // Final awaited uniqueness check for both fields
    const nameOk = await checkUnique("name", data.name);
    const emailOk = await checkUnique("email", data.email);
    if (!nameOk || !emailOk) {
      setLoading(false);
      return;
    }
    try {
      const payload = { ...data, status: 'active' };
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        let errorMsg = "Failed to create employee. Please try again.";
        if (res.status === 400 && errData.error) {
          errorMsg = errData.error;
        }
        setFormError(errorMsg);
        toast({ title: "Error", description: errorMsg, variant: "destructive" });
        setLoading(false);
        return;
      }
      setLoading(false);
      toast({ title: "Success", description: "Employee added successfully!", variant: "default" });
      if (onSuccess) await onSuccess();
    } catch (err) {
      setLoading(false);
      setFormError("Failed to create employee. Please try again.");
      toast({ title: "Error", description: "Failed to create employee. Please try again.", variant: "destructive" });
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {formError && <div className="text-red-600 text-center mb-2">{formError}</div>}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
            <FormField name="name" control={methods.control} rules={{ required: "Name is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter full name"
                      {...field}
                      onBlur={e => {
                        field.onBlur?.(e);
                        checkUnique("name", e.target.value);
                      }}
                      onChange={e => {
                        field.onChange(e);
                        checkUnique("name", e.target.value);
                      }}
                    />
                  </FormControl>
                  {nameError && <span className="block text-xs text-red-500 mt-1">{nameError}</span>}
                  {uniqueStatus.name.loading && !nameError && (
                    <span className="block text-xs text-blue-500 mt-1">Checking...</span>
                  )}
                  {!uniqueStatus.name.loading && field.value && uniqueStatus.name.available && !nameError && (
                    <span className="block text-xs mt-1 text-green-500">Available</span>
                  )}
                  {!uniqueStatus.name.loading && field.value && !uniqueStatus.name.available && !nameError && (
                    <span className="block text-xs mt-1 text-red-500">Not available</span>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField name="email" control={methods.control} rules={{ required: "Email is required" }}
              render={({ field }) => (
                <FormItem>
            <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="employee@example.com"
                      {...field}
                      onBlur={e => {
                        field.onBlur?.(e);
                        checkUnique("email", e.target.value);
                      }}
                      onChange={e => {
                        field.onChange(e);
                        checkUnique("email", e.target.value);
                      }}
                    />
                  </FormControl>
                  {emailError && <span className="block text-xs text-red-500 mt-1">{emailError}</span>}
                  {uniqueStatus.email.loading && !emailError && (
                    <span className="block text-xs text-blue-500 mt-1">Checking...</span>
                  )}
                  {!uniqueStatus.email.loading && field.value && uniqueStatus.email.available && !emailError && (
                    <span className="block text-xs mt-1 text-green-500">Available</span>
                  )}
                  {!uniqueStatus.email.loading && field.value && !uniqueStatus.email.available && !emailError && (
                    <span className="block text-xs mt-1 text-red-500">Not available</span>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField name="phoneNumber" control={methods.control} rules={{ required: "Phone number is required" }}
              render={({ field }) => {
                const value = field.value || "";
                const isFormatValid = /^\+62\d{9,13}$/.test(value);
                const isRealNumber = isFormatValid && isValidIndonesianMobileNumber(value);
                let message = '';
                if (!isFormatValid && value) {
                  message = 'Invalid phone number format. Example: +628123456789';
                } else if (isFormatValid && !isRealNumber) {
                  message = 'Invalid phone number. Please enter a real Indonesian mobile number, e.g., +628123456789';
                }
                return (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+6281234567890"
                        {...field}
                        onChange={e => {
                          // Remove all spaces as user types
                          const trimmed = e.target.value.replace(/\s+/g, '');
                          field.onChange(trimmed);
                        }}
                      />
                    </FormControl>
                    {value && (
                      <span className={`block text-xs mt-1 ${isRealNumber ? 'text-green-500' : 'text-red-500'}`}>{isRealNumber ? 'Valid' : message}</span>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
        </div>
        <div className="space-y-4">
            <FormField name="city" control={methods.control} rules={{ required: "City is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <select {...field} className="w-full border rounded px-2 py-2">
                      <option value="">Select city</option>
                      {cities.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField name="position" control={methods.control} rules={{ required: "Position is required" }}
              render={({ field }) => (
                <FormItem>
            <FormLabel>Position</FormLabel>
                  <FormControl>
                    <select {...field} className="w-full border rounded px-2 py-2">
                      <option value="">Select position</option>
                      {positions.map((p) => (
                        <option key={p} value={p}>{p}</option>
                  ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField name="startDate" control={methods.control} rules={{ required: "Start date is required" }}
              render={({ field }) => (
                <FormItem>
            <FormLabel>Start Date</FormLabel>
                  <FormControl>
            <Input
              type="date"
              {...field}
              className="w-full border rounded px-2 py-2"
            />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={loading || uniqueStatus.name.loading || uniqueStatus.email.loading}
          className="w-full"
        >
          {loading ? "Adding..." : "Add Employee"}
        </Button>
    </form>
    </FormProvider>
  )
}
