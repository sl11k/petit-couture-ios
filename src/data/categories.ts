import catBestsellers from "@/assets/cat-bestsellers.jpg";
import catNewIn from "@/assets/cat-newin.jpg";
import catSwimwear from "@/assets/cat-swimwear.jpg";
import catDresses from "@/assets/cat-dresses.jpg";
import catTops from "@/assets/cat-tops.jpg";
import catShoes from "@/assets/cat-shoes.jpg";
import catOutfits from "@/assets/cat-outfits.jpg";
import catGifts from "@/assets/cat-gifts.jpg";
import catBabysuits from "@/assets/cat-babysuits.jpg";
import catBags from "@/assets/cat-bags.jpg";
import productDress1 from "@/assets/product-dress-1.jpg";
import productDress2 from "@/assets/product-dress-2.jpg";
import productDress3 from "@/assets/product-dress-3.jpg";

export type Category = {
  slug: string;
  name: string;
  img: string;
};

export const categories: Category[] = [
  { slug: "best-sellers", name: "Best Sellers", img: catBestsellers },
  { slug: "new-in", name: "New In", img: catNewIn },
  { slug: "swimwear", name: "Swimwear", img: catSwimwear },
  { slug: "dresses", name: "Dresses", img: catDresses },
  { slug: "tops", name: "Tops", img: catTops },
  { slug: "shoes", name: "Shoes", img: catShoes },
  { slug: "outfit-sets", name: "Outfit Sets", img: catOutfits },
  { slug: "gifts", name: "Gifts", img: catGifts },
  { slug: "babysuits", name: "Babysuits", img: catBabysuits },
  { slug: "bags", name: "Bags", img: catBags },
];

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

export const productsByCategory: Record<string, Product> = {
  "best-sellers": {
    slug: "best-sellers",
    name: "Rosalie Tulle Dress",
    brand: "Maisonnét Atelier",
    category: "Best Sellers",
    sku: "MN-RSL-2024-001",
    price: 1250,
    compareAtPrice: 1650,
    currency: "SAR",
    rating: 4.8,
    reviewsCount: 124,
    stock: 7,
    lowStockThreshold: 10,
    status: "low_stock",
    shortDescription:
      "Hand-embroidered tulle dress with satin sash — crafted in our Paris atelier.",
    description:
      "An ethereal layered tulle dress finished with hand-embroidered floral appliqués and a satin sash. Designed in our Paris atelier for the season's most memorable celebrations.",
    details: [
      "Hand-embroidered bodice",
      "Layered tulle skirt with cotton lining",
      "Satin waist sash",
      "Concealed back zip",
    ],
    specs: [
      { label: "Fabric", value: "100% Silk Tulle" },
      { label: "Lining", value: "Egyptian Cotton" },
      { label: "Origin", value: "Made in France" },
      { label: "Closure", value: "Concealed Back Zip" },
      { label: "Weight", value: "320g" },
    ],
    materials: ["Silk tulle 60%", "Cotton lining 35%", "Satin trim 5%"],
    careInstructions: [
      "Dry clean only",
      "Do not bleach",
      "Iron on low heat",
      "Store on padded hanger",
    ],
    sizes: ["2Y", "3Y", "4Y", "5Y", "6Y", "8Y"],
    sizeChart: [
      { size: "2Y", age: "1.5–2y", chest: "52 cm", length: "55 cm" },
      { size: "3Y", age: "2.5–3y", chest: "54 cm", length: "60 cm" },
      { size: "4Y", age: "3.5–4y", chest: "56 cm", length: "65 cm" },
      { size: "5Y", age: "4.5–5y", chest: "58 cm", length: "70 cm" },
      { size: "6Y", age: "5.5–6y", chest: "60 cm", length: "75 cm" },
      { size: "8Y", age: "7–8y", chest: "64 cm", length: "82 cm" },
    ],
    colors: [
      { name: "Blush", hex: "#F7D8C5" },
      { name: "Cream", hex: "#FFF4D8" },
      { name: "Mint", hex: "#DDEEDB" },
    ],
    images: [productDress1, productDress3, productDress2],
    videoUrl: undefined,
    giftWrapAvailable: true,
    upsells: [
      { id: "hairband", name: "Silk Hairband", price: 95, image: productDress2 },
      { id: "shoes", name: "Ballet Flats", price: 320, image: productDress3 },
    ],
    warranty: "Quality guarantee for 30 days against manufacturing defects.",
    returnPolicy: "Free returns within 14 days. Item must be unworn with tags.",
    reviews: [
      {
        id: "r1",
        name: "Sara A.",
        rating: 5,
        title: "Absolutely stunning",
        body: "The fabric quality is exceptional. My daughter wore it for her birthday and everyone complimented it.",
        date: "2026-03-12",
        verified: true,
      },
      {
        id: "r2",
        name: "Layla M.",
        rating: 5,
        title: "Worth every riyal",
        body: "Beautifully made, true to size. Delivery was fast.",
        date: "2026-02-28",
        verified: true,
      },
      {
        id: "r3",
        name: "Noura K.",
        rating: 4,
        title: "Beautiful but runs small",
        body: "Lovely dress, but I recommend sizing up if your child is on the taller side.",
        date: "2026-02-15",
        verified: true,
      },
    ],
  },
};

export function getProductForCategory(slug: string): Product {
  const base = productsByCategory["best-sellers"];
  const cat = categories.find((c) => c.slug === slug);
  return {
    ...base,
    slug,
    category: cat?.name ?? base.category,
  };
}
