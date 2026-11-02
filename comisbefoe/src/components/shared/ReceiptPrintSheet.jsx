import { createPortal } from "react-dom";

const SLIPS_PER_PAGE = 4;

const money = (v) =>
  v == null ? "—" : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Compact print-only receipt slip: same three-panel layout as the on-screen
 * voucher, sized to a quarter of an A4 page (cut along the dashed lines).
 */
function ReceiptSlip({ receipt }) {
  const isCocoa = receipt.transaction_type === "cocoa";
  const businessName = receipt.business_name || receipt.station_name || "PRODUCE BUYING STATION";
  const location = [receipt.seller_section, receipt.seller_chiefdom, receipt.seller_district]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rslip">
      <div className="rslip-head">
        <div>
          <div className="rslip-kicker">Official Cash Purchase Voucher · Buying Slip</div>
          <div className="rslip-biz">{businessName}</div>
          {(receipt.business_address || receipt.business_phone) && (
            <div className="rslip-muted">
              {receipt.business_address}
              {receipt.business_address && receipt.business_phone && " • "}
              {receipt.business_phone && `Tel: ${receipt.business_phone}`}
            </div>
          )}
        </div>
        <div className="rslip-no">
          <div className="rslip-kicker">Voucher No</div>
          <div className="rslip-mono rslip-strong">{receipt.receipt_number}</div>
          <div className="rslip-muted">{new Date(receipt.issued_at).toLocaleString()}</div>
        </div>
      </div>

      <div className="rslip-cols">
        <div className="rslip-col">
          <div className="rslip-col-title">
            <span>1. Seller</span>
            <span className="rslip-tag">{receipt.is_random_seller ? "Walk-in" : "Registered"}</span>
          </div>
          <div className="rslip-strong">{receipt.seller_name || "Walk-in Seller"}</div>
          {receipt.seller_code && <div className="rslip-mono">ID: {receipt.seller_code}</div>}
          <div className="rslip-mono">Tel: {receipt.seller_contact || "N/A"}</div>
          {location && <div>{location}</div>}
          {receipt.station_name && <div className="rslip-muted">Station: {receipt.station_name}</div>}
        </div>

        <div className="rslip-col">
          <div className="rslip-col-title">
            <span>2. Produce</span>
            <span className="rslip-tag rslip-tag-dark">{receipt.transaction_type}</span>
          </div>
          <div className="rslip-row"><span>Bags</span><b>{receipt.bags ?? 1}</b></div>
          <div className="rslip-row"><span>Gross weight</span><b>{receipt.weight_kg ?? "—"} kg</b></div>
          {isCocoa && (
            <>
              <div className="rslip-row">
                <span>Moisture (std {receipt.standard_percent || 7}%)</span>
                <b>{receipt.water_percent != null ? `${receipt.water_percent}%` : "—"}</b>
              </div>
              <div className="rslip-row">
                <span>Water deduction</span>
                <b>{receipt.moisture_deduction_kg > 0 ? `-${receipt.moisture_deduction_kg}` : "0.0"} kg</b>
              </div>
            </>
          )}
          <div className="rslip-row"><span>Net weight</span><b>{receipt.net_weight_kg ?? receipt.weight_kg} kg</b></div>
          <div className="rslip-row"><span>Price per kg</span><b>Nle {money(receipt.price_per_kg)}</b></div>
        </div>

        <div className="rslip-col">
          <div className="rslip-col-title"><span>3. Settlement</span></div>
          <div className="rslip-row"><span>Gross payable</span><b>Nle {money(receipt.gross_amount)}</b></div>
          {receipt.loan_deduction > 0 && (
            <div className="rslip-row"><span>Loan settled</span><b>-Nle {money(receipt.loan_deduction)}</b></div>
          )}
          <div className="rslip-net">
            <div className="rslip-kicker">Net cash paid to seller</div>
            <div className="rslip-net-amount">Nle {money(receipt.net_amount_paid)}</div>
          </div>
          <div className="rslip-sign">
            <span>Recorded: {receipt.recorded_by_name || "Secretary"}</span>
            <span>Sign: ________</span>
          </div>
          <div className="rslip-sign">
            <span>Authorized: {receipt.issued_by_name || "Manager"}</span>
            <span>Sign: ________</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Off-screen sheet that only appears when printing: 4 slips per A4 portrait page. */
export default function ReceiptPrintSheet({ receipts }) {
  const pages = [];
  for (let i = 0; i < receipts.length; i += SLIPS_PER_PAGE) {
    pages.push(receipts.slice(i, i + SLIPS_PER_PAGE));
  }
  return createPortal(
    <div id="receipt-print-root">
      {pages.map((page, idx) => (
        <div className="rslip-page" key={idx}>
          {page.map((r) => (
            <ReceiptSlip key={r.id} receipt={r} />
          ))}
        </div>
      ))}
    </div>,
    document.body
  );
}
