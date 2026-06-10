import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Info, Plus, RotateCw } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { usePaymentUser } from "@/hooks/usePaymentUser";
import { isValidSite, readStoredSite, siteLabel, storeSite, normalizeSiteUrl } from "@/utils/navigation";

export function WebsitesSection() {
  const { walletAddress } = useSession();
  const { user } = usePaymentUser();
  const site =
    (user?.product_site && isValidSite(user.product_site)
      ? normalizeSiteUrl(user.product_site)
      : null) ?? readStoredSite(walletAddress);
  const company = siteLabel(site ?? undefined);
  const [changeUrl, setChangeUrl] = useState("");

  const applySite = (raw: string) => {
    const next = normalizeSiteUrl(raw);
    if (!isValidSite(next) || !walletAddress) return;
    storeSite(next, walletAddress);
    window.location.reload();
  };

  return (
    <div className="space-y-8">
      <header className="mc-settings-page-header">
        <h2 className="font-display text-2xl font-bold">Websites</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a website to manage its settings and URL.
        </p>
      </header>

      <button
        type="button"
        className="mc-add-website-btn flex h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-border text-sm font-medium transition hover:border-primary hover:text-primary"
        onClick={() => {
          const url = prompt("Enter your product URL (e.g. algointent.xyz)");
          if (url) applySite(url);
        }}
      >
        <Plus className="h-4 w-4" />
        Add New Website
        <span className="ml-1 text-muted-foreground" title="One primary website per workspace">
          <Info className="inline h-3.5 w-3.5" />
        </span>
      </button>

      <div className="mc-website-card rounded-[10px] border border-border p-4 transition hover:border-primary">
        <div className="flex items-center gap-3">
          <div className="mc-company-avatar flex h-10 w-10 items-center justify-center rounded-xl font-display text-sm font-bold text-white">
            {company[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display font-semibold">{company}</span>
              <span className="rounded-lg border border-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Primary
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{site}</p>
          </div>
          <Check className="h-5 w-5 shrink-0 text-primary" />
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="font-display text-base font-bold">Tracked sub-pages</h3>
          <p className="text-[13px] text-muted-foreground">
            Pages from your sitemap tracked for SEO auditing.
          </p>
        </div>
        <div className="mc-alert border-l-[3px] border-primary bg-primary/5 py-3 pl-4 pr-4 text-[13px] text-muted-foreground">
          Upgrade to track sub-pages for deeper SEO insights →{" "}
          <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" disabled>
            Upgrade plan
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="font-display text-base font-bold">Change Website URL</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Changing your URL will reset crawled data for this site. Your company profile is kept per site.
          </p>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">New product URL</span>
          <div className="relative">
            <input
              className="field-input h-11 w-full rounded-lg pr-12"
              placeholder="example.com"
              value={changeUrl}
              onChange={(e) => setChangeUrl(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-primary"
              onClick={() => changeUrl.trim() && applySite(changeUrl)}
              title="Apply URL"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
        </label>
        <p className="text-xs text-muted-foreground">
          Current: <span className="font-mono">{site}</span> ·{" "}
          <Link to="/dashboard" search={{ url: undefined }} className="font-medium text-foreground underline-offset-2 hover:underline">
            Open dashboard
          </Link>
        </p>
      </section>
    </div>
  );
}
