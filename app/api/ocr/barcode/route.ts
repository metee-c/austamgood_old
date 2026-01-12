import { NextRequest, NextResponse } from 'next/server';

// Pattern สำหรับ Barcode ID ของแถม: BFS-YYYYMMDD-XXX-PXXX
const BFS_BARCODE_PATTERN = /BFS-\d{8}-\d{3}-P\d{3}/gi;

// Pattern สำหรับ Barcode ID ปกติ: FS-YYYYMMDD-XXX-PXXX
const FS_BARCODE_PATTERN = /FS-\d{8}-\d{3}-P\d{3}/gi;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json(
        { success: false, error: 'กรุณาเลือกรูปภาพ' },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(bytes).toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';

    // Use Tesseract.js for OCR (client-side) or call external OCR API
    // For now, we'll use a simple approach with regex pattern matching
    // In production, you might want to use Google Cloud Vision, AWS Textract, or Tesseract

    // Try to extract text using built-in approach
    // Since we can't run Tesseract on server easily, we'll return the image
    // and let client-side handle OCR, OR use an external API

    // For this implementation, we'll use a simple regex-based approach
    // assuming the barcode text might be embedded in the image metadata or filename
    
    // Check if we have OCR API key configured
    const ocrApiKey = process.env.OCR_API_KEY;
    const ocrApiUrl = process.env.OCR_API_URL;

    let extractedText = '';
    let barcodes: string[] = [];

    if (ocrApiKey && ocrApiUrl) {
      // Use external OCR API (e.g., OCR.space, Google Vision, etc.)
      try {
        const ocrResponse = await fetch(ocrApiUrl, {
          method: 'POST',
          headers: {
            'apikey': ocrApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            base64Image: `data:${mimeType};base64,${base64Image}`,
            language: 'eng',
            isOverlayRequired: false,
          }),
        });

        const ocrResult = await ocrResponse.json();
        
        if (ocrResult.ParsedResults && ocrResult.ParsedResults.length > 0) {
          extractedText = ocrResult.ParsedResults[0].ParsedText || '';
        }
      } catch (ocrError) {
        console.error('OCR API error:', ocrError);
      }
    }

    // Extract barcode patterns from text
    if (extractedText) {
      // Find BFS barcodes (bonus face sheet)
      const bfsMatches = extractedText.match(BFS_BARCODE_PATTERN) || [];
      // Find FS barcodes (regular face sheet)
      const fsMatches = extractedText.match(FS_BARCODE_PATTERN) || [];
      
      barcodes = [...new Set([...bfsMatches, ...fsMatches])].map(b => b.toUpperCase());
    }

    // Return base64 image for client-side OCR if no server-side OCR available
    return NextResponse.json({
      success: true,
      data: {
        barcodes,
        extractedText,
        hasServerOcr: !!(ocrApiKey && ocrApiUrl),
        // Include base64 for client-side OCR fallback
        base64Image: !ocrApiKey ? `data:${mimeType};base64,${base64Image}` : undefined,
      }
    });

  } catch (error) {
    console.error('OCR error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการประมวลผลรูปภาพ' },
      { status: 500 }
    );
  }
}
