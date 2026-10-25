import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DeliverableRow } from "@/lib/proposal-pdf";

export function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function Area({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

export function DeliverablesEditor({
  rows,
  onChange,
  withQty,
}: {
  rows: DeliverableRow[];
  onChange: (rows: DeliverableRow[]) => void;
  withQty: boolean;
}) {
  const update = (index: number, patch: Partial<DeliverableRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="flex gap-2">
          <Input
            placeholder="Entregável"
            value={row.name}
            onChange={(e) => update(index, { name: e.target.value })}
          />
          {withQty && (
            <Input
              className="w-24"
              placeholder="Qtd."
              value={row.qty}
              onChange={(e) => update(index, { qty: e.target.value })}
            />
          )}
          <Input
            placeholder={withQty ? "Critério de conclusão" : "Descrição / quantidade"}
            value={row.criteria}
            onChange={(e) => update(index, { criteria: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remover"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, { name: "", qty: "", criteria: "" }])}
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar
      </Button>
    </div>
  );
}
