"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Variable } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { createTemplateAction, uploadMediaAction } from "@/app/actions";
import type {
  CreateTemplateInput,
  HeaderType,
  TemplateButton,
} from "@/lib/meta/types";

const HAS_VAR = /\{\{\s*\d+\s*\}\}/;

// Full-page template builder. On success it returns to the templates list.
export function TemplateForm() {
  const router = useRouter();
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const [name, setName] = React.useState("");
  const [language, setLanguage] = React.useState("en_US");
  const [category, setCategory] = React.useState<"MARKETING" | "UTILITY">(
    "MARKETING",
  );
  const [headerType, setHeaderType] = React.useState<HeaderType>("NONE");
  const [headerText, setHeaderText] = React.useState("");
  const [body, setBody] = React.useState("");
  const [bodyExample, setBodyExample] = React.useState("");
  const [footer, setFooter] = React.useState("");
  const [buttons, setButtons] = React.useState<TemplateButton[]>([]);

  // Image header upload state.
  const [uploading, setUploading] = React.useState(false);
  const [mediaHandle, setMediaHandle] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const [submitting, setSubmitting] = React.useState(false);

  const bodyHasVar = HAS_VAR.test(body);

  // Insert a {{1}} variable at the cursor in the body field.
  function insertVariable() {
    const el = bodyRef.current;
    const token = "{{1}}";
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    setMediaHandle(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadMediaAction(fd);
    setUploading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setMediaHandle(res.data.handle);
    toast.success("Sample image uploaded to Meta.");
  }

  function addButton(type: "QUICK_REPLY" | "URL") {
    setButtons((b) => [
      ...b,
      { type, text: "", url: type === "URL" ? "" : undefined },
    ]);
  }

  function updateButton(idx: number, patch: Partial<TemplateButton>) {
    setButtons((b) => b.map((btn, i) => (i === idx ? { ...btn, ...patch } : btn)));
  }

  function removeButton(idx: number) {
    setButtons((b) => b.filter((_, i) => i !== idx));
  }

  // Client-side validation mirroring Meta rules so submissions do not bounce.
  function validate(): string | null {
    if (!/^[a-z0-9_]+$/.test(name)) {
      return "Name must be lowercase letters, numbers and underscores only.";
    }
    if (name.length > 512) return "Name is too long.";
    if (!body.trim()) return "Body text is required.";
    if (body.length > 1024) return "Body must be 1024 characters or fewer.";
    if (bodyHasVar && !bodyExample.trim()) {
      return "Body has a {{1}} variable, so a sample value is required.";
    }
    if (headerType === "TEXT" && !headerText.trim()) {
      return "Text header selected but no header text entered.";
    }
    if (headerType === "IMAGE" && !mediaHandle) {
      return "Image header selected but no sample image uploaded yet.";
    }
    for (const btn of buttons) {
      if (!btn.text.trim()) return "Every button needs a label.";
      if (btn.type === "URL" && !btn.url?.trim()) {
        return "URL buttons need a URL.";
      }
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    const input: CreateTemplateInput = {
      name,
      language,
      category,
      headerType,
      headerText: headerType === "TEXT" ? headerText : undefined,
      headerImageHandle:
        headerType === "IMAGE" ? mediaHandle ?? undefined : undefined,
      body,
      bodyExample: bodyHasVar ? bodyExample : undefined,
      footer: footer.trim() || undefined,
      buttons: buttons.length ? buttons : undefined,
    };

    setSubmitting(true);
    const res = await createTemplateAction(input);
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const data = res.data as { status?: string };
    toast.success(
      `Template submitted. Status: ${data.status ?? "PENDING"}. It will appear as Approved or Rejected after Meta review.`,
    );
    router.push("/templates");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Template details</CardTitle>
            <CardDescription>
              Build a template and submit it to Meta for approval. Approval can
              take a few minutes to a few hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name + language */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                  )
                }
                placeholder="maya_diwali_offer"
                required
              />
              <p className="text-xs text-muted-foreground">
                Lowercase, numbers, and underscores only.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-lang">Language</Label>
              <Input
                id="tpl-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="en_US"
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="tpl-category">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as "MARKETING" | "UTILITY")}
            >
              <SelectTrigger id="tpl-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MARKETING">Marketing</SelectItem>
                <SelectItem value="UTILITY">Utility</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Promotional or offer content (birthday wishes, festive greetings,
              discounts) must be Marketing. Utility is only for transactional
              updates like order or appointment notices.
            </p>
          </div>

          {/* Header type */}
          <div className="space-y-2">
            <Label htmlFor="tpl-header">Header</Label>
            <Select
              value={headerType}
              onValueChange={(v) => setHeaderType(v as HeaderType)}
            >
              <SelectTrigger id="tpl-header">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">None</SelectItem>
                <SelectItem value="TEXT">Text</SelectItem>
                <SelectItem value="IMAGE">Image</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {headerType === "TEXT" ? (
            <div className="space-y-2">
              <Label htmlFor="tpl-header-text">Header text</Label>
              <Input
                id="tpl-header-text"
                value={headerText}
                maxLength={60}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="Happy Birthday!"
              />
            </div>
          ) : null}

          {headerType === "IMAGE" ? (
            <div className="space-y-2 rounded-md border border-dashed p-4">
              <Label htmlFor="tpl-image">Sample header image</Label>
              <p className="text-xs text-muted-foreground">
                Meta needs a sample image to review an image-header template.
                Uploaded via the Resumable Upload API.
              </p>
              <input
                id="tpl-image"
                type="file"
                accept="image/*"
                onChange={onPickImage}
                className="block w-full text-sm file:mr-4 file:min-h-9 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:text-sm file:font-medium hover:file:bg-secondary/80"
              />
              {uploading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Upload className="h-4 w-4 animate-pulse" />
                  Uploading to Meta...
                  <Skeleton className="h-4 w-24" />
                </div>
              ) : null}
              {previewUrl ? (
                <div className="relative mt-2 h-40 w-full overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Header image preview"
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                </div>
              ) : null}
              {mediaHandle ? (
                <p className="text-xs text-success">
                  Image ready (handle received).
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Body */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tpl-body">Body</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={insertVariable}
              >
                <Variable className="h-4 w-4" />
                Insert variable
              </Button>
            </div>
            <Textarea
              id="tpl-body"
              ref={bodyRef}
              value={body}
              maxLength={1024}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {{1}}, wishing you a very happy birthday from Maya Sanghavi Jewels."
              className="min-h-28"
              required
            />
            <p className="text-xs text-muted-foreground">
              {body.length}/1024 characters.{" "}
              {bodyHasVar
                ? "Variable {{1}} detected, sample value required below."
                : "Use Insert variable to personalize with the recipient first name."}
            </p>
          </div>

          {bodyHasVar ? (
            <div className="space-y-2">
              <Label htmlFor="tpl-example">Sample value for {"{{1}}"}</Label>
              <Input
                id="tpl-example"
                value={bodyExample}
                onChange={(e) => setBodyExample(e.target.value)}
                placeholder="Abhinav"
                required
              />
            </div>
          ) : null}

          {/* Footer */}
          <div className="space-y-2">
            <Label htmlFor="tpl-footer">Footer (optional)</Label>
            <Input
              id="tpl-footer"
              value={footer}
              maxLength={60}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="Maya Sanghavi Jewels"
            />
          </div>

          {/* Buttons */}
          <div className="space-y-2">
            <Label>Buttons (optional)</Label>
            <div className="space-y-2">
              {buttons.map((btn, idx) => (
                <div
                  key={idx}
                  className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center"
                >
                  <span className="w-24 shrink-0 text-xs font-medium uppercase text-muted-foreground">
                    {btn.type === "URL" ? "URL" : "Quick reply"}
                  </span>
                  <Input
                    value={btn.text}
                    maxLength={25}
                    onChange={(e) => updateButton(idx, { text: e.target.value })}
                    placeholder="Button label"
                    aria-label={`Button ${idx + 1} label`}
                  />
                  {btn.type === "URL" ? (
                    <Input
                      value={btn.url ?? ""}
                      onChange={(e) => updateButton(idx, { url: e.target.value })}
                      placeholder="https://mayasanghavi.com"
                      aria-label={`Button ${idx + 1} URL`}
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove button ${idx + 1}`}
                    onClick={() => removeButton(idx)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addButton("QUICK_REPLY")}
                disabled={buttons.length >= 10}
              >
                <Plus className="h-4 w-4" />
                Quick reply
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addButton("URL")}
                disabled={buttons.length >= 10}
              >
                <Plus className="h-4 w-4" />
                URL button
              </Button>
            </div>
          </div>

          </CardContent>
        </Card>

        {/* Live preview fills the right column so the page uses the full width. */}
        <Card className="lg:sticky lg:top-16">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Approximate WhatsApp appearance.</CardDescription>
          </CardHeader>
          <CardContent>
            <TemplatePreview
              headerType={headerType}
              headerText={headerText}
              previewUrl={previewUrl}
              body={body}
              bodyExample={bodyExample}
              footer={footer}
              buttons={buttons}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/templates")}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || uploading}>
          {submitting ? "Submitting..." : "Submit to Meta"}
        </Button>
      </div>
    </form>
  );
}

// Lightweight WhatsApp style preview of the template being built.
function TemplatePreview({
  headerType,
  headerText,
  previewUrl,
  body,
  bodyExample,
  footer,
  buttons,
}: {
  headerType: HeaderType;
  headerText: string;
  previewUrl: string | null;
  body: string;
  bodyExample: string;
  footer: string;
  buttons: TemplateButton[];
}) {
  const renderedBody = body
    ? body.replace(/\{\{\s*\d+\s*\}\}/g, bodyExample.trim() || "Name")
    : "Your message text appears here.";

  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="ml-auto max-w-xs rounded-lg rounded-tr-sm bg-card p-3 shadow-sm">
        {headerType === "IMAGE" ? (
          previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Header preview"
              className="mb-2 h-32 w-full rounded-md object-cover"
              loading="lazy"
            />
          ) : (
            <div className="mb-2 flex h-32 w-full items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
              Image header
            </div>
          )
        ) : null}

        {headerType === "TEXT" && headerText ? (
          <p className="mb-1 font-semibold">{headerText}</p>
        ) : null}

        <p className="whitespace-pre-wrap text-sm">{renderedBody}</p>

        {footer ? (
          <p className="mt-2 text-xs text-muted-foreground">{footer}</p>
        ) : null}
      </div>

      {buttons.length ? (
        <div className="mx-auto mt-2 flex max-w-xs flex-col gap-1">
          {buttons.map((b, i) => (
            <div
              key={i}
              className="rounded-md bg-card py-2 text-center text-sm font-medium text-primary shadow-sm"
            >
              {b.text || (b.type === "URL" ? "Visit" : "Reply")}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
