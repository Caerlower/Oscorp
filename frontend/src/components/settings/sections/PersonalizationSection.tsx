import { useState } from "react";
import { toast } from "sonner";

export function PersonalizationSection() {
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");

  const save = () => {
    toast.message("Personalization", {
      description: "Display preferences will sync with your profile in a future update.",
    });
  };

  return (
    <div className="space-y-8">
      <header className="mc-settings-page-header">
        <h2 className="font-display text-2xl font-bold">Personalization</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tune how your AI CMO writes and responds in chat.
        </p>
      </header>

      <div className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Display Name</span>
          <input
            className="field-input h-11 w-full rounded-lg"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Company handle</span>
          <input
            className="field-input h-11 w-full rounded-lg"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@company"
          />
        </label>
        <button type="button" onClick={save} className="mc-btn-primary px-4 py-2 text-sm font-medium">
          Save
        </button>
      </div>
    </div>
  );
}
