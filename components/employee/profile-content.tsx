"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import {
  AtSign,
  Award,
  BadgeCheck,
  Building,
  Camera,
  Edit,
  FileText,
  GraduationCap,
  Languages,
  MapPin,
  Phone,
  Save,
  Shield,
  User,
  X,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Badge } from "@/components/ui/badge"
import { EmployeeSettingsContent } from "@/components/employee/settings-content"
import useSWR from 'swr'
import { useTranslations } from "next-intl"

export function EmployeeProfileContent() {
  const t = useTranslations('Profile')
  const fetcher = (url: string) => fetch(url).then(res => res.json())
  const { data, error, isLoading, mutate } = useSWR('/api/employee/profile', fetcher)

  const [editMode, setEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState("")

  const employee = data?.employee || {}
  const user = employee.user || {}

  const [formData, setFormData] = useState({
    personal: {
      name: user.name || "",
      email: user.email || "",
      phone: user.phoneNumber || "",
      location: employee.city || "",
      bio: employee.bio || "",
    },
    work: {
      position: employee.position || "",
      workLocation: employee.city || "",
    },
  })

  useEffect(() => {
    setFormData({
      personal: {
        name: user.name || "",
        email: user.email || "",
        phone: user.phoneNumber || "",
        location: employee.city || "",
        bio: employee.bio || "",
      },
      work: {
        position: employee.position || "",
        workLocation: employee.city || "",
      },
    })
  }, [user.name, user.email, user.phoneNumber, employee.city, employee.bio, employee.position])

  function handleCancel() {
    setEditMode(false)
    setFormError("")
    setFormData({
      personal: {
        name: user.name || "",
        email: user.email || "",
        phone: user.phoneNumber || "",
        location: employee.city || "",
        bio: employee.bio || "",
      },
      work: {
        position: employee.position || "",
        workLocation: employee.city || "",
      },
    })
  }

  async function handleSave() {
    setFormError("")
    const phone = formData.personal.phone.trim()
    console.log('Phone number to be sent:', phone)
    if (!/^\+62\d{9,13}$/.test(phone)) {
      setFormError("Phone number must be in Indonesian format: +62xxxxxxxxxxx")
      toast({
        title: "Invalid Phone Number",
        description: "Phone number must be in Indonesian format: +62xxxxxxxxxxx",
        variant: "destructive"
      })
      return
    }
    setIsSaving(true)
    try {
      const requestBody = { phoneNumber: phone }
      console.log('Request body:', requestBody)
      const res = await fetch('/api/employee/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const result = await res.json()
      console.log('API response:', result)
      if (!res.ok || result.error) {
        setFormError(result.error || 'Failed to update phone number')
        toast({
          title: "Update Failed",
          description: result.error || 'Failed to update phone number',
          variant: "destructive"
        })
        return
      }
      setFormData(prev => ({
        ...prev,
        personal: {
          ...prev.personal,
          phone: phone
        }
      }))
      await mutate()
      setEditMode(false)
      setFormError("")
      toast({
        title: "Profile Updated",
        description: "Your phone number has been updated successfully.",
        variant: "success"
      })
    } catch (err) {
      console.error('Error updating phone number:', err)
      setFormError('Failed to update phone number')
      toast({
        title: "Update Failed",
        description: 'Failed to update phone number',
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  function handleInputChange(section: "personal" | "work", field: string, value: string) {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }))
  }

  if (isLoading) {
    return <ProfileSkeleton />
  }
  if (error || !data || !data.employee) {
    return <div className="text-red-500">Failed to load profile.</div>
  }

  return (
    <div className="w-full p-4 md:p-6 pb-20 pt-4 md:pt-0">
      <div className="sticky top-0 bg-background z-10 pt-4 pb-4 mb-4 border-b w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('myProfile')}</h1>
            <p className="text-muted-foreground">{t('manageProfile')}</p>
          </div>

          <div>
            {!editMode ? (
              <Button onClick={() => setEditMode(true)} className="gap-2">
                <Edit className="h-4 w-4" />
                {t('editProfile')}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancel} className="gap-2" disabled={isSaving}>
                  <X className="h-4 w-4" />
                  {t('cancel')}
                </Button>
                <Button onClick={handleSave} className="gap-2" disabled={isSaving}>
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Saving...' : t('saveChanges')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Profile card and skills */}
          <div className="space-y-6">
            {/* Profile card */}
            <Card>
              <CardContent className="p-0">
                <div className="relative h-32 bg-gradient-to-r from-primary/20 to-primary/40 rounded-t-lg">
                  <div className="absolute -bottom-12 left-6">
                    <div className="relative">
                      <div className="h-24 w-24 rounded-full border-4 border-background bg-muted flex items-center justify-center overflow-hidden">
                      {employee.pictureUrl ? (
                        <img
                          src={employee.pictureUrl}
                          alt={user.name || 'Employee photo'}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <User className="h-12 w-12 text-muted-foreground" />
                      )}
                      </div>
                      {editMode && (
                        <Button
                          size="icon"
                          variant="secondary"
                          className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-sm"
                        >
                          <Camera className="h-4 w-4" />
                          <span className="sr-only">Change photo</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-14 px-6 pb-6">
                  {!editMode ? (
                    <>
                    <h2 className="text-xl font-bold">{user.name}</h2>
                    <p className="text-sm text-muted-foreground">{employee.position}</p>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <AtSign className="h-4 w-4 text-muted-foreground" />
                        <span>{user.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{user.phoneNumber || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{employee.city}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{employee.joinDate ? format(new Date(employee.joinDate), "MMMM d, yyyy") : '-'}</span>
                        </div>
                      </div>

                      <Separator className="my-4" />

                    <div className="text-sm">{employee.bio || ''}</div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div>
                      <Label htmlFor="name">{t('fullName')}</Label>
                        <Input
                          id="name"
                          value={formData.personal.name}
                          onChange={(e) => handleInputChange("personal", "name", e.target.value)}
                        disabled
                        readOnly
                      />
                    </div>
                    <div>
                      <Label htmlFor="position">{t('position')}</Label>
                      <Input
                        id="position"
                        value={formData.work.position}
                        disabled
                        readOnly
                        />
                      </div>
                      <div>
                      <Label htmlFor="email">{t('email')}</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.personal.email}
                          onChange={(e) => handleInputChange("personal", "email", e.target.value)}
                        disabled
                        readOnly
                        />
                      </div>
                      <div>
                      <Label htmlFor="phone">{t('phone')}</Label>
                        <Input
                          id="phone"
                          value={formData.personal.phone}
                          onChange={(e) => handleInputChange("personal", "phone", e.target.value)}
                        />
                        {formError && (
                          <div className="text-red-500 text-xs mt-1">{formError}</div>
                        )}
                      </div>
                      <div>
                      <Label htmlFor="location">{t('location')}</Label>
                        <Input
                          id="location"
                          value={formData.personal.location}
                          onChange={(e) => handleInputChange("personal", "location", e.target.value)}
                        disabled
                        readOnly
                        />
                      </div>
                      <div>
                      <Label htmlFor="bio">{t('bio')}</Label>
                        <Textarea
                          id="bio"
                          value={formData.personal.bio}
                          onChange={(e) => handleInputChange("personal", "bio", e.target.value)}
                          rows={4}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column - Tabs with work info and settings */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="work">
              <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="work">{t('workInformation')}</TabsTrigger>
              <TabsTrigger value="settings">{t('settings')}</TabsTrigger>
              </TabsList>

              {/* Work Information Tab */}
              <TabsContent value="work" className="mt-4 space-y-6">
                <Card>
                  <CardHeader>
                  <CardTitle>{t('workSchedule')}</CardTitle>
                  <CardDescription>{t('workScheduleDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('regularHours')}</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                          <span>{t('mondayFriday')}</span>
                            <span>9:00 AM - 5:00 PM</span>
                          </div>
                        </div>
                      </div>
                      <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('timeZone')}</h4>
                        <p className="text-sm">Eastern Time (ET)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="mt-4 space-y-6">
                <EmployeeSettingsContent />
              </TabsContent>
            </Tabs>
          </div>
        </div>

      <Toaster />
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column skeleton */}
      <div className="space-y-6">
        <Card>
          <CardContent className="p-0">
            <Skeleton className="h-32 w-full rounded-t-lg" />
            <div className="pt-14 px-6 pb-6">
              <Skeleton className="h-6 w-40 mb-1" />
              <Skeleton className="h-4 w-32 mb-4" />
              <div className="space-y-2 mb-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
              <Skeleton className="h-px w-full my-4" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right column skeleton */}
      <div className="lg:col-span-2">
        <div className="space-y-2 mb-4">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40 mb-1" />
            <Skeleton className="h-4 w-60" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
