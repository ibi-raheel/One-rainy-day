import { useState } from "react";
import { Modal } from "@/components/design/Modal";
import { I } from "@/components/design/Icons";

interface Props { onClose: () => void; }

interface OrderItem { name: string; why: string; qty: number; unit: string; price: number; }

const SUPPLIERS = [
  { id: "rd",    name: "Restaurant Depot", lead: "1 day" },
  { id: "sc",    name: "Sam's Club",       lead: "Same day" },
  { id: "rishi", name: "Rishi Tea",        lead: "2 days" },
];

const INITIAL_ITEMS: OrderItem[] = [
  { name: "Heavy cream",      why: "Below reorder · out by mid-service", qty: 4, unit: "qt",  price: 4.98 },
  { name: "Whole milk",       why: "Standing order · weekly",            qty: 6, unit: "gal", price: 3.48 },
  { name: "Eggs (large)",     why: "Forecast +18% Sat brunch",           qty: 8, unit: "doz", price: 2.84 },
  { name: "Butter, unsalted", why: "Below par",                          qty: 6, unit: "lb",  price: 5.40 },
];

export function NewOrderModal({ onClose }: Props) {
  const [supplier, setSupplier] = useState("rd");
  const [items, setItems] = useState<OrderItem[]>(INITIAL_ITEMS);

  const setQty = (i: number, q: number) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, qty: Math.max(0, q) } : it)));
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const total = items.reduce((s, it) => s + it.qty * it.price, 0);

  return (
    <Modal
      title="New order"
      sub="Generated from forecast + reorder points"
      onClose={onClose}
      width={780}
      footer={
        <>
          <div className="order-total">
            <span className="l">Total</span>
            <span className="v">${total.toFixed(2)}</span>
            <span className="l">· {items.length} items</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose}>Save draft</button>
            <button className="btn primary" onClick={onClose}>Send order <I.ArrowR /></button>
          </div>
        </>
      }
    >
      <div style={{
        fontSize: 12, color: "var(--text-2)", marginBottom: 8,
        fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em",
      }}>
        Supplier
      </div>
      <div className="order-suppliers">
        {SUPPLIERS.map((s) => (
          <div
            key={s.id}
            className={`order-supplier ${supplier === s.id ? "active" : ""}`}
            onClick={() => setSupplier(s.id)}
          >
            <div className="name">{s.name}</div>
            <div className="lead">Lead time · {s.lead}</div>
          </div>
        ))}
      </div>

      <div style={{
        fontSize: 12, color: "var(--text-2)", marginBottom: 8,
        fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em",
      }}>
        Items
      </div>
      <div className="order-items">
        {items.map((it, i) => (
          <div key={i} className="order-item">
            <div>
              <div className="nm">{it.name}</div>
              <div className="why">{it.why}</div>
            </div>
            <div className="qty-input">
              <button onClick={() => setQty(i, it.qty - 1)}>−</button>
              <span style={{ minWidth: 24, textAlign: "center" }}>{it.qty}</span>
              <button onClick={() => setQty(i, it.qty + 1)}>+</button>
              <span style={{ fontSize: 11, color: "var(--text-2)", fontFamily: "Inter" }}>{it.unit}</span>
            </div>
            <div className="ttl">${(it.qty * it.price).toFixed(2)}</div>
            <button className="x" onClick={() => remove(i)} aria-label="Remove">
              <I.X />
            </button>
          </div>
        ))}
      </div>

      <button className="btn ghost" style={{ marginTop: 10, color: "var(--text-2)" }}>
        <I.Plus /> Add item
      </button>
    </Modal>
  );
}
