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
  Sliders,
  Search,
  RefreshCw,
} from "lucide-react";
import defaultHeroImage from "./assets/hero_featured.png";

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

interface ProcessedHeroArtwork {
  trimmedUrl: string;
  bgColor: string;
}

function processAndTrimArtwork(imageSrc: string): Promise<ProcessedHeroArtwork> {
  const fallbackColor = "#D5E2D4";
  return new Promise((resolve) => {
    if (!imageSrc) {
      resolve({ trimmedUrl: "", bgColor: fallbackColor });
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h || w <= 0 || h <= 0) {
          resolve({ trimmedUrl: imageSrc, bgColor: fallbackColor });
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve({ trimmedUrl: imageSrc, bgColor: fallbackColor });
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // 1. Detect background color as the MODE (most common color among border pixels, with fallback #D5E2D4)
        // Group border pixels into subtle buckets of 4 to handle slight compression artifacts
        const colorCounts = new Map<string, { count: number; r: number; g: number; b: number }>();

        const sampleBorderPixel = (idx: number) => {
          const a = data[idx + 3];
          if (a < 64) return; // ignore transparent edge pixels
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const key = `${Math.round(r / 4) * 4},${Math.round(g / 4) * 4},${Math.round(b / 4) * 4}`;
          const existing = colorCounts.get(key);
          if (existing) {
            existing.count++;
            existing.r += r;
            existing.g += g;
            existing.b += b;
          } else {
            colorCounts.set(key, { count: 1, r, g, b });
          }
        };

        // Top and bottom borders (sample outer 2 rows)
        for (let row = 0; row < Math.min(2, h); row++) {
          for (let x = 0; x < w; x++) {
            sampleBorderPixel((row * w + x) * 4);
          }
        }
        for (let row = Math.max(0, h - 2); row < h; row++) {
          for (let x = 0; x < w; x++) {
            sampleBorderPixel((row * w + x) * 4);
          }
        }

        // Left and right borders (sample outer 2 columns)
        for (let y = 0; y < h; y++) {
          for (let col = 0; col < Math.min(2, w); col++) {
            sampleBorderPixel((y * w + col) * 4);
          }
          for (let col = Math.max(0, w - 2); col < w; col++) {
            sampleBorderPixel((y * w + col) * 4);
          }
        }

        let bgR = 213;
        let bgG = 226;
        let bgB = 212;

        let maxCount = 0;
        colorCounts.forEach((val) => {
          if (val.count > maxCount) {
            maxCount = val.count;
            bgR = Math.round(val.r / val.count);
            bgG = Math.round(val.g / val.count);
            bgB = Math.round(val.b / val.count);
          }
        });

        const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
        const detectedBgColor = `#${toHex(bgR)}${toHex(bgG)}${toHex(bgB)}`;

        // 2. Scan bounding box of artwork:
        // Every pixel whose color differs from background color by more than tolerance of 12 (out of 255) per channel
        let minX = w;
        let maxX = -1;
        let minY = h;
        let maxY = -1;

        const tolerance = 12;

        for (let y = 0; y < h; y++) {
          const rowOffset = y * w;
          for (let x = 0; x < w; x++) {
            const idx = (rowOffset + x) * 4;
            const a = data[idx + 3];
            if (a > 32) {
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              if (
                Math.abs(r - bgR) > tolerance ||
                Math.abs(g - bgG) > tolerance ||
                Math.abs(b - bgB) > tolerance
              ) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
        }

        // If no non-background pixels detected, return uncropped
        if (maxX < minX || maxY < minY) {
          resolve({ trimmedUrl: imageSrc, bgColor: detectedBgColor });
          return;
        }

        // Add 3% padding on every side
        const artworkW = maxX - minX + 1;
        const artworkH = maxY - minY + 1;
        const padX = Math.round(artworkW * 0.03);
        const padY = Math.round(artworkH * 0.03);

        const cropX = Math.max(0, minX - padX);
        const cropY = Math.max(0, minY - padY);
        const cropW = Math.min(w - cropX, (maxX + padX) - cropX + 1);
        const cropH = Math.min(h - cropY, (maxY + padY) - cropY + 1);

        if (cropW <= 0 || cropH <= 0) {
          resolve({ trimmedUrl: imageSrc, bgColor: detectedBgColor });
          return;
        }

        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext("2d");
        if (!cropCtx) {
          resolve({ trimmedUrl: imageSrc, bgColor: detectedBgColor });
          return;
        }

        cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const trimmedUrl = cropCanvas.toDataURL("image/png");

        resolve({ trimmedUrl, bgColor: detectedBgColor });
      } catch {
        resolve({ trimmedUrl: imageSrc, bgColor: fallbackColor });
      }
    };
    img.onerror = () => resolve({ trimmedUrl: imageSrc, bgColor: fallbackColor });
    img.src = imageSrc;
  });
}

function detectImageEdgeColor(imageSrc: string): Promise<string> {
  return processAndTrimArtwork(imageSrc).then((res) => res.bgColor);
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
          ? "bg-[#E0764A] text-[#FFFFFF] animate-pulse"
          : "bg-[#EEE7D6] hover:bg-[#F7B8CB]"
      }`}
    >
      {confirming ? "Tap again to confirm" : "Remove"}
    </button>
  );
}

const transparencyCache = new Map<string, boolean>();

function checkImageCornersTransparent(imageSrc: string): Promise<boolean> {
  if (!imageSrc) return Promise.resolve(false);
  if (transparencyCache.has(imageSrc)) {
    return Promise.resolve(transparencyCache.get(imageSrc)!);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = Math.min(img.naturalWidth || img.width || 48, 48);
        const h = Math.min(img.naturalHeight || img.height || 48, 48);
        if (w <= 0 || h <= 0) {
          resolve(false);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(false);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h).data;

        // Sample corners (0,0), (w-1, 0), (0, h-1), (w-1, h-1)
        const corners = [
          [0, 0],
          [w - 1, 0],
          [0, h - 1],
          [w - 1, h - 1],
          [1, 1],
          [w - 2, 1],
          [1, h - 2],
          [w - 2, h - 2],
        ];

        let hasTransparent = false;
        for (const [cx, cy] of corners) {
          const idx = (cy * w + cx) * 4;
          const alpha = imgData[idx + 3];
          if (alpha < 240) {
            hasTransparent = true;
            break;
          }
        }
        transparencyCache.set(imageSrc, hasTransparent);
        resolve(hasTransparent);
      } catch {
        resolve(false);
      }
    };
    img.onerror = () => resolve(false);
    img.src = imageSrc;
  });
}

function DeleteCardButton({
  onDelete,
  disabled,
}: {
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (!confirming) {
      setConfirming(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setConfirming(false);
      }, 3000);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setConfirming(false);
      onDelete();
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title="At least one card must remain in this row"
        className="opacity-30 cursor-not-allowed p-1.5 rounded-full bg-[#FFFFFF]/90 text-[#1F2B20] shadow-xs border border-[rgba(31,43,32,0.10)]"
        aria-label="Cannot delete only card"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={confirming ? "Tap again to confirm deletion" : "Delete card"}
      className={`text-[11px] font-bold transition-all shadow-md cursor-pointer whitespace-nowrap z-20 flex items-center gap-1 border border-[rgba(31,43,32,0.12)] ${
        confirming
          ? "bg-[#E0764A] text-[#FFFFFF] px-2.5 py-1 rounded-full animate-pulse"
          : "p-1.5 rounded-full bg-[#FFFFFF]/90 hover:bg-[#F7B8CB] text-[#1F2B20]/80 hover:text-[#1F2B20] backdrop-blur-xs"
      }`}
    >
      <Trash2 className="w-3.5 h-3.5" />
      {confirming && <span>Tap again to confirm</span>}
    </button>
  );
}

/* ==========================================================================
   PRODUCT IMAGE AREA COMPONENT
   Image placeholder blocks & empty slots: tint #E9E3D3, dashed outlines #6F8F5F at 50% opacity
   Fit mode: contain with blurred backdrop (or #F5EFE3 for transparent cutouts)
   Fill mode: cover (default)
   ========================================================================== */

function ProductImageArea({
  product,
  photoUrl,
  editMode,
  fitMode = "fill",
  onSetFit,
  onUpload,
  onRemove,
}: {
  product: Product;
  photoUrl?: string;
  editMode: boolean;
  fitMode?: "fill" | "fit";
  onSetFit?: (fit: "fill" | "fit") => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTransparent, setIsTransparent] = useState(false);

  useEffect(() => {
    if (photoUrl && fitMode === "fit") {
      checkImageCornersTransparent(photoUrl).then((transparent) => {
        setIsTransparent(transparent);
      });
    }
  }, [photoUrl, fitMode]);

  if (photoUrl) {
    const isFit = fitMode === "fit";

    return (
      <div className="aspect-[4/5] w-full rounded-[16px] overflow-hidden relative group mb-4 bg-[#E9E3D3]">
        {/* Fit mode: blurred backdrop or soft tint #F5EFE3 */}
        {isFit ? (
          <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
            {isTransparent ? (
              <div className="absolute inset-0 bg-[#F5EFE3]" />
            ) : (
              <img
                src={photoUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover scale-[1.25] blur-[24px] pointer-events-none select-none"
              />
            )}
            <img
              src={photoUrl}
              alt={product.name}
              className="relative z-10 w-full h-full object-contain"
            />
          </div>
        ) : (
          <img
            src={photoUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        )}

        {/* Edit mode: Change & Remove buttons in center overlay */}
        {editMode && (
          <div className="absolute inset-0 bg-[#1F2B20]/45 flex items-center justify-center gap-2 p-2 transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100 [@media(hover:none)]:!opacity-100 z-20">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#FFFFFF] hover:bg-[#EEE7D6] text-[#1F2B20] text-xs font-bold px-3 py-1.5 rounded-full shadow-sm cursor-pointer transition-colors"
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

        {/* Edit mode only: small toggle button "Fit / Fill" in bottom-left corner */}
        {editMode && onSetFit && (
          <div className="absolute bottom-2 left-2 z-30">
            <div className="inline-flex items-center bg-[#FFFFFF]/95 backdrop-blur-xs rounded-full p-0.5 shadow-md border border-[rgba(31,43,32,0.12)] text-[11px] font-bold">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetFit("fit");
                }}
                className={`px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                  isFit
                    ? "bg-[#6F8F5F] text-[#FFFFFF]"
                    : "text-[#1F2B20]/80 hover:text-[#1F2B20]"
                }`}
                aria-label="Fit photo in card"
              >
                Fit
              </button>
              <span className="text-[#1F2B20]/30 text-[10px]">/</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetFit("fill");
                }}
                className={`px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                  !isFit
                    ? "bg-[#6F8F5F] text-[#FFFFFF]"
                    : "text-[#1F2B20]/80 hover:text-[#1F2B20]"
                }`}
                aria-label="Fill photo in card"
              >
                Fill
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // When edit mode is OFF: plain warm neutral placeholder #E9E3D3 with dashed outline in #6F8F5F at 50% opacity
  if (!editMode) {
    return (
      <div className="aspect-[4/5] w-full rounded-[16px] mb-4 bg-[#E9E3D3] border-2 border-dashed border-[#6F8F5F]/50" />
    );
  }

  // When edit mode is ON: upload prompt with warm neutral #E9E3D3 and dashed outline in #6F8F5F at 50% opacity
  return (
    <div className="aspect-[4/5] w-full mb-4">
      <label className="w-full h-full border-2 border-dashed border-[#6F8F5F]/50 rounded-[16px] bg-[#E9E3D3] hover:bg-[#E9E3D3]/80 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onUpload}
        />
        <div className="w-9 h-9 rounded-full bg-[#FFFFFF] group-hover:bg-[#EEE7D6] flex items-center justify-center text-[#6F8F5F] shadow-xs transition-colors">
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
  cardFit,
  cardStatus,
  editMode,
  onSelectProductForOrder,
  onImageUpload,
  onImageRemove,
  onCardTextChange,
  onSetCardFit,
  onToggleStatus,
  onDeleteCard,
  onAddCard,
  handleKeyDownNoEnter,
  getProductField,
  isPastCreations = false,
}: {
  products: Product[];
  savedImages: Record<string, string>;
  cardEdits: Record<string, { name?: string; label?: string; description?: string; price?: string }>;
  cardFit: Record<string, "fill" | "fit">;
  cardStatus?: Record<string, "sold" | "available">;
  editMode: boolean;
  onSelectProductForOrder?: (product: Product) => void;
  onImageUpload: (key: string, file: File) => void;
  onImageRemove: (key: string) => void;
  onCardTextChange: (id: string, field: "name" | "label" | "description" | "price", value: string) => void;
  onSetCardFit: (id: string, fit: "fill" | "fit") => void;
  onToggleStatus?: (id: string) => void;
  onDeleteCard?: (id: string) => void;
  onAddCard?: () => void;
  handleKeyDownNoEnter: (e: React.KeyboardEvent<HTMLElement>) => void;
  getProductField: (product: Product, field: "name" | "label" | "description" | "price") => string;
  isPastCreations?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState<"left" | "right" | "rubber" | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (currentIndex >= products.length) {
      setCurrentIndex(Math.max(0, products.length - 1));
    }
  }, [products.length, currentIndex]);

  const handleAddCardUnderDeck = () => {
    if (onAddCard) {
      onAddCard();
      setCurrentIndex(products.length);
    }
  };

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
          boxShadow: "0 18px 30px rgba(60, 45, 20, 0.16)",
          transition: "none",
        };
      }
      if (rel === -1 && dragX > 0) {
        return {
          transform: `translateX(${dragX - cardWidthRef.current}px) rotate(${(dragX - cardWidthRef.current) / 20}deg)`,
          opacity: 1,
          zIndex: 35,
          boxShadow: "0 18px 30px rgba(60, 45, 20, 0.16)",
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
          boxShadow: "0 18px 30px rgba(60, 45, 20, 0.12)",
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
          boxShadow: "0 18px 30px rgba(60, 45, 20, 0.08)",
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
        boxShadow: "0 18px 30px rgba(60, 45, 20, 0.16)",
        transition: "transform 250ms ease-out, opacity 250ms ease-out",
      };
    }
    if (rel === 1) {
      return {
        transform: "translate(0, 12px) scale(0.95) rotate(2deg)",
        opacity: 1,
        zIndex: 20,
        boxShadow: "0 18px 30px rgba(60, 45, 20, 0.12)",
        transition: "transform 250ms ease-out, opacity 250ms ease-out",
      };
    }
    if (rel === 2) {
      return {
        transform: "translate(0, 24px) scale(0.90) rotate(-2deg)",
        opacity: 1,
        zIndex: 10,
        boxShadow: "0 18px 30px rgba(60, 45, 20, 0.08)",
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
      aria-label={`${isPastCreations ? "Past creations" : "Recent creations"} card deck, swipe or use arrow keys`}
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
              className="absolute inset-x-0 top-0 bg-[#FDFCF6] rounded-[20px] p-4 flex flex-col justify-between shadow-[0_8px_24px_rgba(60,45,20,0.10)] will-change-transform relative"
            >
              {/* Delete card button (top-right corner in edit mode) */}
              {editMode && isTopCard && onDeleteCard && (
                <div className="absolute top-2.5 right-2.5 z-30">
                  <DeleteCardButton
                    onDelete={() => onDeleteCard(product.id)}
                    disabled={products.length <= 1}
                  />
                </div>
              )}

              <div>
                <ProductImageArea
                  product={product}
                  photoUrl={photoUrl}
                  editMode={editMode && isTopCard}
                  fitMode={cardFit[product.id] || "fill"}
                  onSetFit={(fit) => onSetCardFit(product.id, fit)}
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
                  className={`text-[13px] font-bold uppercase tracking-wider text-[#6F8F5F] mb-1 outline-none rounded px-1 -mx-1 transition-colors ${
                    editMode && isTopCard ? "hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
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
                    editMode && isTopCard ? "hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
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
                    editMode && isTopCard ? "hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                  }`}
                >
                  {description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[rgba(60,45,20,0.08)] mt-2">
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
                    editMode && isTopCard ? "hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
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
                    className="bg-[#6F8F5F] hover:bg-[#5E7C4F] text-[#FFFFFF] text-xs font-bold px-4 py-2 rounded-full transition-colors cursor-pointer shadow-xs"
                  >
                    Order this
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    {editMode && isTopCard && onToggleStatus ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStatus(product.id);
                        }}
                        className={`text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wider shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                          (cardStatus?.[product.id] || "sold") === "available"
                            ? "bg-[#6F8F5F] hover:bg-[#5E7C4F] text-[#FFFFFF]"
                            : "bg-[#FFF1B5] hover:bg-[#FFF1B5]/85 text-[#1F2B20]"
                        }`}
                        title="Tap to switch status between Sold and Available"
                        aria-label={`Status: ${(cardStatus?.[product.id] || "sold") === "available" ? "Available" : "Sold"}. Tap to switch.`}
                      >
                        <span>{(cardStatus?.[product.id] || "sold") === "available" ? "Available" : "Sold"}</span>
                        <RefreshCw className="w-3 h-3 shrink-0" />
                      </button>
                    ) : (
                      <span
                        className={`text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-xs ${
                          (cardStatus?.[product.id] || "sold") === "available"
                            ? "bg-[#6F8F5F] text-[#FFFFFF]"
                            : "bg-[#FFF1B5] text-[#1F2B20]"
                        }`}
                      >
                        {(cardStatus?.[product.id] || "sold") === "available" ? "Available" : "Sold"}
                      </span>
                    )}

                    {(cardStatus?.[product.id] || "sold") === "available" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectProductForOrder) onSelectProductForOrder(product);
                        }}
                        className="bg-[#6F8F5F] hover:bg-[#5E7C4F] text-[#FFFFFF] text-xs font-bold px-3.5 py-1.5 rounded-full transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                      >
                        Order this
                      </button>
                    )}
                  </div>
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
            aria-label={`Go to piece ${dotIdx + 1} of ${products.length}`}
            className={`rounded-full transition-all ${
              currentIndex === dotIdx
                ? "w-6 h-2 bg-[#6F8F5F]"
                : "w-2 h-2 bg-[#EEE7D6] hover:bg-[#6F8F5F]/50"
            }`}
          />
        ))}
      </div>
      <p className="text-xs font-semibold text-[#1F2B20]/60 mt-1 select-none text-center">
        Piece {currentIndex + 1} of {products.length} · Swipe to see more
      </p>

      {/* On phones, show "+ Add card" button directly under each deck in edit mode */}
      {editMode && products.length < 12 && onAddCard && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={handleAddCardUnderDeck}
            className="border-2 border-dashed border-[#6F8F5F]/60 bg-[#FFFFFF] hover:bg-[#EEE7D6] text-[#1F2B20] text-xs font-bold px-4 py-2 rounded-full shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            aria-label={`Add card to ${isPastCreations ? "Past Creations" : "Recent Creations"}`}
          >
            <Plus className="w-4 h-4 stroke-[2.5] text-[#6F8F5F]" />
            <span>+ Add card ({products.length}/12)</span>
          </button>
        </div>
      )}
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

  // Track scroll position: transparent under 40px, regain colors past 40px
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Threshold: 40px from top
      const scrolled = window.scrollY > 40;
      setIsScrolled(scrolled);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
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

  // 6. Products list state (persisted in localStorage)
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("ms_sage_products_custom");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch {
      // fallback
    }
    return PRODUCTS;
  });

  const persistProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    try {
      localStorage.setItem("ms_sage_products_custom", JSON.stringify(newProducts));
    } catch {
      // Ignore storage error
    }
  };

  // 7. Card fit setting per card ("fill" | "fit")
  const [cardFit, setCardFit] = useState<Record<string, "fill" | "fit">>(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("ms_sage_card_fit");
        if (saved) return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return {};
  });

  const handleSetCardFit = (productId: string, fit: "fill" | "fit") => {
    setCardFit((prev) => {
      const next = { ...prev, [productId]: fit };
      try {
        localStorage.setItem("ms_sage_card_fit", JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  // 8. Card status per card in Past Creations ("sold" | "available", default: "sold")
  const [cardStatus, setCardStatus] = useState<Record<string, "sold" | "available">>(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("ms_sage_card_status");
        if (saved) return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return {};
  });

  const handleToggleCardStatus = (productId: string) => {
    setCardStatus((prev) => {
      const current = prev[productId] || "sold";
      const nextStatus: "sold" | "available" = current === "sold" ? "available" : "sold";
      const next: Record<string, "sold" | "available"> = { ...prev, [productId]: nextStatus };
      try {
        localStorage.setItem("ms_sage_card_status", JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  // Add Card handler
  const handleAddCard = (category: "in-stock" | "past-creation") => {
    const existingCount = products.filter((p) => p.category === category).length;
    if (existingCount >= 12) return;

    const newId = `prod-${category}-${Date.now()}`;
    const newProduct: Product = {
      id: newId,
      name: "Lorem Ipsum Dolor",
      category,
      label: "LOREM IPSUM",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      price: "KES 0,000",
    };

    const nextProducts = [...products, newProduct];
    persistProducts(nextProducts);

    // Default to Fill mode
    setCardFit((prev) => {
      const next = { ...prev, [newId]: "fill" as const };
      try {
        localStorage.setItem("ms_sage_card_fit", JSON.stringify(next));
      } catch {}
      return next;
    });

    // New cards added to Past Creations start as Sold
    if (category === "past-creation") {
      setCardStatus((prev) => {
        const next = { ...prev, [newId]: "sold" as const };
        try {
          localStorage.setItem("ms_sage_card_status", JSON.stringify(next));
        } catch {}
        return next;
      });
    }

    showToast("Added new card");
  };

  // Delete Card handler (needs two taps to confirm, disabled if 1 card left)
  const handleDeleteCard = async (productId: string) => {
    const targetProduct = products.find((p) => p.id === productId);
    if (!targetProduct) return;

    const remainingInRow = products.filter((p) => p.category === targetProduct.category).length;
    if (remainingInRow <= 1) {
      showToast("Cannot delete the only card in this row");
      return;
    }

    const nextProducts = products.filter((p) => p.id !== productId);
    persistProducts(nextProducts);

    await removeImageFromStorage(productId);
    setSavedImages((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });

    setCardEdits((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      try {
        localStorage.setItem("ms_sage_card_edits", JSON.stringify(copy));
      } catch {}
      return copy;
    });

    setCardFit((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      try {
        localStorage.setItem("ms_sage_card_fit", JSON.stringify(copy));
      } catch {}
      return copy;
    });

    setCardStatus((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      try {
        localStorage.setItem("ms_sage_card_status", JSON.stringify(copy));
      } catch {}
      return copy;
    });

    setBasket((prev) => {
      const copy = prev.filter((item) => item.productId !== productId);
      try {
        localStorage.setItem("ms_sage_basket", JSON.stringify(copy));
      } catch {}
      return copy;
    });

    showToast("Card deleted");
  };

  const inStockProducts = products.filter((p) => p.category === "in-stock");
  const pastCreationsProducts = products.filter((p) => p.category === "past-creation");

  // Helper to get product name using current (edited) card text
  const getItemName = (productId: string): string => {
    const product = products.find((p) => p.id === productId);
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

  const heroImage = savedImages["hero_featured"] || defaultHeroImage;
  const [heroAspectRatio, setHeroAspectRatio] = useState<number>(1024 / 572);

  useEffect(() => {
    if (!heroImage) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setHeroAspectRatio(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = heroImage;
  }, [heroImage]);

  const isNarrow = heroAspectRatio < 1.72;

  const navIsSolid = isScrolled || mobileMenuOpen;

  return (
    <div className="min-h-dvh bg-[#F7F1E5] text-[#1F2B20] selection:bg-[#FFF1B5] selection:text-[#1F2B20] flex flex-col items-center">
      {/* -----------------------------------------------------------------------
          HEADER & NAVIGATION
          ----------------------------------------------------------------------- */}
      <header className="sticky top-3 md:top-4 z-50 w-full max-w-[1200px] px-4 pointer-events-none">
        <div className="relative pointer-events-auto flex flex-col w-full">
          {/* Main Nav Bar */}
          <nav
            aria-label="Main Navigation"
            className={`w-full rounded-2xl md:rounded-full px-4 sm:px-8 py-2.5 md:py-3 flex items-center justify-between transition-all duration-250 ease-out ${
              navIsSolid
                ? "bg-[#FFFFFF] border border-[#1F2B20]/10 shadow-[0_10px_25px_rgba(60,45,20,0.08)]"
                : "bg-transparent border border-transparent shadow-none"
            }`}
          >
            {/* --- PHONE NAV (<= 768px: md:hidden) --- */}
            <div className="flex md:hidden items-center justify-between w-full relative">
              {/* Far left: "ms.sage" wordmark + "CREATES" pill */}
              <div className="flex items-center gap-1.5 min-[380px]:gap-2 shrink-0 select-none">
                <span className="font-heading text-[22px] min-[360px]:text-2xl sm:text-3xl leading-none text-[#1F2B20] tracking-[0.02em] whitespace-nowrap">
                  ms.sage
                </span>
                <span className="bg-[#DDEBD3] text-[#1F2B20] text-[9px] min-[360px]:text-[10px] font-black px-1.5 min-[360px]:px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap leading-none">
                  CREATES
                </span>
              </div>

              {/* Far right: Search icon, Cart icon, Hamburger menu icon */}
              <div className="flex items-center gap-1 sm:gap-1.5 z-10 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection("shop");
                    const el = document.getElementById("shop");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  aria-label="Search or explore shop"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#1F2B20] hover:text-[#6F8F5F] hover:bg-[#EEE7D6]/60 transition-colors duration-250 cursor-pointer"
                >
                  <Search className="w-5 h-5 stroke-[2]" />
                </button>

                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  aria-label={totalBasketItems > 0 ? `Shopping cart, ${totalBasketItems} items` : "Shopping cart"}
                  className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#1F2B20] hover:text-[#6F8F5F] hover:bg-[#EEE7D6]/60 transition-colors duration-250 cursor-pointer"
                >
                  <ShoppingCart className="w-5 h-5 stroke-[2]" />
                  {totalBasketItems > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#6F8F5F] text-[#FFFFFF] text-[10px] font-black min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center shadow-xs leading-none">
                      {totalBasketItems}
                    </span>
                  )}
                  <span className="sr-only">{totalBasketItems} items in cart</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label="Toggle navigation menu"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#1F2B20] hover:text-[#6F8F5F] hover:bg-[#EEE7D6]/60 transition-colors duration-250 cursor-pointer"
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
              {/* ZONE 1 (Left): Links Shop and About */}
              <div className="flex items-center gap-7 lg:gap-10 flex-1 justify-start">
                <a
                  href="#shop"
                  onClick={() => setActiveSection("shop")}
                  aria-current={activeSection === "shop" ? "true" : undefined}
                  className={`relative py-1 text-[16px] md:text-[17px] transition-colors duration-250 select-none ${
                    activeSection === "shop"
                      ? navIsSolid
                        ? "text-[#6F8F5F] font-extrabold"
                        : "text-[#1F2B20] font-extrabold"
                      : navIsSolid
                        ? "text-[#1F2B20] font-bold hover:text-[#6F8F5F]"
                        : "text-[#1F2B20] font-bold hover:opacity-75"
                  }`}
                >
                  <span>Shop</span>
                  {activeSection === "shop" && (
                    <span
                      className={`absolute -bottom-1.5 left-0 right-0 h-[3px] rounded-full transition-colors duration-250 ${
                        navIsSolid ? "bg-[#6F8F5F]" : "bg-[#1F2B20]"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </a>

                <a
                  href="#about"
                  onClick={() => setActiveSection("about")}
                  aria-current={activeSection === "about" ? "true" : undefined}
                  className={`relative py-1 text-[16px] md:text-[17px] transition-colors duration-250 select-none ${
                    activeSection === "about"
                      ? navIsSolid
                        ? "text-[#6F8F5F] font-extrabold"
                        : "text-[#1F2B20] font-extrabold"
                      : navIsSolid
                        ? "text-[#1F2B20] font-bold hover:text-[#6F8F5F]"
                        : "text-[#1F2B20] font-bold hover:opacity-75"
                  }`}
                >
                  <span>About</span>
                  {activeSection === "about" && (
                    <span
                      className={`absolute -bottom-1.5 left-0 right-0 h-[3px] rounded-full transition-colors duration-250 ${
                        navIsSolid ? "bg-[#6F8F5F]" : "bg-[#1F2B20]"
                      }`}
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
                  className={`relative py-1 text-[16px] md:text-[17px] transition-colors duration-250 select-none ${
                    activeSection === "info"
                      ? navIsSolid
                        ? "text-[#6F8F5F] font-extrabold"
                        : "text-[#1F2B20] font-extrabold"
                      : navIsSolid
                        ? "text-[#1F2B20] font-bold hover:text-[#6F8F5F]"
                        : "text-[#1F2B20] font-bold hover:opacity-75"
                  }`}
                >
                  <span>Info</span>
                  {activeSection === "info" && (
                    <span
                      className={`absolute -bottom-1.5 left-0 right-0 h-[3px] rounded-full transition-colors duration-250 ${
                        navIsSolid ? "bg-[#6F8F5F]" : "bg-[#1F2B20]"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </a>

                <a
                  href="#order"
                  onClick={() => setActiveSection("order")}
                  aria-current={activeSection === "order" ? "true" : undefined}
                  className={`relative py-1 text-[16px] md:text-[17px] transition-colors duration-250 select-none ${
                    activeSection === "order"
                      ? navIsSolid
                        ? "text-[#6F8F5F] font-extrabold"
                        : "text-[#1F2B20] font-extrabold"
                      : navIsSolid
                        ? "text-[#1F2B20] font-bold hover:text-[#6F8F5F]"
                        : "text-[#1F2B20] font-bold hover:opacity-75"
                  }`}
                >
                  <span>Order</span>
                  {activeSection === "order" && (
                    <span
                      className={`absolute -bottom-1.5 left-0 right-0 h-[3px] rounded-full transition-colors duration-250 ${
                        navIsSolid ? "bg-[#6F8F5F]" : "bg-[#1F2B20]"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </a>

                <div className={`flex items-center pl-3 border-l transition-colors duration-250 ${
                  navIsSolid ? "border-[#1F2B20]/10" : "border-transparent"
                }`}>
                  <button
                    type="button"
                    onClick={() => setCartOpen(true)}
                    aria-label={totalBasketItems > 0 ? `Shopping cart, ${totalBasketItems} items` : "Shopping cart"}
                    className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#1F2B20] hover:text-[#6F8F5F] hover:bg-[#EEE7D6]/60 transition-colors duration-250 cursor-pointer"
                  >
                    <ShoppingCart className="w-5 h-5 stroke-[2]" />
                    {totalBasketItems > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[#6F8F5F] text-[#FFFFFF] text-[10px] font-black min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center shadow-xs leading-none">
                        {totalBasketItems}
                      </span>
                    )}
                    <span className="sr-only">{totalBasketItems} items in cart</span>
                  </button>
                </div>
              </div>
            </div>
          </nav>

          {/* Mobile Dropdown Menu (on phones when menu is open: opens from the right) */}
          {mobileMenuOpen && (
            <div className="md:hidden w-full sm:max-w-xs self-end origin-top-right bg-[#FFFFFF] border border-[#1F2B20]/10 rounded-2xl py-3 px-4 shadow-[0_10px_25px_rgba(60,45,20,0.10)] flex flex-col gap-1 mt-2 animate-in fade-in slide-in-from-right-2 duration-200">
              <a
                href="#shop"
                onClick={() => {
                  setActiveSection("shop");
                  setMobileMenuOpen(false);
                }}
                aria-current={activeSection === "shop" ? "true" : undefined}
                className={`relative py-2 px-3 text-base select-none transition-colors rounded-xl ${
                  activeSection === "shop"
                    ? "text-[#6F8F5F] font-extrabold bg-[#EEE7D6]/60"
                    : "text-[#1F2B20] font-bold hover:bg-[#EEE7D6]/40"
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
                href="#about"
                onClick={() => {
                  setActiveSection("about");
                  setMobileMenuOpen(false);
                }}
                aria-current={activeSection === "about" ? "true" : undefined}
                className={`relative py-2 px-3 text-base select-none transition-colors rounded-xl ${
                  activeSection === "about"
                    ? "text-[#6F8F5F] font-extrabold bg-[#EEE7D6]/60"
                    : "text-[#1F2B20] font-bold hover:bg-[#EEE7D6]/40"
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
                href="#info"
                onClick={() => {
                  setActiveSection("info");
                  setMobileMenuOpen(false);
                }}
                aria-current={activeSection === "info" ? "true" : undefined}
                className={`relative py-2 px-3 text-base select-none transition-colors rounded-xl ${
                  activeSection === "info"
                    ? "text-[#6F8F5F] font-extrabold bg-[#EEE7D6]/60"
                    : "text-[#1F2B20] font-bold hover:bg-[#EEE7D6]/40"
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
                    ? "text-[#6F8F5F] font-extrabold bg-[#EEE7D6]/60"
                    : "text-[#1F2B20] font-bold hover:bg-[#EEE7D6]/40"
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

      {/* ---------------------------------------------------------------------
          FULL-WIDTH HERO FEATURED IMAGE
          - Starts at the very top of the page directly behind the nav (no cream strip)
          - Top padding: nav height plus 16px (pt-[88px] sm:pt-[92px] md:pt-[100px])
          - Bottom padding: about 96px (pb-[96px])
          - Whole featured image without cropping: w-full, h-auto, object-fit: contain, centered
            Desktop: max-h-[calc(100dvh-220px)] min-h-[260px]
            Phones: full width with natural height
          - Background color detected from edge pixels (fallback #D5E2D4)
          - No slow zoom
          - "Order Now" button sits centered just below the image inside bottom padding
          - Edit mode: "Change" & "Remove" at bottom-left of hero
          --------------------------------------------------------------------- */}
      <section
        aria-label="Hero Showcase"
        style={{ backgroundColor: "#EFEFEA" }}
        className="relative w-full -mt-[68px] sm:-mt-[72px] md:-mt-[80px] pt-[76px] sm:pt-[80px] md:pt-[88px] pb-[56px] overflow-hidden group rounded-none flex flex-col items-center justify-center"
      >
        {heroImage ? (
          <div className="w-full relative">
            {/* --- PHONE (<= 768px: md:hidden) --- */}
            {/* Square container (aspect-ratio 1 / 1) at width 100%, object-fit: cover, object-position: center */}
            <div className="md:hidden w-full aspect-square relative overflow-hidden flex items-center justify-center">
              <img
                src={heroImage}
                alt="Featured crochet showcase"
                className="w-full h-full object-cover object-center block"
                style={{
                  WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 24px, black 100%)",
                  maskImage: "linear-gradient(to bottom, transparent 0px, black 24px, black 100%)",
                }}
              />
            </div>

            {/* --- DESKTOP (> 768px: hidden md:flex) --- */}
            <div className="hidden md:flex w-full relative overflow-hidden items-center justify-center">
              {isNarrow ? (
                /* Narrow fallback (< 1.8:1): centered at natural ratio, height max 700px / calc(100dvh-220px), 90px side fade */
                <img
                  src={heroImage}
                  alt="Featured crochet showcase"
                  className="w-auto max-w-full max-h-[min(calc(100dvh-220px),700px)] object-contain object-center block"
                  style={{
                    aspectRatio: heroAspectRatio,
                    WebkitMaskImage:
                      "linear-gradient(to right, transparent 0px, black 90px, black calc(100% - 90px), transparent 100%), linear-gradient(to bottom, transparent 0px, black 24px, black 100%)",
                    maskImage:
                      "linear-gradient(to right, transparent 0px, black 90px, black calc(100% - 90px), transparent 100%), linear-gradient(to bottom, transparent 0px, black 24px, black 100%)",
                    WebkitMaskComposite: "destination-in",
                    maskComposite: "intersect",
                  }}
                />
              ) : (
                /* Full-width banner: width 100%, natural aspect ratio, object-fit: cover, max-height calc(100dvh-180px), yarn reaches edges */
                <img
                  src={heroImage}
                  alt="Featured crochet showcase"
                  className="w-full max-h-[calc(100dvh-180px)] object-cover object-center block"
                  style={{
                    aspectRatio: heroAspectRatio,
                    WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 24px, black 100%)",
                    maskImage: "linear-gradient(to bottom, transparent 0px, black 24px, black 100%)",
                  }}
                />
              )}
            </div>
          </div>
        ) : editMode ? (
          <div className="w-full max-w-[800px] h-[360px] md:h-[calc(100dvh-220px)] md:min-h-[260px] flex items-center justify-center bg-[#E9E3D3] border-2 border-dashed border-[#6F8F5F]/50 mx-auto rounded-3xl">
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
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#FFFFFF] shadow-sm flex items-center justify-center text-[#6F8F5F] group-hover/upload:bg-[#EEE7D6] transition-colors">
                <Plus className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.5]" />
              </div>
              <span className="font-heading text-lg sm:text-xl text-[#1F2B20] tracking-[0.02em]">
                Add featured image
              </span>
            </label>
          </div>
        ) : (
          <div className="w-full max-w-[800px] h-[360px] md:h-[calc(100dvh-220px)] md:min-h-[260px] bg-[#E9E3D3] border-2 border-dashed border-[#6F8F5F]/50 mx-auto rounded-3xl" />
        )}

        {/* "Order Now" button: 40px space above (mt-10) and 56px space below (from hero's pb-[56px]) */}
        <div className="mt-10 flex justify-center z-20">
          <a
            href="#order"
            onClick={() => setActiveSection("order")}
            aria-label="Order Now"
            className={`inline-flex items-center justify-center font-bold text-base md:text-lg px-8 sm:px-10 py-3.5 sm:py-4 rounded-full transition-all duration-250 ease-out whitespace-nowrap cursor-pointer ${
              isScrolled
                ? "bg-[#6F8F5F] hover:bg-[#5E7C4F] text-[#FFFFFF] border-2 border-transparent shadow-[0_10px_25px_rgba(60,45,20,0.12)] backdrop-blur-none"
                : "bg-white/12 backdrop-blur-[6px] border-2 border-[#1F2B20] text-[#1F2B20] hover:bg-[#1F2B20] hover:text-[#FFFFFF] shadow-none"
            }`}
          >
            Order Now
          </a>
        </div>

        {/* Edit mode: Change and Remove buttons at bottom-left of hero */}
        {editMode && heroImage && (
          <div className="absolute bottom-5 left-5 z-20 flex items-center gap-2">
            <label className="bg-[#FFFFFF] hover:bg-[#EEE7D6] text-[#1F2B20] text-xs font-bold px-3.5 py-1.5 rounded-full cursor-pointer shadow-md transition-colors">
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

          {/* ROW 1: RECENT CREATIONS */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#6F8F5F]" />
                <h3 className="font-heading text-2xl text-[#1F2B20] tracking-[0.02em]">
                  Recent Creations
                </h3>
              </div>

              {/* Round arrow sideways scroll buttons (desktop only: hidden on phones) */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollRow(inStockScrollRef, "left")}
                  aria-label="Scroll left recent creations"
                  className="w-10 h-10 rounded-full bg-[#FFFFFF] hover:bg-[#EEE7D6] flex items-center justify-center text-[#1F2B20] shadow-[0_4px_12px_rgba(60,45,20,0.08)] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRow(inStockScrollRef, "right")}
                  aria-label="Scroll right recent creations"
                  className="w-10 h-10 rounded-full bg-[#FFFFFF] hover:bg-[#EEE7D6] flex items-center justify-center text-[#1F2B20] shadow-[0_4px_12px_rgba(60,45,20,0.08)] transition-colors cursor-pointer"
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
                      className="w-[285px] bg-[#FDFCF6] rounded-[20px] p-4 flex flex-col justify-between shadow-[0_8px_24px_rgba(60,45,20,0.10)] h-full relative"
                    >
                      {/* Delete card button (top-right corner in edit mode) */}
                      {editMode && (
                        <div className="absolute top-2.5 right-2.5 z-20">
                          <DeleteCardButton
                            onDelete={() => handleDeleteCard(product.id)}
                            disabled={inStockProducts.length <= 1}
                          />
                        </div>
                      )}

                      <div>
                        <ProductImageArea
                          product={product}
                          photoUrl={photoUrl}
                          editMode={editMode}
                          fitMode={cardFit[product.id] || "fill"}
                          onSetFit={(fit) => handleSetCardFit(product.id, fit)}
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
                          className={`text-[13px] font-bold uppercase tracking-wider text-[#6F8F5F] mb-1 outline-none rounded px-1 -mx-1 transition-colors ${
                            editMode ? "hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
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
                            editMode ? "hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
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
                            editMode ? "hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                          }`}
                        >
                          {description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[rgba(60,45,20,0.08)] mt-2">
                        {/* Editable Price */}
                        <span
                          contentEditable={editMode}
                          suppressContentEditableWarning={true}
                          onKeyDown={editMode ? handleKeyDownNoEnter : undefined}
                          onBlur={editMode ? (e) => handleCardTextChange(product.id, "price", e.currentTarget.textContent || "") : undefined}
                          title={editMode ? "Click to edit price" : undefined}
                          className={`text-[#E0764A] font-bold text-lg outline-none rounded px-1 -mx-1 transition-colors ${
                            editMode ? "hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                          }`}
                        >
                          {price}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSelectProductForOrder(product)}
                          className="bg-[#6F8F5F] hover:bg-[#5E7C4F] text-[#FFFFFF] text-xs font-bold px-4 py-2 rounded-full transition-colors cursor-pointer shadow-xs"
                        >
                          Order this
                        </button>
                      </div>
                    </article>
                  </ScrollReveal>
                );
              })}

              {/* In edit mode, show a dashed "+ Add card" tile at the end of the row */}
              {editMode && inStockProducts.length < 12 && (
                <div className="shrink-0 flex items-stretch">
                  <button
                    type="button"
                    onClick={() => handleAddCard("in-stock")}
                    className="w-[285px] min-h-[460px] h-full border-2 border-dashed border-[#6F8F5F]/50 hover:border-[#6F8F5F] bg-[#E9E3D3]/40 hover:bg-[#E9E3D3]/70 rounded-[20px] p-6 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer group"
                    aria-label="Add card to Recent Creations"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#FFFFFF] group-hover:bg-[#EEE7D6] flex items-center justify-center text-[#6F8F5F] shadow-xs transition-colors">
                      <Plus className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <span className="font-heading text-lg text-[#1F2B20] tracking-[0.02em]">
                      + Add card
                    </span>
                    <span className="text-xs text-[#1F2B20]/60">
                      ({inStockProducts.length}/12)
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Stacked Card Deck (<= 768px only) */}
            <ScrollReveal className="w-full md:hidden">
              <MobileCardDeck
                products={inStockProducts}
                savedImages={savedImages}
                cardEdits={cardEdits}
                cardFit={cardFit}
                editMode={editMode}
                onSelectProductForOrder={handleSelectProductForOrder}
                onImageUpload={handleImageUpload}
                onImageRemove={handleImageRemove}
                onCardTextChange={handleCardTextChange}
                onSetCardFit={handleSetCardFit}
                onDeleteCard={handleDeleteCard}
                onAddCard={() => handleAddCard("in-stock")}
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
                <span className="text-xs font-bold uppercase tracking-wider text-[#1F2B20] bg-[#F7B8CB] px-2.5 py-0.5 rounded-full">
                  Archive &amp; Inspo
                </span>
              </div>

              {/* Round arrow sideways scroll buttons (desktop only: hidden on phones) */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollRow(pastCreationsScrollRef, "left")}
                  aria-label="Scroll left past creations"
                  className="w-10 h-10 rounded-full bg-[#FFFFFF] hover:bg-[#EEE7D6] flex items-center justify-center text-[#1F2B20] shadow-[0_4px_12px_rgba(60,45,20,0.08)] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRow(pastCreationsScrollRef, "right")}
                  aria-label="Scroll right past creations"
                  className="w-10 h-10 rounded-full bg-[#FFFFFF] hover:bg-[#EEE7D6] flex items-center justify-center text-[#1F2B20] shadow-[0_4px_12px_rgba(60,45,20,0.08)] transition-colors cursor-pointer"
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
                      className="w-[285px] bg-[#FDFCF6] rounded-[20px] p-4 flex flex-col justify-between shadow-[0_8px_24px_rgba(60,45,20,0.10)] h-full relative"
                    >
                      {/* Delete card button (top-right corner in edit mode) */}
                      {editMode && (
                        <div className="absolute top-2.5 right-2.5 z-20">
                          <DeleteCardButton
                            onDelete={() => handleDeleteCard(product.id)}
                            disabled={pastCreationsProducts.length <= 1}
                          />
                        </div>
                      )}

                      <div>
                        <ProductImageArea
                          product={product}
                          photoUrl={photoUrl}
                          editMode={editMode}
                          fitMode={cardFit[product.id] || "fill"}
                          onSetFit={(fit) => handleSetCardFit(product.id, fit)}
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
                          className={`text-[13px] font-bold uppercase tracking-wider text-[#6F8F5F] mb-1 outline-none rounded px-1 -mx-1 transition-colors ${
                            editMode ? "hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
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
                            editMode ? "hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
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
                            editMode ? "hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                          }`}
                        >
                          {description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[rgba(60,45,20,0.08)] mt-2">
                        {/* Editable Price */}
                        <span
                          contentEditable={editMode}
                          suppressContentEditableWarning={true}
                          onKeyDown={editMode ? handleKeyDownNoEnter : undefined}
                          onBlur={editMode ? (e) => handleCardTextChange(product.id, "price", e.currentTarget.textContent || "") : undefined}
                          title={editMode ? "Click to edit price" : undefined}
                          className={`text-[#E0764A] font-bold text-lg outline-none rounded px-1 -mx-1 transition-colors ${
                            editMode ? "hover:bg-[#EEE7D6]/50 focus:bg-[#FFF1B5]/40 cursor-text" : "cursor-default"
                          }`}
                        >
                          {price}
                        </span>
                        <div className="flex items-center gap-2">
                          {editMode ? (
                            <button
                              type="button"
                              onClick={() => handleToggleCardStatus(product.id)}
                              className={`text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wider shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                                (cardStatus[product.id] || "sold") === "available"
                                  ? "bg-[#6F8F5F] hover:bg-[#5E7C4F] text-[#FFFFFF]"
                                  : "bg-[#FFF1B5] hover:bg-[#FFF1B5]/85 text-[#1F2B20]"
                              }`}
                              title="Tap to switch status between Sold and Available"
                              aria-label={`Status: ${(cardStatus[product.id] || "sold") === "available" ? "Available" : "Sold"}. Tap to switch.`}
                            >
                              <span>{(cardStatus[product.id] || "sold") === "available" ? "Available" : "Sold"}</span>
                              <RefreshCw className="w-3 h-3 shrink-0" />
                            </button>
                          ) : (
                            <span
                              className={`text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-xs ${
                                (cardStatus[product.id] || "sold") === "available"
                                  ? "bg-[#6F8F5F] text-[#FFFFFF]"
                                  : "bg-[#FFF1B5] text-[#1F2B20]"
                              }`}
                            >
                              {(cardStatus[product.id] || "sold") === "available" ? "Available" : "Sold"}
                            </span>
                          )}

                          {(cardStatus[product.id] || "sold") === "available" && (
                            <button
                              type="button"
                              onClick={() => handleSelectProductForOrder(product)}
                              className="bg-[#6F8F5F] hover:bg-[#5E7C4F] text-[#FFFFFF] text-xs font-bold px-3.5 py-1.5 rounded-full transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                            >
                              Order this
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  </ScrollReveal>
                );
              })}

              {/* In edit mode, show a dashed "+ Add card" tile at the end of the row */}
              {editMode && pastCreationsProducts.length < 12 && (
                <div className="shrink-0 flex items-stretch">
                  <button
                    type="button"
                    onClick={() => handleAddCard("past-creation")}
                    className="w-[285px] min-h-[460px] h-full border-2 border-dashed border-[#6F8F5F]/50 hover:border-[#6F8F5F] bg-[#E9E3D3]/40 hover:bg-[#E9E3D3]/70 rounded-[20px] p-6 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer group"
                    aria-label="Add card to Past Creations"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#FFFFFF] group-hover:bg-[#EEE7D6] flex items-center justify-center text-[#6F8F5F] shadow-xs transition-colors">
                      <Plus className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <span className="font-heading text-lg text-[#1F2B20] tracking-[0.02em]">
                      + Add card
                    </span>
                    <span className="text-xs text-[#1F2B20]/60">
                      ({pastCreationsProducts.length}/12)
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Stacked Card Deck (<= 768px only) */}
            <ScrollReveal className="w-full md:hidden">
              <MobileCardDeck
                products={pastCreationsProducts}
                isPastCreations
                savedImages={savedImages}
                cardEdits={cardEdits}
                cardFit={cardFit}
                cardStatus={cardStatus}
                editMode={editMode}
                onSelectProductForOrder={handleSelectProductForOrder}
                onImageUpload={handleImageUpload}
                onImageRemove={handleImageRemove}
                onCardTextChange={handleCardTextChange}
                onSetCardFit={handleSetCardFit}
                onToggleStatus={handleToggleCardStatus}
                onDeleteCard={handleDeleteCard}
                onAddCard={() => handleAddCard("past-creation")}
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
            <div className="w-full">
              {/* Top row: Display heading and FAQ button */}
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
                <div className="max-w-3xl">
                  <div className="text-[13px] font-bold tracking-widest uppercase text-[#6F8F5F] mb-3">
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
                    className="inline-flex items-center gap-2 bg-[#EEE7D6] hover:bg-[#FDFCF6] text-[#1F2B20] font-bold text-sm px-5 py-2.5 rounded-full shadow-[0_4px_12px_rgba(60,45,20,0.08)] transition-colors cursor-pointer"
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

              {/* Pickup Info Card */}
              <div className="bg-[#FDFCF6] rounded-[20px] px-6 py-4 shadow-[0_8px_24px_rgba(60,45,20,0.10)] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#EEE7D6] flex items-center justify-center text-[#6F8F5F] shrink-0 shadow-xs">
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
            <div className="text-[13px] font-bold tracking-widest uppercase text-[#6F8F5F] mb-2">
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
              <div className="bg-[#FDFCF6] rounded-[20px] p-6 sm:p-7 flex flex-col justify-between shadow-[0_8px_24px_rgba(60,45,20,0.10)] h-full">
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
                <div className="mt-6 pt-4 border-t border-[rgba(60,45,20,0.08)] flex items-center justify-between text-xs text-[#1F2B20]/60 font-semibold">
                  <span>Inspo &amp; Sketches</span>
                  <span className="w-2 h-2 rounded-full bg-[#6F8F5F]" />
                </div>
              </div>
            </ScrollReveal>

            {/* STEP 2 */}
            <ScrollReveal staggerIndex={1}>
              <div className="bg-[#FDFCF6] rounded-[20px] p-6 sm:p-7 flex flex-col justify-between shadow-[0_8px_24px_rgba(60,45,20,0.10)] h-full">
                <div>
                  <div className="text-[13px] font-bold tracking-widest uppercase text-[#6F8F5F] mb-3">
                    STEP 2
                  </div>
                  <h3 className="font-heading text-2xl text-[#1F2B20] mb-3 leading-snug tracking-[0.02em]">
                    Share Details &amp; Fit
                  </h3>
                  <p className="text-[16px] text-[#1F2B20]/80 leading-relaxed">
                    Tap Order Now, note any favorites, and share your sizing details.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[rgba(60,45,20,0.08)] flex items-center justify-between text-xs text-[#1F2B20]/60 font-semibold">
                  <span>Custom Sizing</span>
                  <span className="w-2 h-2 rounded-full bg-[#F7B8CB]" />
                </div>
              </div>
            </ScrollReveal>

            {/* STEP 3 */}
            <ScrollReveal staggerIndex={2}>
              <div className="bg-[#FDFCF6] rounded-[20px] p-6 sm:p-7 flex flex-col justify-between shadow-[0_8px_24px_rgba(60,45,20,0.10)] h-full">
                <div>
                  <div className="text-[13px] font-bold tracking-widest uppercase text-[#6F8F5F] mb-3">
                    STEP 3
                  </div>
                  <h3 className="font-heading text-2xl text-[#1F2B20] mb-3 leading-snug tracking-[0.02em]">
                    Secure Your Slot
                  </h3>
                  <p className="text-[16px] text-[#1F2B20]/80 leading-relaxed">
                    Confirm your order with a 50% deposit so we can start crafting it.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[rgba(60,45,20,0.08)] flex items-center justify-between text-xs text-[#1F2B20]/60 font-semibold">
                  <span>Deposit Confirms Slot</span>
                  <span className="w-2 h-2 rounded-full bg-[#6F8F5F]" />
                </div>
              </div>
            </ScrollReveal>

            {/* STEP 4 */}
            <ScrollReveal staggerIndex={3}>
              <div className="bg-[#FDFCF6] rounded-[20px] p-6 sm:p-7 flex flex-col justify-between shadow-[0_8px_24px_rgba(60,45,20,0.10)] h-full">
                <div>
                  <div className="text-[13px] font-bold tracking-widest uppercase text-[#6F8F5F] mb-3">
                    STEP 4
                  </div>
                  <h3 className="font-heading text-2xl text-[#1F2B20] mb-3 leading-snug tracking-[0.02em]">
                    Made with Care &amp; Delivered
                  </h3>
                  <p className="text-[16px] text-[#1F2B20]/80 leading-relaxed">
                    We'll message you when your order is complete and again just before it's dispatched.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[rgba(60,45,20,0.08)] flex items-center justify-between text-xs text-[#1F2B20]/60 font-semibold">
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
                <div className="bg-[#FDFCF6] text-[#1F2B20] rounded-[20px] p-6 sm:p-8 md:p-9 shadow-[0_16px_40px_rgba(60,45,20,0.16)]">
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
                        className={`w-full bg-[#F5EFE3] border rounded-xl px-4 py-3 text-base text-[#1F2B20] placeholder:text-[#1F2B20]/40 focus:outline-none transition-all disabled:cursor-not-allowed ${
                          nameError
                            ? "border-[#E0764A] ring-1 ring-[#E0764A]"
                            : "border-[rgba(31,43,32,0.12)] focus:ring-2 focus:ring-[#6F8F5F]"
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
                          className="w-full bg-[#F5EFE3] border border-[rgba(31,43,32,0.12)] rounded-xl pl-4 py-3 text-[16px] text-[#1F2B20] focus:outline-none focus:ring-2 focus:ring-[#6F8F5F] transition-all appearance-none cursor-pointer disabled:cursor-not-allowed"
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
                        <div className="mt-2 text-xs bg-[#EEE7D6] text-[#1F2B20] px-3.5 py-2 rounded-lg flex items-center justify-between font-medium gap-2">
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
                        <div className="mt-2 text-xs bg-[#EEE7D6] text-[#1F2B20] px-3.5 py-1.5 rounded-lg flex items-center justify-between font-medium">
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
                        className="w-full bg-[#F5EFE3] border border-[rgba(31,43,32,0.12)] rounded-xl p-4 text-base text-[#1F2B20] placeholder:text-[#1F2B20]/40 focus:outline-none focus:ring-2 focus:ring-[#6F8F5F] transition-all resize-none disabled:cursor-not-allowed"
                      />
                      <p className="text-xs text-[#1F2B20]/70 mt-1.5 font-medium">
                        Have an inspiration photo? You can send it in WhatsApp after you tap send.
                      </p>
                    </div>

                    {/* Sage button disabled when orders are closed */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={!ordersOpen}
                        className={`w-full font-bold text-base py-3.5 px-6 rounded-full transition-colors shadow-md flex items-center justify-center gap-2 ${
                          ordersOpen
                            ? "bg-[#6F8F5F] hover:bg-[#5E7C4F] text-[#FFFFFF] cursor-pointer"
                            : "bg-[#6F8F5F]/40 text-[#FFFFFF]/80 cursor-not-allowed"
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

          {/* Social links with icons on small circles in #F7B8CB: centered horizontally, 16px apart on their own row */}
          <div className="flex items-center justify-center gap-4 w-full">
            <a
              href="https://www.instagram.com/ms.sage_creates"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="w-10 h-10 rounded-full bg-[#F7B8CB] flex items-center justify-center text-[#1F2B20] hover:opacity-80 transition-opacity shadow-xs"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://www.tiktok.com/@ms.sage_creates"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              className="w-10 h-10 rounded-full bg-[#F7B8CB] flex items-center justify-center text-[#1F2B20] hover:opacity-80 transition-opacity shadow-xs"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-2.882 2.766 2.89 2.89 0 0 1 2.896-2.896c.394 0 .768.082 1.11.228V9.378a6.376 6.376 0 0 0-1.11-.098 6.335 6.335 0 0 0-6.338 6.338 6.335 6.335 0 0 0 6.338 6.338 6.335 6.335 0 0 0 6.338-6.338V8.784a8.212 8.212 0 0 0 4.759 1.487V6.828c-.347-.02-.693-.068-1.002-.142z" />
              </svg>
            </a>
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
          className="fixed bottom-4 left-4 z-50 bg-[#1F2B20] text-[#FFFFFF] text-xs font-bold px-4 py-2 rounded-full shadow-[0_8px_24px_rgba(60,45,20,0.20)] border border-[#EEE7D6]/20 flex items-center gap-2 select-none animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <span className="w-2 h-2 rounded-full bg-[#6F8F5F] animate-pulse" />
          <span>Edit mode on</span>
          <span className="text-[#FFFFFF]/40">·</span>
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
          className="fixed top-20 md:top-24 left-1/2 -translate-x-1/2 z-[70] bg-[#1F2B20] text-[#FFFFFF] text-sm font-bold px-5 py-2.5 rounded-full shadow-[0_10px_25px_rgba(60,45,20,0.18)] flex items-center gap-2.5 border border-[#EEE7D6]/20 animate-in fade-in slide-in-from-top-2 duration-150 pointer-events-none"
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
              inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[28px]
              /* Desktop: right-side drawer */
              md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-full md:w-[420px] md:rounded-l-[28px] md:rounded-tr-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(60,45,20,0.08)] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#EEE7D6] text-[#6F8F5F] flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <h3 className="font-heading text-xl text-[#1F2B20] tracking-[0.02em]">
                  Order Basket
                </h3>
                {totalBasketItems > 0 && (
                  <span className="bg-[#EEE7D6] text-[#1F2B20] text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {totalBasketItems} {totalBasketItems === 1 ? "item" : "items"}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="Close basket"
                className="w-8 h-8 rounded-full bg-[#EEE7D6] hover:bg-[#FDFCF6] text-[#1F2B20] flex items-center justify-center transition-colors cursor-pointer"
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
                    className="bg-[#6F8F5F] hover:bg-[#5E7C4F] text-[#FFFFFF] font-bold text-sm px-6 py-3 rounded-full transition-colors cursor-pointer shadow-xs"
                  >
                    Browse the shop
                  </button>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-[rgba(60,45,20,0.08)]">
                  {basket.map((item) => {
                    const product = products.find((p) => p.id === item.productId);
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
                              className="w-12 h-14 rounded-xl object-cover shrink-0 bg-[#E9E3D3]"
                            />
                          ) : (
                            <div className="w-12 h-14 rounded-xl bg-[#E9E3D3] flex items-center justify-center text-[#6F8F5F] shrink-0">
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
                            className="w-7 h-7 rounded-full bg-[#FDFCF6] hover:bg-[#FFFFFF] text-[#1F2B20] flex items-center justify-center transition-colors cursor-pointer"
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
                            className="w-7 h-7 rounded-full bg-[#FDFCF6] hover:bg-[#FFFFFF] text-[#1F2B20] flex items-center justify-center transition-colors cursor-pointer"
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
              <div className="p-5 border-t border-[rgba(60,45,20,0.08)] bg-[#FDFCF6] shrink-0">
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
                  className="w-full bg-[#6F8F5F] hover:bg-[#5E7C4F] text-[#FFFFFF] font-bold text-base py-3.5 px-6 rounded-full text-center transition-colors cursor-pointer shadow-md"
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
          <div className="bg-[#FDFCF6] rounded-[24px] p-6 sm:p-7 max-w-lg w-full max-h-[85dvh] overflow-y-auto shadow-[0_20px_60px_rgba(60,45,20,0.18)] relative my-auto">
            <button
              type="button"
              onClick={() => setFaqOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#EEE7D6] flex items-center justify-center text-[#1F2B20] hover:bg-[#FDFCF6] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <MicroscopeHeading
              as="h3"
              text="Frequently Asked Questions"
              className="font-heading text-2xl text-[#1F2B20] mb-5 tracking-[0.02em]"
            />
            <div className="space-y-4 text-left text-sm text-[#1F2B20]">
              <div className="bg-[#EEE7D6] p-4 rounded-xl shadow-[0_4px_12px_rgba(60,45,20,0.06)]">
                <div className="font-bold text-base mb-1 text-[#1F2B20]">
                  How long does a custom order take?
                </div>
                <div className="text-[#1F2B20]/80">
                  Made-to-measure pieces usually take between 7 to 21 days depending on design complexity and current queue. In-stock drops are dispatched weekly on specific days, as will be communicated.
                </div>
              </div>
              <div className="bg-[#EEE7D6] p-4 rounded-xl shadow-[0_4px_12px_rgba(60,45,20,0.06)]">
                <div className="font-bold text-base mb-1 text-[#1F2B20]">
                  How does Pick Up Mtaani work?
                </div>
                <div className="text-[#1F2B20]/80">
                  Pick Up Mtaani allows you to collect your package from hundreds of secure pickup agent locations across Nairobi and neighboring towns at affordable rates. Delivery is available through Pick Up Mtaani as well.
                </div>
              </div>
              <div className="bg-[#EEE7D6] p-4 rounded-xl shadow-[0_4px_12px_rgba(60,45,20,0.06)]">
                <div className="font-bold text-base mb-1 text-[#1F2B20]">
                  How do I care for my crochet piece?
                </div>
                <div className="text-[#1F2B20]/80">
                  Gently hand-wash in cool water with mild wool detergent. Lay flat on a clean towel to dry. Never hang heavy wet garments or machine tumble-dry.
                </div>
              </div>
              <div className="bg-[#EEE7D6] p-4 rounded-xl shadow-[0_4px_12px_rgba(60,45,20,0.06)]">
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
          <div className="bg-[#FDFCF6] rounded-[24px] p-6 sm:p-7 max-w-lg w-full max-h-[85dvh] overflow-y-auto shadow-[0_20px_60px_rgba(60,45,20,0.18)] relative my-auto">
            <button
              type="button"
              onClick={() => setPolicyOpen(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#EEE7D6] flex items-center justify-center text-[#1F2B20] hover:bg-[#FDFCF6] transition-colors cursor-pointer"
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
