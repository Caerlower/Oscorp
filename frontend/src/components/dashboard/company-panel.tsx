import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useDashboardDetail } from "@/components/dashboard/detail-context";
import { useTheme } from "@/context/ThemeContext";
import {
  AtSign,
  Check,
  ChevronRight,
  Folder,
  Info,
  Linkedin,
  Pencil,
  Plus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAnalysis } from "@/context/AnalysisContext";
import { useCompanyProfile } from "@/context/CompanyProfileContext";
import {
  competitorHost,
  normalizeLinkedInUrl,
  normalizeTwitterHandle,
  type CompanyProfile,
} from "@/utils/company-profile";
import {
  companyPanelTitle,
  competitorsSectionLabel,
  documentsSectionLabel,
} from "@/constants/oscorp-theme";
import {
  COMPANY_MINIMIZED_KEY,
  COMPANY_RAIL_WIDTH_PX,
  CompanyCollapseIcon,
  DocRow,
  Panel,
  PanelSkeleton,
  Section,
} from "@/components/dashboard/shared";

function competitorUrl(raw: string): string {
  const trimmed = raw.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return trimmed ? `https://${trimmed}` : "#";
}

type CompanyPanelEditorProps = {
  profile: CompanyProfile;
  displayTags: string[];
  isOscorp: boolean;
  onSave: (profile: CompanyProfile) => void;
  onCancel: () => void;
};

function CompanyPanelEditor({
  profile,
  displayTags,
  isOscorp,
  onSave,
  onCancel,
}: CompanyPanelEditorProps) {
  const [draft, setDraft] = useState<CompanyProfile>({ ...profile });
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (draft.tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    setDraft((p) => ({ ...p, tags: [...p.tags, t] }));
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setDraft((p) => ({ ...p, tags: p.tags.filter((t) => t !== tag) }));
  };

  const handleSave = () => {
    onSave({
      ...draft,
      twitterHandle: normalizeTwitterHandle(draft.twitterHandle),
      linkedInUrl: normalizeLinkedInUrl(draft.linkedInUrl),
      competitors: draft.competitors.map(competitorHost).filter(Boolean),
    });
  };

  const manualTags = [
    ...draft.tags,
    ...(draft.teamSize.trim() ? [`Team: ${draft.teamSize.trim()}`] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {manualTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
          >
            {tag.startsWith("Team:") ? <Users className="h-3 w-3 shrink-0 opacity-70" /> : null}
            {tag}
            <button
              type="button"
              onClick={() => (tag.startsWith("Team:") ? setDraft((p) => ({ ...p, teamSize: "" })) : removeTag(tag))}
              className="rounded-full p-0.5 hover:bg-muted"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {displayTags
          .filter((t) => !manualTags.some((m) => m.toLowerCase() === t.toLowerCase()))
          .map((tag) => (
            <span
              key={`auto-${tag}`}
              className="inline-flex items-center rounded-full border border-dashed border-border/80 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
              title="From site analysis"
            >
              {tag}
            </span>
          ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="Add tag…"
          className="field-input min-w-[7rem] flex-1 text-xs"
        />
        <button type="button" onClick={addTag} className="btn-secondary px-2.5 py-1.5 text-xs">
          <Plus className="h-3 w-3" /> Tag
        </button>
        <input
          value={draft.teamSize}
          onChange={(e) => setDraft((p) => ({ ...p, teamSize: e.target.value }))}
          placeholder="Team size"
          className="field-input w-24 text-xs"
        />
      </div>

      <div className="space-y-2">
        <div className="relative">
          <AtSign className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={draft.twitterHandle}
            onChange={(e) => setDraft((p) => ({ ...p, twitterHandle: e.target.value }))}
            placeholder="founder or company handle"
            className="field-input w-full pl-9 text-sm"
          />
        </div>
        <div className="relative">
          <Linkedin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={draft.linkedInUrl}
            onChange={(e) => setDraft((p) => ({ ...p, linkedInUrl: e.target.value }))}
            placeholder="profile or company URL"
            className="field-input w-full pl-9 text-sm"
          />
        </div>
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          Checks your last 10 public posts weekly to match your writing style.
        </p>
      </div>

      <textarea
        value={draft.description}
        onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
        className="field-input min-h-[120px] resize-y text-sm leading-relaxed"
        placeholder="Company description for AI agents…"
      />

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 text-sm">
          Cancel
        </button>
        <button type="button" onClick={handleSave} className="btn-primary flex-1 text-sm">
          <Check className="h-4 w-4" /> Save
        </button>
      </div>
    </div>
  );
}

export function CompanyPanel({
  company,
  site,
  minimized,
  onMinimizedChange,
  embedded = false,
  onClose: _onClose,
}: {
  company: string;
  site: string;
  minimized: boolean;
  onMinimizedChange: (minimized: boolean) => void;
  embedded?: boolean;
  onClose?: () => void;
}) {
  const { theme, isOscorp } = useTheme();
  const { data: analysis, status: analysisStatus } = useAnalysis();
  const { profile, displayTags, twitterHandle, saveProfile } = useCompanyProfile();
  const [editing, setEditing] = useState(false);
  const [editingCompetitors, setEditingCompetitors] = useState(false);
  const [focusSection, setFocusSection] = useState<"brand" | "docs" | "comps" | null>(null);
  const [competitorsEditList, setCompetitorsEditList] = useState<string[]>(profile.competitors);

  const displayCompany = analysis?.company?.name ?? company;
  const loading = analysisStatus === "loading" && !analysis;
  const twitter = twitterHandle;
  const linkedIn = normalizeLinkedInUrl(profile.linkedInUrl);

  useEffect(() => {
    setCompetitorsEditList([...profile.competitors]);
  }, [profile.competitors]);

  useEffect(() => {
    if (!minimized && focusSection === "comps") {
      setEditingCompetitors(true);
      setCompetitorsEditList([...profile.competitors]);
      setFocusSection(null);
    }
  }, [minimized, focusSection, profile.competitors]);

  const saveCompetitors = () => {
    const next = competitorsEditList.map((d) => competitorHost(d)).filter(Boolean);
    saveProfile({ ...profile, competitors: next.length > 0 ? next : profile.competitors });
    setEditingCompetitors(false);
    toast.success("Competitors updated");
  };

  const cancelCompetitors = () => {
    setCompetitorsEditList([...profile.competitors]);
    setEditingCompetitors(false);
  };

  const removeCompetitor = (index: number) => {
    setCompetitorsEditList((list) => list.filter((_, i) => i !== index));
  };

  const addCompetitor = () => {
    const raw = window.prompt("Competitor domain (e.g. example.com)");
    if (!raw) return;
    const host = competitorHost(raw);
    if (!host) return;
    if (competitorsEditList.includes(host)) {
      toast.error("Already in list");
      return;
    }
    setCompetitorsEditList((list) => [...list, host]);
  };

  const expand = (section?: "brand" | "docs" | "comps") => {
    if (section) setFocusSection(section);
    onMinimizedChange(false);
  };

  if (!embedded && minimized) {
    return (
      <CompanyRail
        company={company}
        onExpand={expand}
        isOscorp={isOscorp}
      />
    );
  }

  const panelContent = (
    <div className={`space-y-6 ${embedded ? "mc-company-drawer-body space-y-6 p-4" : "space-y-4 p-4"}`}>
        {loading ? (
          <PanelSkeleton rows={8} />
        ) : (
          <>
        <div className={`flex items-start justify-between gap-2 ${embedded ? "mc-company-drawer-header" : ""}`}>
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex shrink-0 items-center justify-center font-bold text-white ${
                embedded
                  ? "mc-company-avatar h-14 w-14 rounded-xl font-display text-2xl"
                  : `rounded-xl text-sm ${isOscorp ? "oscorp-company-avatar h-9 w-9" : "h-9 w-9 bg-gradient-to-br from-indigo-500 to-purple-600"}`
              }`}
            >
              {displayCompany[0]}
            </div>
            <span className={`truncate ${embedded ? "font-display text-xl font-bold" : "font-semibold"}`}>
              {displayCompany}
            </span>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Edit company"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {editing ? (
          <CompanyPanelEditor
            profile={profile}
            displayTags={displayTags}
            isOscorp={isOscorp}
            onSave={(next) => {
              saveProfile(next);
              setEditing(false);
              toast.success("Company profile saved");
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {displayTags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1 text-xs ${
                    embedded
                      ? "mc-company-tag rounded-[20px] border border-border bg-card px-3 py-1 text-muted-foreground"
                      : "rounded-full border border-border/80 bg-muted/30 px-2.5 py-1 font-medium text-foreground/90"
                  }`}
                >
                  {tag.startsWith("Team:") ? <Users className="h-3 w-3 shrink-0 opacity-70" /> : null}
                  {tag}
                </span>
              ))}
              {twitter ? (
                <a
                  href={`https://x.com/${twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 text-xs transition ${
                    embedded
                      ? "mc-company-tag rounded-[20px] border border-border bg-card px-3 py-1 text-muted-foreground hover:text-foreground"
                      : "rounded-full border border-border/80 bg-muted/30 px-2.5 py-1 font-medium text-foreground/90 hover:bg-muted/60"
                  }`}
                >
                  <AtSign className="h-3 w-3 shrink-0 opacity-80" />
                  {twitter}
                </a>
              ) : null}
              {linkedIn ? (
                <a
                  href={linkedIn}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 text-xs transition ${
                    embedded
                      ? "mc-company-tag rounded-[20px] border border-border bg-card px-3 py-1 text-muted-foreground hover:text-foreground"
                      : "rounded-full border border-border/80 bg-muted/30 px-2.5 py-1 font-medium text-foreground/90 hover:bg-muted/60"
                  }`}
                >
                  <Linkedin className="h-3 w-3 shrink-0 opacity-80" />
                  LinkedIn
                </a>
              ) : null}
            </div>

            {embedded ? (
              <div className="mc-company-section space-y-3">
                <div className="mc-section-label">AI Summary</div>
                <blockquote className="mc-ai-summary-quote border-l-[3px] border-primary bg-primary/5 py-3 pl-4 pr-4 text-[13px] italic leading-relaxed text-muted-foreground rounded-r-lg">
                  {profile.description}
                </blockquote>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">{profile.description}</p>
            )}
          </>
        )}

        <div className={embedded ? "mc-company-section" : ""}>
          <div className={`${embedded ? "mc-section-label mb-3" : `mb-2 ${isOscorp ? "oscorp-section-label" : "text-[11px] uppercase tracking-wider text-muted-foreground"}`}`}>
            {embedded ? "Documents" : documentsSectionLabel(theme)}
          </div>
          <div className={embedded ? "" : "space-y-0.5"}>
            {[
              { name: "Product Information", detailId: "doc:product-information" },
              { name: "Competitor Analysis", detailId: "doc:competitor-analysis" },
              { name: "Brand Voice", detailId: "doc:brand-voice" },
              { name: "Marketing Strategy", detailId: "doc:marketing-strategy" },
              { name: "llms.txt", detailId: "doc:llms-txt" },
              { name: "Articles", detailId: "doc:articles", dot: true },
            ].map((d) => (
              <DocRow key={d.name} {...d} embedded={embedded} />
            ))}
          </div>
        </div>

        <CompetitorsSection
          competitors={profile.competitors}
          editing={editingCompetitors}
          editList={competitorsEditList}
          embedded={embedded}
          sectionLabel={embedded ? "Competitor Intel" : competitorsSectionLabel(theme)}
          hint={
            analysis?.competitorsStatus === "rate_limited" || analysis?.aiAnalysis?.status === "rate_limited"
              ? "Competitor research is waiting on Groq API quota. Refresh analysis after quota resets."
              : profile.competitors.length === 0 && analysisStatus === "live"
                ? "No market competitors yet — refresh analysis to populate."
                : undefined
          }
          isOscorp={isOscorp}
          onStartEdit={() => {
            setCompetitorsEditList([...profile.competitors]);
            setEditingCompetitors(true);
          }}
          onSave={saveCompetitors}
          onCancel={cancelCompetitors}
          onRemove={removeCompetitor}
          onAdd={addCompetitor}
        />
          </>
        )}
    </div>
  );

  if (embedded) {
    return <div className="h-full min-h-0 overflow-y-auto">{panelContent}</div>;
  }

  return (
    <Panel
      panelId="RS-01"
      title={
        <>
          <Folder className="h-4 w-4" /> {companyPanelTitle(theme)}
        </>
      }
      action={
        <button
          type="button"
          onClick={() => onMinimizedChange(true)}
          className="rounded p-1 hover:bg-muted"
          aria-label="Minimize company panel"
        >
          <CompanyCollapseIcon expanded />
        </button>
      }
    >
      {panelContent}
    </Panel>
  );
}

function CompanyRail({
  company,
  onExpand,
  isOscorp,
}: {
  company: string;
  onExpand: (section?: "brand" | "docs" | "comps") => void;
  isOscorp: boolean;
}) {
  return (
    <div className={`flex h-full w-full flex-col items-center rounded-2xl border py-3 ${isOscorp ? "oscorp-company-rail" : "border-border bg-card"}`}>
      <button
        type="button"
        onClick={() => onExpand()}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        aria-label="Expand company panel"
      >
        <CompanyCollapseIcon expanded={false} />
      </button>

      <div
        className={`mt-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[9px] font-semibold leading-tight ${isOscorp ? "oscorp-company-avatar text-white" : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"}`}
        title={company}
      >
        {company.slice(0, 2)}
      </div>

      <div className="my-3 h-px w-6 bg-border" />

      <nav className="flex flex-col items-center gap-4">
        <RailNavItem icon={Info} label="Brand" onClick={() => onExpand("brand")} />
        <RailNavItem icon={Folder} label="Docs" onClick={() => onExpand("docs")} />
        <RailNavItem icon={Users} label="Comps" onClick={() => onExpand("comps")} />
      </nav>
    </div>
  );
}

function RailNavItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Info;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground transition hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function CompetitorsSection({
  competitors,
  editing,
  editList,
  sectionLabel,
  hint,
  isOscorp,
  embedded,
  onStartEdit,
  onSave,
  onCancel,
  onRemove,
  onAdd,
}: {
  competitors: string[];
  editing: boolean;
  editList: string[];
  sectionLabel: string;
  hint?: string;
  isOscorp: boolean;
  embedded?: boolean;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className={`border-t border-border pt-3 ${embedded ? "mc-company-section" : ""}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={embedded ? "mc-section-label" : isOscorp ? "oscorp-section-label" : "text-[11px] font-medium uppercase tracking-wider text-muted-foreground"}>
          {sectionLabel}
        </span>
        {editing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center gap-1 rounded-lg bg-foreground px-2.5 py-1 text-xs font-medium text-background"
            >
              <Check className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onStartEdit}
            className="rounded p-1 hover:bg-muted"
            aria-label="Edit competitors"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {editList.map((domain, index) => (
            <div key={`${domain}-${index}`} className="flex min-w-0 items-center gap-1.5 py-0.5">
              <img
                src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
                alt=""
                width={14}
                height={14}
                className="shrink-0 rounded-sm"
              />
              <span className="min-w-0 flex-1 truncate text-xs">{domain}</span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${domain}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={onAdd}
            className="flex min-h-[36px] items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/20 text-xs text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      ) : competitors.length === 0 ? (
        <p className="text-xs italic leading-relaxed text-muted-foreground">
          {hint ?? "No competitors added yet."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {competitors.map((domain) => (
            <a
              key={domain}
              href={competitorUrl(domain)}
              target="_blank"
              rel="noreferrer"
              className="mc-competitor-card flex min-w-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-foreground/80 transition hover:border-primary"
            >
              <img
                src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 shrink-0 rounded-sm"
              />
              <span className="truncate">{domain}</span>
            </a>
          ))}
        </div>
      )}
      {competitors.length > 0 && hint ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
