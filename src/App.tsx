import { useEffect, useRef, useState } from "react";
import { useApp } from "./store/app";
import { api } from "./db/api";
import { I } from "./components/design/Icons";
import { Umbrella } from "./components/design/Umbrella";
import { PageRain } from "./components/design/Rain";
import { TooltipProvider } from "./components/ui/Tooltip";
import { IngredientsTab } from "./features/ingredients/IngredientsTab";
import { RecipesTab } from "./features/recipes/RecipesTab";
import { DashboardTab } from "./features/dashboard/DashboardTab";
import { MarketTab } from "./features/market/MarketTab";
import { StockTab } from "./features/stock/StockTab";
import { SuppliersTab } from "./features/suppliers/SuppliersTab";
import { ScanReceiptModal } from "./features/modals/ScanReceiptModal";
import { ReviewModal } from "./features/modals/ReviewModal";
import { NewOrderModal } from "./features/modals/NewOrderModal";
import { QuickAddModal } from "./features/modals/QuickAddModal";

type ModalKey = "scan" | "review" | "order" | "quick";

declare global {
  interface Window {
    openModal?: (m: ModalKey | null) => void;
    switchTab?: (t: TabKey) => void;
  }
}

type TabKey =
  | "dashboard"
  | "recipes"
  | "ingredients"
  | "stock"
  | "market"
  | "suppliers";

interface NavDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  badgeMuted?: number;
  section?: string;
}

const NAV: NavDef[] = [
  { key: "dashboard",   label: "Dashboard",   icon: <I.Dashboard /> },
  { key: "recipes",     label: "Recipes",     icon: <I.Recipes /> },
  { key: "ingredients", label: "Ingredients", icon: <I.Ingredients /> },
  { key: "stock",       label: "Stock",       icon: <I.Stock /> },
  { key: "market",      label: "Market",      icon: <I.Market /> },
];

const NAV_OPS: NavDef[] = [
  { key: "suppliers",   label: "Suppliers",   icon: <I.Box /> },
];

export default function App() {
  const load = useApp((s) => s.load);
  const loaded = useApp((s) => s.loaded);
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [modal, setModal] = useState<ModalKey | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // Auto-close the mobile drawer when the user taps a nav item or switches tabs
  useEffect(() => { setNavOpen(false); }, [tab]);
  // Close on Escape
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setNavOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  useEffect(() => {
    window.openModal = setModal;
    window.switchTab = setTab;
    return () => { window.openModal = undefined; window.switchTab = undefined; };
  }, []);

  // ⌘K / Ctrl+K opens the Quick add palette (matches the topbar kbd hint)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setModal("quick");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = api.subscribeToChanges(() => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => load(), 400);
    });
    return () => {
      unsubscribe();
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [load]);

  const activeNav = [...NAV, ...NAV_OPS].find((n) => n.key === tab);

  return (
    <TooltipProvider>
      <PageRain count={35} />
      <div className={`app ${navOpen ? "nav-open" : ""}`}>
        <div
          className="nav-scrim"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
        <aside className="sidebar">
          <div className="brand">
            <Umbrella size={36} />
            <div>
              <div className="brand-name">One Rainy Day</div>
              <div className="brand-sub">Cafe ops</div>
            </div>
          </div>

          <div className="nav">
            <div className="nav-section">Workspace</div>
            {NAV.map((n) => (
              <div
                key={n.key}
                className={`nav-item ${tab === n.key ? "active" : ""}`}
                onClick={() => setTab(n.key)}
              >
                <span className="nav-dot" />
                {n.icon}
                <span>{n.label}</span>
                {n.badge != null && <span className="badge">{n.badge}</span>}
                {n.badgeMuted != null && <span className="badge muted">{n.badgeMuted}</span>}
              </div>
            ))}

            <div className="nav-section">Operations</div>
            {NAV_OPS.map((n) => (
              <div
                key={n.key}
                className={`nav-item ${tab === n.key ? "active" : ""}`}
                onClick={() => setTab(n.key)}
              >
                <span className="nav-dot" />
                {n.icon}
                <span>{n.label}</span>
              </div>
            ))}
            <div className="nav-item" style={{ opacity: 0.7, cursor: "default" }}>
              <span className="nav-dot" />
              <I.Sparkles />
              <span>AI assistant</span>
              <span className="badge muted">soon</span>
            </div>
          </div>

          <div className="sidebar-foot">
            <div className="user-chip">
              <div className="avatar">HK</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)" }}>Huda K.</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Owner · Edgewater</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <button
              className="nav-toggle"
              onClick={() => setNavOpen((v) => !v)}
              aria-label={navOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={navOpen}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="crumbs">
              Workspace / <strong>{activeNav?.label ?? "Dashboard"}</strong>
            </div>
            <div
              className="search"
              role="button"
              tabIndex={0}
              onClick={() => setModal("quick")}
              onKeyDown={(e) => { if (e.key === "Enter") setModal("quick"); }}
              style={{ cursor: "pointer" }}
            >
              <I.Search />
              <input
                placeholder="Search recipes, ingredients, suppliers…"
                onFocus={() => setModal("quick")}
                readOnly
                style={{ cursor: "pointer" }}
              />
              <kbd>⌘K</kbd>
            </div>
            <button className="btn primary" onClick={() => setModal("quick")}>
              <I.Plus /> Quick add
            </button>
          </div>

          <div className="page">
            {!loaded ? (
              <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div>
            ) : tab === "dashboard" ? (
              <DashboardTab />
            ) : tab === "recipes" ? (
              <RecipesTab />
            ) : tab === "ingredients" ? (
              <IngredientsTab />
            ) : tab === "stock" ? (
              <StockTab />
            ) : tab === "market" ? (
              <MarketTab />
            ) : (
              <SuppliersTab />
            )}
          </div>
        </main>
      </div>

      {modal === "scan" && (
        <ScanReceiptModal
          onClose={() => setModal(null)}
          onReview={() => setModal("review")}
        />
      )}
      {modal === "review" && <ReviewModal onClose={() => setModal(null)} />}
      {modal === "order" && <NewOrderModal onClose={() => setModal(null)} />}
      {modal === "quick" && (
        <QuickAddModal
          onClose={() => setModal(null)}
          onScan={() => setModal("scan")}
          onOrder={() => setModal("order")}
        />
      )}
    </TooltipProvider>
  );
}

function ComingSoon({ name }: { name: string }) {
  return (
    <div className="view">
      <div className="page-head fade-up">
        <div className="head-row">
          <div style={{ flex: 1 }}>
            <h1>{name}</h1>
            <p className="subtle">Designed and ready — wiring up next.</p>
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Building this view now.
      </div>
    </div>
  );
}
