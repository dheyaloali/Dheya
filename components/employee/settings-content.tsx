"use client"

import { useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Bell, Camera, Key, Lock, Mail, Save, User } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { useEmployeeSettings } from "@/hooks/useEmployeeSettings"
import { Skeleton } from "@/components/ui/skeleton"
import { useTranslations } from "next-intl"

const profileFormSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  phone: z.string().min(10, {
    message: "Phone number must be at least 10 characters.",
  }),
  bio: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
})

const notificationFormSchema = z.object({
  emailNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(true),
  monthlyReports: z.boolean().default(false),
  taskReminders: z.boolean().default(true),
  documentUpdates: z.boolean().default(true),
  leaveApprovals: z.boolean().default(true),
})

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(8, {
      message: "Password must be at least 8 characters.",
    }),
    newPassword: z.string().min(8, {
      message: "Password must be at least 8 characters.",
    }),
    confirmPassword: z.string().min(8, {
      message: "Password must be at least 8 characters.",
    }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export function EmployeeSettingsContent() {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [user, setUser] = useState<{ name: string; email: string; username: string } | null>(null)
  const { data, error, isLoading, updateSettings } = useEmployeeSettings()
  const t = useTranslations('Settings')

  useEffect(() => {
    // In a real app, this would fetch user data from an API
    const userStr = localStorage.getItem("user")
    if (userStr) {
      const userData = JSON.parse(userStr)
      setUser(userData)
    }
  }, [])

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      bio: "",
      address: "",
      emergencyContact: "",
    },
  })

  const notificationForm = useForm<z.infer<typeof notificationFormSchema>>({
    resolver: zodResolver(notificationFormSchema),
    defaultValues: {
      emailNotifications: true,
      pushNotifications: true,
      monthlyReports: false,
      taskReminders: true,
      documentUpdates: true,
      leaveApprovals: true,
    },
  })

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  // Update form when user data is loaded
  useEffect(() => {
    if (user) {
      profileForm.setValue("name", user.name)
      profileForm.setValue("email", user.email)
      // In a real app, you would populate other fields from the user data
    }
  }, [user, profileForm])

  function onSubmitProfile(values: z.infer<typeof profileFormSchema>) {
    setIsSaving(true)

    // Simulate API call
    setTimeout(() => {
      setIsSaving(false)
      toast({
        title: "Profile updated",
        description: "Your profile information has been updated successfully.",
      })

      // Update local storage user data
      if (user) {
        const updatedUser = { ...user, name: values.name, email: values.email }
        localStorage.setItem("user", JSON.stringify(updatedUser))
        setUser(updatedUser)
      }
    }, 1000)
  }

  function onSubmitNotifications(values: z.infer<typeof notificationFormSchema>) {
    setIsSaving(true)

    // Simulate API call
    setTimeout(() => {
      setIsSaving(false)
      toast({
        title: "Notification preferences saved",
        description: "Your notification preferences have been updated successfully.",
      })
    }, 1000)
  }

  function onSubmitPassword(values: z.infer<typeof passwordFormSchema>) {
    setIsSaving(true)

    // Simulate API call
    setTimeout(() => {
      setIsSaving(false)
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      })
      passwordForm.reset()
    }, 1000)
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-16 w-full mb-4" />
        <Skeleton className="h-16 w-full mb-4" />
        <Skeleton className="h-16 w-full mb-4" />
      </div>
    )
  }

  if (error) {
    return <div className="text-muted-foreground">Settings are currently unavailable. Please try again later.</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('settings')}</h1>
      </div>

      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            {t('notifications')}
          </TabsTrigger>
          <TabsTrigger value="password">
            <Lock className="mr-2 h-4 w-4" />
            {t('password')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('notificationPreferences')}</CardTitle>
              <CardDescription>{t('notificationPreferencesDesc')}</CardDescription>
            </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                    <span className="text-base font-medium flex items-center gap-2">
                      <span role="img" aria-label="location">📍</span> {t('allowLocationAccess')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('allowLocationAccessDesc')}
                    </span>
                              </div>
                  <Switch checked={data.locationAccess} disabled />
                            </div>
                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                    <span className="text-base font-medium flex items-center gap-2">
                      <span role="img" aria-label="notification">🔔</span> {t('allowNotifications')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('allowNotificationsDesc')}
                    </span>
                  </div>
                  <Switch checked={data.notifications} disabled />
                            </div>
                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                    <span className="text-base font-medium flex items-center gap-2">
                      <span role="img" aria-label="language">🌐</span> {t('language')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('languageDesc')}
                    </span>
                            </div>
                  <div className="flex items-center">
                    <LanguageSwitcher
                      minimal
                      value={data.language}
                      onChange={async (lang: string) => {
                        try {
                          await updateSettings({ language: lang })
                          toast({ title: "Language updated", description: "Your language preference has been saved." })
                        } catch {
                          toast({ title: "Error", description: "Failed to update language.", variant: "destructive" })
                        }
                      }}
                    />
                  </div>
                    </div>
                  </div>
                </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password to keep your account secure.</CardDescription>
            </CardHeader>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)}>
                <CardContent className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormDescription>
                          Password must be at least 8 characters long and include a mix of letters, numbers, and special
                          characters.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>Updating...</>
                    ) : (
                      <>
                        <Key className="mr-2 h-4 w-4" />
                        Update Password
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
