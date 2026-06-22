export function money(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid monetary value");
  return Math.round(parsed * 100) / 100;
}

export function amountsMatch(left: unknown, right: unknown): boolean {
  const leftMinorUnits = Math.round(money(left) * 100);
  const rightMinorUnits = Math.round(money(right) * 100);
  return Math.abs(leftMinorUnits - rightMinorUnits) <= 1;
}

export function assertOrderTotals(
  items: Array<{ unit_price: unknown; qty: unknown }>,
  order: {
    subtotal: unknown;
    shipping_fee: unknown;
    tax: unknown;
    discount_amount: unknown;
    total: unknown;
  },
) {
  const itemSubtotal = money(
    items.reduce((sum, item) => sum + money(item.unit_price) * Number(item.qty), 0),
  );
  const expectedTotal = money(
    itemSubtotal +
      money(order.shipping_fee || 0) +
      money(order.tax || 0) -
      money(order.discount_amount || 0),
  );

  if (!amountsMatch(itemSubtotal, order.subtotal) || !amountsMatch(expectedTotal, order.total)) {
    throw new Error("Order totals are inconsistent");
  }
}
