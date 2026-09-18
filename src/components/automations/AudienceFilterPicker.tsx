import { useMemo } from "react";
import { useCRM, type Contact } from "@/lib/crm-data";

const ALL = "__all__";
const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export interface AudienceFilters {
  source: string;
  tag: string;
  mainPain: string;
  wantsFeedback: string;
}

export const emptyAudienceFilters: AudienceFilters = {
  source: ALL,
  tag: ALL,
  mainPain: ALL,
  wantsFeedback: ALL,
};

export function matchesAudienceFilters(contact: Contact, filters: AudienceFilters) {
  return (
    (filters.source === ALL || contact.source === filters.source) &&
    (filters.tag === ALL || contact.tags.includes(filters.tag)) &&
    (filters.mainPain === ALL || contact.mainPain === filters.mainPain) &&
    (filters.wantsFeedback === ALL || contact.wantsFeedback === filters.wantsFeedback)
  );
}

export function audienceFiltersToJson(filters: AudienceFilters): Record<string, string> {
  const json: Record<string, string> = {};
  if (filters.source !== ALL) json["source"] = filters.source;
  if (filters.tag !== ALL) json["tag"] = filters.tag;
  if (filters.mainPain !== ALL) json["main_pain"] = filters.mainPain;
  if (filters.wantsFeedback !== ALL) json["wants_feedback"] = filters.wantsFeedback;
  return json;
}

export function audienceFiltersFromJson(
  json: Record<string, unknown> | null | undefined,
): AudienceFilters {
  return {
    source: (json?.["source"] as string) || ALL,
    tag: (json?.["tag"] as string) || ALL,
    mainPain: (json?.["main_pain"] as string) || ALL,
    wantsFeedback: (json?.["wants_feedback"] as string) || ALL,
  };
}

export function AudienceFilterPicker({
  value,
  onChange,
}: {
  value: AudienceFilters;
  onChange: (next: AudienceFilters) => void;
}) {
  const { contacts } = useCRM();
  const origins = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.source).filter(Boolean))).sort(),
    [contacts],
  );
  const tags = useMemo(
    () => Array.from(new Set(contacts.flatMap((c) => c.tags))).sort(),
    [contacts],
  );
  const mainPains = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.mainPain).filter(Boolean))).sort(),
    [contacts],
  );
  const feedbackOptions = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.wantsFeedback).filter(Boolean))).sort(),
    [contacts],
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <select
        className={fieldClass}
        value={value.source}
        onChange={(e) => onChange({ ...value, source: e.target.value })}
        aria-label="Filtro por origem"
      >
        <option value={ALL}>Todas as origens</option>
        {origins.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <select
        className={fieldClass}
        value={value.tag}
        onChange={(e) => onChange({ ...value, tag: e.target.value })}
        aria-label="Filtro por tag"
      >
        <option value={ALL}>Todas as tags</option>
        {tags.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        className={fieldClass}
        value={value.mainPain}
        onChange={(e) => onChange({ ...value, mainPain: e.target.value })}
        aria-label="Filtro por maior dor"
      >
        <option value={ALL}>Todas as dores</option>
        {mainPains.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select
        className={fieldClass}
        value={value.wantsFeedback}
        onChange={(e) => onChange({ ...value, wantsFeedback: e.target.value })}
        aria-label="Filtro por interesse em devolutiva"
      >
        <option value={ALL}>Todas as devolutivas</option>
        {feedbackOptions.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
    </div>
  );
}
