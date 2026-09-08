import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProducts from "./tools/list-products";
import getProduct from "./tools/get-product";
import listOrders from "./tools/list-orders";
import getOrder from "./tools/get-order";
import lowStock from "./tools/low-stock";
import salesSummary from "./tools/sales-summary";
import updateOrderStatus from "./tools/update-order-status";

// The OAuth issuer must be the direct Supabase host; the project ref is inlined at build time.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "remix-of-petite-elegance-app",
  title: "Remix of Petite Elegance App",
  version: "0.1.0",
  instructions:
    "Tools for the Le Petit Paradis (lppme.com) store. Callers act as the signed-in store user: staff can browse products, orders, stock levels and sales figures and update order fulfilment status; customers see only their own orders. Use `list_orders`/`get_order` for order lookups, `low_stock_products` for restocking, and `sales_summary` for paid-only revenue.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProducts, getProduct, listOrders, getOrder, lowStock, salesSummary, updateOrderStatus],
});
