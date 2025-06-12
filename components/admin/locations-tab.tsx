import { useToast } from "@/components/ui/use-toast";
import { useSWR } from "swr";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { AddLocationModal, EditLocationModal } from "@/components/admin/location-modals";

export default function LocationsTab() {
  const { toast } = useToast();
  const { data: locationsData, error: locationsError, isLoading: locationsLoading, mutate: mutateLocations } = useSWR("/api/locations", fetcher);
  const [isDeletingLocation, setIsDeletingLocation] = useState(false);
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteConfirmLocation, setDeleteConfirmLocation] = useState<Location | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleDeleteLocation = async (locationId: string | number) => {
    setIsDeletingLocation(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/locations/${locationId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete location");
      }
      await mutateLocations();
      toast({
        title: "Location Deleted",
        description: "Location has been deleted successfully!",
      });
      setDeleteConfirmLocation(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete location");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete location",
        variant: "destructive",
      });
    } finally {
      setIsDeletingLocation(false);
    }
  };

  const handleAddLocation = async (data: AddLocationFormData) => {
    setIsAddingLocation(true);
    setActionError(null);
    try {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add location");
      }
      await mutateLocations();
      toast({
        title: "Location Added",
        description: "Location has been added successfully!",
      });
      setIsAddModalOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add location");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to add location",
        variant: "destructive",
      });
    } finally {
      setIsAddingLocation(false);
    }
  };

  const handleEditLocation = async (locationId: string | number, data: EditLocationFormData) => {
    setIsEditingLocation(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/locations/${locationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to edit location");
      }
      await mutateLocations();
      toast({
        title: "Location Updated",
        description: "Location has been updated successfully!",
      });
      setIsEditModalOpen(false);
      setSelectedLocation(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to edit location");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to edit location",
        variant: "destructive",
      });
    } finally {
      setIsEditingLocation(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ... existing table code ... */}

      {/* Add Location Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
          </DialogHeader>
          <AddLocationModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onAdd={handleAddLocation}
            isLoading={isAddingLocation}
          />
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </DialogContent>
      </Dialog>

      {/* Edit Location Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          {selectedLocation && (
            <EditLocationModal
              location={selectedLocation}
              isOpen={isEditModalOpen}
              onClose={() => {
                setIsEditModalOpen(false);
                setSelectedLocation(null);
              }}
              onEdit={handleEditLocation}
              isLoading={isEditingLocation}
            />
          )}
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmLocation} onOpenChange={open => { if (!open) setDeleteConfirmLocation(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div>Are you sure you want to delete this location?</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmLocation(null)}>Cancel</Button>
            <LoadingButton
              variant="destructive"
              loading={isDeletingLocation}
              loadingText="Deleting..."
              onClick={() => {
                if (deleteConfirmLocation) {
                  handleDeleteLocation(deleteConfirmLocation.id);
                }
              }}
            >
              Delete
            </LoadingButton>
          </DialogFooter>
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </DialogContent>
      </Dialog>
    </div>
  );
} 