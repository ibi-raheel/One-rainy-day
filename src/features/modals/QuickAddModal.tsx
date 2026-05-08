import type { ReactNode } from "react";
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
  const sections: QSection[] = [
    {
      title: "Create",
      actions: [
        { icon: <I.Box />,      title: "New order",       sub: "Build a supplier order from forecast", k: "⌘O", click: () => { onClose(); onOrder(); } },
        { icon: <I.Camera />,   title: "Scan receipt",    sub: "OCR a delivery slip & match items",     k: "⌘R", click: () => { onClose(); onScan(); } },
        { icon: <I.Plus />,     title: "Add ingredient",  sub: "New SKU with par level + unit cost",    k: "⌘I" },
        { icon: <I.Sparkles />, title: "New recipe",      sub: "Cost it from your ingredient list",     k: "⌘N" },
      ],
    },
    {
      title: "Plan",
      actions: [
        { icon: <I.Calendar />, title: "Today's prep list", sub: "Print or send to the kitchen iPad", k: "⌘P" },
        { icon: <I.Refresh />,  title: "Re-forecast week",  sub: "Pull fresh weather + sales signals" },
      ],
    },
    {
      title: "Jump to",
      actions: [
        { icon: <I.Dashboard />, title: "Dashboard" },
        { icon: <I.Box />,       title: "Stock" },
        { icon: <I.LineChart />, title: "Market" },
      ],
    },
  ];

  return (
    <Modal
      title="Quick add"
      sub="What do you want to do?"
      onClose={onClose}
      width={560}
    >
      <div className="quick-search">
        <I.Search />
        <input autoFocus placeholder="Type a command, ingredient, or recipe…" />
        <kbd>esc</kbd>
      </div>
      {sections.map((s) => (
        <div key={s.title}>
          <div className="quick-section">{s.title}</div>
          {s.actions.map((a, i) => (
            <div key={i} className="quick-action" onClick={a.click}>
              <div className="qa-icon">{a.icon}</div>
              <div style={{ flex: 1 }}>
                <div className="qa-title">{a.title}</div>
                {a.sub && <div className="qa-sub">{a.sub}</div>}
              </div>
              {a.k && <div className="qa-shortcut">{a.k}</div>}
            </div>
          ))}
        </div>
      ))}
    </Modal>
  );
}
