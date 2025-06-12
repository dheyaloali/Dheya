"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useTranslations } from "next-intl"
import debounce from "lodash.debounce"
import ReCAPTCHA from "react-google-recaptcha"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
const allowedCities = ["Jakarta", "Surabaya", "Bandung"];

const passwordRequirements = [
  { regex: /.{12,}/, label: "At least 12 characters" },
  { regex: /[A-Z]/, label: "At least one uppercase letter" },
  { regex: /[a-z]/, label: "At least one lowercase letter" },
  { regex: /[0-9]/, label: "At least one number" },
  { regex: /[^A-Za-z0-9]/, label: "At least one special character" },
]

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

function isValidIndonesianMobileNumber(number) {
  if (!/^\+62\d{9,13}$/.test(number)) return false;
  return validPrefixes.some(prefix => number.startsWith(prefix));
}

// Move schema into a function that takes t
function getFormSchema(t: (key: string) => string) {
  return z.object({
    name: z.string()
      .min(2, {
      message: t('nameMin2'),
      })
      .regex(/^[A-Za-z ]+$/, {
        message: t('nameLettersOnly'),
    }),
    email: z.string().email({
      message: t('validEmail'),
    }),
    phoneNumber: z.string().min(12, {
      message: t('phoneRequired'),
    }).regex(/^\+62\d{9,13}$/, {
      message: 'Phone number must be in Indonesian format: +62xxxxxxxxxxx',
    }),
    password: z.string().min(12, {
      message: t('passwordMin12'),
    }).refine((val) => passwordRequirements.every(req => req.regex.test(val)), {
      message: t('passwordRequirements'),
    }),
    confirmPassword: z.string(),
    city: z.enum(["Jakarta", "Surabaya", "Bandung"], {
      required_error: t('selectCity'),
    }),
    picture: z.any().refine((file) => file && file.length === 1, {
      message: t('pictureRequired'),
    }),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('passwordsDoNotMatch'),
    path: ["confirmPassword"],
  })
}

// Add a simple modal component
function SuccessModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('Auth')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full text-center">
        <h2 className="text-xl font-semibold mb-2">{t('registrationSuccessTitle')}</h2>
        <p className="mb-4">{t('registrationSuccessDesc')}</p>
        <Button onClick={onClose} className="w-full">{t('goToLogin')}</Button>
      </div>
    </div>
  )
}

export function RegisterForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [registerError, setRegisterError] = useState("")
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [passwordValue, setPasswordValue] = useState("")
  const [picturePreview, setPicturePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const t = useTranslations('Auth')
  const [uniqueStatus, setUniqueStatus] = useState({
    name: { loading: false, available: true, message: "" },
    email: { loading: false, available: true, message: "" }
  });
  const [recaptchaToken, setRecaptchaToken] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Add AbortController ref
  const abortControllerRef = useRef<AbortController | null>(null);

  const form = useForm<z.infer<ReturnType<typeof getFormSchema>>>({
    resolver: zodResolver(getFormSchema(t)),
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
      city: undefined,
      picture: undefined,
    },
  })

  const checkUnique = useCallback(
    debounce(async (field: "name" | "email", value: string) => {
      // Don't check if empty or too short
      if (!value || !value.trim()) {
        setUniqueStatus(prev => ({
          ...prev,
          [field]: { loading: false, available: true, message: "" }
        }));
        return;
      }

      // Cancel previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();

      setUniqueStatus(prev => ({ ...prev, [field]: { ...prev[field], loading: true } }));

      try {
        const res = await fetch("/api/check-unique", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field, value }),
          signal: abortControllerRef.current.signal
        });

        const data = await res.json();
        
        setUniqueStatus(prev => ({
          ...prev,
          [field]: {
            loading: false,
            available: data.available,
            message: data.available ? t('available') : t(data.message)
          }
        }));
      } catch (error: unknown) {
        // Don't update state if request was aborted
        if (error instanceof Error && error.name === 'AbortError') return;
        
        setUniqueStatus(prev => ({
          ...prev,
          [field]: { loading: false, available: true, message: "" }
        }));
      }
    }, 500),
    [t]
  );

  // Handlers for onChange only (not onBlur)
  const handleUniqueCheck = (field: "name" | "email", value: string) => {
    // Trim value before checking uniqueness
    const trimmedValue = value.trim();
    setUniqueStatus(prev => ({ ...prev, [field]: { ...prev[field], loading: true } }));
    checkUnique(field, trimmedValue);
  };

  // Prevent submit if any field is not unique or is being checked
  const canSubmit = uniqueStatus.name.available && uniqueStatus.email.available &&
    !uniqueStatus.name.loading && !uniqueStatus.email.loading;

  // Debounced submit handler
  const debouncedSubmit = useCallback(
    debounce(async (values: z.infer<ReturnType<typeof getFormSchema>>) => {
    setIsLoading(true)
    setRegisterError("")
    try {
      // Normalize and trim values
      const normalizedEmail = values.email.trim().toLowerCase();
      const trimmedName = values.name.trim();
      const trimmedPhone = values.phoneNumber.replace(/\s+/g, '').trim();
      // Prepare form data for file upload
      const formData = new FormData()
      formData.append("name", trimmedName)
      formData.append("email", normalizedEmail)
      formData.append("phoneNumber", trimmedPhone)
      formData.append("password", values.password)
      formData.append("city", values.city)
      formData.append("picture", values.picture[0])
        formData.append("recaptchaToken", recaptchaToken)
      // Call the registration API
      const res = await fetch("/api/auth/register", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        const errorKey = data.message || 'registrationFailed';
        setRegisterError(t(errorKey));
        toast({
          variant: "destructive",
          title: t('registrationFailed'),
          description: t(errorKey),
        });
        setIsLoading(false)
          setIsSubmitting(false)
        return
      }
      // Show modal instead of toast
      setShowSuccessModal(true)
      form.reset()
      setPicturePreview(null)
      setTimeout(() => {
        router.push("/login")
      }, 4000)
    } catch (error) {
      setRegisterError(t('unexpectedError'))
      toast({
        variant: "destructive",
        title: t('registrationFailed'),
        description: t('unexpectedError'),
      })
    } finally {
      setIsLoading(false)
        setIsSubmitting(false)
      }
    }, 1000, { leading: true, trailing: false }),
    [recaptchaToken, t, toast, router, form]
  );

  async function onSubmit(values: z.infer<ReturnType<typeof getFormSchema>>) {
    if (isSubmitting) return
    setIsSubmitting(true)
    await debouncedSubmit(values)
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSubmit.cancel()
    }
  }, [debouncedSubmit])

  return (
    <>
      {showSuccessModal && <SuccessModal onClose={() => router.push("/login")} />}
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Name + Email + Phone row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="name"
              render={({ field }: { field: any }) => {
                const nameValue = field.value || "";
                const isNameFormatValid = /^[A-Za-z ]+$/.test(nameValue);
                return (
              <FormItem>
                <FormLabel>{t('name')}</FormLabel>
                <FormControl>
                  <Input
                    className="bg-gray-50 border border-gray-200 focus:border-blue-400 focus:bg-white transition text-base py-3 placeholder:text-xs"
                    placeholder={t('enterName')}
                    {...field}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          field.onChange(e);
                          if (/^[A-Za-z ]+$/.test(e.target.value)) {
                            handleUniqueCheck("name", e.target.value);
                          }
                        }}
                  />
                </FormControl>
                    {!isNameFormatValid && nameValue && (
                      <span className="block text-xs mt-1 text-red-500">{t('nameLettersOnly')}</span>
                    )}
                    {isNameFormatValid && uniqueStatus.name.loading && (
                  <span className="block text-xs text-blue-500 mt-1">{t('checking')}</span>
                )}
                    {isNameFormatValid && !uniqueStatus.name.loading && nameValue && (
                  <span className={`block text-xs mt-1 ${uniqueStatus.name.available ? 'text-green-500' : 'text-red-500'}`}>
                    {uniqueStatus.name.message}
                  </span>
                )}
                <FormMessage />
              </FormItem>
                );
              }}
          />
          <FormField
            control={form.control}
            name="email"
              render={({ field }: { field: any }) => {
                const emailValue = field.value || "";
                const isEmailFormatValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
                return (
              <FormItem>
                <FormLabel>{t('email')}</FormLabel>
                <FormControl>
                  <Input
                    className="bg-gray-50 border border-gray-200 focus:border-blue-400 focus:bg-white transition text-base py-3 placeholder:text-xs"
                    placeholder={t('enterEmail')}
                    {...field}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          field.onChange(e);
                          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value)) {
                            handleUniqueCheck("email", e.target.value);
                          }
                        }}
                  />
                </FormControl>
                    {!isEmailFormatValid && emailValue && (
                      <span className="block text-xs mt-1 text-red-500">{t('validEmail')}</span>
                    )}
                    {isEmailFormatValid && uniqueStatus.email.loading && (
                  <span className="block text-xs text-blue-500 mt-1">{t('checking')}</span>
                )}
                    {isEmailFormatValid && !uniqueStatus.email.loading && emailValue && (
                  <span className={`block text-xs mt-1 ${uniqueStatus.email.available ? 'text-green-500' : 'text-red-500'}`}>
                    {uniqueStatus.email.message}
                  </span>
                )}
                <FormMessage />
              </FormItem>
                );
              }}
          />
          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }: { field: any }) => {
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
                  <FormLabel>{t('phoneNumber')}</FormLabel>
                  <FormControl>
                    <Input
                      className="bg-gray-50 border border-gray-200 focus:border-blue-400 focus:bg-white transition text-base py-3 placeholder:text-xs"
                      placeholder={t('enterPhoneNumber')}
                      {...field}
                      onChange={(e) => {
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
              )
            }}
          />
        </div>
        {/* Password + Confirm Password row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }: { field: any }) => (
              <FormItem>
                <FormLabel>{t('password')}</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    className="bg-gray-50 border border-gray-200 focus:border-blue-400 focus:bg-white transition text-base py-3 placeholder:text-xs"
                    placeholder={t('enterPassword')}
                    {...field}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      field.onChange(e)
                      setPasswordValue(e.target.value)
                    }}
                  />
                </FormControl>
                <div className="mt-1 space-y-1 text-xs">
                  {[t('passwordAtLeast12'), t('passwordUpper'), t('passwordLower'), t('passwordNumber'), t('passwordSpecial')].map((label, i) => (
                    <div key={label} className={passwordRequirements[i].regex.test(passwordValue) ? "text-green-600" : "text-gray-400"}>
                      {label}
                    </div>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }: { field: any }) => (
              <FormItem>
                <FormLabel>{t('confirmPassword')}</FormLabel>
                <FormControl>
                  <Input type="password" className="bg-gray-50 border border-gray-200 focus:border-blue-400 focus:bg-white transition text-base py-3 placeholder:text-xs" placeholder={t('enterPassword')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {/* City + Picture row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field, fieldState }: { field: any; fieldState: any }) => (
              <FormItem>
                <FormLabel>{t('city')}</FormLabel>
                <FormControl>
                  <select {...field} className="w-full border rounded px-3 py-3 bg-gray-50 border-gray-200 focus:border-blue-400 focus:bg-white transition text-base placeholder:text-xs">
                    <option value="">{t('selectCity')}</option>
                    {allowedCities.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </FormControl>
                {fieldState.error && (
                  <span className="block text-xs text-red-500 mt-1">{fieldState.error.message}</span>
                )}
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="picture"
            render={({ field, fieldState }: { field: any; fieldState: any }) => (
              <FormItem>
                <FormLabel>{t('picture')}</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    className="bg-gray-50 border border-gray-200 focus:border-blue-400 focus:bg-white transition text-base py-3 placeholder:text-xs"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      field.onChange(e.target.files)
                      if (e.target.files && e.target.files[0]) {
                        const reader = new FileReader()
                        reader.onload = ev => setPicturePreview(ev.target?.result as string)
                        reader.readAsDataURL(e.target.files[0])
                      } else {
                        setPicturePreview(null)
                      }
                    }}
                  />
                </FormControl>
                {picturePreview && (
                  <img src={picturePreview} alt="Preview" className="mt-2 w-24 h-24 object-cover rounded-full border" />
                )}
                {fieldState.error && (
                  <span className="block text-xs text-red-500 mt-1">{fieldState.error.message}</span>
                )}
              </FormItem>
            )}
          />
        </div>
          <ReCAPTCHA
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
            onChange={token => setRecaptchaToken(token || "")}
            theme="light"
            size="normal"
          />
        {registerError && <p className="text-sm font-medium text-red-500">{registerError}</p>}
          <Button 
            type="submit" 
            className="w-full relative" 
            disabled={isLoading || isSubmitting || !canSubmit || !recaptchaToken}
          >
            {isLoading || isSubmitting ? (
              <>
                <span className="opacity-0">{t('register')}</span>
                <span className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </span>
              </>
            ) : (
              t('register')
            )}
        </Button>
      </form>
    </Form>
    </>
  )
}
