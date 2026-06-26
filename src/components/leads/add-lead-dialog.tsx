"use client";

import * as React from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLeadAction } from "@/app/actions";

interface LeadFields {
  First_Name: string;
  Last_Name: string;
  Mobile: string;
  Email: string;
  Date_of_Birth: string;
  Anniversary_Date: string;
  tag: string;
}

function blank(): LeadFields {
  return {
    First_Name: "",
    Last_Name: "",
    Mobile: "",
    Email: "",
    Date_of_Birth: "",
    Anniversary_Date: "",
    // Default tag so test records are easy to find and clean up later.
    tag: "Test",
  };
}

export function AddLeadDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<LeadFields>(blank());
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm(blank());
  }, [open]);

  function set<K extends keyof LeadFields>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.Last_Name.trim()) {
      toast.error("Last name is required by Zoho.");
      return;
    }
    setSaving(true);
    const res = await createLeadAction({
      First_Name: form.First_Name.trim() || undefined,
      Last_Name: form.Last_Name.trim(),
      Mobile: form.Mobile.trim() || undefined,
      Email: form.Email.trim() || undefined,
      Date_of_Birth: form.Date_of_Birth || undefined,
      Anniversary_Date: form.Anniversary_Date || undefined,
      tag: form.tag.trim() || undefined,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const data = res.data as { id: string; tag: string | null };
    toast.success(
      `Lead created${data.tag ? ` with tag "${data.tag}"` : ""}. Zoho id ${data.id}.`,
    );
    setOpen(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" />
          Add lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a lead</DialogTitle>
          <DialogDescription>
            Create a Zoho CRM lead. It is tagged so you can find and test on it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lead-first">First name</Label>
              <Input
                id="lead-first"
                value={form.First_Name}
                onChange={(e) => set("First_Name", e.target.value)}
                placeholder="Abhinav"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-last">Last name (required)</Label>
              <Input
                id="lead-last"
                value={form.Last_Name}
                onChange={(e) => set("Last_Name", e.target.value)}
                placeholder="Rai"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lead-mobile">Mobile</Label>
              <Input
                id="lead-mobile"
                value={form.Mobile}
                onChange={(e) => set("Mobile", e.target.value)}
                placeholder="918169921886"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={form.Email}
                onChange={(e) => set("Email", e.target.value)}
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lead-dob">Date of birth</Label>
              <Input
                id="lead-dob"
                type="date"
                value={form.Date_of_Birth}
                onChange={(e) => set("Date_of_Birth", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-anniv">Anniversary</Label>
              <Input
                id="lead-anniv"
                type="date"
                value={form.Anniversary_Date}
                onChange={(e) => set("Anniversary_Date", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead-tag">Tag</Label>
            <Input
              id="lead-tag"
              value={form.tag}
              onChange={(e) => set("tag", e.target.value)}
              placeholder="Test"
            />
            <p className="text-xs text-muted-foreground">
              Applied via the Zoho add tags action. Use it to mark and find your
              test records.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
