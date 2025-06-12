"use client"

import { MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTranslations } from "next-intl"

interface LocationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEnable: () => void
}

export function LocationDialog({ open, onOpenChange, onEnable }: LocationDialogProps) {
  const t = useTranslations('LocationDialog')

  const handleEnable = () => {
    // In a real app, this would request browser location permissions
    onEnable()
    onOpenChange(false)
  }

  return (
    <Dialog open={open}>
      <DialogContent
        onInteractOutside={(e: React.MouseEvent | React.TouchEvent) => e.preventDefault()}
        onEscapeKeyDown={(e: React.KeyboardEvent) => e.preventDefault()}
        className="sm:max-w-[425px]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {t('enableLocationServices')}
          </DialogTitle>
          <DialogDescription>
            {t('allowLocationDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="text-sm font-medium mb-2">{t('whyWeNeed')}</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
              <li>{t('verifyAttendance')}</li>
              <li>{t('ensureCompliance')}</li>
              <li>{t('automateCheckIn')}</li>
            </ul>
            <p className="text-sm mt-3 text-muted-foreground">
              {t('privacyNotice')}
            </p>
          </div>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleEnable} className="sm:w-auto w-full">
            {t('enableLocation')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
