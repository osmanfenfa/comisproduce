import { useCallback, useEffect, useState } from "react";
import ReceiptPrintSheet from "../components/shared/ReceiptPrintSheet.jsx";

/**
 * Print one or many receipts, 4 per A4 page.
 *
 *   const { printReceipts, printSheet } = useReceiptPrinter();
 *   ...render {printSheet} somewhere, then call printReceipts([r1, r2, ...])
 */
export function useReceiptPrinter() {
  const [queue, setQueue] = useState(null);

  useEffect(() => {
    if (!queue) return;
    document.body.classList.add("printing-receipts");
    const done = () => {
      document.body.classList.remove("printing-receipts");
      setQueue(null);
    };
    window.addEventListener("afterprint", done, { once: true });
    // Let the sheet render before opening the print dialog
    const timer = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("printing-receipts");
    };
  }, [queue]);

  const printReceipts = useCallback((receipts) => {
    if (receipts && receipts.length) setQueue([...receipts]);
  }, []);

  return {
    printReceipts,
    printing: !!queue,
    printSheet: queue ? <ReceiptPrintSheet receipts={queue} /> : null,
  };
}
