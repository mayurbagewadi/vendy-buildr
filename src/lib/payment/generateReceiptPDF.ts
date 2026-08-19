// Fallback payment receipt — generated entirely from data already on the client
// (no extra DB calls) when a customer's payment succeeded but our server-side
// confirmation could not be verified after a retry. Gives the customer proof to
// share with the store owner.

export interface ReceiptItem {
  productName: string;
  variant?: string;
  price: number;
  quantity: number;
}

export interface PaymentReceiptData {
  storeName: string;
  storePhone: string | null;
  orderNumber: string;
  paymentId: string;
  amount: number;
  customerName: string;
  customerPhone: string;
  items: ReceiptItem[];
}

export const downloadPaymentReceiptPDF = async (data: PaymentReceiptData) => {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF();
  const dateStr = new Date().toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.storeName || "Store", 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (data.storePhone) {
    doc.text(`Phone: ${data.storePhone}`, 14, 25);
  }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Receipt", 14, 38);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const details = [
    [`Order Number:`, data.orderNumber],
    [`Payment ID:`, data.paymentId],
    [`Date:`, dateStr],
    [`Customer:`, `${data.customerName} (${data.customerPhone})`],
    [`Amount Paid:`, `Rs. ${data.amount.toFixed(2)}`],
  ];
  let y = 46;
  details.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), 55, y);
    y += 6;
  });

  autoTable(doc, {
    startY: y + 4,
    head: [["Item", "Variant", "Qty", "Price"]],
    body: data.items.map((item) => [
      item.productName,
      item.variant || "-",
      String(item.quantity),
      `Rs. ${(item.price * item.quantity).toFixed(2)}`,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20;
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(
    "This payment was successful but the order could not be confirmed automatically.",
    14,
    finalY + 10
  );
  doc.text("Please share this receipt with the store owner.", 14, finalY + 15);

  doc.save(`Payment-Receipt-${data.orderNumber}.pdf`);
};
