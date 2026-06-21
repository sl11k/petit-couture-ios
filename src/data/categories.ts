// Legacy seed data. The storefront is fully DB-driven now; these arrays are kept
// empty so no fake categories/products leak into the UI. The exported types and
// helper signatures remain so older imports keep compiling.

export type Category = {
  slug: string;
  name: string;
  img: string;
};

export const categories: Category[] = [];

export type Product = {
  slug: string;
  name: string;
  brand: string;
  category: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  rating: number;
  reviewsCount: number;
  stock: number;
  lowStockThreshold: number;
  status: "in_stock" | "low_stock" | "out_of_stock" | "preorder" | "coming_soon";
  description: string;
  shortDescription: string;
  details: string[];
  specs: { label: string; value: string }[];
  materials: string[];
  careInstructions: string[];
  sizes: string[];
  sizeChart: { size: string; chest: string; length: string; age: string }[];
  colors: { name: string; hex: string; image?: string }[];
  images: string[];
  videoUrl?: string;
  view360?: string[];
  giftWrapAvailable: boolean;
  upsells: { id: string; name: string; price: number; image: string }[];
  warranty: string;
  returnPolicy: string;
  reviews: {
    id: string;
    name: string;
    rating: number;
    title: string;
    body: string;
    date: string;
    verified: boolean;
    images?: string[];
  }[];
};

export const productsByCategory: Record<string, Product> = {};

const EMPTY_PRODUCT: Product = {
  slug: "",
  name: "",
  brand: "",
  category: "",
  sku: "",
  price: 0,
  currency: "SAR",
  rating: 0,
  reviewsCount: 0,
  stock: 0,
  lowStockThreshold: 0,
  status: "out_of_stock",
  description: "",
  shortDescription: "",
  details: [],
  specs: [],
  materials: [],
  careInstructions: [],
  sizes: [],
  sizeChart: [],
  colors: [],
  images: [],
  giftWrapAvailable: false,
  upsells: [],
  warranty: "",
  returnPolicy: "",
  reviews: [],
};

export function getProductForCategory(slug: string): Product {
  return { ...EMPTY_PRODUCT, slug };
}
