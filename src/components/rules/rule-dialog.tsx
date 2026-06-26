"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createRuleAction, updateRuleAction } from "@/app/actions";
import type { Rule } from "@/lib/db/schema";
import type { NormalizedTemplate } from "@/lib/meta/types";

interface FormState {
  name: string;
  module: "Contacts" | "Leads" | "both";
  dateField: "Date_of_Birth" | "Anniversary_Date";
  templateName: string;
  templateLang: string;
  hasNameVar: boolean;
  hasHeaderImage: boolean;
  headerImageUrl: string;
  sendTime: string;
  criteriaJson: string;
}

function blank(): FormState {
  return {
    name: "",
    module: "both",
    dateField: "Date_of_Birth",
    templateName: "",
    templateLang: "en_US",
    hasNameVar: false,
    hasHeaderImage: false,
    headerImageUrl: "",
    sendTime: "09:00",
    criteriaJson: "",
  };
}

export function RuleDialog({
  open,
  onOpenChange,
  editing,
  templates,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Rule | null;
  templates: NormalizedTemplate[];
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(blank());
  const [saving, setSaving] = React.useState(false);

  // Reset the form whenever the dialog opens for create or edit.
  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        module: editing.module,
        dateField: editing.dateField,
        templateName: editing.templateName,
        templateLang: editing.templateLang,
        hasNameVar: editing.hasNameVar,
        hasHeaderImage: editing.hasHeaderImage,
        headerImageUrl: editing.headerImageUrl ?? "",
        sendTime: editing.sendTime,
        criteriaJson: editing.criteriaJson ?? "",
      });
    } else {
      setForm(blank());
    }
  }, [open, editing]);

  const selectedTemplate = templates.find(
    (t) => t.name === form.templateName,
  );

  // Selecting a template auto-detects its name variable and image header.
  function onTemplateChange(name: string) {
    const t = templates.find((tpl) => tpl.name === name);
    setForm((f) => ({
      ...f,
      templateName: name,
      templateLang: t?.language ?? f.templateLang,
      hasNameVar: t?.hasNameVar ?? false,
      hasHeaderImage: t?.hasHeaderImage ?? false,
      // Clear an old image URL if the new template has no image header.
      headerImageUrl: t?.hasHeaderImage ? f.headerImageUrl : "",
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Give the rule a name.");
      return;
    }
    if (!form.templateName) {
      toast.error("Pick a template.");
      return;
    }
    if (form.hasHeaderImage && !form.headerImageUrl.trim()) {
      toast.error("This template has an image header, so a header image URL is required.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      module: form.module,
      dateField: form.dateField,
      templateName: form.templateName,
      templateLang: form.templateLang,
      hasNameVar: form.hasNameVar,
      hasHeaderImage: form.hasHeaderImage,
      headerImageUrl: form.hasHeaderImage ? form.headerImageUrl.trim() : null,
      sendTime: form.sendTime,
      criteriaJson: form.criteriaJson.trim() || null,
    };

    setSaving(true);
    const res = editing
      ? await updateRuleAction(editing.id, payload)
      : await createRuleAction(payload);
    setSaving(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Rule updated." : "Rule created.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit rule" : "New rule"}</DialogTitle>
          <DialogDescription>
            Choose what triggers the message and which approved template to send.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule-name">Rule name</Label>
            <Input
              id="rule-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Birthday wishes"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rule-trigger">Trigger</Label>
              <Select
                value={form.dateField}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    dateField: v as FormState["dateField"],
                  })
                }
              >
                <SelectTrigger id="rule-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Date_of_Birth">Birthday</SelectItem>
                  <SelectItem value="Anniversary_Date">Anniversary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-module">Zoho module</Label>
              <Select
                value={form.module}
                onValueChange={(v) =>
                  setForm({ ...form, module: v as FormState["module"] })
                }
              >
                <SelectTrigger id="rule-module">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Contacts and Leads</SelectItem>
                  <SelectItem value="Contacts">Contacts</SelectItem>
                  <SelectItem value="Leads">Leads</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-template">Template (approved only)</Label>
            <Select value={form.templateName} onValueChange={onTemplateChange}>
              <SelectTrigger id="rule-template">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No approved templates found
                  </SelectItem>
                ) : (
                  templates.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name} ({t.language})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedTemplate ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedTemplate.hasNameVar ? (
                  <Badge variant="outline">Inserts first name</Badge>
                ) : (
                  <Badge variant="secondary">No name variable</Badge>
                )}
                {selectedTemplate.hasHeaderImage ? (
                  <Badge variant="outline">Image header</Badge>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Header image URL appears only when the template has an image header. */}
          {form.hasHeaderImage ? (
            <div className="space-y-2">
              <Label htmlFor="rule-header-image">Header image URL</Label>
              <Input
                id="rule-header-image"
                type="url"
                value={form.headerImageUrl}
                onChange={(e) =>
                  setForm({ ...form, headerImageUrl: e.target.value })
                }
                placeholder="https://example.com/birthday.jpg"
                required
              />
              <p className="text-xs text-muted-foreground">
                Sent as the header image on every message for this rule.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rule-time">Send time</Label>
              <Input
                id="rule-time"
                type="time"
                value={form.sendTime}
                onChange={(e) =>
                  setForm({ ...form, sendTime: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-lang">Language</Label>
              <Input
                id="rule-lang"
                value={form.templateLang}
                onChange={(e) =>
                  setForm({ ...form, templateLang: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-criteria">
              Extra Zoho criteria (optional)
            </Label>
            <Textarea
              id="rule-criteria"
              value={form.criteriaJson}
              onChange={(e) =>
                setForm({ ...form, criteriaJson: e.target.value })
              }
              placeholder="e.g. City = 'Mumbai'"
            />
            <p className="text-xs text-muted-foreground">
              A COQL WHERE fragment, added with AND to the date match. Leave
              blank for everyone.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Create rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
