// lib/online-packing/product-bundles.ts
// Shared bundle product mapping for online packing system
// Bundle = 1 marketplace SKU ที่ต้องแตกเป็นหลาย WMS SKU

export interface BundleComponent {
  sku: string;
  name: string;
  quantity: number;
}

export const PRODUCT_BUNDLES: Record<string, BundleComponent[]> = {
  // Buzz Balanced+ SET 7kg (แตกเป็น 2x3kg + 1x1kg)
  '8854052503703': [
    { sku: '8854052503307', name: 'Buzz Balanced+ แมวโต Hair&Skin | 3 กก.', quantity: 2 },
    { sku: '8854052503109', name: 'Buzz Balanced+ แมวโต Hair&Skin | 1 กก.', quantity: 1 }
  ],
  '8854052501709': [
    { sku: '8854052501303', name: 'Buzz Balanced+ แมวโต Indoor | 3 กก.', quantity: 2 },
    { sku: '8854052501105', name: 'Buzz Balanced+ แมวโต Indoor | 1 กก.', quantity: 1 }
  ],
  '8854052504700': [
    { sku: '8854052504304', name: 'Buzz Balanced+ ลูกและแม่แมว K&P | 3 กก.', quantity: 2 },
    { sku: '8854052504106', name: 'Buzz Balanced+ ลูกและแม่แมว K&P | 1 กก.', quantity: 1 }
  ],
  '8854052502706': [
    { sku: '8854052502300', name: 'Buzz Balanced+ แมวโต Weight+ | 3 กก.', quantity: 2 },
    { sku: '8854052502102', name: 'Buzz Balanced+ แมวโต Weight+ | 1 กก.', quantity: 1 }
  ],
  // Buzz Netura SET (แตกเป็น 4x2.5kg)
  '5424052641014': [
    { sku: '5424052641250', name: 'Buzz Netura สุนัขโต ไก่ เม็ดเล็ก | 2.5 กก.', quantity: 4 }
  ],
  '5424052630018': [
    { sku: '5424052630254', name: 'Buzz Netura สุนัขโต แซลมอน เม็ดใหญ่ | 2.5 กก.', quantity: 4 }
  ]
};

/**
 * Expand bundle parent_sku into component SKUs
 * Returns array of { sku_id, quantity, product_name } for each component
 * If not a bundle, returns single item with original parent_sku
 */
export function expandBundleSku(parentSku: string, quantity: number): { sku_id: string; quantity: number; product_name: string }[] {
  const bundle = PRODUCT_BUNDLES[parentSku];
  if (bundle) {
    return bundle.map(component => ({
      sku_id: component.sku,
      quantity: component.quantity * quantity,
      product_name: component.name
    }));
  }
  return [{ sku_id: parentSku, quantity, product_name: '' }];
}

/**
 * Check if a parent_sku is a bundle product
 */
export function isBundle(parentSku: string): boolean {
  return parentSku in PRODUCT_BUNDLES;
}
