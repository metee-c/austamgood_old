'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import MobileLayout from '@/components/layout/MobileLayout';
import {
  Camera,
  Loader2,
  Check,
  AlertTriangle,
  X,
  ScanLine,
  Copy,
  Gift,
  Trash2,
  Save,
} from 'lucide-react';

interface OcrResult {
  barcodes: string[];
  lotNumbers: string[];
}

interface SavedRecord {
  id: string;
  barcode_id: string;
  lot_no: string;
  saved_at: Date;
  status: 'success' | 'error' | 'duplicate' | 'not_found';
  message?: string;
}

// เสียง success
const playSuccessSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.2;
    oscillator.start();
    setTimeout(() => { oscillator.frequency.value = 1000; }, 100);
    setTimeout(() => { oscillator.stop(); audioContext.close(); }, 200);
  } catch (e) { console.log('Audio not supported'); }
  try { if ('vibrate' in navigator) navigator.vibrate([50, 30, 50]); } catch (e) {}
};

// เสียง error
const playErrorSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 400;
    oscillator.type = 'square';
    gainNode.gain.value = 0.3;
    oscillator.start();
    setTimeout(() => { oscillator.frequency.value = 300; }, 150);
    setTimeout(() => { oscillator.stop(); audioContext.close(); }, 300);
  } catch (e) { console.log('Audio not supported'); }
};

export default function PremiumPackageOcrPage() {
  const { user } = useAuthContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // OCR states - ทีละภาพ
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrImage, setOcrImage] = useState<string | null>(null);
  const [ocrResults, setOcrResults] = useState<OcrResult | null>(null);
  const [ocrRawText, setOcrRawText] = useState<string>('');
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  
  // Save states
  const [saving, setSaving] = useState(false);
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);

  // Preprocess image for better OCR
  const preprocessImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(URL.createObjectURL(file));
          return;
        }

        const scale = Math.max(1, 1500 / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const contrast = 1.5;
          const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));
          const newGray = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
          const threshold = newGray > 140 ? 255 : 0;
          
          data[i] = threshold;
          data[i + 1] = threshold;
          data[i + 2] = threshold;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Extract barcodes and lot numbers from text
  const extractData = useCallback((text: string): OcrResult => {
    const barcodes: string[] = [];
    const lotNumbers: string[] = [];
    
    const normalizeBarcode = (str: string): string => {
      return str
        .toUpperCase()
        .replace(/[oO]/g, '0')
        .replace(/[lI|]/g, '1')
        .replace(/\s+/g, '')
        .replace(/['"]/g, '')
        .replace(/[-]+/g, '-');
    };
    
    const cleanedText = text.replace(/['"'`]/g, '').replace(/\s+/g, ' ');
    
    // Extract BFS Barcodes
    const bfsStartPattern = /BFS-?[0-9O]{8}-?[0-9O]{3}-?/gi;
    const bfsStarts = cleanedText.match(bfsStartPattern) || [];
    
    for (const bfsStart of bfsStarts) {
      const startIdx = cleanedText.toUpperCase().indexOf(bfsStart.toUpperCase());
      if (startIdx === -1) continue;
      
      const searchArea = cleanedText.substring(startIdx, startIdx + 50);
      const packMatch = searchArea.match(/P[0-9O]{3}/i);
      
      if (packMatch) {
        const combined = bfsStart + packMatch[0];
        const normalized = normalizeBarcode(combined);
        const formatted = normalized.replace(/^BFS-?(\d{8})-?(\d{3})-?(P\d{3})$/, 'BFS-$1-$2-$3');
        
        if (/^BFS-\d{8}-\d{3}-P\d{3}$/.test(formatted) && !barcodes.includes(formatted)) {
          barcodes.push(formatted);
        }
      }
    }
    
    // Direct pattern search
    const directPattern = /BFS-?[0-9O]{8}-?[0-9O]{3}-?P[0-9O]{3}/gi;
    const directMatches = cleanedText.match(directPattern) || [];
    
    for (const match of directMatches) {
      const normalized = normalizeBarcode(match);
      const formatted = normalized.replace(/^BFS-?(\d{8})-?(\d{3})-?(P\d{3})$/, 'BFS-$1-$2-$3');
      if (/^BFS-\d{8}-\d{3}-P\d{3}$/.test(formatted) && !barcodes.includes(formatted)) {
        barcodes.push(formatted);
      }
    }
    
    // Extract MR Lot Numbers - Long codes first
    const mrLongPattern = /MR[0-9O]{8,}/gi;
    const mrLongMatches = cleanedText.match(mrLongPattern) || [];
    
    for (const match of mrLongMatches) {
      const normalized = match.toUpperCase().replace(/O/g, '0');
      if (!lotNumbers.includes(normalized)) {
        lotNumbers.push(normalized);
      }
    }
    
    // Short MR codes - exclude if part of long code
    const mrShortPattern = /MR[0-9O]{2}(?![0-9O])/gi;
    const mrShortMatches = cleanedText.match(mrShortPattern) || [];
    
    for (const match of mrShortMatches) {
      const normalized = match.toUpperCase().replace(/O/g, '0');
      const isPartOfLongCode = lotNumbers.some(long => long.startsWith(normalized));
      if (/^MR\d{2}$/.test(normalized) && !lotNumbers.includes(normalized) && !isPartOfLongCode) {
        lotNumbers.push(normalized);
      }
    }
    
    return { barcodes: [...new Set(barcodes)], lotNumbers: [...new Set(lotNumbers)] };
  }, []);

  // Handle image selection - ทีละภาพ
  const handleImageSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ล้างข้อมูลภาพเก่า แต่ไม่ล้าง savedRecords
    setOcrError(null);
    setOcrResults(null);
    setOcrRawText('');
    setOcrProcessing(true);
    setMessage(null);

    // ล้าง URL เก่า
    if (ocrImage) {
      URL.revokeObjectURL(ocrImage);
    }

    const imageUrl = URL.createObjectURL(file);
    setOcrImage(imageUrl);

    try {
      const processedImage = await preprocessImage(file);
      const Tesseract = await import('tesseract.js');
      
      const result = await Tesseract.recognize(processedImage, 'eng', {
        logger: () => {},
      });

      const extractedText = result.data.text;
      setOcrRawText(extractedText);
      
      const data = extractData(extractedText);
      
      if (data.barcodes.length > 0 || data.lotNumbers.length > 0) {
        setOcrResults(data);
        setOcrError(null);
      } else {
        setOcrError('ไม่พบ Barcode ID หรือ โล MR ในภาพ');
      }
    } catch (error) {
      console.error('OCR error:', error);
      setOcrError('เกิดข้อผิดพลาดในการอ่านภาพ');
    } finally {
      setOcrProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [preprocessImage, extractData, ocrImage]);

  // Save barcode + lot to database
  const handleSaveRecord = useCallback(async (barcode: string, lotNo: string) => {
    setSaving(true);
    
    try {
      const res = await fetch('/api/stock-count/premium-packages/ocr-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode_id: barcode,
          lot_no: lotNo,
          counted_by: user?.user_id
        })
      });
      const data = await res.json();

      const record: SavedRecord = {
        id: `${barcode}-${Date.now()}`,
        barcode_id: barcode,
        lot_no: lotNo,
        saved_at: new Date(),
        status: data.success ? 'success' : (data.duplicate ? 'duplicate' : (data.not_found ? 'not_found' : 'error')),
        message: data.message || data.error
      };

      if (data.success) {
        playSuccessSound();
        setMessage({ type: 'success', text: data.message || 'บันทึกสำเร็จ' });
        // Remove saved barcode from OCR results
        setOcrResults(prev => prev ? {
          ...prev,
          barcodes: prev.barcodes.filter(b => b !== barcode)
        } : null);
      } else {
        playErrorSound();
        setMessage({ type: 'error', text: data.error || 'บันทึกไม่สำเร็จ' });
      }

      setSavedRecords(prev => [record, ...prev]);
    } catch (error) {
      console.error('Error saving:', error);
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด' });
    } finally {
      setSaving(false);
    }
  }, [user?.user_id]);

  // Copy to clipboard
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(text);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }, []);

  // Reset OCR - ล้างภาพปัจจุบัน แต่ไม่ล้าง savedRecords
  const handleResetOcr = useCallback(() => {
    if (ocrImage) {
      URL.revokeObjectURL(ocrImage);
    }
    setOcrImage(null);
    setOcrResults(null);
    setOcrRawText('');
    setOcrError(null);
  }, [ocrImage]);

  // Delete saved record from list (local only)
  const handleDeleteRecord = useCallback((id: string) => {
    setSavedRecords(prev => prev.filter(r => r.id !== id));
  }, []);

  // Get short lot number (MR01, MR02) for save - prefer short codes over long order numbers
  const shortLotNo = ocrResults?.lotNumbers.find(lot => /^MR\d{2}$/.test(lot)) || '';
  const longLotNo = ocrResults?.lotNumbers.find(lot => /^MR\d{8,}$/.test(lot)) || '';

  return (
    <MobileLayout title="นับสต็อก OCR" showBackButton>
      {/* Loading Overlay */}
      {saving && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-xl">
            <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
            <p className="text-gray-700 font-thai font-semibold">กำลังบันทึก...</p>
          </div>
        </div>
      )}

      <div className="p-2 space-y-3 pb-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl p-3 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-thai font-bold">อ่านบาร์โค้ดจากรูปภาพ</h2>
              <p className="text-purple-100 text-xs">ถ่ายภาพเพื่ออ่าน Barcode ID และ โล MR</p>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`p-2 rounded-xl text-center font-thai text-sm font-semibold ${
            message.type === 'success' ? 'bg-green-100 text-green-700' :
            message.type === 'error' ? 'bg-red-100 text-red-700' :
            message.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Upload Button - แสดงเมื่อไม่มีภาพ */}
        {!ocrImage && !ocrProcessing && (
          <div className="space-y-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-5 bg-white border-2 border-dashed border-purple-300 rounded-xl flex flex-col items-center gap-2 hover:border-purple-500 hover:bg-purple-50 transition-colors"
            >
              <div className="p-3 bg-purple-100 rounded-full">
                <Camera className="w-8 h-8 text-purple-600" />
              </div>
              <div className="text-center">
                <p className="font-thai font-semibold text-gray-700">ถ่ายภาพ / เลือกรูป</p>
                <p className="text-xs text-gray-500">รองรับ JPG, PNG</p>
              </div>
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
            />

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-blue-700 font-thai text-sm flex items-center gap-2">
                <Gift className="w-4 h-4" />
                ระบบจะอ่านหา:
              </p>
              <ul className="text-blue-600 text-xs mt-1 space-y-1 ml-6">
                <li>• Barcode ID: BFS-XXXXXXXX-XXX-PXXX</li>
                <li>• โล MR: MR01, MR02, MR26010045</li>
              </ul>
            </div>
          </div>
        )}

        {/* Processing */}
        {ocrProcessing && (
          <div className="bg-white rounded-xl p-6 text-center shadow-sm">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-700 font-thai font-semibold">กำลังอ่านข้อความ...</p>
            <p className="text-gray-500 text-xs mt-1">อาจใช้เวลาสักครู่</p>
          </div>
        )}

        {/* Image Preview */}
        {ocrImage && !ocrProcessing && (
          <div className="bg-white rounded-xl overflow-hidden shadow-sm">
            <div className="relative">
              <img 
                src={ocrImage} 
                alt="OCR Preview" 
                className="w-full h-auto max-h-[25vh] object-contain bg-gray-100"
              />
              <button
                onClick={handleResetOcr}
                className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {ocrError && !ocrProcessing && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-1" />
            <p className="text-red-700 font-thai text-sm">{ocrError}</p>
            <p className="text-red-500 text-xs mt-1">ลองถ่ายภาพใหม่ให้ชัดขึ้น</p>
          </div>
        )}

        {/* OCR Results */}
        {ocrResults && !ocrProcessing && (
          <div className="space-y-3">
            {/* Lot Numbers Display */}
            {ocrResults.lotNumbers.length > 0 && (
              <div className="bg-blue-50 rounded-xl overflow-hidden">
                <div className="p-2 bg-blue-100 border-b border-blue-200">
                  <p className="text-blue-700 font-thai text-sm font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    โล MR ที่อ่านได้ ({ocrResults.lotNumbers.length})
                  </p>
                </div>
                <div className="p-2 flex flex-wrap gap-2">
                  {ocrResults.lotNumbers.map((lot, index) => (
                    <button
                      key={index}
                      onClick={() => handleCopy(lot)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-mono font-bold flex items-center gap-1 ${
                        copiedItem === lot
                          ? 'bg-green-100 text-green-700'
                          : 'bg-white text-blue-700 border border-blue-200'
                      }`}
                    >
                      {lot}
                      {copiedItem === lot ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Barcodes - with Save button */}
            {ocrResults.barcodes.length > 0 && (
              <div className="bg-purple-50 rounded-xl overflow-hidden">
                <div className="p-2 bg-purple-100 border-b border-purple-200">
                  <p className="text-purple-700 font-thai text-sm font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Barcode ID ({ocrResults.barcodes.length})
                  </p>
                </div>
                <div className="divide-y divide-purple-100">
                  {ocrResults.barcodes.map((barcode, index) => (
                    <div key={index} className="p-2 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-bold text-gray-800 truncate">{barcode}</p>
                        {shortLotNo && (
                          <p className="text-xs text-gray-500">โล: <span className="font-bold text-blue-600">{shortLotNo}</span></p>
                        )}
                        {longLotNo && (
                          <p className="text-xs text-gray-400">เลขออเดอร์: {longLotNo}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleSaveRecord(barcode, shortLotNo)}
                        disabled={saving}
                        className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-thai flex items-center gap-1 whitespace-nowrap disabled:opacity-50"
                      >
                        <Save className="w-3 h-3" />
                        บันทึก
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ปุ่มถ่ายภาพใหม่ - แสดงเมื่อมีภาพอยู่แล้ว */}
        {ocrImage && !ocrProcessing && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 bg-purple-100 text-purple-700 rounded-xl font-thai text-sm flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            ถ่ายภาพใหม่ / เลือกรูปถัดไป
          </button>
        )}

        {/* Hidden file input - ใช้ร่วมกันทั้งสองกรณี */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageSelect}
          className="hidden"
        />

        {/* Raw Text Debug */}
        {ocrRawText && !ocrProcessing && (
          <details className="bg-gray-50 rounded-xl overflow-hidden">
            <summary className="p-2 text-xs text-gray-500 font-thai cursor-pointer">
              ดูข้อความที่อ่านได้ทั้งหมด
            </summary>
            <pre className="p-2 text-xs text-gray-600 whitespace-pre-wrap break-all font-mono bg-white border-t max-h-24 overflow-y-auto">
              {ocrRawText}
            </pre>
          </details>
        )}

        {/* Saved Records List */}
        {savedRecords.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-2 border-b bg-gray-50">
              <p className="text-xs text-gray-600 font-thai">
                รายการที่บันทึกแล้ว ({savedRecords.filter(r => r.status === 'success').length})
              </p>
            </div>
            <div className="max-h-[30vh] overflow-y-auto divide-y divide-gray-100">
              {savedRecords.map((record) => (
                <div key={record.id} className={`p-2 ${
                  record.status === 'success' ? 'bg-green-50' :
                  record.status === 'duplicate' ? 'bg-yellow-50' :
                  'bg-red-50'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm font-bold text-gray-700 truncate">{record.barcode_id}</p>
                        {record.status === 'success' && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                        {record.status === 'duplicate' && <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
                        {(record.status === 'error' || record.status === 'not_found') && <X className="w-4 h-4 text-red-500 flex-shrink-0" />}
                      </div>
                      {record.lot_no && (
                        <p className="text-xs text-gray-500">โล: {record.lot_no}</p>
                      )}
                      {record.message && (
                        <p className={`text-xs ${
                          record.status === 'success' ? 'text-green-600' :
                          record.status === 'duplicate' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>{record.message}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteRecord(record.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
