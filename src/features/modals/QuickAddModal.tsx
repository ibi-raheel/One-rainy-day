import { useMemo, useState, type ReactNode } from "react";
import { Modal } from "@/components/design/Modal";
import { I } from "@/components/design/Icons";

interface Props {
  onClose: () => void;
  onScan: () => void;
  onOrder: () => void;
}

interface QAction {
  icon: ReactNode;
  title: string;
  sub?: string;
  k?: string;
  click?: () => void;
}

interface QSection { title: string; actions: QAction[] }

export function QuickAddModal({ onClose, onScan, onOrder }: Props) {
  const [query, setQuery] = useState("");

  const goto = (tab: "dashboard" | "recipes" | "ingredients" | "stock" | "market" | "suppliers") => {
    onClose();
    window.switchTab?.(tab);
  };

  const sections: QSection[] = [
    {
      title: "Create",
      actions: [
        {
          icon: <I.Box />,
          title: "New order",
          sub: "Build a supplier order from forecast",
          k: "⌘O",
          click: () => { onClose(); onOrder(); },
        },
        {
          icon: <I.Camera />,
          title: "Scan receipt",
          sub: "OCR a delivery slip & match items",
          k: "⌘R",
          click: () => { onClose(); onScan(); },
        },
        {
          icon: <I.Plus />,
          title: "Add ingredient",
          sub: "New SKU with par level + unit cost",
          k: "⌘I",
          click: () => goto("ingredients"),
        },
        {
          icon: <I.Sparkles />,
          title: "New recipe",
          sub: "Cost it from your ingredient list",
          k: "⌘N",
          click: () => goto("recipes"),
        },
      ],
    },
    {
      title: "Plan",
      actions: [
        {
          icon: <I.Calendar />,
          title: "Today's prep list",
          sub: "Open the dashboard prep panel",
          click: () => goto("dashboard"),
        },
        {
          icon: <I.Refresh />,
          title: "Refresh market data",
          sub: "Pull fresh prices from public Shopify wholesalers",
          click: () => goto("market"),
        },
      ],
    },
    {
      title: "Jump to",
      actions: [
        { icon: <I.Dashboard />,   title: "Dashboard",    click: () => goto("dashboard") },
        { icon: <I.Recipes />,     title: "Recipes",      click: () => goto("recipes") },
        { icon: <I.Ingredients />, title: "Ingredients",  click: () => goto("ingredients") },
        { icon: <I.Stock />,       title: "Stock",        click: () => goto("stock") },
        { icon: <I.LineChart />,   title: "Market",       click: () => goto("market") },
        { icon: <I.Box />,         title: "Suppliers",    click: () => goto("suppliers") },
      ],
    },
  ];

  // Fuzzy filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        actions: s.actions.filter(
          (a) =>
            a.title.toLowerCase().includes(q) ||
            (a.sub ?? "").toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.actions.length > 0);
  }, [query, sections]);

  return (
    <Modal title="Quick add" sub="What do you want to do?" onClose={onClose} width={560}>
      <div className="quick-search">
        <I.Search />
        <input
          autoFocus
          placeholder="Type a command, ingredient, or recipe…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter") {
              const first = filtered[0]?.actions[0];
              if (first?.click) first.click();
            }
          }}
        />
        <kbd>esc</kbd>
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: 22, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          No matches.
        </div>
      ) : (
        filtered.map((s) => (
          <div key={s.title}>
            <div className="quick-section">{s.title}</div>
            {s.actions.map((a, i) => (
              <div
                key={`${s.title}-${i}`}
                className="quick-action"
                onClick={a.click}
                style={a.click ? undefined : { opacity: 0.6 }}
              >
                <div className="qa-icon">{a.icon}</div>
                <div style={{ flex: 1 }}>
                  <div className="qa-title">{a.title}</div>
                  {a.sub && <div className="qa-sub">{a.sub}</div>}
                </div>
                {a.k && <div className="qa-shortcut">{a.k}</div>}
              </div>
            ))}
          </div>
        ))
      )}
    </Modal>
  );
}
