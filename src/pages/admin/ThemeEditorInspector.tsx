import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import type { ThemeSettingField } from "@/new-storefront/theme-engine/types";

interface ThemeEditorInspectorProps {
  sectionLabel: string;
  fields: ThemeSettingField[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
  onClose: () => void;
}

export function ThemeEditorInspector({
  sectionLabel,
  fields,
  values,
  onChange,
  onClose,
}: ThemeEditorInspectorProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="truncate text-sm font-medium text-foreground">
          {sectionLabel}
        </span>
        <button
          onClick={onClose}
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {fields.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No settings for this section.
          </p>
        ) : (
          fields.map((field) => (
            <SettingField
              key={field.id}
              field={field}
              value={values[field.id] ?? field.defaultValue}
              onChange={(v) => onChange(field.id, v)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function SettingField({
  field,
  value,
  onChange,
}: {
  field: ThemeSettingField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-normal leading-snug text-foreground">
          {field.label}
        </Label>
        <Switch checked={Boolean(value)} onCheckedChange={onChange} />
      </div>
    );
  }

  if (field.type === "select") {
    const strVal = String(value ?? field.defaultValue ?? "");
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{field.label}</Label>
        <Select value={strVal} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{field.label}</Label>
        <Textarea
          value={String(value ?? field.defaultValue ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[72px] resize-y text-sm"
          placeholder={field.placeholder}
        />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{field.label}</Label>
        <Input
          type="number"
          value={Number(value ?? field.defaultValue ?? 0)}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 text-sm"
        />
      </div>
    );
  }

  if (field.type === "color") {
    const strVal = String(value ?? field.defaultValue ?? "#000000");
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{field.label}</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
          />
          <Input
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 flex-1 font-mono text-sm"
            placeholder="#000000"
          />
        </div>
      </div>
    );
  }

  // text | image | product-reference | collection-reference
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{field.label}</Label>
      <Input
        value={String(value ?? field.defaultValue ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm"
        placeholder={field.placeholder}
      />
    </div>
  );
}
