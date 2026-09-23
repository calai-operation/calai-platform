// Plain text for the existing CloudPRNT and ESC/POS bridges; 40 printable columns.
export function generateReceiptText(
  order,
  businessSettings = {},
  contactInfo = {},
) {
  const width = 40,
    rule = "-".repeat(width),
    heavy = "=".repeat(width);
  const clean = (value) =>
    String(value ?? "")
      .replace(/[\x00-\x1f\x7f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const wrap = (value) => {
    const text = clean(value),
      result = [];
    let rest = text;
    while (rest.length > width) {
      let end = rest.lastIndexOf(" ", width);
      if (end < 1) end = width;
      result.push(rest.slice(0, end));
      rest = rest.slice(end).trimStart();
    }
    if (rest) result.push(rest);
    return result;
  };
  const centered = (value) =>
    wrap(value).map(
      (line) => " ".repeat(Math.floor((width - line.length) / 2)) + line,
    );
  const columns = (left, right) => {
    left = clean(left);
    right = clean(right);
    return left.length + right.length + 1 <= width
      ? [left + " ".repeat(width - left.length - right.length) + right]
      : [
          ...wrap(left),
          ...wrap(right).map((line) => " ".repeat(width - line.length) + line),
        ];
  };
  const money = (value) => "\u00a3 " + Number(value || 0).toFixed(2);
  const unconfirmed = order.confirmationStatus === "unconfirmed";
  const stamp = order.createdAt ? new Date(order.createdAt) : new Date();
  const date =
    order.date ||
    stamp.toLocaleDateString("en-GB", { timeZone: "Europe/London" });
  const time =
    order.time ||
    stamp.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/London",
    });
  const logo = [
    "   .---.        ",
    "  / ... \\ Calai ",
    "  \\   __/       ",
    "   `.__)        ",
  ];
  const lines = [
    "",
    heavy,
    "",
    ...logo.map(
      (line) => " ".repeat(Math.floor((width - line.length) / 2)) + line,
    ),
    "",
    ...centered(businessSettings?.businessName || "RESTAURANT"),
  ];
  for (const value of [
    businessSettings?.businessAddress,
    contactInfo?.email,
    contactInfo?.phone,
  ])
    if (value) lines.push(...centered(value));
  lines.push("", rule, "");
  if (unconfirmed)
    lines.push(
      ...centered("UNCONFIRMED ORDER"),
      ...centered("Customer confirmation required"),
      "",
      rule,
      "",
    );
  lines.push(
    ...columns(
      "Order: " + (order.id ? "#" + order.id.split("-")[0] : "N/A"),
      "Time: " + time,
    ),
    "Date: " + date,
  );
  const type = order.orderType || "PICKUP";
  lines.push("Order Type: " + (type === "UNKNOWN" ? "Not specified" : type));
  if (type === "DELIVERY")
    lines.push(
      ...wrap("Address: " + (order.deliveryAddress || "Not provided")),
    );
  else if (type === "PICKUP" && !unconfirmed) {
    const pickup =
      order.pickupTime ||
      new Date(stamp.getTime() + 15 * 60000).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/London",
      });
    lines.push("Pickup Time: " + pickup);
  }
  lines.push(
    "",
    rule,
    "",
    ...wrap("Customer: " + (order.customerName || "N/A")),
    ...wrap(
      "Phone: " + (order.call?.customerNumber || order.customerNumber || "N/A"),
    ),
    "",
    rule,
    "",
  );
  let items = order.items || [];
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  if (!Array.isArray(items)) items = items?.order_details || [];
  const firstItem = Array.isArray(items) && items.length > 0 ? items[0] : null;
  const generalNotes =
    order.notes ||
    order.specialInstructions ||
    order.special_instructions ||
    order.order_notes ||
    firstItem?.order_notes;
  if (generalNotes)
    lines.push("NOTES:", "", ...wrap(generalNotes), "", rule, "");
  lines.push("ITEMS:", "");
  for (const item of Array.isArray(items) ? items : []) {
    const name = item.product_name || item.item_name || item.name || "Item";
    const qty = parseInt(item.quantity) || 1;
    const unit = parseFloat(
      item.unit_prize || item.unit_price || item.price || 0,
    );
    const total = parseFloat(item.total_price || qty * unit);
    const amount =
      unconfirmed && item.unit_prize === null ? "Price unknown" : money(total);
    lines.push(...columns(qty + "x " + name, amount));
    if (item.notes) lines.push(...wrap("Note: " + item.notes));
    lines.push("");
  }
  if (!items.length) lines.push("No item details available.", "");
  const total =
    unconfirmed && order.totalPrice === null
      ? "Not confirmed"
      : money(order.totalPrice);
  lines.push(
    rule,
    "",
    ...columns("Subtotal:", total),
    "",
    ...columns("TOTAL:", total),
    "",
    rule,
    "",
  );
  if (unconfirmed)
    lines.push(
      "REASON NOT CONFIRMED:",
      "",
      ...wrap(order.unconfirmedReason || "Call ended before confirmation."),
      "",
      ...centered("Please contact the customer."),
    );
  else lines.push(...centered("Thank you for your order!"));
  lines.push(
    "",
    rule,
    "",
    ...centered("Need help?"),
    ...centered("hello@calai.info"),
    "",
    rule,
    "",
    "",
    "",
    "",
  );
  return lines.join("\n");
}
