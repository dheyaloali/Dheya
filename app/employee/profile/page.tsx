import { EmployeeProfileContent } from "@/components/employee/profile-content"
import { EmployeeLayout } from "@/components/layouts/employee-layout"
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export const metadata = {
  title: "Profile | Employee Management System",
  description: "View and manage your employee profile",
}

export default function EmployeeProfilePage() {
   return (
      <>
        <LanguageSwitcher currentLocale={"en"} />
      <EmployeeProfileContent />
      </>
   )
}
