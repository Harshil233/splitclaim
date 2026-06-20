"use client";

import { useState, useRef } from "react";
import Tesseract from "tesseract.js";
import styles from "@/styles/Expense.module.css";
import { Upload, Plus, Trash2, Check, Camera } from "lucide-react";

interface ScannedItem {
  id: string;
  name: string;
  price: number;
}

interface BillScannerProps {
  onItemsConfirmed: (items: ScannedItem[]) => void;
  currency: string;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

const getMimeTypeFromExtension = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
};

const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
};

const preprocessCanvas = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  
  let min = 255;
  let max = 0;
  
  // Find luminance min and max for contrast stretching
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }
  
  const range = max - min || 1;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Stretch contrast
    gray = ((gray - min) / range) * 255;
    
    // Clean thresholding (white background, black text)
    let val = gray;
    if (gray > 200) {
      val = 255;
    } else if (gray < 85) {
      val = 0;
    }
    
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }
  
  ctx.putImageData(imgData, 0, 0);
};

export default function BillScanner({ onItemsConfirmed, currency }: BillScannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");

  const loadPdfJs = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
      
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
        resolve(pdfjsLib);
      };
      script.onerror = () => {
        reject(new Error("Failed to load PDF processing library."));
      };
      document.body.appendChild(script);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(Array.from(files));
  };

  const itemsMatch = (item1: Omit<ScannedItem, "id">, item2: Omit<ScannedItem, "id">) => {
    if (Math.abs(item1.price - item2.price) > 0.05) return false;
    
    const n1 = item1.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const n2 = item2.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    
    if (n1 === n2) return true;
    
    if (n1.length > 5 && n2.length > 5) {
      if (n1.includes(n2) || n2.includes(n1)) return true;
    }
    
    return false;
  };

  const mergeItemLists = (list1: ScannedItem[], list2: ScannedItem[]): ScannedItem[] => {
    if (list1.length === 0) return list2;
    if (list2.length === 0) return list1;
    
    let maxOverlap = 0;
    const maxPossibleOverlap = Math.min(list1.length, list2.length);
    
    for (let k = 1; k <= maxPossibleOverlap; k++) {
      let match = true;
      for (let i = 0; i < k; i++) {
        const idx1 = list1.length - k + i;
        const idx2 = i;
        if (!itemsMatch(list1[idx1], list2[idx2])) {
          match = false;
          break;
        }
      }
      if (match) {
        maxOverlap = k;
      }
    }
    
    const merged = [...list1];
    for (let i = maxOverlap; i < list2.length; i++) {
      merged.push(list2[i]);
    }
    return merged;
  };

  const processFiles = async (files: File[]) => {
    setLoading(true);
    setProgress(0);
    setError("");
    setStatusText("AI scanning in progress...");

    try {
      // Convert all files to base64
      const fileDataPromises = files.map(async (file) => {
        const base64 = await fileToBase64(file);
        return {
          name: file.name,
          type: file.type || getMimeTypeFromExtension(file.name),
          base64: base64.split(",")[1] // Strip "data:image/jpeg;base64," prefix
        };
      });

      const fileData = await Promise.all(fileDataPromises);

      // Call the server-side OCR route
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ files: fileData })
      });

      const data = await response.json();

      if (response.ok && data.success && data.items) {
        // Map Gemini items to ScannedItem interface (add random IDs)
        const itemsWithIds: ScannedItem[] = data.items.map((item: any) => ({
          id: Math.random().toString(36).substring(2, 9),
          name: item.name,
          price: parseFloat(item.price) || 0
        }));

        const merged = mergeItemLists(items, itemsWithIds);
        setItems(merged);
        if (merged.length === 0) {
          setError("No items detected. You can add them manually below.");
        }
        setLoading(false);
        return;
      }

      // If AI scanning failed or is not configured, fall back to Tesseract!
      console.warn("AI scanning failed or not configured, falling back to local Tesseract OCR:", data.error || "Unknown error");
      await processFilesLocal(files);
    } catch (err: any) {
      console.error("AI scanning error, trying local fallback:", err);
      await processFilesLocal(files);
    }
  };

  const processFilesLocal = async (files: File[]) => {
    setProgress(0);
    setStatusText("Initializing OCR Engine (Local Fallback)...");

    let allParsedItems: ScannedItem[] = [...items];

    try {
      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx];
        const fileDisplay = files.length > 1 ? ` (${fIdx + 1}/${files.length})` : "";
        
        if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
          setStatusText(`Loading PDF document${fileDisplay}...`);
          const pdfjsLib = await loadPdfJs();
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const pageDisplay = pdf.numPages > 1 ? ` Page ${pageNum}/${pdf.numPages}` : "";
            setStatusText(`Rendering PDF${fileDisplay}${pageDisplay}...`);
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for quality
            
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const context = canvas.getContext("2d");
            if (!context) continue;
            
            await page.render({ canvasContext: context, viewport }).promise;
            
            setStatusText(`Scanning PDF${fileDisplay}${pageDisplay}...`);
            setProgress(0);
            
            const { data: { text } } = await Tesseract.recognize(
              canvas,
              "eng",
              {
                logger: (m) => {
                  if (m.status === "recognizing text") {
                    setProgress(Math.round(m.progress * 100));
                  }
                },
              }
            );
            
            const parsed = parseReceiptText(text);
            allParsedItems = mergeItemLists(allParsedItems, parsed);
          }
        } else {
          setStatusText(`Preprocessing Receipt Image${fileDisplay}...`);
          setProgress(0);
          
          let imageInput: any = file;
          try {
            const img = await loadImage(file);
            const canvas = document.createElement("canvas");
            const scale = 2.0;
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const context = canvas.getContext("2d");
            if (context) {
              context.imageSmoothingEnabled = true;
              context.imageSmoothingQuality = "high";
              context.drawImage(img, 0, 0, canvas.width, canvas.height);
              preprocessCanvas(canvas);
              imageInput = canvas;
            }
          } catch (e) {
            console.error("Image preprocessing failed, using raw file instead", e);
          }
          
          setStatusText(`Scanning Receipt Image${fileDisplay}...`);
          const { data: { text } } = await Tesseract.recognize(
            imageInput,
            "eng",
            {
              logger: (m) => {
                if (m.status === "recognizing text") {
                  setProgress(Math.round(m.progress * 100));
                }
              },
            }
          );
          
          const parsed = parseReceiptText(text);
          allParsedItems = mergeItemLists(allParsedItems, parsed);
        }
      }
      
      setItems(allParsedItems);
      if (allParsedItems.length === 0) {
        setError("No items detected. You can add them manually below.");
      }
    } catch (err: any) {
      console.error("OCR/PDF Error:", err);
      setError("Failed to scan receipt. Please add items manually or try another file.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const parseReceiptText = (text: string): ScannedItem[] => {
    const lines = text.split("\n");
    const parsed: ScannedItem[] = [];

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;

      const cleanLine = trimmed.replace(/[^a-zA-Z0-9.,\s]+$/, "").trim();

      const priceRegex = /([£$€₹]?)\s*([\d.,]+)\s*$/;
      const match = cleanLine.match(priceRegex);

      if (match) {
        let priceStr = match[2];
        
        if (!/\d/.test(priceStr)) continue;
        if (priceStr.startsWith(",")) {
          priceStr = "1" + priceStr.substring(1);
        }
        priceStr = priceStr.replace(/\.\.+/g, ".");
        
        if (priceStr.includes(",") && priceStr.includes(".")) {
          priceStr = priceStr.replace(/,/g, "");
        } else if (priceStr.includes(",") && !priceStr.includes(".")) {
          const parts = priceStr.split(",");
          if (parts.length === 2 && parts[1].length === 2) {
            priceStr = priceStr.replace(",", ".");
          } else {
            priceStr = priceStr.replace(/,/g, "");
          }
        }

        let price = parseFloat(priceStr);
        
        // Smart correction for Indian Rupee symbol (₹) misread as '3' prepended to price
        if (currency === "INR" || currency === "₹") {
          const beforeDecimal = priceStr.split(".")[0];
          if (priceStr.startsWith("3")) {
            if (beforeDecimal.length === 3) {
              price = price - 300;
            } else if (beforeDecimal.length === 4) {
              price = price - 3000;
            }
          }
        }

        const priceIndex = cleanLine.lastIndexOf(match[0]);
        let name = cleanLine.substring(0, priceIndex).trim();

        name = name.replace(/[:*\-._+\s/,|&¢£$€₹]+$/, "").trim();
        name = name.replace(/^[:*\-._+\s/,|&¢£$€₹]+/, "").trim();

        const lowerName = name.toLowerCase();
        const noiseKeywords = [
          "total", "subtotal", "sub total", "tax", "cgst", "sgst", "vat", "gst", 
          "service charge", "service tax", "round", "round-off", "round off", 
          "cash", "card", "change", "due", "paid", "payment", "tender", 
          "phone", "mobile", "tel", "invoice", "date", "waiter", "table", 
          "gstin", "order", "receipt", "cashier", "chk", "inv", "terminal",
          "return policy", "know more", "details", "listing price", "selling price",
          "price details", "discount", "promo", "delivery", "fee"
        ];
        
        const isCommonTotalNoise = noiseKeywords.some(keyword => lowerName.includes(keyword));
        const isSuspiciouslyLarge = price >= 20000 && priceStr.replace(".", "").length >= 7;

        if (isCommonTotalNoise || isSuspiciouslyLarge) continue;

        if (name && name.length >= 4) {
          parsed.push({
            id: Math.random().toString(36).substring(2, 9),
            name: name,
            price: price,
          });
        } else {
          let foundName = "";
          for (let k = i - 1; k >= 0; k--) {
            const candidate = lines[k].trim();
            if (!candidate) continue;

            const candMatch = candidate.match(priceRegex);
            if (candMatch && /\d/.test(candMatch[2])) continue;

            const lowerCand = candidate.toLowerCase();
            const isNoiseCand = noiseKeywords.some(keyword => lowerCand.includes(keyword));
            if (isNoiseCand) continue;

            if (/^[|:*\-._+\s/,()\[\]{}&+=!%?~<>^;\\/#`'"]+$/.test(candidate)) continue;
            if (candidate.length < 3) continue;

            foundName = candidate;
            break;
          }

          if (foundName) {
            foundName = foundName.replace(/[:*\-._+\s/,|&¢£$€₹]+$/, "").trim();
            foundName = foundName.replace(/^[:*\-._+\s/,|&¢£$€₹]+/, "").trim();
            
            if (parsed.length > 0 && parsed[parsed.length - 1].name === foundName) {
              continue;
            }

            parsed.push({
              id: Math.random().toString(36).substring(2, 9),
              name: foundName,
              price: price,
            });
          }
        }
      }
    }

    return parsed;
  };

  const handleItemChange = (id: string, field: keyof ScannedItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            [field]: field === "price" ? parseFloat(value) || 0 : value,
          };
        }
        return item;
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Math.random().toString(36).substring(2, 9),
        name: "New Item",
        price: 0,
      },
    ]);
  };

  const handleConfirm = () => {
    const validItems = items.filter((item) => item.name.trim() && item.price > 0);
    onItemsConfirmed(validItems);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const triggerCameraSelect = () => {
    cameraInputRef.current?.click();
  };

  const totalScanned = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className={styles.scannerContainer}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,application/pdf"
        multiple
        style={{ display: "none" }}
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
      />

      {!loading && items.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
          <div onClick={triggerFileSelect} className={styles.dropzone}>
            <Upload size={36} style={{ color: "var(--primary)" }} />
            <div className={styles.dropzoneText}>
              <strong>Upload Receipt / PDF</strong>
              <p style={{ fontSize: "12px", marginTop: "4px", color: "var(--text-muted)" }}>
                Supports JPG, PNG, PDF (multiple files supported)
              </p>
            </div>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "4px 0" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>or</span>
          </div>

          <button
            type="button"
            onClick={triggerCameraSelect}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px" }}
          >
            <Camera size={18} /> Scan with Camera
          </button>
        </div>
      )}

      {loading && (
        <div className={styles.ocrStatus}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
            <span>{statusText}</span>
            <span>{progress}%</span>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressValue} style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {error && (
        <div className="btn btn-danger" style={{ cursor: "default", padding: "10px", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>
              Edit Parsed Items
            </span>
            <button
              type="button"
              onClick={triggerFileSelect}
              className="btn btn-secondary"
              disabled={loading}
              style={{ width: "auto", padding: "6px 12px", fontSize: "12px" }}
            >
              Scan More
            </button>
          </div>

          <div className={styles.tableContainer}>
            <div className={styles.tableHeader}>
              <span>Item Name</span>
              <span style={{ textAlign: "right" }}>Price ({currency})</span>
              <span></span>
            </div>
            
            {items.map((item) => (
              <div key={item.id} className={styles.itemEditRow}>
                <input
                  type="text"
                  className={styles.itemEditInput}
                  value={item.name}
                  onChange={(e) => handleItemChange(item.id, "name", e.target.value)}
                  placeholder="Item Name"
                />
                <input
                  type="number"
                  step="0.01"
                  className={styles.itemEditInput}
                  style={{ textAlign: "right" }}
                  value={item.price || ""}
                  onChange={(e) => handleItemChange(item.id, "price", e.target.value)}
                  placeholder="0.00"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className={styles.deleteBtn}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 4px" }}>
            <button
              type="button"
              onClick={handleAddItem}
              className="btn btn-secondary"
              style={{ width: "auto", padding: "8px 16px", fontSize: "13px" }}
            >
              <Plus size={14} /> Add Item
            </button>
            <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
              Total: {totalScanned.toFixed(2)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="btn btn-accent"
            disabled={loading}
            style={{ marginTop: "12px" }}
          >
            <Check size={18} /> Confirm OCR Items & Use Bill Total
          </button>
        </div>
      )}
    </div>
  );
}
