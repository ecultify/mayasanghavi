"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/page-header";
import { sendTestAction } from "@/app/actions";
import type { NormalizedTemplate } from "@/lib/meta/types";

export function TestForm({ templates }: { templates: NormalizedTemplate[] }) {
  const router = useRouter();
  const [templateName, setTemplateName] = React.useState("");
  const [to, setTo] = React.useState("");
  const [name, setName] = React.useState("");
  const [headerImageUrl, setHeaderImageUrl] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const selected = templates.find((t) => t.name === templateName);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!templateName) {
      toast.error("Pick a template.");
      return;
    }
    if (!to.trim()) {
      toast.error("Enter a recipient number.");
      return;
    }
    if (selected?.hasHeaderImage && !headerImageUrl.trim()) {
      toast.error("This template has an image header, so a header image URL is required.");
      return;
    }

    setSending(true);
    const res = await sendTestAction({
      to: to.trim(),
      template: templateName,
      lang: selected?.language,
      name: selected?.hasNameVar ? name.trim() : undefined,
      headerImageUrl: selected?.hasHeaderImage ? headerImageUrl.trim() : undefined,
    });
    setSending(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const data = res.data as { messageId: string | null; to: string };
    toast.success(`Sent to ${data.to}. Message id: ${data.messageId ?? "n/a"}.`);
    router.refresh();
  }

  if (templates.length === 0) {
    return (
      <EmptyState message="No approved templates available. Create and get a template approved first." />
    );
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Send a test message</CardTitle>
        <CardDescription>
          Fields adjust to the selected template (name variable, image header).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-template">Template</Label>
            <Select value={templateName} onValueChange={setTemplateName}>
              <SelectTrigger id="test-template">
                <SelectValue placeholder="Select an approved template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name} ({t.language})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {selected.hasNameVar ? (
                  <Badge variant="outline">Inserts first name</Badge>
                ) : null}
                {selected.hasHeaderImage ? (
                  <Badge variant="outline">Image header</Badge>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-to">Recipient number</Label>
            <Input
              id="test-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="918169921886 or 8169921886"
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground">
              Indian mobile. 10 digits or 91 followed by 10 digits.
            </p>
          </div>

          {selected?.hasNameVar ? (
            <div className="space-y-2">
              <Label htmlFor="test-name">Recipient first name</Label>
              <Input
                id="test-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Abhinav"
              />
            </div>
          ) : null}

          {selected?.hasHeaderImage ? (
            <div className="space-y-2">
              <Label htmlFor="test-image">Header image URL</Label>
              <Input
                id="test-image"
                type="url"
                value={headerImageUrl}
                onChange={(e) => setHeaderImageUrl(e.target.value)}
                placeholder="https://example.com/header.jpg"
              />
            </div>
          ) : null}

          <Button type="submit" disabled={sending}>
            <Send className="h-4 w-4" />
            {sending ? "Sending..." : "Send now"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
