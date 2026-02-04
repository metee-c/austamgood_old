import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Supplier } from '@/types/supplier'; // Import the Supplier type
import { withAdminAuth } from '@/lib/api/with-auth';
async function handlePost(request: NextRequest, context: any) {
try {
    const supabase = await createClient();
    
    // First check if table exists
    const { data: existingTable } = await supabase
      .from('master_supplier')
      .select('*')
      .limit(1);

    if (existingTable !== null) {
      return NextResponse.json({ 
        message: 'Master supplier table already exists',
        table_exists: true
      });
    }

    // Since we can't execute raw SQL through the client directly,
    // let's try to create some sample data to see if the table exists
    // and if not, it will give us an error that we can use to guide next steps

    const { data: testData, error: testError } = await supabase
      .from('master_supplier')
      .insert([{
        supplier_id: 'TEST001',
        supplier_code: 'TEST001',
        supplier_name: 'Test Supplier',
        supplier_type: 'vendor',
        created_by: 'admin@austamgood.com'
      }])
      .select()
      .single();

    if (testError) {
      return NextResponse.json({ 
        error: 'Table does not exist and cannot be created through API',
        details: testError,
        message: 'Please create the master_supplier table manually in Supabase dashboard or using SQL console'
      }, { status: 400 });
    }

    // If successful, delete the test record
    if (testData) {
      await supabase
        .from('master_supplier')
        .delete()
        .eq('supplier_id', 'TEST001');
    }

    // Insert sample data
    const { data: sampleData, error: sampleError }: { data: Supplier[] | null; error: any } = await supabase
      .from('master_supplier')
      .insert([
        {
          supplier_id: 'SUP001',
          supplier_code: 'VND001',
          supplier_name: 'บริษัท ผลิตภัณฑ์อุตสาหกรรม จำกัด',
          supplier_type: 'vendor',
          business_reg_no: '0105558123456',
          tax_id: '0105558123456',
          contact_person: 'นาย วิชาญ อุตสาหกรรม',
          phone: '02-345-6789',
          email: 'contact@industrial-products.co.th',
          website: 'https://www.industrial-products.co.th',
          billing_address: '789 ถนนรัชดาภิเษก แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร 10310',
          shipping_address: '789 ถนนรัชดาภิเษก แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร 10310',
          payment_terms: '30 วัน',
          product_category: 'วัตถุดิบอุตสาหกรรม',
          rating: 4.2,
          status: 'active',
          created_by: 'admin@austamgood.com',
          remarks: 'ซัพพลายเออร์หลักสำหรับวัตถุดิบอุตสาหกรรม มีคุณภาพดีและส่งมอบตรงเวลา'
        },
        {
          supplier_id: 'SUP002',
          supplier_code: 'SVC001',
          supplier_name: 'บริษัท ขนส่งและโลจิสติกส์ จำกัด',
          supplier_type: 'service_provider',
          business_reg_no: '0105559876543',
          tax_id: '0105559876543',
          contact_person: 'นางสาว สุภาพร ขนส่ง',
          phone: '02-456-7890',
          email: 'service@transport-logistics.co.th',
          website: 'https://www.transport-logistics.co.th',
          billing_address: '456 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพมหานคร 10900',
          shipping_address: '456 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพมหานคร 10900',
          payment_terms: '7 วัน',
          service_category: 'ขนส่งและโลจิสติกส์',
          rating: 4.5,
          status: 'active',
          created_by: 'admin@austamgood.com',
          remarks: 'ผู้ให้บริการขนส่งที่มีประสบการณ์ มีรถบรรทุกครบทุกขนาด'
        },
        {
          supplier_id: 'SUP003',
          supplier_code: 'BTH001',
          supplier_name: 'บริษัท ผลิตและบริการครบวงจร จำกัด',
          supplier_type: 'both',
          business_reg_no: '0105557654321',
          tax_id: '0105557654321',
          contact_person: 'นาย ประสิทธิ์ ครบวงจร',
          phone: '02-567-8901',
          email: 'info@complete-service.co.th',
          website: 'https://www.complete-service.co.th',
          billing_address: '123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองตัน กรุงเทพมหานคร 10110',
          shipping_address: '123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองตัน กรุงเทพมหานคร 10110',
          payment_terms: '15 วัน',
          service_category: 'ผลิตและประกอบ',
          product_category: 'อุปกรณ์อิเล็กทรอนิกส์',
          rating: 4.0,
          status: 'active',
          created_by: 'admin@austamgood.com',
          remarks: 'บริษัทที่ให้บริการทั้งผลิตสินค้าและขายอุปกรณ์อิเล็กทรอนิกส์'
        }
      ]);

    if (sampleError) {
      console.error('Error inserting sample data:', sampleError);
      return NextResponse.json({ 
        error: 'Failed to insert sample data',
        details: sampleError 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Master supplier table populated with sample data successfully',
      sample_data_count: 3
    });

  } catch (error) {
    console.error('Unexpected error:', error);

    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}

// Export with admin auth wrapper
export const POST = withAdminAuth(handlePost);
