import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { LoadingButton } from "@/components/ui/loading-button";

interface EditLocationModalProps {
  location: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    phone?: string;
    email?: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onEdit: (id: string, form: any) => Promise<void>;
  isLoading: boolean;
}

export default function EditLocationModal({
  location,
  isOpen,
  onClose,
  onEdit,
  isLoading,
}: EditLocationModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: location.name,
    address: location.address,
    city: location.city,
    state: location.state,
    zipCode: location.zipCode,
    phone: location.phone || "",
    email: location.email || "",
  });
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      name: location.name,
      address: location.address,
      city: location.city,
      state: location.state,
      zipCode: location.zipCode,
      phone: location.phone || "",
      email: location.email || "",
    });
  }, [location]);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleEdit = async () => {
    if (!form.name.trim() || !form.address.trim() || !form.city.trim() || !form.state.trim() || !form.zipCode.trim()) {
      setActionError("Name, address, city, state, and zip code are required.");
      return;
    }

    setActionError(null);
    try {
      await onEdit(location.id, form);
      toast({
        title: "Location Updated",
        description: "Location has been updated successfully!",
      });
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update location");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update location",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Location</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => handleChange("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => handleChange("address", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={e => handleChange("city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={form.state} onChange={e => handleChange("state", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Zip Code</Label>
              <Input value={form.zipCode} onChange={e => handleChange("zipCode", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => handleChange("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => handleChange("email", e.target.value)} />
            </div>
          </div>
          {actionError && <div className="text-red-500 text-sm mt-2">{actionError}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <LoadingButton
              onClick={handleEdit}
              loading={isLoading}
              loadingText="Updating..."
              disabled={!!actionError}
            >
              Save Changes
            </LoadingButton>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
} 