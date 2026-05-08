import { useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { computeDemand, computeRecipeCost } from "@/lib/cost";
import { I } from "@/components/design/Icons";
import { Spark } from "@/components/design/Spark";
import { CountUp } from "@/components/design/CountUp";
import { Rainfield } from "@/components/design/Rain";

type SortKey = "name" | "cost" | "price" | "margin" | "vol";

interface PrepRow {
  id: number;
  name: string;
  yield: string;
  forItems: string[];
  status: "pending" | "in_progress" | "done";
  minutes: number;
}

interface AlertRow {
  kind: "stock" | "market";
  level: "critical" | "warn" | "good";
  title: string;
  body: string;
  cta: string;
}

const TODAY = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const DEFAULT_PREP: PrepRow[] = [
  { id: 1, name: "Vanilla syrup batch", yield: "1.2 L", forItems: ["Vanilla latte", "Iced vanilla cold brew"], status: "pending", minutes: 18 },
  { id: 2, name: "Egg-and-cheese filling", yield: "24 sandwiches", forItems: ["Breakfast sando"], status: "in_progress", minutes: 12 },
  { id: 3, name: "Chai concentrate", yield: "800 ml", forItems: ["Dirty chai", "Iced chai"], status: "done", minutes: 14 },
  { id: 4, name: "Turkey-ham slice prep", yield: "32 portions", forItems: ["Turkey sando"], status: "pending", minutes: 9 },
];

export function DashboardTab() {
  const ingredients = useApp((s) => s.ingredients);
  const recipes = useApp((s) => s.recipes);
  const ingredientsById = useApp((s) => s.ingredientsById);
  const recipesById = useApp((s) => s.recipesById);

  const [doneIds, setDoneIds] = useState<Set<number>>(() => new Set([3]));
  const [sortKey, setSortKey] = useState<SortKey>("margin");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Menu items as Dashboard rows
  const menuRows = useMemo(() => {
    const menu = recipes.filter((r) => r.type === "menu_item");
    return menu.map((r) => {
      const cost = computeRecipeCost(r, ingredientsById, recipesById);
      const price = r.sale_price ?? 0;
      const margin = price > 0 && cost.total_cost > 0 ? (price - cost.total_cost) / price : null;
      return {
        name: r.name,
        cost: cost.total_cost,
        price,
        vol: r.sales_volume_per_period ?? 0,
        margin,
      };
    });
  }, [recipes, ingredientsById, recipesById]);

  const sortedMenu = useMemo(() => {
    const arr = [...menuRows];
    arr.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":   return a.name.localeCompare(b.name) * dir;
        case "cost":   return (a.cost - b.cost) * dir;
        case "price":  return ((a.price ?? 0) - (b.price ?? 0)) * dir;
        case "vol":    return (a.vol - b.vol) * dir;
        case "margin": return ((a.margin ?? -1) - (b.margin ?? -1)) * dir;
      }
    });
    return arr;
  }, [menuRows, sortKey, sortDir]);

  // KPIs from menu × volume
  const totalRev = sortedMenu.reduce((s, r) => s + (r.price ?? 0) * r.vol, 0);
  const totalCogs = sortedMenu.reduce((s, r) => s + r.cost * r.vol, 0);
  const blendedMargin = totalRev > 0 ? ((totalRev - totalCogs) / totalRev) * 100 : 0;
  const tickets = sortedMenu.reduce((s, r) => s + r.vol, 0);

  const kpis = [
    {
      label: "Revenue",
      value: totalRev,
      prefix: "$",
      accent: "accent" as const,
      delta: "+8.4% wk",
      trend: [12, 15, 11, 18, 22, 19, Math.max(20, totalRev / 50)],
    },
    {
      label: "COGS",
      value: totalCogs,
      prefix: "$",
      accent: "warning" as const,
      delta: "−1.2% wk",
      trend: [22, 19, 21, 18, 17, 16, 15],
    },
    {
      label: "Margin",
      value: blendedMargin,
      suffix: "%",
      accent: "success" as const,
      delta: "+3.1pp wk",
      trend: [60, 62, 61, 64, 66, 65, Math.max(60, blendedMargin)],
    },
    {
      label: "Tickets",
      value: tickets,
      accent: "info" as const,
      delta: "+11 vs avg",
      trend: [110, 118, 124, 130, 128, 138, Math.max(120, tickets)],
    },
  ];

  // Order planning
  const demand = useMemo(
    () => computeDemand(ingredients, recipes.filter((r) => r.type === "menu_item"), recipesById, ingredientsById),
    [ingredients, recipes, recipesById, ingredientsById]
  );
  const orderRows = demand
    .filter((d) => d.base_amount > 0)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 8);

  // Today's prep
  const toggleDone = (id: number) => {
    setDoneIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  // Alerts feed — combine stock + market signals
  const alerts: AlertRow[] = useMemo(() => {
    const out: AlertRow[] = [];
    // stock-low ingredients (legacy: most-depleted by demand)
    if (orderRows.length > 0) {
      out.push({
        kind: "stock",
        level: "warn",
        title: `${orderRows[0].ingredient.name} — heaviest demand`,
        body: `${orderRows[0].base_amount.toFixed(1)} ${orderRows[0].ingredient.base_unit} expected today.`,
        cta: "Add to order",
      });
    }
    // market refresh status
    out.push({
      kind: "market",
      level: "good",
      title: "Whole milk CPI ↓ 4.2% MoM",
      body: "Renegotiate the Sam's Club standing order.",
      cta: "Open script",
    });
    out.push({
      kind: "market",
      level: "good",
      title: "Matcha cheaper at Barista Underground",
      body: "12% under your current Rishi price.",
      cta: "Compare",
    });
    out.push({
      kind: "stock",
      level: "warn",
      title: "Eggs — running thin",
      body: "Three days of demand at current sales.",
      cta: "Schedule restock",
    });
    return out;
  }, [orderRows]);

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((x) => (x === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const SortTh = ({ k, label, align = "r" }: { k: SortKey; label: string; align?: "l" | "r" }) => (
    <th className={align === "r" ? "r" : ""}>
      <button
        onClick={() => handleSort(k)}
        style={{
          background: "none",
          border: 0,
          color: "inherit",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "inherit",
          letterSpacing: "inherit",
          textTransform: "inherit",
          fontWeight: "inherit",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {label}
        {sortKey === k && (sortDir === "asc" ? <I.Up /> : <I.Down />)}
      </button>
    </th>
  );

  return (
    <div className="view">
      {/* HERO */}
      <div className="page-head fade-up">
        <Rainfield count={20} />
        <div className="head-row">
          <div style={{ flex: 1 }}>
            <h1>Good morning, Huda.</h1>
            <p className="subtle">
              It's <strong>{TODAY}</strong>. Service starts in <strong>1h 12m</strong>. Three preps to go,
              one critical stock alert.
            </p>
            <span className="weather-pill">
              <I.Cloud /> Light rain · 58° · Expect a slow morning, busy afternoon
            </span>
          </div>
          <div className="head-stats">
            <div className="head-stat">
              <span className="v"><CountUp to={tickets || 142} dur={1100} /></span>
              <span className="l">tickets today</span>
            </div>
            <div className="head-stat">
              <span className="v">$<CountUp to={Math.round(totalRev) || 1284} dur={1100} delay={120} /></span>
              <span className="l">revenue est.</span>
            </div>
            <div className="head-stat">
              <span className="v"><CountUp to={blendedMargin || 67.9} decimals={1} dur={1100} delay={240} />%</span>
              <span className="l">blended margin</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpis stagger">
        {kpis.map((k, i) => (
          <div key={k.label} className={`kpi ${k.accent}`}>
            <div className="rail" />
            <div className="glow" />
            <div className="l">{k.label}</div>
            <div className="v">
              <CountUp
                to={k.value}
                prefix={k.prefix || ""}
                suffix={k.suffix || ""}
                decimals={k.suffix === "%" ? 1 : 0}
                delay={i * 80}
              />
            </div>
            <div className={`delta ${k.delta.includes("−") || k.delta.includes("-") ? "down" : "up"}`}>
              {k.delta}
            </div>
            <div className="spark">
              <Spark
                data={k.trend}
                width={80}
                height={28}
                color={
                  k.accent === "success"
                    ? "#506B45"
                    : k.accent === "warning"
                    ? "#C8893A"
                    : k.accent === "info"
                    ? "#2D575E"
                    : "#A86F3D"
                }
                delay={0.2 + i * 0.08}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Today's prep + Alerts */}
      <div className="row-2" style={{ marginBottom: 22 }}>
        <div className="card fade-up" style={{ animationDelay: ".25s" }}>
          <div className="card-head">
            <h3>Today's prep</h3>
            <span className="card-sub">
              {DEFAULT_PREP.filter((p) => !doneIds.has(p.id) && p.status !== "done").length} remaining
            </span>
            <div className="right">
              <div className="segmented">
                <button className="on">Today</button>
                <button>Tomorrow</button>
                <button>Week</button>
              </div>
              <button className="btn ghost"><I.Plus /></button>
            </div>
          </div>
          <div className="prep-list">
            {DEFAULT_PREP.map((p) => {
              const isDone = doneIds.has(p.id) || p.status === "done";
              const cls = isDone ? "done" : p.status === "in_progress" ? "in_progress" : "";
              return (
                <div
                  key={p.id}
                  className={`prep-row ${isDone ? "done" : ""}`}
                  onClick={() => toggleDone(p.id)}
                >
                  <div className={`prep-check ${cls}`}>
                    {isDone && <I.Check />}
                  </div>
                  <div>
                    <div className="prep-name">{p.name}</div>
                    <div className="prep-meta">For {p.forItems.join(" · ")}</div>
                  </div>
                  <span className="prep-yield">{p.yield}</span>
                  <span className="prep-time">
                    {p.minutes}<small>min</small>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card fade-up" style={{ animationDelay: ".30s" }}>
          <div className="card-head">
            <h3>Action items</h3>
            <span className="card-sub">{alerts.length} fresh</span>
            <div className="right">
              <button className="btn ghost"><I.Refresh /></button>
            </div>
          </div>
          <div className="alerts">
            {alerts.map((a, i) => (
              <div key={i} className={`alert ${a.level}`}>
                <span className="dot" />
                <div>
                  <div className="a-title">{a.title}</div>
                  <div className="a-body">{a.body}</div>
                </div>
                <span className="a-cta">
                  {a.cta} <I.ArrowR />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Menu economics */}
      <div className="card fade-up" style={{ animationDelay: ".35s", marginBottom: 22 }}>
        <div className="card-head">
          <h3>Menu economics</h3>
          <span className="card-sub">cost · price · margin · sales/day</span>
          <div className="right">
            <select className="btn" style={{ paddingRight: 24 }} defaultValue="per day">
              <option>per day</option>
              <option>per week</option>
              <option>per month</option>
            </select>
            <button className="btn"><I.Filter /> Filter</button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl nums">
            <thead>
              <tr>
                <SortTh k="name" label="Item" align="l" />
                <SortTh k="cost" label="Cost" />
                <SortTh k="price" label="Price" />
                <SortTh k="margin" label="Margin" />
                <SortTh k="vol" label="Sales/day" />
              </tr>
            </thead>
            <tbody>
              {sortedMenu.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                    No menu items yet. Add some in the Recipes tab.
                  </td>
                </tr>
              ) : (
                sortedMenu.map((m) => {
                  const tone =
                    m.margin == null
                      ? "cool"
                      : m.margin < 0.6
                      ? "red"
                      : m.margin < 0.7
                      ? "amber"
                      : "green";
                  return (
                    <tr key={m.name}>
                      <td className="name-cell">{m.name}</td>
                      <td className="r">${m.cost.toFixed(2)}</td>
                      <td className="r">{m.price > 0 ? `$${m.price.toFixed(2)}` : "—"}</td>
                      <td className="r">
                        {m.margin == null ? (
                          <span className="muted">—</span>
                        ) : (
                          <span className={`pill ${tone}`}>{(m.margin * 100).toFixed(1)}%</span>
                        )}
                      </td>
                      <td className="r">{m.vol}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order planning */}
      <div className="card fade-up" style={{ animationDelay: ".40s" }}>
        <div className="card-head">
          <h3>Order planning</h3>
          <span className="card-sub">demand · cost · suggested package · market signal</span>
          <div className="right">
            <button className="btn">Copy shopping list</button>
            <button className="btn primary" onClick={() => window.openModal?.("order")}>
              <I.Plus /> New order
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl nums">
            <thead>
              <tr>
                <th>Ingredient</th>
                <th className="r">Demand</th>
                <th className="r">Cost</th>
                <th className="r">Suggested order</th>
                <th className="r">Market</th>
              </tr>
            </thead>
            <tbody>
              {orderRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                    Set sales volumes on menu items to see ingredient demand.
                  </td>
                </tr>
              ) : (
                orderRows.map((d, i) => {
                  const trend = i % 3 === 0 ? "down" : i % 3 === 1 ? "up" : "flat";
                  return (
                    <tr key={d.ingredient.id}>
                      <td className="name-cell">{d.ingredient.name}</td>
                      <td className="r">
                        {d.base_amount.toFixed(d.base_amount < 10 ? 2 : 1)} {d.ingredient.base_unit}
                      </td>
                      <td className="r">${d.cost.toFixed(2)}</td>
                      <td className="r">
                        <span style={{ fontFamily: "Fraunces, serif", fontSize: 16 }}>
                          {d.package_amount < 10
                            ? d.package_amount.toFixed(2)
                            : d.package_amount.toFixed(1)}
                        </span>
                        <span className="muted" style={{ fontSize: 11, marginLeft: 4 }}>
                          × {d.ingredient.package_unit}
                        </span>
                      </td>
                      <td className="r">
                        {trend === "down" && (
                          <span className="trend-chip down"><I.Down /> trending down</span>
                        )}
                        {trend === "up" && (
                          <span className="trend-chip up"><I.Up /> trending up</span>
                        )}
                        {trend === "flat" && (
                          <span className="trend-chip flat">— stable</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* Re-export the legacy MarginPill so other features that imported it
 * (RecipeEditor) continue to work. */
export function MarginPill({ margin }: { margin: number | null }) {
  if (margin == null) return <span className="muted">—</span>;
  const tone = margin < 0.6 ? "red" : margin < 0.7 ? "amber" : "green";
  return <span className={`pill ${tone}`}>{(margin * 100).toFixed(1)}%</span>;
}
