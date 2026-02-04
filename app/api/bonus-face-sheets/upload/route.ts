import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * POST /api/bonus-face-sheets/upload
 * อัปโหลดและประมวลผลไฟล์ Excel สำหรับสินค้าของแถม
 */
async function _POST(request: NextRequest) {
try {
    const body = await request.json();
    const { excelData, warehouse_id = 'WH001', created_by = 'System' } = body;
    
    if (!excelData || !Array.isArray(excelData) || excelData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่มีข้อมูลจากไฟล์ Excel' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    // จัดกลุ่มข้อมูลตาม Order_No + Pack_No
    const groupedData: { [key: string]: any } = {};
    
    excelData.forEach((row: any) => {
      const orderNo = row['เลขที่ใบสั่งส่ง'] || row['Order_No'] || '';
      const packNo = row['แพ็คที่'] || row['Pack_No'] || '';
      const productCode = row['รหัสสินค้า'] || row['Product_Code'] || '';
      const productName = row['ชื่อสินค้า'] || row['Product_Name'] || '';
      const qty = row['จำนวน'] || row['Qty'] || 0;
      const shopName = row['ชื่อร้านค้า'] || row['Shop_Name'] || '';
      const customerCode = row['รหัสลูกค้า/ผู้ขาย'] || row['Customer_Code'] || '';
      const address = row['ที่อยู่'] || row['Address'] || '';
      const deliveryType = row['ประเภทจัดส่ง'] || row['Delivery_Type'] || '';
      const remark = row['หมายเหตุ'] || row['Remark'] || '';
      
      if (!orderNo || !packNo) {
        return; // ข้ามแถวที่ไม่มีข้อมูลสำคัญ
      }
      
      const key = `${orderNo}_${packNo}`;
      
      if (!groupedData[key]) {
        groupedData[key] = {
          order_no: orderNo,
          pack_no: packNo,
          shop_name: shopName,
          customer_code: customerCode,
          address: address,
          delivery_type: deliveryType,
          remark: remark,
          items: []
        };
      }
      
      groupedData[key].items.push({
        product_code: productCode,
        product_name: productName,
        quantity: parseFloat(qty) || 0,
        unit: 'ชิ้น'
      });
    });
    
    // แปลงเป็น array
    const packages = Object.values(groupedData);
    
    if (packages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถประมวลผลข้อมูลได้' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      packages,
      total_packages: packages.length,
      total_items: packages.reduce((sum, pkg) => sum + pkg.items.length, 0),
      message: `ประมวลผลข้อมูลสำเร็จ: ${packages.length} แพ็ค`
    });
  } catch (error: any) {
    console.error('Error in POST /api/bonus-face-sheets/upload:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);
