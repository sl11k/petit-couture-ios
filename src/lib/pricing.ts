export function getCanonicalProductPrice(
  productPrice: number | string | null | undefined,
  variantPrice?: number | string | null,
) {
  // Prefer an explicit variant price override when present (variant should
  // override the base product price). Fall back to the product price, then
  // zero.
  const normalizedVariantPrice =
    variantPrice === null || variantPrice === undefined || variantPrice === ""
      ? null
      : Number(variantPrice);
  if (Number.isFinite(normalizedVariantPrice) && (normalizedVariantPrice as number) >= 0) {
    return Math.round((normalizedVariantPrice as number) * 100) / 100;
  }

  const normalizedProductPrice =
    productPrice === null || productPrice === undefined || productPrice === ""
      ? null
      : Number(productPrice);
  if (Number.isFinite(normalizedProductPrice) && (normalizedProductPrice as number) >= 0) {
    return Math.round((normalizedProductPrice as number) * 100) / 100;
  }

  return 0;
}
