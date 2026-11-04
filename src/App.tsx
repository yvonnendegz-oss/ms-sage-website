/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Menu,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Truck,
  Instagram,
  Heart,
  X,
  Send,
  HelpCircle,
} from "lucide-react";

/* ==========================================================================
   PRODUCT DATA ARRAY (EDIT PRODUCT DETAILS HERE)
   ========================================================================== */

export interface Product {
  id: string;
  name: string;
  category: "in-stock" | "past-creation";
  label: string;
  description: string;
  price: string;
  image?: string;
}

export const PRODUCTS: Product[] = [
  // --- ROW 1: IN STOCK PIECES (4) ---
  {
    id: "prod-1",
    name: "Lorem Ipsum Dolor",
    category: "in-stock",
    label: "LOREM IPSUM",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    price: "KES 0,000",
  },
  {
    id: "prod-2",
    name: "Lorem Ipsum Dolor",
    category: "in-stock",
    label: "LOREM IPSUM",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    price: "KES 0,000",
  },
  {
    id: "prod-3",
    name: "Lorem Ipsum Dolor",
    category: "in-stock",
    label: "LOREM IPSUM",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    price: "KES 0,000",
  },
  {
    id: "prod-4",
    name: "Lorem Ipsum Dolor",
    category: "in-stock",
    label: "LOREM IPSUM",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    price: "KES 0,000",
  },

  // --- ROW 2: PAST CREATIONS (4) ---
  {
    id: "prod-5",
    name: "Lorem Ipsum Dolor",
    category: "past-creation",
    label: "LOREM IPSUM",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    price: "KES 0,000",
  },
  {
    id: "prod-6",
    name: "Lorem Ipsum Dolor",
    category: "past-creation",
    label: "LOREM IPSUM",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    price: "KES 0,000",
  },
  {
    id: "prod-7",
    name: "Lorem Ipsum Dolor",
    category: "past-creation",
    label: "LOREM IPSUM",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    price: "KES 0,000",
  },
  {
    id: "prod-8",
    name: "Lorem Ipsum Dolor",
    category: "past-creation",
    label: "LOREM IPSUM",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    price: "KES 0,000",
  },
];

/* ==========================================================================
   IMAGE STORAGE & RESIZING HELPERS (INDEXEDDB + IN-MEMORY FALLBACK)
   ========================================================================== */

const DB_NAME = "ms_sage_crochet_storage";
const STORE_NAME = "uploaded_photos";
const DB_VERSION = 1;

const memoryFallbackMap = new Map<string, string>();

function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveImageToStorage(key: string, dataUrl: string): Promise<void> {
  memoryFallbackMap.set(key, dataUrl);
  try {
    const db = await openDatabase();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(dataUrl, key);
  } catch {
    // Silent in-memory fallback
  }
}

async function removeImageFromStorage(key: string): Promise<void> {
  memoryFallbackMap.delete(key);
  try {
    const db = await openDatabase();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
  } catch {
    // Silent in-memory fallback
  }
}

async function loadAllSavedImages(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  memoryFallbackMap.forEach((v, k) => {
    result[k] = v;
  });
  try {
    const db = await openDatabase();
    if (!db) return result;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          result[cursor.key as string] = cursor.value as string;
          cursor.continue();
        } else {
          resolve(result);
        }
      };
      req.onerror = () => resolve(result);
    });
  } catch {
    return result;
  }
}

function resizeImageFile(file: File, maxDim = 1200): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

/* ==========================================================================
   PRODUCT IMAGE AREA COMPONENT
   ========================================================================== */

function ProductImageArea({
  product,
  photoUrl,
  onUpload,
  onRemove,
}: {
  product: Product;
  photoUrl?: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (photoUrl) {
    return (
      <div className="aspect-[4/5] w-full rounded-[16px] overflow-hidden relative group mb-4 bg-[#EEE7D6]">
        <img
          src={photoUrl}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-[#1F2B20]/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#FDFCF6] hover:bg-[#FFF1B5] text-[#1F2B20] text-xs font-bold px-3 py-1.5 rounded-full shadow-sm cursor-pointer transition-colors active:scale-95"
          >
            Change
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="bg-[#FDFCF6] hover:bg-[#F7B8CB] text-[#1F2B20] text-xs font-bold px-3 py-1.5 rounded-full shadow-sm cursor-pointer transition-colors active:scale-95"
          >
            Remove
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onUpload}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-[4/5] w-full mb-4">
      <label className="w-full h-full border-2 border-dashed border-[#1F2B20]/25 hover:border-[#6F8F5F] rounded-[16px] bg-[#F7F1E5]/40 hover:bg-[#EEE7D6]/60 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onUpload}
        />
        <div className="w-9 h-9 rounded-full bg-[#FDFCF6] group-hover:bg-[#FFF1B5] flex items-center justify-center text-[#6F8F5F] shadow-2xs transition-colors">
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#1F2B20]/70 group-hover:text-[#1F2B20]">
          Add photo
        </span>
      </label>
    </div>
  );
}

/* ==========================================================================
   MAIN APPLICATION
   ========================================================================== */

export default function App() {
  const [savedImages, setSavedImages] = useState<Record<string, string>>({});

  // 5. Card text edits stored in browser (name, label, description, price)
  const [cardEdits, setCardEdits] = useState<
    Record<string, { name?: string; label?: string; description?: string; price?: string }>
  >(() => {
    try {
      const saved = localStorage.getItem("ms_sage_card_edits");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 2. ORDERS OPEN / CLOSED state (persisted in localStorage)
  const [ordersOpen, setOrdersOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("ms_sage_orders_open");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Active section for navigation highlighting
  const [activeSection, setActiveSection] = useState<string>("about");

  // Navigation / search / modal states
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Simple order basket (persisted in localStorage)
  const [basket, setBasket] = useState<Array<{ productId: string; quantity: number }>>(() => {
    try {
      const saved = localStorage.getItem("ms_sage_basket");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  };

  // 4. Mobile carousel active dot index for each row
  const [inStockIndex, setInStockIndex] = useState(0);
  const [pastCreationsIndex, setPastCreationsIndex] = useState(0);

  // Order form state
  const [orderCustomerName, setOrderCustomerName] = useState("");
  const [orderType, setOrderType] = useState<string>("In-stock piece");
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [whatsappStatusNote, setWhatsappStatusNote] = useState<string | null>(null);

  // Horizontal scroll refs for Shop rows
  const inStockScrollRef = useRef<HTMLDivElement>(null);
  const pastCreationsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAllSavedImages().then((imgs) => {
      setSavedImages(imgs);
    });
  }, []);

  // IntersectionObserver to update active nav link as visitor scrolls
  useEffect(() => {
    const sectionIds = ["about", "shop", "info", "order"];
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          visibleEntries.sort(
            (a, b) => b.intersectionRatio - a.intersectionRatio
          );
          setActiveSection(visibleEntries[0].target.id);
        }
      },
      {
        root: null,
        rootMargin: "-20% 0px -40% 0px",
        threshold: [0.1, 0.25, 0.5, 0.75],
      }
    );

    sections.forEach((sec) => observer.observe(sec));

    return () => {
      sections.forEach((sec) => observer.unobserve(sec));
    };
  }, []);

  // 4. Track center card on mobile carousel scroll
  const handleCarouselScroll = (
    ref: React.RefObject<HTMLDivElement | null>,
    setIndex: (idx: number) => void
  ) => {
    if (!ref.current) return;
    const container = ref.current;
    const cards = Array.from(container.children) as HTMLElement[];
    if (cards.length === 0) return;

    const containerCenter = container.scrollLeft + container.offsetWidth / 2;
    let closestIdx = 0;
    let closestDist = Infinity;

    cards.forEach((card, idx) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(containerCenter - cardCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = idx;
      }
    });

    setIndex(closestIdx);
  };

  const scrollRow = (ref: React.RefObject<HTMLDivElement | null>, direction: "left" | "right") => {
    if (ref.current) {
      const scrollAmount = direction === "right" ? 340 : -340;
      ref.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const handleImageUpload = async (key: string, file: File) => {
    const resizedDataUrl = await resizeImageFile(file, 1200);
    if (!resizedDataUrl) return;
    await saveImageToStorage(key, resizedDataUrl);
    setSavedImages((prev) => ({ ...prev, [key]: resizedDataUrl }));
  };

  const handleImageRemove = async (key: string) => {
    await removeImageFromStorage(key);
    setSavedImages((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  // Helper to read card text with user edits
  const getProductField = (product: Product, field: "name" | "label" | "description" | "price"): string => {
    if (cardEdits[product.id] && cardEdits[product.id][field]) {
      return cardEdits[product.id][field]!;
    }
    return product[field];
  };

  // Helper to save card text edits to state and localStorage
  const handleCardTextChange = (id: string, field: "name" | "label" | "description" | "price", value: string) => {
    setCardEdits((prev) => {
      const updated = {
        ...prev,
        [id]: {
          ...(prev[id] || {}),
          [field]: value,
        },
      };
      try {
        localStorage.setItem("ms_sage_card_edits", JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
  };

  // Prevent Enter key in name, label, and price from adding new line
  const handleKeyDownNoEnter = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  };

  // 2. Toggle ORDERS OPEN / CLOSED
  const toggleOrdersOpen = () => {
    setOrdersOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("ms_sage_orders_open", JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const inStockProducts = PRODUCTS.filter((p) => p.category === "in-stock");
  const pastCreationsProducts = PRODUCTS.filter((p) => p.category === "past-creation");

  const filteredProducts = searchQuery.trim()
    ? PRODUCTS.filter((p) => {
        const name = getProductField(p, "name").toLowerCase();
        const label = getProductField(p, "label").toLowerCase();
        const desc = getProductField(p, "description").toLowerCase();
        const query = searchQuery.toLowerCase();
        return name.includes(query) || label.includes(query) || desc.includes(query);
      })
    : PRODUCTS;

  // Helper to get product name using current (edited) card text
  const getItemName = (productId: string): string => {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) return "Crochet piece";
    return getProductField(product, "name");
  };

  // 1. Tapping "Order this" on an in-stock product card adds to basket, shows toast, and opens basket
  const addToBasket = (product: Product) => {
    const currentName = getProductField(product, "name");
    setSelectedItemName(currentName);
    setBasket((prev) => {
      const existingIdx = prev.findIndex((item) => item.productId === product.id);
      let next: Array<{ productId: string; quantity: number }>;
      if (existingIdx >= 0) {
        next = prev.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        next = [...prev, { productId: product.id, quantity: 1 }];
      }
      try {
        localStorage.setItem("ms_sage_basket", JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });

    showToast("Added to basket");
    setCartOpen(true);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setBasket((prev) => {
      const next = prev
        .map((item) => {
          if (item.productId === productId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter((item): item is { productId: string; quantity: number } => item !== null);
      try {
        localStorage.setItem("ms_sage_basket", JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const removeFromBasket = (productId: string) => {
    setBasket((prev) => {
      const next = prev.filter((item) => item.productId !== productId);
      try {
        localStorage.setItem("ms_sage_basket", JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const totalBasketItems = basket.reduce((sum, item) => sum + item.quantity, 0);

  // When someone taps "Order this":
  const handleSelectProductForOrder = (product: Product) => {
    addToBasket(product);
  };

  // WhatsApp send handler
  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!ordersOpen) return;

    if (!orderCustomerName.trim()) {
      setNameError("Please enter your name so we can personalize your order.");
      return;
    }
    setNameError(null);

    const lines: string[] = ["Hi ms.sage creates! I'd like to place an order."];
    lines.push(`Name: ${orderCustomerName.trim()}`);
    lines.push(`Order type: ${orderType}`);

    // 4. In WhatsApp message, replace single "Item:" with "Items:" listing the basket
    // e.g. "Items: 2x Lorem Ipsum Dolor, 1x Lorem Ipsum Dolor". If empty, leave out.
    if (basket.length > 0) {
      const itemsList = basket
        .filter((item) => item.quantity > 0)
        .map((item) => `${item.quantity}x ${getItemName(item.productId)}`)
        .join(", ");
      if (itemsList) {
        lines.push(`Items: ${itemsList}`);
      }
    }

    if (orderNotes.trim()) {
      lines.push(`Notes: ${orderNotes.trim()}`);
    }

    const message = lines.join("\n");
    const encoded = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/254759920324?text=${encoded}`;

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setWhatsappStatusNote("WhatsApp is opening. Tap Send there to finish your order.");
  };

  const heroImage = savedImages["hero_featured"];

  return (
    <div className="min-h-dvh bg-[#F7F1E5] text-[#1F2B20] selection:bg-[#FFF1B5] selection:text-[#1F2B20] flex flex-col items-center pb-20">
      {/* -----------------------------------------------------------------------
          HEADER & NAVIGATION
          ----------------------------------------------------------------------- */}
      <header className="sticky top-3 md:top-4 z-50 w-full max-w-[1200px] px-4 pointer-events-none">
        <div className="relative pointer-events-auto flex flex-col w-full">
          {/* Main Nav Bar */}
          <nav
            aria-label="Main Navigation"
            className="w-full bg-[#FFFFFF] rounded-2xl md:rounded-full px-4 sm:px-8 py-2.5 md:py-3 flex items-center justify-between border border-[#1F2B20]/10 shadow-[0_10px_25px_rgba(31,43,32,0.06)]"
          >
            {/* --- PHONE NAV (<= 768px: md:hidden) --- */}
            <div className="flex md:hidden items-center justify-between w-full">
              {/* Left corner: "ms.sage" wordmark with small light-green "CREATES" pill */}
              <div className="flex items-center gap-2">
                <span className="font-heading text-xl text-[#1F2B20] tracking-[0.02em]">
                  ms.sage
                </span>
                <span className="bg-[#E4EEDC] text-[#1F2B20] text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  CREATES
                </span>
              </div>

              {/* Right: Search icon, Cart icon, Menu hamburger */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search crochet pieces"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#1F2B20] hover:text-[#6F8F5F] hover:bg-[#EEE7D6]/60 transition-colors cursor-pointer"
                >
                  <Search className="w-5 h-5 stroke-[2]" />
                </button>
                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  aria-label={totalBasketItems > 0 ? `Shopping cart, ${totalBasketItems} items` : "Shopping cart"}
                  className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#1F2B20] hover:text-[#6F8F5F] hover:bg-[#EEE7D6]/60 transition-colors cursor-pointer"
                >
                  <ShoppingCart className="w-5 h-5 stroke-[2]" />
                  {totalBasketItems > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#6F8F5F] text-[#FDFCF6] text-[10px] font-black min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center shadow-xs leading-none">
                      {totalBasketItems}
                    </span>
                  )}
                  <span className="sr-only">{totalBasketItems} items in cart</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label="Toggle navigation menu"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#1F2B20] hover:text-[#6F8F5F] hover:bg-[#EEE7D6]/60 transition-colors cursor-pointer ml-1"
                >
                  {mobileMenuOpen ? (
                    <X className="w-5 h-5 stroke-[2.2]" />
                  ) : (
                    <Menu className="w-5 h-5 stroke-[2.2]" />
                  )}
                </button>
              </div>
            </div>

            {/* --- DESKTOP NAV (> 768px: hidden md:flex) --- */}
            <div className="hidden md:flex items-center justify-between w-full">
              {/* ZONE 1 (Left): Links About and Shop */}
              <div className="flex items-center gap-7 lg:gap-10 flex-1 justify-start">
                <a
                  href="#about"
                  onClick={() => setActiveSection("about")}
                  aria-current={activeSection === "about" ? "true" : undefined}
                  className={`relative py-1 text-[16px] md:text-[17px] transition-colors select-none ${
                    activeSection === "about"
                      ? "text-[#6F8F5F] font-extrabold"
                      : "text-[#1F2B20] font-bold hover:text-[#6F8F5F]"
                  }`}
                >
                  <span>About</span>
                  {activeSection === "about" && (
                    <span
                      className="absolute -bottom-1.5 left-0 right-0 h-[3px] bg-[#6F8F5F] rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </a>

                <a
                  href="#shop"
                  onClick={() => setActiveSection("shop")}
                  aria-current={activeSection === "shop" ? "true" : undefined}
                  className={`relative py-1 text-[16px] md:text-[17px] transition-colors select-none ${
                    activeSection === "shop"
                      ? "text-[#6F8F5F] font-extrabold"
                      : "text-[#1F2B20] font-bold hover:text-[#6F8F5F]"
                  }`}
                >
                  <span>Shop</span>
                  {activeSection === "shop" && (
                    <span
                      className="absolute -bottom-1.5 left-0 right-0 h-[3px] bg-[#6F8F5F] rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </a>
              </div>

              {/* ZONE 2 (Center): "ms.sage" wordmark (~40px) + "CREATES" pill */}
              <div className="flex items-center justify-center gap-2.5 px-4 shrink-0 select-none">
                <span className="font-heading text-[38px] lg:text-[40px] leading-none text-[#1F2B20] tracking-[0.02em]">
                  ms.sage
                </span>
                <span className="bg-[#E4EEDC] text-[#1F2B20] text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  CREATES
                </span>
              </div>

              {/* ZONE 3 (Right): Links Info & Order, followed by search and cart icons */}
              <div className="flex items-center gap-7 lg:gap-10 flex-1 justify-end">
                <a
                  href="#info"
                  onClick={() => setActiveSection("info")}
                  aria-current={activeSection === "info" ? "true" : undefined}
                  className={`relative py-1 text-[16px] md:text-[17px] transition-colors select-none ${
                    activeSection === "info"
                      ? "text-[#6F8F5F] font-extrabold"
                      : "text-[#1F2B20] font-bold hover:text-[#6F8F5F]"
                  }`}
                >
                  <span>Info</span>
                  {activeSection === "info" && (
                    <span
                      className="absolute -bottom-1.5 left-0 right-0 h-[3px] bg-[#6F8F5F] rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </a>

                <a
                  href="#order"
                  onClick={() => setActiveSection("order")}
                  aria-current={activeSection === "order" ? "true" : undefined}
                  className={`relative py-1 text-[16px] md:text-[17px] transition-colors select-none ${
                    activeSection === "order"
                      ? "text-[#6F8F5F] font-extrabold"
                      : "text-[#1F2B20] font-bold hover:text-[#6F8F5F]"
                  }`}
                >
                  <span>Order</span>
                  {activeSection === "order" && (
                    <span
                      className="absolute -bottom-1.5 left-0 right-0 h-[3px] bg-[#6F8F5F] rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </a>

                <div className="flex items-center gap-2 sm:gap-2.5 pl-3 border-l border-[#EEE7D6]">
                  <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    aria-label="Search crochet pieces"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[#1F2B20] hover:text-[#6F8F5F] hover:bg-[#EEE7D6]/60 transition-colors cursor-pointer"
                  >
                    <Search className="w-5 h-5 stroke-[2]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCartOpen(true)}
                    aria-label={totalBasketItems > 0 ? `Shopping cart, ${totalBasketItems} items` : "Shopping cart"}
                    className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#1F2B20] hover:text-[#6F8F5F] hover:bg-[#EEE7D6]/60 transition-colors cursor-pointer"
                  >
                    <ShoppingCart className="w-5 h-5 stroke-[2]" />
                    {totalBasketItems > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[#6F8F5F] text-[#FDFCF6] text-[10px] font-black min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center shadow-xs leading-none">
                        {totalBasketItems}
                      </span>
                    )}
                    <span className="sr-only">{totalBasketItems} items in cart</span>
                  </button>
                </div>
              </div>
            </div>
          </nav>

          {/* Mobile Dropdown Menu (on phones when menu is open) */}
          {mobileMenuOpen && (
            <div className="md:hidden w-full bg-[#FFFFFF] border border-[#1F2B20]/10 rounded-2xl py-3 px-4 shadow-lg flex flex-col gap-1 mt-2 animate-in fade-in slide-in-from-top-2 duration-150">
              <a
                href="#about"
                onClick={() => {
                  setActiveSection("about");
                  setMobileMenuOpen(false);
                }}
                aria-current={activeSection === "about" ? "true" : undefined}
                className={`relative py-2 px-3 text-base select-none transition-colors rounded-xl ${
                  activeSection === "about"
                    ? "text-[#6F8F5F] font-extrabold bg-[#EEE7D6]/35"
                    : "text-[#1F2B20] font-bold hover:bg-[#FFF1B5]/60"
                }`}
              >
                <span className="relative inline-block">
                  About
                  {activeSection === "about" && (
                    <span
                      className="absolute -bottom-0.5 left-0 right-0 h-[3px] bg-[#6F8F5F] rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </span>
              </a>

              <a
                href="#shop"
                onClick={() => {
                  setActiveSection("shop");
                  setMobileMenuOpen(false);
                }}
                aria-current={activeSection === "shop" ? "true" : undefined}
                className={`relative py-2 px-3 text-base select-none transition-colors rounded-xl ${
                  activeSection === "shop"
                    ? "text-[#6F8F5F] font-extrabold bg-[#EEE7D6]/35"
                    : "text-[#1F2B20] font-bold hover:bg-[#FFF1B5]/60"
                }`}
              >
                <span className="relative inline-block">
                  Shop
                  {activeSection === "shop" && (
                    <span
                      className="absolute -bottom-0.5 left-0 right-0 h-[3px] bg-[#6F8F5F] rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </span>
              </a>

              <a
                href="#info"
                onClick={() => {
                  setActiveSection("info");
                  setMobileMenuOpen(false);
                }}
                aria-current={activeSection === "info" ? "true" : undefined}
                className={`relative py-2 px-3 text-base select-none transition-colors rounded-xl ${
                  activeSection === "info"
                    ? "text-[#6F8F5F] font-extrabold bg-[#EEE7D6]/35"
                    : "text-[#1F2B20] font-bold hover:bg-[#FFF1B5]/60"
                }`}
              >
                <span className="relative inline-block">
                  Info
                  {activeSection === "info" && (
                    <span
                      className="absolute -bottom-0.5 left-0 right-0 h-[3px] bg-[#6F8F5F] rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </span>
              </a>

              <a
                href="#order"
                onClick={() => {
                  setActiveSection("order");
                  setMobileMenuOpen(false);
                }}
                aria-current={activeSection === "order" ? "true" : undefined}
                className={`relative py-2 px-3 text-base select-none transition-colors rounded-xl ${
                  activeSection === "order"
                    ? "text-[#6F8F5F] font-extrabold bg-[#EEE7D6]/35"
                    : "text-[#1F2B20] font-bold hover:bg-[#FFF1B5]/60"
                }`}
              >
                <span className="relative inline-block">
                  Order
                  {activeSection === "order" && (
                    <span
                      className="absolute -bottom-0.5 left-0 right-0 h-[3px] bg-[#6F8F5F] rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </span>
              </a>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="w-full max-w-[1200px] px-4 md:px-6 pt-10 md:pt-14 flex flex-col gap-20 md:gap-28">
        {/* ---------------------------------------------------------------------
            HERO
            --------------------------------------------------------------------- */}
        <section aria-label="Hero Showcase" className="relative w-full pt-2">
          <div className="relative w-full rounded-[32px] bg-[#EEE7D6] shadow-[0_16px_40px_rgba(31,43,32,0.06)] min-h-[420px] md:min-h-[500px] flex items-center justify-center">
            {heroImage ? (
              <div className="absolute inset-0 rounded-[32px] overflow-hidden">
                <img
                  src={heroImage}
                  alt="Featured crochet showcase"
                  className="w-full h-full object-cover"
                />
                <label className="absolute top-5 right-5 z-20 bg-[#FDFCF6]/90 hover:bg-[#FFF1B5] backdrop-blur-xs text-[#1F2B20] text-xs font-bold px-4 py-2 rounded-full cursor-pointer shadow-md transition-all flex items-center gap-1.5 active:scale-95">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleImageUpload("hero_featured", e.target.files[0]);
                      }
                    }}
                  />
                  <span>Change</span>
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-3.5 cursor-pointer group p-8 rounded-3xl transition-transform hover:scale-105 active:scale-95 mb-14">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleImageUpload("hero_featured", e.target.files[0]);
                    }
                  }}
                />
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#FDFCF6] shadow-sm flex items-center justify-center text-[#6F8F5F] group-hover:bg-[#FFF1B5] transition-colors">
                  <Plus className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.5]" />
                </div>
                <span className="font-heading text-lg sm:text-xl text-[#1F2B20] tracking-[0.02em]">
                  Add featured image
                </span>
              </label>
            )}

            {/* "Make Order" button: fully inside the card, centered, 28px above bottom edge */}
            <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-20">
              <a
                href="#order"
                onClick={() => setActiveSection("order")}
                className="inline-flex items-center justify-center bg-[#6F8F5F] hover:bg-[#5C794E] hover:scale-105 text-[#FDFCF6] font-bold text-base md:text-lg px-8 sm:px-10 py-3.5 sm:py-4 rounded-full shadow-[0_10px_25px_rgba(111,143,95,0.35)] transition-all active:scale-95 whitespace-nowrap"
              >
                Make Order
              </a>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------------
            ABOUT SECTION (id="about")
            --------------------------------------------------------------------- */}
        <section id="about" className="w-full scroll-mt-24 md:scroll-mt-28">
          <div className="bg-[#FDFCF6] rounded-[32px] p-8 md:p-12 shadow-[0_8px_30px_rgba(31,43,32,0.04)] border border-[#EEE7D6]">
            {/* Top row: Display heading and FAQ button */}
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
              <div className="max-w-3xl">
                <div className="text-[13px] font-bold tracking-widest uppercase text-[#6F8F5F] mb-3">
                  About Our Studio
                </div>
                <h2 className="font-heading text-3xl sm:text-4xl md:text-[54px] lg:text-[60px] text-[#1F2B20] leading-[1.05] tracking-[0.02em]">
                  Handcrafted crochet pieces made to move with you.
                </h2>
              </div>

              {/* Small FAQ button */}
              <div className="self-start lg:self-auto shrink-0 pt-2">
                <button
                  type="button"
                  onClick={() => setFaqOpen(true)}
                  className="inline-flex items-center gap-2 bg-[#EEE7D6] hover:bg-[#FFF1B5] text-[#1F2B20] font-bold text-sm px-5 py-2.5 rounded-full transition-colors cursor-pointer shadow-sm active:scale-95"
                >
                  <HelpCircle className="w-4 h-4 text-[#6F8F5F]" />
                  <span>FAQ</span>
                </button>
              </div>
            </div>

            {/* 3 to 4 lines of placeholder text about made-to-order crochet in Nairobi */}
            <div className="text-[18px] text-[#1F2B20]/80 leading-[1.65] max-w-3xl mb-8 space-y-3">
              <p>
                ms.sage creates is an independent slow-fiber practice rooted in Nairobi, Kenya, celebrating the meditative artistry of intentional hand-stitching.
              </p>
              <p>
                Every garment, bucket hat, and checkered bag is made stitch by stitch to celebrate individual expression and enduring comfort. Rather than mass-producing, we craft small-batch drops and made-to-measure pieces designed to seamlessly fit your daily lifestyle.
              </p>
            </div>

            {/* Pickup Info Strip */}
            <div className="bg-[#EEE7D6] rounded-[20px] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#FDFCF6] flex items-center justify-center text-[#6F8F5F] shrink-0 shadow-xs">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[16px] font-bold text-[#1F2B20]">
                    Based in Nairobi, Kenya.
                  </p>
                  <p className="text-[14px] font-semibold text-[#1F2B20]/80">
                    Pick up and delivery available through Pick Up Mtaani.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-[#6F8F5F] bg-[#FDFCF6] px-3 py-1 rounded-full uppercase tracking-wider">
                  Pick Up Mtaani
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------------
            SHOP SECTION (id="shop")
            4. Mobile carousel (screens <= 768px):
               - 80% screen width cards (snap-center)
               - next card peeks from right
               - dot indicators showing active slide
               - arrow buttons hidden on phones
               - desktop keeps arrow buttons and standard grid/snap-start
            5. Lorem Ipsum placeholder text for all cards & contenteditable
            --------------------------------------------------------------------- */}
        <section
          id="shop"
          className="w-full scroll-mt-24 md:scroll-mt-28 flex flex-col gap-14"
        >
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-heading text-4xl sm:text-[44px] text-[#1F2B20] leading-[1.1] mb-3 tracking-[0.02em]">
              Fresh Off the Hook
            </h2>
            <p className="text-[18px] text-[#1F2B20]/80 leading-[1.6]">
              Explore favorite drops and custom staples. All prices listed in KES.
            </p>
          </div>

          {/* ROW 1: IN STOCK */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#6F8F5F]" />
                <h3 className="font-heading text-2xl text-[#1F2B20] tracking-[0.02em]">
                  In Stock
                </h3>
                <span className="text-xs font-bold uppercase tracking-wider text-[#6F8F5F] bg-[#EEE7D6] px-2.5 py-0.5 rounded-full">
                  Ready to Dispatch
                </span>
              </div>

              {/* Round arrow sideways scroll buttons (desktop only: hidden on phones) */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollRow(inStockScrollRef, "left")}
                  aria-label="Scroll left in stock pieces"
                  className="w-10 h-10 rounded-full bg-[#FDFCF6] hover:bg-[#FFF1B5] border border-[#EEE7D6] flex items-center justify-center text-[#1F2B20] shadow-sm transition-colors cursor-pointer active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRow(inStockScrollRef, "right")}
                  aria-label="Scroll right in stock pieces"
                  className="w-10 h-10 rounded-full bg-[#FDFCF6] hover:bg-[#FFF1B5] border border-[#EEE7D6] flex items-center justify-center text-[#1F2B20] shadow-sm transition-colors cursor-pointer active:scale-95"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* In Stock Container: 80% screen width cards on mobile with snap-center */}
            <div
              ref={inStockScrollRef}
              onScroll={() => handleCarouselScroll(inStockScrollRef, setInStockIndex)}
              className="flex gap-4 md:gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory no-scrollbar pb-4 pt-1 px-[10vw] md:px-1"
            >
              {inStockProducts.map((product) => {
                const photoUrl = savedImages[product.id] || product.image;
                const name = getProductField(product, "name");
                const label = getProductField(product, "label");
                const description = getProductField(product, "description");
                const price = getProductField(product, "price");

                return (
                  <article
                    key={product.id}
                    className="snap-center md:snap-start shrink-0 w-[80vw] max-w-[320px] md:w-[285px] bg-[#FDFCF6] rounded-[20px] p-4 flex flex-col justify-between shadow-[0_8px_24px_rgba(31,43,32,0.04)] border border-[#EEE7D6] transition-transform hover:-translate-y-1 duration-200"
                  >
                    <div>
                      <ProductImageArea
                        product={product}
                        photoUrl={photoUrl}
                        onUpload={(e) => {
                          if (e.target.files?.[0]) {
                            handleImageUpload(product.id, e.target.files[0]);
                          }
                        }}
                        onRemove={() => handleImageRemove(product.id)}
                      />

                      {/* 5. Editable Label */}
                      <div
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onKeyDown={handleKeyDownNoEnter}
                        onBlur={(e) => handleCardTextChange(product.id, "label", e.currentTarget.textContent || "")}
                        title="Click to edit label"
                        className="text-[13px] font-bold uppercase tracking-wider text-[#6F8F5F] mb-1 outline-none hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 rounded px-1 -mx-1 transition-colors cursor-text"
                      >
                        {label}
                      </div>

                      {/* 5. Editable Product Name */}
                      <h4
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onKeyDown={handleKeyDownNoEnter}
                        onBlur={(e) => handleCardTextChange(product.id, "name", e.currentTarget.textContent || "")}
                        title="Click to edit name"
                        className="font-heading text-xl text-[#1F2B20] leading-snug mb-1.5 tracking-[0.02em] outline-none hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 rounded px-1 -mx-1 transition-colors cursor-text"
                      >
                        {name}
                      </h4>

                      {/* 5. Editable Description */}
                      <p
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onBlur={(e) => handleCardTextChange(product.id, "description", e.currentTarget.textContent || "")}
                        title="Click to edit description"
                        className="text-[#1F2B20]/75 text-sm line-clamp-2 mb-3 outline-none hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 rounded px-1 -mx-1 transition-colors cursor-text"
                      >
                        {description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#EEE7D6]/80 mt-2">
                      {/* 5. Editable Price */}
                      <span
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onKeyDown={handleKeyDownNoEnter}
                        onBlur={(e) => handleCardTextChange(product.id, "price", e.currentTarget.textContent || "")}
                        title="Click to edit price"
                        className="text-[#E0764A] font-bold text-lg outline-none hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 rounded px-1 -mx-1 transition-colors cursor-text"
                      >
                        {price}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectProductForOrder(product)}
                        className="bg-[#6F8F5F] hover:bg-[#5C794E] text-[#FDFCF6] text-xs font-bold px-4 py-2 rounded-full transition-colors cursor-pointer active:scale-95 shadow-xs"
                      >
                        Order this
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* 4. Mobile dot indicators under In Stock carousel */}
            <div className="flex md:hidden items-center justify-center gap-2 pt-1 pb-2" aria-label="In Stock carousel dots">
              {inStockProducts.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (inStockScrollRef.current) {
                      const children = inStockScrollRef.current.children;
                      if (children[idx]) {
                        (children[idx] as HTMLElement).scrollIntoView({
                          behavior: "smooth",
                          inline: "center",
                          block: "nearest",
                        });
                      }
                    }
                  }}
                  aria-label={`Go to in stock item ${idx + 1}`}
                  className={`transition-all rounded-full ${
                    inStockIndex === idx
                      ? "w-6 h-2 bg-[#6F8F5F]"
                      : "w-2 h-2 bg-[#EEE7D6] hover:bg-[#6F8F5F]/50"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* ROW 2: PAST CREATIONS */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E0764A]" />
                <h3 className="font-heading text-2xl text-[#1F2B20] tracking-[0.02em]">
                  Past Creations
                </h3>
                <span className="text-xs font-bold uppercase tracking-wider text-[#1F2B20]/70 bg-[#EEE7D6] px-2.5 py-0.5 rounded-full">
                  Archive &amp; Inspo
                </span>
              </div>

              {/* Round arrow sideways scroll buttons (desktop only: hidden on phones) */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollRow(pastCreationsScrollRef, "left")}
                  aria-label="Scroll left past creations"
                  className="w-10 h-10 rounded-full bg-[#FDFCF6] hover:bg-[#FFF1B5] border border-[#EEE7D6] flex items-center justify-center text-[#1F2B20] shadow-sm transition-colors cursor-pointer active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRow(pastCreationsScrollRef, "right")}
                  aria-label="Scroll right past creations"
                  className="w-10 h-10 rounded-full bg-[#FDFCF6] hover:bg-[#FFF1B5] border border-[#EEE7D6] flex items-center justify-center text-[#1F2B20] shadow-sm transition-colors cursor-pointer active:scale-95"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Past Creations Container: 80% screen width cards on mobile with snap-center */}
            <div
              ref={pastCreationsScrollRef}
              onScroll={() => handleCarouselScroll(pastCreationsScrollRef, setPastCreationsIndex)}
              className="flex gap-4 md:gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory no-scrollbar pb-4 pt-1 px-[10vw] md:px-1"
            >
              {pastCreationsProducts.map((product) => {
                const photoUrl = savedImages[product.id] || product.image;
                const name = getProductField(product, "name");
                const label = getProductField(product, "label");
                const description = getProductField(product, "description");
                const price = getProductField(product, "price");

                return (
                  <article
                    key={product.id}
                    className="snap-center md:snap-start shrink-0 w-[80vw] max-w-[320px] md:w-[285px] bg-[#FDFCF6] rounded-[20px] p-4 flex flex-col justify-between shadow-[0_8px_24px_rgba(31,43,32,0.04)] border border-[#EEE7D6] transition-transform hover:-translate-y-1 duration-200 relative"
                  >
                    <div>
                      <ProductImageArea
                        product={product}
                        photoUrl={photoUrl}
                        onUpload={(e) => {
                          if (e.target.files?.[0]) {
                            handleImageUpload(product.id, e.target.files[0]);
                          }
                        }}
                        onRemove={() => handleImageRemove(product.id)}
                      />

                      {/* 5. Editable Label */}
                      <div
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onKeyDown={handleKeyDownNoEnter}
                        onBlur={(e) => handleCardTextChange(product.id, "label", e.currentTarget.textContent || "")}
                        title="Click to edit label"
                        className="text-[13px] font-bold uppercase tracking-wider text-[#6F8F5F] mb-1 outline-none hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 rounded px-1 -mx-1 transition-colors cursor-text"
                      >
                        {label}
                      </div>

                      {/* 5. Editable Product Name */}
                      <h4
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onKeyDown={handleKeyDownNoEnter}
                        onBlur={(e) => handleCardTextChange(product.id, "name", e.currentTarget.textContent || "")}
                        title="Click to edit name"
                        className="font-heading text-xl text-[#1F2B20] leading-snug mb-1.5 tracking-[0.02em] outline-none hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 rounded px-1 -mx-1 transition-colors cursor-text"
                      >
                        {name}
                      </h4>

                      {/* 5. Editable Description */}
                      <p
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onBlur={(e) => handleCardTextChange(product.id, "description", e.currentTarget.textContent || "")}
                        title="Click to edit description"
                        className="text-[#1F2B20]/75 text-sm line-clamp-2 mb-3 outline-none hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 rounded px-1 -mx-1 transition-colors cursor-text"
                      >
                        {description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#EEE7D6]/80 mt-2">
                      {/* 5. Editable Price */}
                      <span
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onKeyDown={handleKeyDownNoEnter}
                        onBlur={(e) => handleCardTextChange(product.id, "price", e.currentTarget.textContent || "")}
                        title="Click to edit price"
                        className="text-[#E0764A] font-bold text-lg outline-none hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 rounded px-1 -mx-1 transition-colors cursor-text"
                      >
                        {price}
                      </span>
                      <span className="bg-[#FFF1B5] text-[#1F2B20] text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-xs">
                        Sold
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* 4. Mobile dot indicators under Past Creations carousel */}
            <div className="flex md:hidden items-center justify-center gap-2 pt-1 pb-2" aria-label="Past Creations carousel dots">
              {pastCreationsProducts.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (pastCreationsScrollRef.current) {
                      const children = pastCreationsScrollRef.current.children;
                      if (children[idx]) {
                        (children[idx] as HTMLElement).scrollIntoView({
                          behavior: "smooth",
                          inline: "center",
                          block: "nearest",
                        });
                      }
                    }
                  }}
                  aria-label={`Go to past creation item ${idx + 1}`}
                  className={`transition-all rounded-full ${
                    pastCreationsIndex === idx
                      ? "w-6 h-2 bg-[#6F8F5F]"
                      : "w-2 h-2 bg-[#EEE7D6] hover:bg-[#6F8F5F]/50"
                  }`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------------
            HOW TO GET YOUR PIECE (id="info")
            --------------------------------------------------------------------- */}
        <section id="info" className="w-full scroll-mt-24 md:scroll-mt-28">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="text-[13px] font-bold tracking-widest uppercase text-[#6F8F5F] mb-2">
              The Process
            </div>
            <h2 className="font-heading text-4xl sm:text-[44px] text-[#1F2B20] leading-[1.1] mb-3 tracking-[0.02em]">
              How to Get Your Piece
            </h2>
            <p className="text-[18px] text-[#1F2B20]/80 leading-[1.6]">
              Simple, transparent steps to bring your crochet dreams into reality.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* STEP 1 */}
            <div className="bg-[#FDFCF6] rounded-[20px] p-6 sm:p-7 flex flex-col justify-between shadow-[0_8px_24px_rgba(31,43,32,0.04)] border border-[#EEE7D6] hover:border-[#6F8F5F]/40 transition-colors">
              <div>
                <div className="text-[13px] font-bold tracking-widest uppercase text-[#6F8F5F] mb-3">
                  STEP 1
                </div>
                <h3 className="font-heading text-2xl text-[#1F2B20] mb-3 leading-snug tracking-[0.02em]">
                  Pick or Pitch
                </h3>
                <p className="text-[16px] text-[#1F2B20]/80 leading-relaxed">
                  Choose from our Featured Work or share a dream design or reference image. I'll let you know if I can bring it to life.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#EEE7D6]/70 flex items-center justify-between text-xs text-[#1F2B20]/60 font-semibold">
                <span>Inspo &amp; Sketches</span>
                <span className="w-2 h-2 rounded-full bg-[#FFF1B5]" />
              </div>
            </div>

            {/* STEP 2 */}
            <div className="bg-[#FDFCF6] rounded-[20px] p-6 sm:p-7 flex flex-col justify-between shadow-[0_8px_24px_rgba(31,43,32,0.04)] border border-[#EEE7D6] hover:border-[#6F8F5F]/40 transition-colors">
              <div>
                <div className="text-[13px] font-bold tracking-widest uppercase text-[#6F8F5F] mb-3">
                  STEP 2
                </div>
                <h3 className="font-heading text-2xl text-[#1F2B20] mb-3 leading-snug tracking-[0.02em]">
                  Share Details &amp; Fit
                </h3>
                <p className="text-[16px] text-[#1F2B20]/80 leading-relaxed">
                  Tap Make Order, choose from the available yarn colors, note any favorites, and share your sizing details.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#EEE7D6]/70 flex items-center justify-between text-xs text-[#1F2B20]/60 font-semibold">
                <span>Custom Sizing</span>
                <span className="w-2 h-2 rounded-full bg-[#F7B8CB]" />
              </div>
            </div>

            {/* STEP 3 */}
            <div className="bg-[#FDFCF6] rounded-[20px] p-6 sm:p-7 flex flex-col justify-between shadow-[0_8px_24px_rgba(31,43,32,0.04)] border border-[#EEE7D6] hover:border-[#6F8F5F]/40 transition-colors">
              <div>
                <div className="text-[13px] font-bold tracking-widest uppercase text-[#6F8F5F] mb-3">
                  STEP 3
                </div>
                <h3 className="font-heading text-2xl text-[#1F2B20] mb-3 leading-snug tracking-[0.02em]">
                  Secure Your Slot
                </h3>
                <p className="text-[16px] text-[#1F2B20]/80 leading-relaxed">
                  Confirm your order with a deposit so we can reserve your yarn and start crafting.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#EEE7D6]/70 flex items-center justify-between text-xs text-[#1F2B20]/60 font-semibold">
                <span>Deposit Confirms Slot</span>
                <span className="w-2 h-2 rounded-full bg-[#6F8F5F]" />
              </div>
            </div>

            {/* STEP 4 */}
            <div className="bg-[#FDFCF6] rounded-[20px] p-6 sm:p-7 flex flex-col justify-between shadow-[0_8px_24px_rgba(31,43,32,0.04)] border border-[#EEE7D6] hover:border-[#6F8F5F]/40 transition-colors">
              <div>
                <div className="text-[13px] font-bold tracking-widest uppercase text-[#6F8F5F] mb-3">
                  STEP 4
                </div>
                <h3 className="font-heading text-2xl text-[#1F2B20] mb-3 leading-snug tracking-[0.02em]">
                  Made with Care &amp; Delivered
                </h3>
                <p className="text-[16px] text-[#1F2B20]/80 leading-relaxed">
                  Watch your piece come to life with progress updates, then get it delivered right to your door.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#EEE7D6]/70 flex items-center justify-between text-xs text-[#1F2B20]/60 font-semibold">
                <span>Pick Up Mtaani</span>
                <span className="w-2 h-2 rounded-full bg-[#E0764A]" />
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------------
            CREATE ORDER (id="order")
            2. "ORDERS OPEN" / "ORDERS CLOSED" clickable toggle
            3. Order type dropdown full width with font-size 16px and 44px+ padding-right
            6. Delivery sentence: "Delivery and pick up through the Pick Up Mtaani nearest to you."
            --------------------------------------------------------------------- */}
        <section id="order" className="w-full scroll-mt-24 md:scroll-mt-28">
          <div className="w-full bg-[#1F2B20] text-[#FDFCF6] rounded-[32px] p-8 sm:p-10 md:p-14 shadow-[0_20px_50px_rgba(31,43,32,0.18)]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Left Side */}
              <div className="lg:col-span-5 flex flex-col items-start">
                {/* 2. Clickable Orders Open / Closed Pill */}
                <button
                  type="button"
                  onClick={toggleOrdersOpen}
                  title="Click to toggle order status"
                  aria-label={`Orders are currently ${ordersOpen ? "open" : "closed"}. Click to toggle.`}
                  className={`${
                    ordersOpen
                      ? "bg-[#FFF1B5] text-[#1F2B20] hover:bg-[#FFF1B5]/85"
                      : "bg-[#F7B8CB] text-[#1F2B20] hover:bg-[#F7B8CB]/85"
                  } text-xs font-black tracking-widest uppercase px-3.5 py-1 rounded-full mb-6 shadow-sm transition-all cursor-pointer active:scale-95 select-none`}
                >
                  {ordersOpen ? "ORDERS OPEN" : "ORDERS CLOSED"}
                </button>

                <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl text-[#FDFCF6] leading-[1.1] mb-5 tracking-[0.02em]">
                  Let's Create Something Cute
                </h2>

                <p className="text-[18px] text-[#EEE7D6]/90 leading-[1.6] mb-8">
                  Ready to place your order or ask a question? Send a quick message below.
                </p>

                {/* 6. Updated Delivery Sentence */}
                <div className="bg-[#172118] border border-[#2c3d2e] rounded-2xl p-4 w-full flex flex-col gap-2.5 text-sm text-[#EEE7D6]/80">
                  <div className="flex items-center gap-2.5">
                    <Heart className="w-4 h-4 text-[#F7B8CB] shrink-0" />
                    <span>Average crafting lead time: 7 to 21 days</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Truck className="w-4 h-4 text-[#FFF1B5] shrink-0" />
                    <span>Delivery and pick up through the Pick Up Mtaani nearest to you.</span>
                  </div>
                </div>
              </div>

              {/* Right Side: Cream Form Card */}
              <div className="lg:col-span-7">
                <div className="bg-[#FDFCF6] text-[#1F2B20] rounded-[20px] p-6 sm:p-8 md:p-9 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-heading text-2xl sm:text-3xl text-[#1F2B20] tracking-[0.02em]">
                      Let's make your piece
                    </h3>
                    {!ordersOpen && (
                      <span className="text-xs font-bold uppercase tracking-wider text-[#E0764A] bg-[#EEE7D6] px-2.5 py-1 rounded-full">
                        Form Paused
                      </span>
                    )}
                  </div>

                  <form
                    onSubmit={handleOrderSubmit}
                    className={`space-y-5 transition-opacity duration-200 ${
                      !ordersOpen ? "opacity-60" : ""
                    }`}
                    noValidate
                  >
                    {/* Customer Name */}
                    <div>
                      <label
                        htmlFor="customerName"
                        className="block text-[13px] font-bold uppercase tracking-wider text-[#6F8F5F] mb-1.5"
                      >
                        Customer Name <span className="text-[#E0764A]">*</span>
                      </label>
                      <input
                        id="customerName"
                        type="text"
                        disabled={!ordersOpen}
                        value={orderCustomerName}
                        onChange={(e) => {
                          setOrderCustomerName(e.target.value);
                          if (nameError) setNameError(null);
                        }}
                        placeholder="e.g. Amani Mwangi"
                        className={`w-full bg-[#F7F1E5] border rounded-xl px-4 py-3 text-base text-[#1F2B20] placeholder:text-[#1F2B20]/40 focus:outline-none transition-all disabled:cursor-not-allowed ${
                          nameError
                            ? "border-[#E0764A] ring-1 ring-[#E0764A]"
                            : "border-[#EEE7D6] focus:ring-2 focus:ring-[#6F8F5F]"
                        }`}
                      />
                      {nameError && (
                        <p className="text-xs text-[#E0764A] font-bold mt-1.5">
                          {nameError}
                        </p>
                      )}
                    </div>

                    {/* 3. Order Type: full width, 16px font, at least 44px right padding */}
                    <div>
                      <label
                        htmlFor="orderType"
                        className="block text-[13px] font-bold uppercase tracking-wider text-[#6F8F5F] mb-1.5"
                      >
                        Order Type
                      </label>
                      <div className="relative w-full">
                        <select
                          id="orderType"
                          value={orderType}
                          disabled={!ordersOpen}
                          onChange={(e) => setOrderType(e.target.value)}
                          style={{ fontSize: "16px", paddingRight: "48px" }}
                          className="w-full bg-[#F7F1E5] border border-[#EEE7D6] rounded-xl pl-4 py-3 text-[16px] text-[#1F2B20] focus:outline-none focus:ring-2 focus:ring-[#6F8F5F] transition-all appearance-none cursor-pointer disabled:cursor-not-allowed"
                        >
                          <option value="In-stock piece">In-stock piece</option>
                          <option value="Custom order (my own idea)">
                            Custom order (my own idea)
                          </option>
                          <option value="Other">Other</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-[#1F2B20]">
                          <svg className="fill-current h-4 w-4" viewBox="0 0 20 20">
                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                          </svg>
                        </div>
                      </div>

                      {/* Display basket items when user has pieces in basket */}
                      {basket.length > 0 && orderType === "In-stock piece" ? (
                        <div className="mt-2 text-xs bg-[#E4EEDC] text-[#1F2B20] px-3.5 py-2 rounded-lg flex items-center justify-between font-medium gap-2">
                          <span className="truncate">
                            Basket items: <strong>{basket.map((i) => `${i.quantity}x ${getItemName(i.productId)}`).join(", ")}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => setCartOpen(true)}
                            className="text-xs text-[#6F8F5F] font-bold hover:underline shrink-0 cursor-pointer"
                          >
                            View basket
                          </button>
                        </div>
                      ) : selectedItemName && orderType === "In-stock piece" ? (
                        <div className="mt-2 text-xs bg-[#E4EEDC] text-[#1F2B20] px-3.5 py-1.5 rounded-lg flex items-center justify-between font-medium">
                          <span>
                            Selected item: <strong>{selectedItemName}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedItemName(null)}
                            className="text-xs text-[#E0764A] font-bold hover:underline ml-2 cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {/* Notes / preferences */}
                    <div>
                      <label
                        htmlFor="orderNotes"
                        className="block text-[13px] font-bold uppercase tracking-wider text-[#6F8F5F] mb-1.5"
                      >
                        Notes / Preferences
                      </label>
                      <textarea
                        id="orderNotes"
                        rows={4}
                        disabled={!ordersOpen}
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="Share any ideas, measurements, deadlines, and other preferences..."
                        className="w-full bg-[#F7F1E5] border border-[#EEE7D6] rounded-xl p-4 text-base text-[#1F2B20] placeholder:text-[#1F2B20]/40 focus:outline-none focus:ring-2 focus:ring-[#6F8F5F] transition-all resize-none disabled:cursor-not-allowed"
                      />
                      <p className="text-xs text-[#1F2B20]/70 mt-1.5 font-medium">
                        Have an inspiration photo? You can send it in WhatsApp after you tap send.
                      </p>
                    </div>

                    {/* 2. Sage button disabled when orders are closed */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={!ordersOpen}
                        className={`w-full font-bold text-base py-3.5 px-6 rounded-full transition-all shadow-md flex items-center justify-center gap-2 ${
                          ordersOpen
                            ? "bg-[#6F8F5F] hover:bg-[#5C794E] text-[#FDFCF6] cursor-pointer active:scale-95"
                            : "bg-[#6F8F5F]/40 text-[#FDFCF6]/80 cursor-not-allowed"
                        }`}
                      >
                        {ordersOpen && <Send className="w-4 h-4" />}
                        <span>
                          {ordersOpen
                            ? "Send order on WhatsApp"
                            : "Orders are currently closed"}
                        </span>
                      </button>

                      {ordersOpen && whatsappStatusNote ? (
                        <p className="text-center text-xs text-[#6F8F5F] font-bold mt-2.5">
                          {whatsappStatusNote}
                        </p>
                      ) : (
                        <p className="text-center text-xs text-[#1F2B20]/60 mt-2 font-medium">
                          {ordersOpen
                            ? "Opens in WhatsApp with your details pre-filled."
                            : "New orders are temporarily paused. Check back soon!"}
                        </p>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* -----------------------------------------------------------------------
          FOOTER
          ----------------------------------------------------------------------- */}
      <footer className="w-full border-t border-[#EEE7D6] bg-[#F7F1E5] mt-24 py-14">
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 flex flex-col items-center text-center gap-8">
          <div className="flex items-center gap-2">
            <span className="font-heading text-3xl sm:text-4xl text-[#1F2B20] tracking-[0.02em]">
              ms.sage
            </span>
            <span className="bg-[#E4EEDC] text-[#1F2B20] text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              creates
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm font-bold text-[#1F2B20]">
            <button
              type="button"
              onClick={() => setPolicyOpen("privacy")}
              className="hover:text-[#6F8F5F] transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span className="text-[#1F2B20]/30 select-none">·</span>
            <button
              type="button"
              onClick={() => setFaqOpen(true)}
              className="hover:text-[#6F8F5F] transition-colors cursor-pointer"
            >
              FAQ
            </button>
            <span className="text-[#1F2B20]/30 select-none">·</span>
            <button
              type="button"
              onClick={() => setPolicyOpen("delivery")}
              className="hover:text-[#6F8F5F] transition-colors cursor-pointer"
            >
              Delivery &amp; Pickup
            </button>
          </div>

          {/* Social links */}
          <div className="flex items-center gap-4">
            <a
              href="https://www.instagram.com/ms.sage_creates"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram @ms.sage_creates"
              className="w-10 h-10 rounded-full bg-[#FDFCF6] hover:bg-[#FFF1B5] border border-[#EEE7D6] flex items-center justify-center text-[#1F2B20] transition-colors shadow-xs"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://www.tiktok.com/@ms.sage_creates"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok @ms.sage_creates"
              className="w-10 h-10 rounded-full bg-[#FDFCF6] hover:bg-[#FFF1B5] border border-[#EEE7D6] flex items-center justify-center text-[#1F2B20] transition-colors shadow-xs"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-2.882 2.766 2.89 2.89 0 0 1 2.896-2.896c.394 0 .768.082 1.11.228V9.378a6.376 6.376 0 0 0-1.11-.098 6.335 6.335 0 0 0-6.338 6.338 6.335 6.335 0 0 0 6.338 6.338 6.335 6.335 0 0 0 6.338-6.338V8.784a8.212 8.212 0 0 0 4.759 1.487V6.828c-.347-.02-.693-.068-1.002-.142z" />
              </svg>
            </a>
            <span className="text-sm font-bold text-[#1F2B20]/80">
              @ms.sage_creates
            </span>
          </div>

          <div className="text-xs text-[#1F2B20]/60 font-medium">
            © 2026 ms.sage creates. Handcrafted with care in Nairobi, Kenya.
          </div>
        </div>
      </footer>

      {/* -----------------------------------------------------------------------
          INTERACTIVE OVERLAYS
          ----------------------------------------------------------------------- */}

      {/* Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-[#1F2B20]/60 backdrop-blur-xs flex items-start justify-center pt-24 px-4 min-h-dvh overflow-y-auto">
          <div className="bg-[#FDFCF6] rounded-[24px] p-6 max-w-lg w-full shadow-2xl border border-[#EEE7D6] relative animate-in fade-in duration-150 my-auto">
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#EEE7D6] flex items-center justify-center text-[#1F2B20] hover:bg-[#FFF1B5] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-heading text-2xl text-[#1F2B20] mb-4 tracking-[0.02em]">
              Search ms.sage pieces
            </h3>
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-[#1F2B20]/50 absolute left-3.5 top-3.5" />
              <input
                type="text"
                autoFocus
                placeholder="Search by name, label, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F7F1E5] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1F2B20] focus:outline-none focus:ring-2 focus:ring-[#6F8F5F]"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {filteredProducts.length === 0 ? (
                <p className="text-sm text-[#1F2B20]/60 py-4 text-center">
                  No matching crochet pieces found.
                </p>
              ) : (
                filteredProducts.map((item) => {
                  const currentName = getProductField(item, "name");
                  const currentLabel = getProductField(item, "label");
                  const currentPrice = getProductField(item, "price");

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#EEE7D6]/50 transition-colors"
                    >
                      <div>
                        <div className="text-xs font-bold text-[#6F8F5F] uppercase">
                          {currentLabel}
                        </div>
                        <div className="font-heading text-sm text-[#1F2B20] tracking-[0.02em]">
                          {currentName}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#E0764A] font-bold text-sm">
                          {currentPrice}
                        </span>
                        {item.category === "in-stock" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchOpen(false);
                              handleSelectProductForOrder(item);
                            }}
                            className="text-xs bg-[#6F8F5F] text-white font-bold px-3 py-1 rounded-full hover:bg-[#5C794E] cursor-pointer"
                          >
                            Order
                          </button>
                        ) : (
                          <span className="text-xs bg-[#FFF1B5] text-[#1F2B20] font-bold px-2 py-0.5 rounded-full">
                            Sold
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification: "Added to basket" */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 md:top-24 left-1/2 -translate-x-1/2 z-[70] bg-[#1F2B20] text-[#FDFCF6] text-sm font-bold px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2.5 border border-[#EEE7D6]/20 animate-in fade-in slide-in-from-top-2 duration-150 pointer-events-none"
        >
          <span className="w-2 h-2 rounded-full bg-[#6F8F5F] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Order Basket: Side drawer on desktop, bottom sheet on phones */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#1F2B20]/60 backdrop-blur-xs transition-opacity"
            onClick={() => setCartOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer / Bottom Sheet */}
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Order basket"
            className="fixed z-50 bg-[#FDFCF6] flex flex-col shadow-2xl transition-all duration-300
              /* Phone: bottom sheet */
              inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[28px] border-t border-[#EEE7D6]
              /* Desktop: right-side drawer */
              md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-full md:w-[420px] md:rounded-l-[28px] md:rounded-tr-none md:border-l md:border-t-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EEE7D6] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#EEE7D6] text-[#6F8F5F] flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <h3 className="font-heading text-xl text-[#1F2B20] tracking-[0.02em]">
                  Order Basket
                </h3>
                {totalBasketItems > 0 && (
                  <span className="bg-[#E4EEDC] text-[#1F2B20] text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {totalBasketItems} {totalBasketItems === 1 ? "item" : "items"}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="Close basket"
                className="w-8 h-8 rounded-full bg-[#EEE7D6] hover:bg-[#FFF1B5] text-[#1F2B20] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {basket.length === 0 ? (
                <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center py-10 px-2">
                  <div className="w-14 h-14 rounded-full bg-[#EEE7D6] text-[#6F8F5F] flex items-center justify-center mb-4">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <p className="font-heading text-xl text-[#1F2B20] mb-2 tracking-[0.02em]">
                    Your basket is empty.
                  </p>
                  <p className="text-sm text-[#1F2B20]/75 max-w-xs mb-6">
                    Handmade crochet pieces in limited drops. Find something special fresh off the hook.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCartOpen(false);
                      setActiveSection("shop");
                      const shopSection = document.getElementById("shop");
                      if (shopSection) {
                        shopSection.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className="bg-[#6F8F5F] hover:bg-[#5C794E] text-[#FDFCF6] font-bold text-sm px-6 py-3 rounded-full transition-colors cursor-pointer shadow-xs active:scale-95"
                  >
                    Browse the shop
                  </button>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-[#EEE7D6]">
                  {basket.map((item) => {
                    const product = PRODUCTS.find((p) => p.id === item.productId);
                    const currentName = product ? getProductField(product, "name") : "Crochet piece";
                    const photoUrl = product ? savedImages[product.id] : undefined;

                    return (
                      <div
                        key={item.productId}
                        className="py-4 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={currentName}
                              className="w-12 h-14 rounded-xl object-cover shrink-0 bg-[#EEE7D6]"
                            />
                          ) : (
                            <div className="w-12 h-14 rounded-xl bg-[#EEE7D6] flex items-center justify-center text-[#6F8F5F] shrink-0">
                              <ShoppingCart className="w-5 h-5 opacity-60" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-heading text-base text-[#1F2B20] truncate tracking-[0.02em]">
                              {currentName}
                            </h4>
                            <button
                              type="button"
                              onClick={() => removeFromBasket(item.productId)}
                              className="text-xs text-[#E0764A] hover:underline font-semibold cursor-pointer mt-1 flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>

                        {/* Quantity control (- and +) */}
                        <div className="flex items-center bg-[#EEE7D6] rounded-full p-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, -1)}
                            aria-label={`Decrease quantity of ${currentName}`}
                            className="w-7 h-7 rounded-full bg-[#FDFCF6] hover:bg-[#FFF1B5] text-[#1F2B20] flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-[#1F2B20]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, 1)}
                            aria-label={`Increase quantity of ${currentName}`}
                            className="w-7 h-7 rounded-full bg-[#FDFCF6] hover:bg-[#FFF1B5] text-[#1F2B20] flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom button: sage button "Continue to order" */}
            {basket.length > 0 && (
              <div className="p-5 border-t border-[#EEE7D6] bg-[#FDFCF6] shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCartOpen(false);
                    setOrderType("In-stock piece");
                    setActiveSection("order");
                    const orderSection = document.getElementById("order");
                    if (orderSection) {
                      orderSection.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  className="w-full bg-[#6F8F5F] hover:bg-[#5C794E] text-[#FDFCF6] font-bold text-base py-3.5 px-6 rounded-full text-center transition-colors cursor-pointer shadow-md active:scale-95"
                >
                  Continue to order
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* 1. FAQ Dialog: max-height: 85dvh and overflow-y: auto */}
      {faqOpen && (
        <div className="fixed inset-0 z-50 bg-[#1F2B20]/60 backdrop-blur-xs flex items-center justify-center p-4 min-h-dvh overflow-y-auto">
          <div className="bg-[#FDFCF6] rounded-[24px] p-6 sm:p-7 max-w-lg w-full max-h-[85dvh] overflow-y-auto shadow-2xl border border-[#EEE7D6] relative my-auto">
            <button
              type="button"
              onClick={() => setFaqOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#EEE7D6] flex items-center justify-center text-[#1F2B20] hover:bg-[#FFF1B5] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-heading text-2xl text-[#1F2B20] mb-5 tracking-[0.02em]">
              Frequently Asked Questions
            </h3>
            <div className="space-y-4 text-left text-sm text-[#1F2B20]">
              <div className="bg-[#F7F1E5] p-4 rounded-xl">
                <div className="font-bold text-base mb-1 text-[#1F2B20]">
                  How long does a custom order take?
                </div>
                <div className="text-[#1F2B20]/80">
                  Made-to-measure pieces usually take between 7 to 21 days depending on design complexity and current queue. In-stock drops dispatch within 24–48 hours.
                </div>
              </div>
              <div className="bg-[#F7F1E5] p-4 rounded-xl">
                <div className="font-bold text-base mb-1 text-[#1F2B20]">
                  How does Pick Up Mtaani work?
                </div>
                <div className="text-[#1F2B20]/80">
                  Pick Up Mtaani allows you to collect your package from hundreds of secure pickup agent locations across Nairobi and neighboring towns at affordable rates. Delivery is available through Pick Up Mtaani only.
                </div>
              </div>
              <div className="bg-[#F7F1E5] p-4 rounded-xl">
                <div className="font-bold text-base mb-1 text-[#1F2B20]">
                  How do I care for my crochet piece?
                </div>
                <div className="text-[#1F2B20]/80">
                  Gently hand-wash in cool water with mild wool detergent. Lay flat on a clean towel to dry. Never hang heavy wet garments or machine tumble-dry.
                </div>
              </div>
              <div className="bg-[#F7F1E5] p-4 rounded-xl">
                <div className="font-bold text-base mb-1 text-[#1F2B20]">
                  Do you ship outside Nairobi?
                </div>
                <div className="text-[#1F2B20]/80">
                  Yes! Delivery across Kenya is available through Pick Up Mtaani only.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Policy Dialog */}
      {policyOpen && (
        <div className="fixed inset-0 z-50 bg-[#1F2B20]/60 backdrop-blur-xs flex items-center justify-center p-4 min-h-dvh overflow-y-auto">
          <div className="bg-[#FDFCF6] rounded-[24px] p-6 sm:p-7 max-w-lg w-full max-h-[85dvh] overflow-y-auto shadow-2xl border border-[#EEE7D6] relative my-auto">
            <button
              type="button"
              onClick={() => setPolicyOpen(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#EEE7D6] flex items-center justify-center text-[#1F2B20] hover:bg-[#FFF1B5] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-heading text-2xl text-[#1F2B20] mb-4 tracking-[0.02em]">
              {policyOpen === "privacy" ? "Privacy Policy" : "Delivery & Pickup"}
            </h3>
            {policyOpen === "privacy" ? (
              <div className="text-sm text-[#1F2B20]/80 space-y-3">
                <p>
                  At <strong>ms.sage creates</strong>, we respect your privacy. Any personal information you provide (name, sizing measurements, phone number, address) is used strictly to fulfill your crochet orders and communicate dispatch updates.
                </p>
                <p>
                  We never share, sell, or disclose your personal contact details to third parties.
                </p>
              </div>
            ) : (
              <div className="text-sm text-[#1F2B20]/80 space-y-3">
                <p>
                  <strong>Delivery through Pick Up Mtaani only:</strong> Convenient pick up points across Nairobi and nationwide. Once your piece is completed and dispatched, you will receive an SMS with your pickup location and collection code.
                </p>
                <p>
                  <strong>Packaging:</strong> All pieces are wrapped in reusable, breathable packaging to protect delicate cotton and wool stitches during transit.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
