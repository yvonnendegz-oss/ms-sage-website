/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import {
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
   MICROSCOPE HEADING REVEAL COMPONENT
   Letter-by-letter focus animation from opacity 0, scale 1.8, blur(6px) -> 1, 1, 0
   Staggered by 45ms (capped at 1200ms), respect prefers-reduced-motion, word-wrapped
   ========================================================================== */

function MicroscopeHeading({
  text,
  as: Tag = "h2",
  className = "",
}: {
  text: string;
  as?: "h2" | "h3";
  className?: string;
}) {
  const [hasMounted, setHasMounted] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setHasMounted(true);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);

    if (media.matches) {
      setIsRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && (entry.isIntersecting || entry.intersectionRatio >= 0.35)) {
          setIsRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );

    if (headingRef.current) {
      observer.observe(headingRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const words = text.split(" ");
  const totalLetters = text.replace(/\s+/g, "").length;
  const staggerDelay = totalLetters > 1 ? Math.min(45, 1200 / (totalLetters - 1)) : 45;

  let globalLetterIdx = 0;
  const shouldAnimate = hasMounted && !reducedMotion;

  return (
    <Tag ref={headingRef} aria-label={text} className={className}>
      {words.map((word, wordIdx) => (
        <span key={wordIdx} className="inline-block whitespace-nowrap">
          {word.split("").map((char, charIdx) => {
            const currentIdx = globalLetterIdx++;
            const delayMs = Math.round(currentIdx * staggerDelay);
            const isVisible = !shouldAnimate || isRevealed;

            return (
              <span
                key={charIdx}
                aria-hidden="true"
                className="inline-block"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? "scale(1)" : "scale(1.8)",
                  filter: isVisible ? "blur(0px)" : "blur(6px)",
                  transition: shouldAnimate && isRevealed
                    ? `opacity 600ms ease-out ${delayMs}ms, transform 600ms ease-out ${delayMs}ms, filter 600ms ease-out ${delayMs}ms`
                    : "none",
                  willChange: "transform, opacity, filter",
                }}
              >
                {char}
              </span>
            );
          })}
          {wordIdx < words.length - 1 && (
            <span aria-hidden="true" className="inline-block">
              &nbsp;
            </span>
          )}
        </span>
      ))}
    </Tag>
  );
}

/* ==========================================================================
   SCROLL REVEAL WRAPPER FOR CARDS
   Fade in and rise 16px over 500ms as they scroll into view once
   ========================================================================== */

function ScrollReveal({
  children,
  staggerIndex = 0,
  className = "",
}: {
  children: React.ReactNode;
  staggerIndex?: number;
  className?: string;
}) {
  const [hasMounted, setHasMounted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasMounted(true);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);

    if (media.matches) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (elRef.current) observer.observe(elRef.current);
    return () => observer.disconnect();
  }, []);

  const shouldAnimate = hasMounted && !reducedMotion;
  const isVisible = !shouldAnimate || revealed;
  const delayMs = staggerIndex * 80;

  return (
    <div
      ref={elRef}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(16px)",
        transition: shouldAnimate && revealed
          ? `opacity 500ms ease-out ${delayMs}ms, transform 500ms ease-out ${delayMs}ms`
          : "none",
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}

/* ==========================================================================
   CONFIRM REMOVE BUTTON (2-STEP CONFIRMATION)
   ========================================================================== */

function ConfirmRemoveButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setConfirming(false);
      }, 3000);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setConfirming(false);
      onConfirm();
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`text-[#1F2B20] text-xs font-bold px-3 py-1.5 rounded-full shadow-sm cursor-pointer transition-colors whitespace-nowrap ${
        confirming
          ? "bg-[#E0764A] text-[#FDFCF6] animate-pulse"
          : "bg-[#FDFCF6] hover:bg-[#F7B8CB]"
      }`}
    >
      {confirming ? "Tap again to confirm" : "Remove"}
    </button>
  );
}

/* ==========================================================================
   PRODUCT IMAGE AREA COMPONENT
   Image placeholder blocks & empty slots: tint #C5D4B8, dashed outlines #4E6B43/50
   ========================================================================== */

function ProductImageArea({
  product,
  photoUrl,
  editMode,
  onUpload,
  onRemove,
}: {
  product: Product;
  photoUrl?: string;
  editMode: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (photoUrl) {
    return (
      <div className="aspect-[4/5] w-full rounded-[16px] overflow-hidden relative group mb-4 bg-[#C5D4B8]">
        <img
          src={photoUrl}
          alt={product.name}
          className="w-full h-full object-cover"
        />
        {editMode && (
          <div className="absolute inset-0 bg-[#1F2B20]/45 flex items-center justify-center gap-2 p-2 transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100 [@media(hover:none)]:!opacity-100">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#FDFCF6] hover:bg-[#FFF1B5] text-[#1F2B20] text-xs font-bold px-3 py-1.5 rounded-full shadow-sm cursor-pointer transition-colors"
            >
              Change
            </button>
            <ConfirmRemoveButton onConfirm={onRemove} />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onUpload}
            />
          </div>
        )}
      </div>
    );
  }

  // When edit mode is OFF: plain soft tinted placeholder #C5D4B8 with dashed outline in #4E6B43 at 50% opacity
  if (!editMode) {
    return (
      <div className="aspect-[4/5] w-full rounded-[16px] mb-4 bg-[#C5D4B8] border-2 border-dashed border-[#4E6B43]/50" />
    );
  }

  // When edit mode is ON: upload prompt with tint #C5D4B8 and dashed outline in #4E6B43 at 50% opacity
  return (
    <div className="aspect-[4/5] w-full mb-4">
      <label className="w-full h-full border-2 border-dashed border-[#4E6B43]/50 rounded-[16px] bg-[#C5D4B8] hover:bg-[#C5D4B8]/80 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onUpload}
        />
        <div className="w-9 h-9 rounded-full bg-[#FDFCF6] group-hover:bg-[#FFF1B5] flex items-center justify-center text-[#4E6B43] shadow-xs transition-colors">
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#1F2B20]/80 group-hover:text-[#1F2B20]">
          Add photo
        </span>
      </label>
    </div>
  );
}

/* ==========================================================================
   MOBILE CARD DECK COMPONENT (screens <= 768px ONLY)
   Stacked card deck with pointer drag gestures, rubber-band edges, dots & arrow keys
   ========================================================================== */

function MobileCardDeck({
  products,
  savedImages,
  cardEdits,
  editMode,
  onSelectProductForOrder,
  onImageUpload,
  onImageRemove,
  onCardTextChange,
  handleKeyDownNoEnter,
  getProductField,
  isPastCreations = false,
}: {
  products: Product[];
  savedImages: Record<string, string>;
  cardEdits: Record<string, { name?: string; label?: string; description?: string; price?: string }>;
  editMode: boolean;
  onSelectProductForOrder?: (product: Product) => void;
  onImageUpload: (key: string, file: File) => void;
  onImageRemove: (key: string) => void;
  onCardTextChange: (id: string, field: "name" | "label" | "description" | "price", value: string) => void;
  handleKeyDownNoEnter: (e: React.KeyboardEvent<HTMLElement>) => void;
  getProductField: (product: Product, field: "name" | "label" | "description" | "price") => string;
  isPastCreations?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState<"left" | "right" | "rubber" | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const deckRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const cardWidthRef = useRef(320);
  const isPointerDownRef = useRef(false);
  const isDragIntentRef = useRef<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, label, textarea, select, [contenteditable="true"]')) {
      return;
    }
    if (animating) return;

    isPointerDownRef.current = true;
    isDragIntentRef.current = null;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startTimeRef.current = Date.now();
    if (deckRef.current) {
      cardWidthRef.current = deckRef.current.offsetWidth || 320;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (isDragIntentRef.current === null) {
      if (Math.abs(dx) > 7 || Math.abs(dy) > 7) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          isDragIntentRef.current = true;
          setIsDragging(true);
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            // Ignore capture error
          }
        } else {
          isDragIntentRef.current = false;
          isPointerDownRef.current = false;
          return;
        }
      } else {
        return;
      }
    }

    if (isDragIntentRef.current) {
      if (currentIndex === 0 && dx > 0) {
        setDragX(dx * 0.25);
      } else if (currentIndex === products.length - 1 && dx < 0) {
        setDragX(dx * 0.25);
      } else {
        setDragX(dx);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current && !isDragging) return;
    isPointerDownRef.current = false;

    if (!isDragging) {
      return;
    }

    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    setIsDragging(false);
    const cardWidth = cardWidthRef.current;
    const threshold = cardWidth * 0.25;
    const dt = Math.max(1, Date.now() - startTimeRef.current);
    const velocity = dragX / dt;

    // Swipe left (next card)
    if ((dragX < -threshold || velocity < -0.45) && currentIndex < products.length - 1) {
      if (reducedMotion) {
        setCurrentIndex((prev) => prev + 1);
        setDragX(0);
      } else {
        setAnimating("left");
        setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
          setAnimating(null);
          setDragX(0);
        }, 350);
      }
    }
    // Swipe right (previous card)
    else if ((dragX > threshold || velocity > 0.45) && currentIndex > 0) {
      if (reducedMotion) {
        setCurrentIndex((prev) => prev - 1);
        setDragX(0);
      } else {
        setAnimating("right");
        setTimeout(() => {
          setCurrentIndex((prev) => prev - 1);
          setAnimating(null);
          setDragX(0);
        }, 350);
      }
    }
    // Snap back
    else {
      setAnimating("rubber");
      setTimeout(() => {
        setAnimating(null);
        setDragX(0);
      }, 250);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (currentIndex < products.length - 1) {
        if (reducedMotion) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          setAnimating("left");
          setTimeout(() => {
            setCurrentIndex((prev) => prev + 1);
            setAnimating(null);
          }, 350);
        }
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (currentIndex > 0) {
        if (reducedMotion) {
          setCurrentIndex((prev) => prev - 1);
        } else {
          setAnimating("right");
          setTimeout(() => {
            setCurrentIndex((prev) => prev - 1);
            setAnimating(null);
          }, 350);
        }
      }
    }
  };

  const getCardStyle = (idx: number): React.CSSProperties => {
    const rel = idx - currentIndex;

    if (animating === "left") {
      if (rel === 0) {
        return {
          transform: "translateX(-120%) rotate(-12deg)",
          opacity: 0,
          zIndex: 30,
          boxShadow: "0 18px 30px rgba(31, 43, 32, 0.18)",
          transition: "transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 350ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        };
      }
      if (rel === 1) {
        return {
          transform: "translate(0, 0) scale(1) rotate(0deg)",
          opacity: 1,
          zIndex: 25,
          boxShadow: "0 18px 30px rgba(31, 43, 32, 0.18)",
          transition: "transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 350ms",
        };
      }
      if (rel === 2) {
        return {
          transform: "translate(0, 12px) scale(0.95) rotate(2deg)",
          opacity: 1,
          zIndex: 20,
          boxShadow: "0 18px 30px rgba(31, 43, 32, 0.12)",
          transition: "transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        };
      }
      if (rel === 3) {
        return {
          transform: "translate(0, 24px) scale(0.90) rotate(-2deg)",
          opacity: 1,
          zIndex: 10,
          boxShadow: "0 18px 30px rgba(31, 43, 32, 0.08)",
          transition: "opacity 350ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        };
      }
      return { opacity: 0, pointerEvents: "none" };
    }

    if (animating === "right") {
      if (rel === -1) {
        return {
          transform: "translate(0, 0) scale(1) rotate(0deg)",
          opacity: 1,
          zIndex: 35,
          boxShadow: "0 18px 30px rgba(31, 43, 32, 0.18)",
          transition: "transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 350ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        };
      }
      if (rel === 0) {
        return {
          transform: "translate(0, 12px) scale(0.95) rotate(2deg)",
          opacity: 1,
          zIndex: 20,
          boxShadow: "0 18px 30px rgba(31, 43, 32, 0.12)",
          transition: "transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        };
      }
      if (rel === 1) {
        return {
          transform: "translate(0, 24px) scale(0.90) rotate(-2deg)",
          opacity: 1,
          zIndex: 10,
          boxShadow: "0 18px 30px rgba(31, 43, 32, 0.08)",
          transition: "transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        };
      }
      return { opacity: 0, pointerEvents: "none" };
    }

    if (animating === "rubber") {
      if (rel === 0) {
        return {
          transform: "translate(0, 0) scale(1) rotate(0deg)",
          opacity: 1,
          zIndex: 30,
          boxShadow: "0 18px 30px rgba(31, 43, 32, 0.18)",
          transition: "transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        };
      }
      if (rel === 1) {
        return {
          transform: "translate(0, 12px) scale(0.95) rotate(2deg)",
          opacity: 1,
          zIndex: 20,
          boxShadow: "0 18px 30px rgba(31, 43, 32, 0.12)",
          transition: "transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        };
      }
      if (rel === 2) {
        return {
          transform: "translate(0, 24px) scale(0.90) rotate(-2deg)",
          opacity: 1,
          zIndex: 10,
          boxShadow: "0 18px 30px rgba(31, 43, 32, 0.08)",
          transition: "transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        };
      }
      return { opacity: 0, pointerEvents: "none" };
    }

    if (isDragging) {
      if (rel === 0) {
        return {
          transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)`,
          opacity: 1,
          zIndex: 30,
          boxShadow: "0 18px 30px rgba(31, 43, 32, 0.18)",
          transition: "none",
        };
      }
      if (rel === -1 && dragX > 0) {
        return {
          transform: `translateX(${dragX - cardWidthRef.current}px) rotate(${(dragX - cardWidthRef.current) / 20}deg)`,
          opacity: 1,
          zIndex: 35,
          boxShadow: "0 18px 30px rgba(31, 43, 32, 0.18)",
          transition: "none",
        };
      }
      if (rel === 1) {
        const factor = Math.min(1, Math.abs(dragX) / (cardWidthRef.current || 320));
        const dy = 12 - 12 * factor;
        const s = 0.95 + 0.05 * factor;
        const rot = 2 - 2 * factor;
        return {
          transform: `translate(0, ${dy}px) scale(${s}) rotate(${rot}deg)`,
          opacity: 1,
          zIndex: 20,
          boxShadow: "0 18px 30px rgba(31, 43, 32, 0.14)",
          transition: "none",
        };
      }
      if (rel === 2) {
        const factor = Math.min(1, Math.abs(dragX) / (cardWidthRef.current || 320));
        const dy = 24 - 12 * factor;
        const s = 0.90 + 0.05 * factor;
        const rot = -2 + 4 * factor;
        return {
          transform: `translate(0, ${dy}px) scale(${s}) rotate(${rot}deg)`,
          opacity: 1,
          zIndex: 10,
          boxShadow: "0 18px 30px rgba(31, 43, 32, 0.08)",
          transition: "none",
        };
      }
      return { opacity: 0, pointerEvents: "none" };
    }

    if (rel === 0) {
      return {
        transform: "translate(0, 0) scale(1) rotate(0deg)",
        opacity: 1,
        zIndex: 30,
        boxShadow: "0 18px 30px rgba(31, 43, 32, 0.18)",
        transition: "transform 250ms ease-out, opacity 250ms ease-out",
      };
    }
    if (rel === 1) {
      return {
        transform: "translate(0, 12px) scale(0.95) rotate(2deg)",
        opacity: 1,
        zIndex: 20,
        boxShadow: "0 18px 30px rgba(31, 43, 32, 0.12)",
        transition: "transform 250ms ease-out, opacity 250ms ease-out",
      };
    }
    if (rel === 2) {
      return {
        transform: "translate(0, 24px) scale(0.90) rotate(-2deg)",
        opacity: 1,
        zIndex: 10,
        boxShadow: "0 18px 30px rgba(31, 43, 32, 0.08)",
        transition: "transform 250ms ease-out, opacity 250ms ease-out",
      };
    }

    return { opacity: 0, pointerEvents: "none" };
  };

  return (
    <div
      className="w-full flex flex-col items-center select-none py-2 outline-none"
      style={{ touchAction: "pan-y" }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`${isPastCreations ? "Past creations" : "In stock pieces"} card deck, swipe or use arrow keys`}
    >
      <div className="sr-only" aria-live="polite">
        Piece {currentIndex + 1} of {products.length}
      </div>

      {/* Deck stack container */}
      <div
        ref={deckRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative w-[min(84vw,340px)] min-h-[530px] sm:min-h-[550px] cursor-grab active:cursor-grabbing"
      >
        {products.map((product, idx) => {
          const photoUrl = savedImages[product.id] || product.image;
          const name = getProductField(product, "name");
          const label = getProductField(product, "label");
          const description = getProductField(product, "description");
          const price = getProductField(product, "price");
          const cardStyle = getCardStyle(idx);
          const isTopCard = idx === currentIndex;

          return (
            <article
              key={product.id}
              style={cardStyle}
              className="absolute inset-x-0 top-0 bg-[#FDFCF6] rounded-[20px] p-4 flex flex-col justify-between border border-[#D3DFC8] will-change-transform"
            >
              <div>
                <ProductImageArea
                  product={product}
                  photoUrl={photoUrl}
                  editMode={editMode && isTopCard}
                  onUpload={(e) => {
                    if (e.target.files?.[0]) {
                      onImageUpload(product.id, e.target.files[0]);
                    }
                  }}
                  onRemove={() => onImageRemove(product.id)}
                />

                {/* Editable Label */}
                <div
                  contentEditable={editMode && isTopCard}
                  suppressContentEditableWarning={true}
                  onKeyDown={editMode && isTopCard ? handleKeyDownNoEnter : undefined}
                  onBlur={
                    editMode && isTopCard
                      ? (e) => onCardTextChange(product.id, "label", e.currentTarget.textContent || "")
                      : undefined
                  }
                  title={editMode && isTopCard ? "Click to edit label" : undefined}
                  className={`text-[13px] font-bold uppercase tracking-wider text-[#4E6B43] mb-1 outline-none rounded px-1 -mx-1 transition-colors ${
                    editMode && isTopCard ? "hover:bg-[#D3DFC8]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                  }`}
                >
                  {label}
                </div>

                {/* Editable Name */}
                <h4
                  contentEditable={editMode && isTopCard}
                  suppressContentEditableWarning={true}
                  onKeyDown={editMode && isTopCard ? handleKeyDownNoEnter : undefined}
                  onBlur={
                    editMode && isTopCard
                      ? (e) => onCardTextChange(product.id, "name", e.currentTarget.textContent || "")
                      : undefined
                  }
                  title={editMode && isTopCard ? "Click to edit name" : undefined}
                  className={`font-heading text-xl text-[#1F2B20] leading-snug mb-1.5 tracking-[0.02em] outline-none rounded px-1 -mx-1 transition-colors ${
                    editMode && isTopCard ? "hover:bg-[#D3DFC8]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                  }`}
                >
                  {name}
                </h4>

                {/* Editable Description */}
                <p
                  contentEditable={editMode && isTopCard}
                  suppressContentEditableWarning={true}
                  onBlur={
                    editMode && isTopCard
                      ? (e) => onCardTextChange(product.id, "description", e.currentTarget.textContent || "")
                      : undefined
                  }
                  title={editMode && isTopCard ? "Click to edit description" : undefined}
                  className={`text-[#1F2B20]/75 text-sm line-clamp-2 mb-3 outline-none rounded px-1 -mx-1 transition-colors ${
                    editMode && isTopCard ? "hover:bg-[#D3DFC8]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                  }`}
                >
                  {description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#D3DFC8]/80 mt-2">
                <span
                  contentEditable={editMode && isTopCard}
                  suppressContentEditableWarning={true}
                  onKeyDown={editMode && isTopCard ? handleKeyDownNoEnter : undefined}
                  onBlur={
                    editMode && isTopCard
                      ? (e) => onCardTextChange(product.id, "price", e.currentTarget.textContent || "")
                      : undefined
                  }
                  title={editMode && isTopCard ? "Click to edit price" : undefined}
                  className={`text-[#E0764A] font-bold text-lg outline-none rounded px-1 -mx-1 transition-colors ${
                    editMode && isTopCard ? "hover:bg-[#D3DFC8]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                  }`}
                >
                  {price}
                </span>

                {!isPastCreations ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectProductForOrder) onSelectProductForOrder(product);
                    }}
                    className="bg-[#4E6B43] hover:bg-[#3F5A36] text-[#FDFCF6] text-xs font-bold px-4 py-2 rounded-full transition-colors cursor-pointer shadow-xs"
                  >
                    Order this
                  </button>
                ) : (
                  <span className="bg-[#FFF1B5] text-[#1F2B20] text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-xs">
                    Sold
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Dot Indicators */}
      <div className="flex items-center justify-center gap-2 pt-5 pb-1" aria-label="Deck progress dots">
        {products.map((_, dotIdx) => (
          <button
            key={dotIdx}
            type="button"
            onClick={() => setCurrentIndex(dotIdx)}
            aria-label={`Go to piece ${dotIdx + 1}`}
            className={`rounded-full transition-all ${
              currentIndex === dotIdx
                ? "w-6 h-2 bg-[#4E6B43]"
                : "w-2 h-2 bg-[#D3DFC8] hover:bg-[#4E6B43]/50"
            }`}
          />
        ))}
      </div>
      <p className="text-xs font-semibold text-[#1F2B20]/60 mt-1 select-none">
        Swipe to see more
      </p>
    </div>
  );
}

/* ==========================================================================
   MAIN APPLICATION
   ========================================================================== */

export default function App() {
  const [savedImages, setSavedImages] = useState<Record<string, string>>({});

  // OWNER EDIT MODE (off by default, persisted in localStorage)
  const [editMode, setEditMode] = useState<boolean>(() => {
    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("edit") === "1") return true;
        const saved = localStorage.getItem("ms_sage_edit_mode");
        return saved ? JSON.parse(saved) : false;
      }
      return false;
    } catch {
      return false;
    }
  });

  const setEditModeAndPersist = (val: boolean) => {
    setEditMode(val);
    try {
      localStorage.setItem("ms_sage_edit_mode", JSON.stringify(val));
    } catch {
      // Ignore storage error
    }
  };

  // Check URL query param ?edit=1 on mount and listen for Ctrl+Shift+E
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("edit") === "1") {
        setEditModeAndPersist(true);
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "E" || e.key === "e")) {
        e.preventDefault();
        setEditModeAndPersist(true);
        showToast("Edit mode enabled");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Phone: tap footer copyright 5 times in 3 seconds to activate edit mode
  const copyrightTapsRef = useRef<number[]>([]);
  const handleCopyrightTap = () => {
    const now = Date.now();
    const recent = [...copyrightTapsRef.current.filter((t) => now - t < 3000), now];
    copyrightTapsRef.current = recent;
    if (recent.length >= 5) {
      copyrightTapsRef.current = [];
      setEditModeAndPersist(true);
      showToast("Edit mode enabled");
    }
  };

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
  const [activeSection, setActiveSection] = useState<string>("shop");

  // Navigation / modal states
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

  // Slow hero zoom state (100% -> 105% over 12s on page load, once)
  const [heroZoomed, setHeroZoomed] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!media.matches) {
      const timer = setTimeout(() => setHeroZoomed(true), 60);
      return () => clearTimeout(timer);
    }
  }, []);

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
    const sectionIds = ["shop", "about", "info", "order"];
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
    <div className="min-h-dvh bg-[#E2EAD8] text-[#1F2B20] selection:bg-[#FFF1B5] selection:text-[#1F2B20] flex flex-col items-center">
      {/* -----------------------------------------------------------------------
          HEADER & NAVIGATION
          ----------------------------------------------------------------------- */}
      <header className="sticky top-3 md:top-4 z-50 w-full max-w-[1200px] px-4 pointer-events-none">
        <div className="relative pointer-events-auto flex flex-col w-full">
          {/* Main Nav Bar */}
          <nav
            aria-label="Main Navigation"
            className="w-full bg-[#FFFFFF] rounded-2xl md:rounded-full px-4 sm:px-8 py-2.5 md:py-3 flex items-center justify-between border border-[#1F2B20]/10 shadow-[0_10px_25px_rgba(31,43,32,0.12)]"
          >
            {/* --- PHONE NAV (<= 768px: md:hidden) --- */}
            <div className="flex md:hidden items-center justify-between w-full relative">
              {/* Far left: Hamburger menu icon */}
              <div className="flex items-center justify-start z-10 shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label="Toggle navigation menu"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#1F2B20] hover:text-[#4E6B43] hover:bg-[#D3DFC8]/60 transition-colors cursor-pointer"
                >
                  {mobileMenuOpen ? (
                    <X className="w-5 h-5 stroke-[2.2]" />
                  ) : (
                    <Menu className="w-5 h-5 stroke-[2.2]" />
                  )}
                </button>
              </div>

              {/* Center: "ms.sage" wordmark with small "CREATES" pill exactly centered */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none px-12">
                <div className="flex items-center gap-1.5 min-[380px]:gap-2 shrink-0 pointer-events-auto">
                  <span className="font-heading text-[18px] min-[360px]:text-xl sm:text-2xl text-[#1F2B20] tracking-[0.02em] whitespace-nowrap leading-none">
                    ms.sage
                  </span>
                  <span className="bg-[#DDEBD3] text-[#1F2B20] text-[9px] min-[360px]:text-[10px] font-black px-1.5 min-[360px]:px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap leading-none">
                    CREATES
                  </span>
                </div>
              </div>

              {/* Far right: Cart icon */}
              <div className="flex items-center gap-1 sm:gap-1.5 z-10 shrink-0">
                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  aria-label={totalBasketItems > 0 ? `Shopping cart, ${totalBasketItems} items` : "Shopping cart"}
                  className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#1F2B20] hover:text-[#4E6B43] hover:bg-[#D3DFC8]/60 transition-colors cursor-pointer"
                >
                  <ShoppingCart className="w-5 h-5 stroke-[2]" />
                  {totalBasketItems > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#4E6B43] text-[#FDFCF6] text-[10px] font-black min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center shadow-xs leading-none">
                      {totalBasketItems}
                    </span>
                  )}
                  <span className="sr-only">{totalBasketItems} items in cart</span>
                </button>
              </div>
            </div>

            {/* --- DESKTOP NAV (> 768px: hidden md:flex) --- */}
            <div className="hidden md:flex items-center justify-between w-full">
              {/* ZONE 1 (Left): Links Shop and About */}
              <div className="flex items-center gap-7 lg:gap-10 flex-1 justify-start">
                <a
                  href="#shop"
                  onClick={() => setActiveSection("shop")}
                  aria-current={activeSection === "shop" ? "true" : undefined}
                  className={`relative py-1 text-[16px] md:text-[17px] transition-colors select-none ${
                    activeSection === "shop"
                      ? "text-[#4E6B43] font-extrabold"
                      : "text-[#1F2B20] font-bold hover:text-[#4E6B43]"
                  }`}
                >
                  <span>Shop</span>
                  {activeSection === "shop" && (
                    <span
                      className="absolute -bottom-1.5 left-0 right-0 h-[3px] bg-[#4E6B43] rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </a>

                <a
                  href="#about"
                  onClick={() => setActiveSection("about")}
                  aria-current={activeSection === "about" ? "true" : undefined}
                  className={`relative py-1 text-[16px] md:text-[17px] transition-colors select-none ${
                    activeSection === "about"
                      ? "text-[#4E6B43] font-extrabold"
                      : "text-[#1F2B20] font-bold hover:text-[#4E6B43]"
                  }`}
                >
                  <span>About</span>
                  {activeSection === "about" && (
                    <span
                      className="absolute -bottom-1.5 left-0 right-0 h-[3px] bg-[#4E6B43] rounded-full"
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
                <span className="bg-[#DDEBD3] text-[#1F2B20] text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  CREATES
                </span>
              </div>

              {/* ZONE 3 (Right): Links Info & Order, followed by cart icon */}
              <div className="flex items-center gap-7 lg:gap-10 flex-1 justify-end">
                <a
                  href="#info"
                  onClick={() => setActiveSection("info")}
                  aria-current={activeSection === "info" ? "true" : undefined}
                  className={`relative py-1 text-[16px] md:text-[17px] transition-colors select-none ${
                    activeSection === "info"
                      ? "text-[#4E6B43] font-extrabold"
                      : "text-[#1F2B20] font-bold hover:text-[#4E6B43]"
                  }`}
                >
                  <span>Info</span>
                  {activeSection === "info" && (
                    <span
                      className="absolute -bottom-1.5 left-0 right-0 h-[3px] bg-[#4E6B43] rounded-full"
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
                      ? "text-[#4E6B43] font-extrabold"
                      : "text-[#1F2B20] font-bold hover:text-[#4E6B43]"
                  }`}
                >
                  <span>Order</span>
                  {activeSection === "order" && (
                    <span
                      className="absolute -bottom-1.5 left-0 right-0 h-[3px] bg-[#4E6B43] rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </a>

                <div className="flex items-center pl-3 border-l border-[#D3DFC8]">
                  <button
                    type="button"
                    onClick={() => setCartOpen(true)}
                    aria-label={totalBasketItems > 0 ? `Shopping cart, ${totalBasketItems} items` : "Shopping cart"}
                    className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#1F2B20] hover:text-[#4E6B43] hover:bg-[#D3DFC8]/60 transition-colors cursor-pointer"
                  >
                    <ShoppingCart className="w-5 h-5 stroke-[2]" />
                    {totalBasketItems > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[#4E6B43] text-[#FDFCF6] text-[10px] font-black min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center shadow-xs leading-none">
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
            <div className="md:hidden w-full sm:max-w-xs self-start origin-top-left bg-[#FFFFFF] border border-[#1F2B20]/10 rounded-2xl py-3 px-4 shadow-lg flex flex-col gap-1 mt-2 animate-in fade-in slide-in-from-top-2 duration-150">
              <a
                href="#shop"
                onClick={() => {
                  setActiveSection("shop");
                  setMobileMenuOpen(false);
                }}
                aria-current={activeSection === "shop" ? "true" : undefined}
                className={`relative py-2 px-3 text-base select-none transition-colors rounded-xl ${
                  activeSection === "shop"
                    ? "text-[#4E6B43] font-extrabold bg-[#D3DFC8]/35"
                    : "text-[#1F2B20] font-bold hover:bg-[#FFF1B5]/60"
                }`}
              >
                <span className="relative inline-block">
                  Shop
                  {activeSection === "shop" && (
                    <span
                      className="absolute -bottom-0.5 left-0 right-0 h-[3px] bg-[#4E6B43] rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </span>
              </a>

              <a
                href="#about"
                onClick={() => {
                  setActiveSection("about");
                  setMobileMenuOpen(false);
                }}
                aria-current={activeSection === "about" ? "true" : undefined}
                className={`relative py-2 px-3 text-base select-none transition-colors rounded-xl ${
                  activeSection === "about"
                    ? "text-[#4E6B43] font-extrabold bg-[#D3DFC8]/35"
                    : "text-[#1F2B20] font-bold hover:bg-[#FFF1B5]/60"
                }`}
              >
                <span className="relative inline-block">
                  About
                  {activeSection === "about" && (
                    <span
                      className="absolute -bottom-0.5 left-0 right-0 h-[3px] bg-[#4E6B43] rounded-full"
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
                    ? "text-[#4E6B43] font-extrabold bg-[#D3DFC8]/35"
                    : "text-[#1F2B20] font-bold hover:bg-[#FFF1B5]/60"
                }`}
              >
                <span className="relative inline-block">
                  Info
                  {activeSection === "info" && (
                    <span
                      className="absolute -bottom-0.5 left-0 right-0 h-[3px] bg-[#4E6B43] rounded-full"
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
                    ? "text-[#4E6B43] font-extrabold bg-[#D3DFC8]/35"
                    : "text-[#1F2B20] font-bold hover:bg-[#FFF1B5]/60"
                }`}
              >
                <span className="relative inline-block">
                  Order
                  {activeSection === "order" && (
                    <span
                      className="absolute -bottom-0.5 left-0 right-0 h-[3px] bg-[#4E6B43] rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </span>
              </a>
            </div>
          )}
        </div>
      </header>

      {/* ---------------------------------------------------------------------
          FULL-WIDTH HERO FEATURED IMAGE
          - Span full width edge to edge (w-full, no horizontal scroll)
          - Square corners (rounded-none)
          - Attached directly under the nav bar
          - Height: ~70vh desktop (between 420px and 720px), ~60vh phones (min 380px)
          - Slow hero zoom: image slowly zooms from 100% to 105% over 12s on page load, once
          - "Make Order" button centered inside, about 28px above bottom edge (stays still)
          --------------------------------------------------------------------- */}
      <section
        aria-label="Hero Showcase"
        className="relative w-full h-[60vh] min-h-[380px] md:h-[70vh] md:min-h-[420px] md:max-h-[720px] bg-[#D3DFC8] overflow-hidden -mt-2 md:-mt-3 group rounded-none"
      >
        {heroImage ? (
          <>
            <img
              src={heroImage}
              alt="Featured crochet showcase"
              className="w-full h-full object-cover will-change-transform"
              style={{
                transform: heroZoomed ? "scale(1.05)" : "scale(1)",
                transition: "transform 12000ms cubic-bezier(0.25, 1, 0.5, 1)",
              }}
            />
            {editMode && (
              <div className="absolute top-5 right-5 z-20 flex items-center gap-2 transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100 [@media(hover:none)]:!opacity-100">
                <label className="bg-[#FDFCF6]/95 hover:bg-[#FFF1B5] text-[#1F2B20] text-xs font-bold px-3.5 py-1.5 rounded-full cursor-pointer shadow-md transition-colors">
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
                <ConfirmRemoveButton onConfirm={() => handleImageRemove("hero_featured")} />
              </div>
            )}
          </>
        ) : editMode ? (
          <div className="w-full h-full flex items-center justify-center bg-[#C5D4B8] border-2 border-dashed border-[#4E6B43]/50">
            <label className="flex flex-col items-center justify-center gap-3.5 cursor-pointer group/upload p-8 rounded-3xl">
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
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#FDFCF6] shadow-sm flex items-center justify-center text-[#4E6B43] group-hover/upload:bg-[#FFF1B5] transition-colors">
                <Plus className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.5]" />
              </div>
              <span className="font-heading text-lg sm:text-xl text-[#1F2B20] tracking-[0.02em]">
                Add featured image
              </span>
            </label>
          </div>
        ) : (
          /* When edit mode is OFF and no photo: placeholder slot with tint #C5D4B8 and dashed outline */
          <div className="w-full h-full bg-[#C5D4B8] border-2 border-dashed border-[#4E6B43]/50" />
        )}

        {/* "Make Order" button: fully inside the card, centered, 28px above bottom edge */}
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-20">
          <a
            href="#order"
            onClick={() => setActiveSection("order")}
            className="inline-flex items-center justify-center bg-[#4E6B43] hover:bg-[#3F5A36] text-[#FDFCF6] font-bold text-base md:text-lg px-8 sm:px-10 py-3.5 sm:py-4 rounded-full shadow-[0_10px_25px_rgba(31,43,32,0.14)] transition-colors whitespace-nowrap"
          >
            Make Order
          </a>
        </div>
      </section>

      {/* Main Content Container */}
      <main className="w-full max-w-[1200px] px-4 md:px-6 pt-12 md:pt-16 flex flex-col gap-20 md:gap-28">


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
            <MicroscopeHeading
              as="h2"
              text="Fresh Off the Hook"
              className="font-heading text-4xl sm:text-[44px] text-[#1F2B20] leading-[1.1] mb-3 tracking-[0.02em]"
            />
            <p className="text-[18px] text-[#1F2B20]/80 leading-[1.6]">
              Explore favorite drops and custom staples. All prices listed in KES.
            </p>
          </div>

          {/* ROW 1: IN STOCK */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4E6B43]" />
                <h3 className="font-heading text-2xl text-[#1F2B20] tracking-[0.02em]">
                  In Stock
                </h3>
                <span className="text-xs font-bold uppercase tracking-wider text-[#4E6B43] bg-[#D3DFC8] px-2.5 py-0.5 rounded-full">
                  Ready to Dispatch
                </span>
              </div>

              {/* Round arrow sideways scroll buttons (desktop only: hidden on phones) */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollRow(inStockScrollRef, "left")}
                  aria-label="Scroll left in stock pieces"
                  className="w-10 h-10 rounded-full bg-[#FDFCF6] hover:bg-[#FFF1B5] border border-[#D3DFC8] flex items-center justify-center text-[#1F2B20] shadow-sm transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRow(inStockScrollRef, "right")}
                  aria-label="Scroll right in stock pieces"
                  className="w-10 h-10 rounded-full bg-[#FDFCF6] hover:bg-[#FFF1B5] border border-[#D3DFC8] flex items-center justify-center text-[#1F2B20] shadow-sm transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Desktop Row: standard scrollable row (hidden on phones) */}
            <div
              ref={inStockScrollRef}
              className="hidden md:flex gap-6 overflow-x-auto scroll-smooth no-scrollbar pb-4 pt-1 px-1"
            >
              {inStockProducts.map((product, idx) => {
                const photoUrl = savedImages[product.id] || product.image;
                const name = getProductField(product, "name");
                const label = getProductField(product, "label");
                const description = getProductField(product, "description");
                const price = getProductField(product, "price");

                return (
                  <ScrollReveal key={product.id} staggerIndex={idx} className="shrink-0">
                    <article
                      className="w-[285px] bg-[#FDFCF6] rounded-[20px] p-4 flex flex-col justify-between shadow-[0_8px_24px_rgba(31,43,32,0.12)] border border-[#D3DFC8] h-full"
                    >
                      <div>
                        <ProductImageArea
                          product={product}
                          photoUrl={photoUrl}
                          editMode={editMode}
                          onUpload={(e) => {
                            if (e.target.files?.[0]) {
                              handleImageUpload(product.id, e.target.files[0]);
                            }
                          }}
                          onRemove={() => handleImageRemove(product.id)}
                        />

                        {/* Editable Label */}
                        <div
                          contentEditable={editMode}
                          suppressContentEditableWarning={true}
                          onKeyDown={editMode ? handleKeyDownNoEnter : undefined}
                          onBlur={editMode ? (e) => handleCardTextChange(product.id, "label", e.currentTarget.textContent || "") : undefined}
                          title={editMode ? "Click to edit label" : undefined}
                          className={`text-[13px] font-bold uppercase tracking-wider text-[#4E6B43] mb-1 outline-none rounded px-1 -mx-1 transition-colors ${
                            editMode ? "hover:bg-[#D3DFC8]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                          }`}
                        >
                          {label}
                        </div>

                        {/* Editable Product Name */}
                        <h4
                          contentEditable={editMode}
                          suppressContentEditableWarning={true}
                          onKeyDown={editMode ? handleKeyDownNoEnter : undefined}
                          onBlur={editMode ? (e) => handleCardTextChange(product.id, "name", e.currentTarget.textContent || "") : undefined}
                          title={editMode ? "Click to edit name" : undefined}
                          className={`font-heading text-xl text-[#1F2B20] leading-snug mb-1.5 tracking-[0.02em] outline-none rounded px-1 -mx-1 transition-colors ${
                            editMode ? "hover:bg-[#D3DFC8]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                          }`}
                        >
                          {name}
                        </h4>

                        {/* Editable Description */}
                        <p
                          contentEditable={editMode}
                          suppressContentEditableWarning={true}
                          onBlur={editMode ? (e) => handleCardTextChange(product.id, "description", e.currentTarget.textContent || "") : undefined}
                          title={editMode ? "Click to edit description" : undefined}
                          className={`text-[#1F2B20]/75 text-sm line-clamp-2 mb-3 outline-none rounded px-1 -mx-1 transition-colors ${
                            editMode ? "hover:bg-[#D3DFC8]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                          }`}
                        >
                          {description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[#D3DFC8]/80 mt-2">
                        {/* Editable Price */}
                        <span
                          contentEditable={editMode}
                          suppressContentEditableWarning={true}
                          onKeyDown={editMode ? handleKeyDownNoEnter : undefined}
                          onBlur={editMode ? (e) => handleCardTextChange(product.id, "price", e.currentTarget.textContent || "") : undefined}
                          title={editMode ? "Click to edit price" : undefined}
                          className={`text-[#E0764A] font-bold text-lg outline-none rounded px-1 -mx-1 transition-colors ${
                            editMode ? "hover:bg-[#D3DFC8]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                          }`}
                        >
                          {price}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSelectProductForOrder(product)}
                          className="bg-[#4E6B43] hover:bg-[#3F5A36] text-[#FDFCF6] text-xs font-bold px-4 py-2 rounded-full transition-colors cursor-pointer shadow-xs"
                        >
                          Order this
                        </button>
                      </div>
                    </article>
                  </ScrollReveal>
                );
              })}
            </div>

            {/* Mobile Stacked Card Deck (<= 768px only) */}
            <ScrollReveal className="w-full md:hidden">
              <MobileCardDeck
                products={inStockProducts}
                savedImages={savedImages}
                cardEdits={cardEdits}
                editMode={editMode}
                onSelectProductForOrder={handleSelectProductForOrder}
                onImageUpload={handleImageUpload}
                onImageRemove={handleImageRemove}
                onCardTextChange={handleCardTextChange}
                handleKeyDownNoEnter={handleKeyDownNoEnter}
                getProductField={getProductField}
              />
            </ScrollReveal>
          </div>

          {/* ROW 2: PAST CREATIONS */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E0764A]" />
                <h3 className="font-heading text-2xl text-[#1F2B20] tracking-[0.02em]">
                  Past Creations
                </h3>
                <span className="text-xs font-bold uppercase tracking-wider text-[#1F2B20]/70 bg-[#D3DFC8] px-2.5 py-0.5 rounded-full">
                  Archive &amp; Inspo
                </span>
              </div>

              {/* Round arrow sideways scroll buttons (desktop only: hidden on phones) */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollRow(pastCreationsScrollRef, "left")}
                  aria-label="Scroll left past creations"
                  className="w-10 h-10 rounded-full bg-[#FDFCF6] hover:bg-[#FFF1B5] border border-[#D3DFC8] flex items-center justify-center text-[#1F2B20] shadow-sm transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRow(pastCreationsScrollRef, "right")}
                  aria-label="Scroll right past creations"
                  className="w-10 h-10 rounded-full bg-[#FDFCF6] hover:bg-[#FFF1B5] border border-[#D3DFC8] flex items-center justify-center text-[#1F2B20] shadow-sm transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Desktop Row: standard scrollable row (hidden on phones) */}
            <div
              ref={pastCreationsScrollRef}
              className="hidden md:flex gap-6 overflow-x-auto scroll-smooth no-scrollbar pb-4 pt-1 px-1"
            >
              {pastCreationsProducts.map((product, idx) => {
                const photoUrl = savedImages[product.id] || product.image;
                const name = getProductField(product, "name");
                const label = getProductField(product, "label");
                const description = getProductField(product, "description");
                const price = getProductField(product, "price");

                return (
                  <ScrollReveal key={product.id} staggerIndex={idx} className="shrink-0">
                    <article
                      className="w-[285px] bg-[#FDFCF6] rounded-[20px] p-4 flex flex-col justify-between shadow-[0_8px_24px_rgba(31,43,32,0.12)] border border-[#D3DFC8] h-full relative"
                    >
                      <div>
                        <ProductImageArea
                          product={product}
                          photoUrl={photoUrl}
                          editMode={editMode}
                          onUpload={(e) => {
                            if (e.target.files?.[0]) {
                              handleImageUpload(product.id, e.target.files[0]);
                            }
                          }}
                          onRemove={() => handleImageRemove(product.id)}
                        />

                        {/* Editable Label */}
                        <div
                          contentEditable={editMode}
                          suppressContentEditableWarning={true}
                          onKeyDown={editMode ? handleKeyDownNoEnter : undefined}
                          onBlur={editMode ? (e) => handleCardTextChange(product.id, "label", e.currentTarget.textContent || "") : undefined}
                          title={editMode ? "Click to edit label" : undefined}
                          className={`text-[13px] font-bold uppercase tracking-wider text-[#4E6B43] mb-1 outline-none rounded px-1 -mx-1 transition-colors ${
                            editMode ? "hover:bg-[#D3DFC8]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                          }`}
                        >
                          {label}
                        </div>

                        {/* Editable Product Name */}
                        <h4
                          contentEditable={editMode}
                          suppressContentEditableWarning={true}
                          onKeyDown={editMode ? handleKeyDownNoEnter : undefined}
                          onBlur={editMode ? (e) => handleCardTextChange(product.id, "name", e.currentTarget.textContent || "") : undefined}
                          title={editMode ? "Click to edit name" : undefined}
                          className={`font-heading text-xl text-[#1F2B20] leading-snug mb-1.5 tracking-[0.02em] outline-none rounded px-1 -mx-1 transition-colors ${
                            editMode ? "hover:bg-[#D3DFC8]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                          }`}
                        >
                          {name}
                        </h4>

                        {/* Editable Description */}
                        <p
                          contentEditable={editMode}
                          suppressContentEditableWarning={true}
                          onBlur={editMode ? (e) => handleCardTextChange(product.id, "description", e.currentTarget.textContent || "") : undefined}
                          title={editMode ? "Click to edit description" : undefined}
                          className={`text-[#1F2B20]/75 text-sm line-clamp-2 mb-3 outline-none rounded px-1 -mx-1 transition-colors ${
                            editMode ? "hover:bg-[#D3DFC8]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                          }`}
                        >
                          {description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[#D3DFC8]/80 mt-2">
                        {/* Editable Price */}
                        <span
                          contentEditable={editMode}
                          suppressContentEditableWarning={true}
                          onKeyDown={editMode ? handleKeyDownNoEnter : undefined}
                          onBlur={editMode ? (e) => handleCardTextChange(product.id, "price", e.currentTarget.textContent || "") : undefined}
                          title={editMode ? "Click to edit price" : undefined}
                          className={`text-[#E0764A] font-bold text-lg outline-none rounded px-1 -mx-1 transition-colors ${
                            editMode ? "hover:bg-[#D3DFC8]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                          }`}
                        >
                          {price}
                        </span>
                        <span className="bg-[#FFF1B5] text-[#1F2B20] text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-xs">
                          Sold
                        </span>
                      </div>
                    </article>
                  </ScrollReveal>
                );
              })}
            </div>

            {/* Mobile Stacked Card Deck (<= 768px only) */}
            <ScrollReveal className="w-full md:hidden">
              <MobileCardDeck
                products={pastCreationsProducts}
                isPastCreations
                savedImages={savedImages}
                cardEdits={cardEdits}
                editMode={editMode}
                onImageUpload={handleImageUpload}
                onImageRemove={handleImageRemove}
                onCardTextChange={handleCardTextChange}
                handleKeyDownNoEnter={handleKeyDownNoEnter}
                getProductField={getProductField}
              />
            </ScrollReveal>
          </div>
        </section>

        {/* ---------------------------------------------------------------------
            ABOUT SECTION (id="about")
            --------------------------------------------------------------------- */}
        <section id="about" className="w-full scroll-mt-24 md:scroll-mt-28">
          <ScrollReveal className="w-full">
            <div className="bg-[#FDFCF6] rounded-[32px] p-8 md:p-12 shadow-[0_8px_30px_rgba(31,43,32,0.12)] border border-[#D3DFC8]">
              {/* Top row: Display heading and FAQ button */}
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
                <div className="max-w-3xl">
                  <div className="text-[13px] font-bold tracking-widest uppercase text-[#4E6B43] mb-3">
                    About Our Studio
                  </div>
                  <MicroscopeHeading
                    as="h2"
                    text="Handcrafted crochet pieces made to move with you."
                    className="font-heading text-3xl sm:text-4xl md:text-[54px] lg:text-[60px] text-[#1F2B20] leading-[1.05] tracking-[0.02em]"
                  />
                </div>

                {/* Small FAQ button */}
                <div className="self-start lg:self-auto shrink-0 pt-2">
                  <button
                    type="button"
                    onClick={() => setFaqOpen(true)}
                    className="inline-flex items-center gap-2 bg-[#D3DFC8] hover:bg-[#FFF1B5] text-[#1F2B20] font-bold text-sm px-5 py-2.5 rounded-full transition-colors cursor-pointer shadow-sm"
                  >
                    <HelpCircle className="w-4 h-4 text-[#4E6B43]" />
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
              <div className="bg-[#D3DFC8] rounded-[20px] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#FDFCF6] flex items-center justify-center text-[#4E6B43] shrink-0 shadow-xs">
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
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ---------------------------------------------------------------------
            HOW TO GET YOUR PIECE (id="info")
            --------------------------------------------------------------------- */}
        <section id="info" className="w-full scroll-mt-24 md:scroll-mt-28">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="text-[13px] font-bold tracking-widest uppercase text-[#4E6B43] mb-2">
              The Process
            </div>
            <MicroscopeHeading
              as="h2"
              text="How to Get Your Piece"
              className="font-heading text-4xl sm:text-[44px] text-[#1F2B20] leading-[1.1] mb-3 tracking-[0.02em]"
            />
            <p className="text-[18px] text-[#1F2B20]/80 leading-[1.6]">
              Simple, transparent steps to bring your crochet dreams into reality.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* STEP 1 */}
            <ScrollReveal staggerIndex={0}>
              <div className="bg-[#FDFCF6] rounded-[20px] p-6 sm:p-7 flex flex-col justify-between shadow-[0_8px_24px_rgba(31,43,32,0.12)] border border-[#D3DFC8] hover:border-[#4E6B43]/40 transition-colors h-full">
                <div>
                  <div className="text-[13px] font-bold tracking-widest uppercase text-[#4E6B43] mb-3">
                    STEP 1
                  </div>
                  <h3 className="font-heading text-2xl text-[#1F2B20] mb-3 leading-snug tracking-[0.02em]">
                    Pick or Pitch
                  </h3>
                  <p className="text-[16px] text-[#1F2B20]/80 leading-relaxed">
                    Choose from our Featured Work or share a dream design or reference image. I'll let you know if I can bring it to life.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#D3DFC8]/70 flex items-center justify-between text-xs text-[#1F2B20]/60 font-semibold">
                  <span>Inspo &amp; Sketches</span>
                  <span className="w-2 h-2 rounded-full bg-[#FFF1B5]" />
                </div>
              </div>
            </ScrollReveal>

            {/* STEP 2 */}
            <ScrollReveal staggerIndex={1}>
              <div className="bg-[#FDFCF6] rounded-[20px] p-6 sm:p-7 flex flex-col justify-between shadow-[0_8px_24px_rgba(31,43,32,0.12)] border border-[#D3DFC8] hover:border-[#4E6B43]/40 transition-colors h-full">
                <div>
                  <div className="text-[13px] font-bold tracking-widest uppercase text-[#4E6B43] mb-3">
                    STEP 2
                  </div>
                  <h3 className="font-heading text-2xl text-[#1F2B20] mb-3 leading-snug tracking-[0.02em]">
                    Share Details &amp; Fit
                  </h3>
                  <p className="text-[16px] text-[#1F2B20]/80 leading-relaxed">
                    Tap Make Order, note any favorites, and share your sizing details.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#D3DFC8]/70 flex items-center justify-between text-xs text-[#1F2B20]/60 font-semibold">
                  <span>Custom Sizing</span>
                  <span className="w-2 h-2 rounded-full bg-[#F7B8CB]" />
                </div>
              </div>
            </ScrollReveal>

            {/* STEP 3 */}
            <ScrollReveal staggerIndex={2}>
              <div className="bg-[#FDFCF6] rounded-[20px] p-6 sm:p-7 flex flex-col justify-between shadow-[0_8px_24px_rgba(31,43,32,0.12)] border border-[#D3DFC8] hover:border-[#4E6B43]/40 transition-colors h-full">
                <div>
                  <div className="text-[13px] font-bold tracking-widest uppercase text-[#4E6B43] mb-3">
                    STEP 3
                  </div>
                  <h3 className="font-heading text-2xl text-[#1F2B20] mb-3 leading-snug tracking-[0.02em]">
                    Secure Your Slot
                  </h3>
                  <p className="text-[16px] text-[#1F2B20]/80 leading-relaxed">
                    Confirm your order with a 50% deposit so we can start crafting it.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#D3DFC8]/70 flex items-center justify-between text-xs text-[#1F2B20]/60 font-semibold">
                  <span>Deposit Confirms Slot</span>
                  <span className="w-2 h-2 rounded-full bg-[#4E6B43]" />
                </div>
              </div>
            </ScrollReveal>

            {/* STEP 4 */}
            <ScrollReveal staggerIndex={3}>
              <div className="bg-[#FDFCF6] rounded-[20px] p-6 sm:p-7 flex flex-col justify-between shadow-[0_8px_24px_rgba(31,43,32,0.12)] border border-[#D3DFC8] hover:border-[#4E6B43]/40 transition-colors h-full">
                <div>
                  <div className="text-[13px] font-bold tracking-widest uppercase text-[#4E6B43] mb-3">
                    STEP 4
                  </div>
                  <h3 className="font-heading text-2xl text-[#1F2B20] mb-3 leading-snug tracking-[0.02em]">
                    Made with Care &amp; Delivered
                  </h3>
                  <p className="text-[16px] text-[#1F2B20]/80 leading-relaxed">
                    We'll message you when your order is complete and again just before it's dispatched.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#D3DFC8]/70 flex items-center justify-between text-xs text-[#1F2B20]/60 font-semibold">
                  <span>Pick Up Mtaani</span>
                  <span className="w-2 h-2 rounded-full bg-[#E0764A]" />
                </div>
              </div>
            </ScrollReveal>
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
                {/* Orders Open / Closed Pill (clickable only in edit mode) */}
                {editMode ? (
                  <button
                    type="button"
                    onClick={toggleOrdersOpen}
                    title="Click to toggle order status"
                    aria-label={`Orders are currently ${ordersOpen ? "open" : "closed"}. Click to toggle.`}
                    className={`${
                      ordersOpen
                        ? "bg-[#FFF1B5] text-[#1F2B20] hover:bg-[#FFF1B5]/85"
                        : "bg-[#F7B8CB] text-[#1F2B20] hover:bg-[#F7B8CB]/85"
                    } text-xs font-black tracking-widest uppercase px-3.5 py-1 rounded-full mb-6 shadow-sm transition-colors cursor-pointer select-none`}
                  >
                    {ordersOpen ? "ORDERS OPEN" : "ORDERS CLOSED"}
                  </button>
                ) : (
                  <div
                    className={`${
                      ordersOpen ? "bg-[#FFF1B5] text-[#1F2B20]" : "bg-[#F7B8CB] text-[#1F2B20]"
                    } text-xs font-black tracking-widest uppercase px-3.5 py-1 rounded-full mb-6 shadow-sm select-none inline-block`}
                  >
                    {ordersOpen ? "ORDERS OPEN" : "ORDERS CLOSED"}
                  </div>
                )}

                <MicroscopeHeading
                  as="h2"
                  text="Let's Create Something Cute"
                  className="font-heading text-3xl sm:text-4xl md:text-5xl text-[#FDFCF6] leading-[1.1] mb-5 tracking-[0.02em]"
                />

                <p className="text-[18px] text-[#D3DFC8]/90 leading-[1.6] mb-8">
                  Ready to place your order or ask a question? Send a quick message below.
                </p>

                {/* Delivery Sentence Strip */}
                <div className="bg-[#172118] border border-[#2c3d2e] rounded-2xl p-4 w-full flex flex-col gap-2.5 text-sm text-[#D3DFC8]/80">
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
              <ScrollReveal className="lg:col-span-7">
                <div className="bg-[#FDFCF6] text-[#1F2B20] rounded-[20px] p-6 sm:p-8 md:p-9 shadow-2xl border border-[#D3DFC8]">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-heading text-2xl sm:text-3xl text-[#1F2B20] tracking-[0.02em]">
                      Let's make your piece
                    </h3>
                    {!ordersOpen && (
                      <span className="text-xs font-bold uppercase tracking-wider text-[#E0764A] bg-[#D3DFC8] px-2.5 py-1 rounded-full">
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
                        className="block text-[13px] font-bold uppercase tracking-wider text-[#4E6B43] mb-1.5"
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
                        className={`w-full bg-[#E2EAD8] border rounded-xl px-4 py-3 text-base text-[#1F2B20] placeholder:text-[#1F2B20]/40 focus:outline-none transition-all disabled:cursor-not-allowed ${
                          nameError
                            ? "border-[#E0764A] ring-1 ring-[#E0764A]"
                            : "border-[#D3DFC8] focus:ring-2 focus:ring-[#4E6B43]"
                        }`}
                      />
                      {nameError && (
                        <p className="text-xs text-[#E0764A] font-bold mt-1.5">
                          {nameError}
                        </p>
                      )}
                    </div>

                    {/* Order Type: full width, 16px font, at least 44px right padding */}
                    <div>
                      <label
                        htmlFor="orderType"
                        className="block text-[13px] font-bold uppercase tracking-wider text-[#4E6B43] mb-1.5"
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
                          className="w-full bg-[#E2EAD8] border border-[#D3DFC8] rounded-xl pl-4 py-3 text-[16px] text-[#1F2B20] focus:outline-none focus:ring-2 focus:ring-[#4E6B43] transition-all appearance-none cursor-pointer disabled:cursor-not-allowed"
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
                        <div className="mt-2 text-xs bg-[#DDEBD3] text-[#1F2B20] px-3.5 py-2 rounded-lg flex items-center justify-between font-medium gap-2">
                          <span className="truncate">
                            Basket items: <strong>{basket.map((i) => `${i.quantity}x ${getItemName(i.productId)}`).join(", ")}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => setCartOpen(true)}
                            className="text-xs text-[#4E6B43] font-bold hover:underline shrink-0 cursor-pointer"
                          >
                            View basket
                          </button>
                        </div>
                      ) : selectedItemName && orderType === "In-stock piece" ? (
                        <div className="mt-2 text-xs bg-[#DDEBD3] text-[#1F2B20] px-3.5 py-1.5 rounded-lg flex items-center justify-between font-medium">
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
                        className="block text-[13px] font-bold uppercase tracking-wider text-[#4E6B43] mb-1.5"
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
                        className="w-full bg-[#E2EAD8] border border-[#D3DFC8] rounded-xl p-4 text-base text-[#1F2B20] placeholder:text-[#1F2B20]/40 focus:outline-none focus:ring-2 focus:ring-[#4E6B43] transition-all resize-none disabled:cursor-not-allowed"
                      />
                      <p className="text-xs text-[#1F2B20]/70 mt-1.5 font-medium">
                        Have an inspiration photo? You can send it in WhatsApp after you tap send.
                      </p>
                    </div>

                    {/* Deep sage button disabled when orders are closed */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={!ordersOpen}
                        className={`w-full font-bold text-base py-3.5 px-6 rounded-full transition-colors shadow-md flex items-center justify-center gap-2 ${
                          ordersOpen
                            ? "bg-[#4E6B43] hover:bg-[#3F5A36] text-[#FDFCF6] cursor-pointer"
                            : "bg-[#4E6B43]/40 text-[#FDFCF6]/80 cursor-not-allowed"
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
                        <p className="text-center text-xs text-[#4E6B43] font-bold mt-2.5">
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
              </ScrollReveal>
            </div>
          </div>
        </section>
      </main>

      {/* -----------------------------------------------------------------------
          FOOTER
          ----------------------------------------------------------------------- */}
      {/* -----------------------------------------------------------------------
          FOOTER (Soft Pink #F9CCDA, square top corners, mt-12 = 48px)
          ----------------------------------------------------------------------- */}
      <footer className="w-full bg-[#F9CCDA] rounded-none mt-12 py-12 md:py-14 text-[#1F2B20]">
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 flex flex-col items-center text-center gap-7 sm:gap-8">
          <div className="flex items-center gap-2">
            <span className="font-heading text-3xl sm:text-4xl text-[#1F2B20] tracking-[0.02em]">
              ms.sage
            </span>
            <span className="bg-[#DDEBD3] text-[#1F2B20] text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              creates
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm font-bold text-[#1F2B20]">
            <button
              type="button"
              onClick={() => setPolicyOpen("privacy")}
              className="text-[#1F2B20] hover:underline transition-all cursor-pointer"
            >
              Privacy Policy
            </button>
            <span className="text-[#1F2B20]/40 select-none">·</span>
            <button
              type="button"
              onClick={() => setFaqOpen(true)}
              className="text-[#1F2B20] hover:underline transition-all cursor-pointer"
            >
              FAQ
            </button>
            <span className="text-[#1F2B20]/40 select-none">·</span>
            <button
              type="button"
              onClick={() => setPolicyOpen("delivery")}
              className="text-[#1F2B20] hover:underline transition-all cursor-pointer"
            >
              Delivery &amp; Pickup
            </button>
          </div>

          {/* Social links with icons on small circles in #F7B8CB */}
          <div className="flex items-center gap-4">
            <a
              href="https://www.instagram.com/ms.sage_creates"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram @ms.sage_creates"
              className="w-10 h-10 rounded-full bg-[#F7B8CB] flex items-center justify-center text-[#1F2B20] transition-colors shadow-xs"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://www.tiktok.com/@ms.sage_creates"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok @ms.sage_creates"
              className="w-10 h-10 rounded-full bg-[#F7B8CB] flex items-center justify-center text-[#1F2B20] transition-colors shadow-xs"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-2.882 2.766 2.89 2.89 0 0 1 2.896-2.896c.394 0 .768.082 1.11.228V9.378a6.376 6.376 0 0 0-1.11-.098 6.335 6.335 0 0 0-6.338 6.338 6.335 6.335 0 0 0 6.338 6.338 6.335 6.335 0 0 0 6.338-6.338V8.784a8.212 8.212 0 0 0 4.759 1.487V6.828c-.347-.02-.693-.068-1.002-.142z" />
              </svg>
            </a>
            <span className="text-sm font-bold text-[#1F2B20]">
              @ms.sage_creates
            </span>
          </div>

          {/* Copyright: 5 taps in 3s enables owner edit mode on mobile */}
          <div
            onClick={handleCopyrightTap}
            className="text-xs text-[#1F2B20]/80 font-medium cursor-pointer select-none"
          >
            © 2026 ms.sage creates. Handcrafted with care in Nairobi, Kenya.
          </div>
        </div>
      </footer>

      {/* Edit Mode Fixed Pill (Bottom-Left) */}
      {editMode && (
        <aside
          aria-label="Owner edit mode controls"
          className="fixed bottom-4 left-4 z-50 bg-[#1F2B20] text-[#FDFCF6] text-xs font-bold px-4 py-2 rounded-full shadow-lg border border-[#D3DFC8]/30 flex items-center gap-2 select-none animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <span className="w-2 h-2 rounded-full bg-[#4E6B43] animate-pulse" />
          <span>Edit mode on</span>
          <span className="text-[#FDFCF6]/40">·</span>
          <button
            type="button"
            onClick={() => {
              setEditModeAndPersist(false);
              showToast("Edit mode exited");
            }}
            className="text-[#F7B8CB] hover:text-[#FFF1B5] font-black underline cursor-pointer transition-colors"
          >
            Exit
          </button>
        </aside>
      )}

      {/* -----------------------------------------------------------------------
          INTERACTIVE OVERLAYS
          ----------------------------------------------------------------------- */}

      {/* Toast Notification: "Added to basket" */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 md:top-24 left-1/2 -translate-x-1/2 z-[70] bg-[#1F2B20] text-[#FDFCF6] text-sm font-bold px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2.5 border border-[#D3DFC8]/20 animate-in fade-in slide-in-from-top-2 duration-150 pointer-events-none"
        >
          <span className="w-2 h-2 rounded-full bg-[#4E6B43] shrink-0" />
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
              inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[28px] border-t border-[#D3DFC8]
              /* Desktop: right-side drawer */
              md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-full md:w-[420px] md:rounded-l-[28px] md:rounded-tr-none md:border-l md:border-t-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D3DFC8] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#D3DFC8] text-[#4E6B43] flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <h3 className="font-heading text-xl text-[#1F2B20] tracking-[0.02em]">
                  Order Basket
                </h3>
                {totalBasketItems > 0 && (
                  <span className="bg-[#DDEBD3] text-[#1F2B20] text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {totalBasketItems} {totalBasketItems === 1 ? "item" : "items"}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="Close basket"
                className="w-8 h-8 rounded-full bg-[#D3DFC8] hover:bg-[#FFF1B5] text-[#1F2B20] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {basket.length === 0 ? (
                <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center py-10 px-2">
                  <div className="w-14 h-14 rounded-full bg-[#D3DFC8] text-[#4E6B43] flex items-center justify-center mb-4">
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
                    className="bg-[#4E6B43] hover:bg-[#3F5A36] text-[#FDFCF6] font-bold text-sm px-6 py-3 rounded-full transition-colors cursor-pointer shadow-xs"
                  >
                    Browse the shop
                  </button>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-[#D3DFC8]">
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
                              className="w-12 h-14 rounded-xl object-cover shrink-0 bg-[#D3DFC8]"
                            />
                          ) : (
                            <div className="w-12 h-14 rounded-xl bg-[#D3DFC8] flex items-center justify-center text-[#4E6B43] shrink-0">
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
                        <div className="flex items-center bg-[#D3DFC8] rounded-full p-1 shrink-0">
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
              <div className="p-5 border-t border-[#D3DFC8] bg-[#FDFCF6] shrink-0">
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
                  className="w-full bg-[#4E6B43] hover:bg-[#3F5A36] text-[#FDFCF6] font-bold text-base py-3.5 px-6 rounded-full text-center transition-colors cursor-pointer shadow-md"
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
          <div className="bg-[#FDFCF6] rounded-[24px] p-6 sm:p-7 max-w-lg w-full max-h-[85dvh] overflow-y-auto shadow-2xl border border-[#D3DFC8] relative my-auto">
            <button
              type="button"
              onClick={() => setFaqOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#D3DFC8] flex items-center justify-center text-[#1F2B20] hover:bg-[#FFF1B5] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <MicroscopeHeading
              as="h3"
              text="Frequently Asked Questions"
              className="font-heading text-2xl text-[#1F2B20] mb-5 tracking-[0.02em]"
            />
            <div className="space-y-4 text-left text-sm text-[#1F2B20]">
              <div className="bg-[#E2EAD8] p-4 rounded-xl">
                <div className="font-bold text-base mb-1 text-[#1F2B20]">
                  How long does a custom order take?
                </div>
                <div className="text-[#1F2B20]/80">
                  Made-to-measure pieces usually take between 7 to 21 days depending on design complexity and current queue. In-stock drops are dispatched weekly on specific days, as will be communicated.
                </div>
              </div>
              <div className="bg-[#E2EAD8] p-4 rounded-xl">
                <div className="font-bold text-base mb-1 text-[#1F2B20]">
                  How does Pick Up Mtaani work?
                </div>
                <div className="text-[#1F2B20]/80">
                  Pick Up Mtaani allows you to collect your package from hundreds of secure pickup agent locations across Nairobi and neighboring towns at affordable rates. Delivery is available through Pick Up Mtaani as well.
                </div>
              </div>
              <div className="bg-[#E2EAD8] p-4 rounded-xl">
                <div className="font-bold text-base mb-1 text-[#1F2B20]">
                  How do I care for my crochet piece?
                </div>
                <div className="text-[#1F2B20]/80">
                  Gently hand-wash in cool water with mild wool detergent. Lay flat on a clean towel to dry. Never hang heavy wet garments or machine tumble-dry.
                </div>
              </div>
              <div className="bg-[#E2EAD8] p-4 rounded-xl">
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
          <div className="bg-[#FDFCF6] rounded-[24px] p-6 sm:p-7 max-w-lg w-full max-h-[85dvh] overflow-y-auto shadow-2xl border border-[#D3DFC8] relative my-auto">
            <button
              type="button"
              onClick={() => setPolicyOpen(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#D3DFC8] flex items-center justify-center text-[#1F2B20] hover:bg-[#FFF1B5] transition-colors cursor-pointer"
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
