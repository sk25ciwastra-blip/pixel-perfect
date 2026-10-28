import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { rpc, useTable } from "@/lib/data-live";

type ReceiptBlock = { key: string; required: boolean; visible: boolean };
const requiredKeys = new Set([
  "header",
  "transaction_details",
  "current_payment",
  "totals",
  "footer",
]);
const defaultBlocks: ReceiptBlock[] = [
  { key: "header", required: true, visible: true },
  { key: "transaction_details", required: true, visible: true },
  { key: "description", required: true, visible: true },
  { key: "payment_history", required: false, visible: true },
  { key: "current_payment", required: true, visible: true },
  { key: "totals", required: true, visible: true },
  { key: "footer", required: true, visible: true },
];
const labels: Record<string, string> = {
  header: "Header",
  transaction_details: "Transaction Details",
  description: "Description",
  payment_history: "Payment History",
  current_payment: "Current Payment",
  totals: "Totals",
  footer: "Footer",
};

export function ReceiptTemplateEditor() {
  const templates = useTable("receipt_template_versions", true);
  const [kind, setKind] = useState<"BOOKING" | "WALK_IN">("BOOKING");
  const [preset, setPreset] = useState("STANDARD");
  const [title, setTitle] = useState("Baturaden 25 Homestay");
  const [footer, setFooter] = useState("Thank you for booking");
  const [blocks, setBlocks] = useState(defaultBlocks);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [draftId, setDraftId] = useState("");
  const active = useMemo(
    () => templates.rows.find((row) => row.template_kind === kind && row.status === "ACTIVE"),
    [kind, templates.rows],
  );

  function toggleBlock(key: string) {
    setBlocks((current) =>
      current.map((block) =>
        block.key === key && !requiredKeys.has(key) ? { ...block, visible: !block.visible } : block,
      ),
    );
  }
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const saved = await rpc("save_receipt_template_version", {
        _template_kind: kind,
        _preset: preset,
        _blocks: blocks,
        _header_config: {
          title,
          address: "Jl. Baturaden Raya No. 25, Ciwastra",
          city: "Bandung City",
          whatsapp: "0811669505",
        },
        _footer_config: { thank_you: footer },
      });
      if (saved.error) throw new Error(saved.error.message);
      setDraftId(saved.data as string);
      await templates.refresh();
      setMessage("Draft template saved. Preview before activation.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Template save failed");
    } finally {
      setBusy(false);
    }
  }
  async function activate() {
    const targetId = draftId || active?.id;
    if (!targetId) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await rpc("activate_receipt_template_version", { _template_id: targetId });
      if (result.error) throw new Error(result.error.message);
      await templates.refresh();
      setMessage("Template activated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Template activation failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-lembut">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Receipt templates
          </p>
          <h2 className="mt-1 text-lg font-bold">Thermal 58 mm</h2>
        </div>
        <span className="text-xs text-muted-foreground">Owner-only versioned blocks</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Template
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as "BOOKING" | "WALK_IN")}
            className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3"
          >
            <option value="BOOKING">Booking</option>
            <option value="WALK_IN">Walk-in / Direct Check-in</option>
          </select>
        </label>
        <label className="text-sm">
          Preset
          <select
            value={preset}
            onChange={(event) => setPreset(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3"
          >
            <option>COMPACT</option>
            <option>STANDARD</option>
            <option>DETAILED</option>
            <option>PREMIUM_MINIMAL</option>
          </select>
        </label>
        <label className="text-sm">
          Header title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3"
          />
        </label>
        <label className="text-sm">
          Footer text
          <input
            value={footer}
            onChange={(event) => setFooter(event.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3"
          />
        </label>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {blocks.map((block) => (
          <label key={block.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.visible}
              disabled={block.required}
              onChange={() => toggleBlock(block.key)}
            />
            <span>
              {labels[block.key] ?? block.key}
              {block.required ? " (required)" : ""}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => void save()}>
          Save Draft Version
        </Button>
        <Button
          type="button"
          disabled={busy || !(draftId || active)}
          onClick={() => void activate()}
        >
          Activate Current
        </Button>
      </div>
      {message && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </section>
  );
}
