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
  price: number;
  currency: string;
  description: string;
  details: string[];
  sizes: string[];
  colors: { name: string; hex: string }[];
  images: string[];
};

export const productsByCategory: Record<string, Product> = {
  "best-sellers": {
    slug: "best-sellers",
    name: "Rosalie Tulle Dress",
    brand: "Maisonnét Atelier",
    category: "Best Sellers",
    price: 1250,
    currency: "SAR",
    description:
      "An ethereal layered tulle dress finished with hand-embroidered floral appliqués and a satin sash. Designed in our Paris atelier for the season's most memorable celebrations.",
    details: [
      "Hand-embroidered bodice",
      "Layered tulle skirt with cotton lining",
      "Satin waist sash",
      "Concealed back zip",
    ],
    sizes: ["2Y", "3Y", "4Y", "5Y", "6Y", "8Y"],
    colors: [
      { name: "Blush", hex: "#F7D8C5" },
      { name: "Cream", hex: "#FFF4D8" },
      { name: "Mint", hex: "#DDEEDB" },
    ],
    images: [productDress1, productDress3, productDress2],
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
