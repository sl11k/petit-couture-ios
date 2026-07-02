export function getCanonicalProductPrice(
  productPrice: number | string | null | undefined,
  variantPrice?: number | string | null,
) {
  // The product price is the public source of truth across listing, product,
  // cart, checkout, and payment. Variant prices are only a fallback for older
  // records that do not have a base product price.
  const normalizedProductPrice =
    productPrice === null || productPrice === undefined || productPrice === ""
      ? null
      : Number(productPrice);
  if (Number.isFinite(normalizedProductPrice) && (normalizedProductPrice as number) >= 0) {
    return Math.round((normalizedProductPrice as number) * 100) / 100;
  }

  const normalizedVariantPrice =
    variantPrice === null || variantPrice === undefined || variantPrice === ""
      ? null
      : Number(variantPrice);
  if (Number.isFinite(normalizedVariantPrice) && (normalizedVariantPrice as number) >= 0) {
    return Math.round((normalizedVariantPrice as number) * 100) / 100;
  }

  return 0;
}
