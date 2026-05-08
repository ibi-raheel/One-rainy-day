import { useEffect, useState } from "react";
import { Modal } from "@/components/design/Modal";
import { I } from "@/components/design/Icons";

interface Props { onClose: () => void; onReview: () => void; }

const STEPS = [
  { label: "Capturing image",        detail: "1280×1920px · clear focus" },
  { label: "Reading text (OCR)",     detail: "14 line items detected" },
  { label: "Matching to ingredients",detail: "12 of 14 auto-matched" },
  { label: "Updating prices & stock",detail: "Ready for review" },
];

export function ScanReceiptModal({ onClose, onReview }: Props) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= STEPS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 1200 : 1100);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <Modal
      title="Scan receipt"
      sub="Restaurant Depot · May 8, 2026 · 9:42 AM"
      onClose={onClose}
      width={680}
      footer={
        <>
          <span style={{ fontSize: 12, color: "var(--text-2)" }}>
            {step >= STEPS.length ? "Done · 14 items, $182.40" : "Working…"}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button
              className="btn primary"
              disabled={step < STEPS.length}
              style={step < STEPS.length ? { opacity: 0.5, cursor: "not-allowed" } : {}}
              onClick={() => { onClose(); onReview(); }}
            >
              Review items <I.ArrowR />
            </button>
          </div>
        </>
      }
    >
      <div className="scan-frame scan-corners">
        <i />
        <div className="scan-receipt">
          <div className="r-line head"><span>RESTAURANT DEPOT</span></div>
          <div className="r-line"><span>WHL MILK 1GAL</span><span>3.48</span></div>
          <div className="r-line"><span>HVY CRM QT</span><span>4.98</span></div>
          <div className="r-line"><span>EGGS 5DZ</span><span>14.20</span></div>
          <div className="r-line"><span>BUTTER UNSL</span><span>5.40</span></div>
          <div className="r-line"><span>BREAD FLR 50#</span><span>21.80</span></div>
          <div className="r-line"><span>SUGAR GRN 25#</span><span>18.40</span></div>
          <div className="r-line"><span>VAN EXT 16OZ</span><span>11.20</span></div>
          <div className="r-line"><span>CHOC 70% 5#</span><span>32.10</span></div>
          <div className="r-line total"><span>TOTAL</span><span>$182.40</span></div>
        </div>
        <div className="scan-laser" />
      </div>

      <div className="scan-progress">
        {STEPS.map((s, i) => (
          <div key={i} className={`scan-step ${i < step ? "done" : i === step ? "active" : ""}`}>
            <div className="dot" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-2)" }}>{s.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
