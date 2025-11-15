'use client';
import React, { useEffect, useRef } from 'react';
// Simple QR code implementation without external dependency
const generateSimpleQR = (text: string, size: number): string[][] => {
  // This is a very simple placeholder QR code generator
  // In production, you should use a proper QR code library
  const modules: string[][] = [];
  const moduleCount = 21; // Smallest QR code size
  
  for (let row = 0; row < moduleCount; row++) {
    modules[row] = [];
    for (let col = 0; col < moduleCount; col++) {
      // Simple pattern - just create a border and some internal pattern
      if (row === 0 || row === moduleCount - 1 || col === 0 || col === moduleCount - 1) {
        modules[row][col] = 'black';
      } else if ((row < 7 && col < 7) || (row < 7 && col >= moduleCount - 7) || (row >= moduleCount - 7 && col < 7)) {
        // Position marker patterns
        modules[row][col] = (row === 1 || row === 5 || col === 1 || col === 5) && !(row === 1 && col === 1) && !(row === 1 && col === 5) && !(row === 5 && col === 1) && !(row === 5 && col === 5) ? 'white' : 'black';
      } else {
        // Simple data pattern based on text
        const charCode = text.charCodeAt((row * moduleCount + col) % text.length);
        modules[row][col] = charCode % 2 === 0 ? 'black' : 'white';
      }
    }
  }
  
  return modules;
};

interface LoadlistQRCodeProps {
  loadlistId: number;
  loadlistCode: string;
  size?: number;
}

const LoadlistQRCode: React.FC<LoadlistQRCodeProps> = ({
  loadlistId,
  loadlistCode,
  size = 80
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const generateQRCode = async () => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Create URL for mobile scanning
      const url = `${window.location.origin}/mobile/loading?loadlist_id=${loadlistId}&code=${loadlistCode}`;

      try {
        // Generate simple QR code pattern
        const modules = generateSimpleQR(url, size);
        const moduleSize = size / modules.length;
        
        // Clear canvas
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        
        // Draw QR code modules
        modules.forEach((row, rowIndex) => {
          row.forEach((module, colIndex) => {
            ctx.fillStyle = module === 'black' ? '#000000' : '#FFFFFF';
            ctx.fillRect(
              colIndex * moduleSize,
              rowIndex * moduleSize,
              moduleSize,
              moduleSize
            );
          });
        });
      } catch (error) {
        console.error('Error generating QR code:', error);
        
        // Fallback: draw a simple placeholder
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('QR Code', size / 2, size / 2);
      }
    };

    generateQRCode();
  }, [loadlistId, loadlistCode, size]);

  return (
    <div className="inline-block">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="border border-gray-300 rounded"
      />
      <div className="text-xs text-center text-gray-600 mt-1">
        {loadlistCode}
      </div>
    </div>
  );
};

export default LoadlistQRCode;
