-- Migration 304: Add e-commerce related columns to master_sku
-- Purpose: Consolidate products table data into master_sku to reduce complexity
-- This eliminates the need for a separate products/packing_products table

-- Add ecommerce_name column for e-commerce product display name
ALTER TABLE master_sku 
ADD COLUMN IF NOT EXISTS ecommerce_name TEXT;

-- Add is_sample column to indicate if product is a sample
ALTER TABLE master_sku 
ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN master_sku.ecommerce_name IS 'Product name displayed on e-commerce platforms (may differ from sku_name)';
COMMENT ON COLUMN master_sku.is_sample IS 'Indicates if this SKU is a sample/tester product';

-- Update existing SKUs with e-commerce data (from products table data)
UPDATE master_sku SET ecommerce_name = '[SET] Buzz Balanced+ ลูกและแม่แมว K&P | 7 กก. [2 x 3 กก. + 1 กก.]', is_sample = false WHERE sku_id = 'BS-BAP-C|KNP|070';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะบำรุงข้อ เม็ดใหญ่ | 15 กก.', is_sample = false WHERE sku_id = 'B-NEP-D|HEJ-L|150';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond สุนัขโต รสแกะ | 1.2 กก. [No Sticker]', is_sample = true WHERE sku_id = 'B-BEY-D|LAM|NS|012';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะ เม็ดใหญ่ | 15 กก.', is_sample = false WHERE sku_id = 'B-NEP-D|SKN-L|150';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond สุนัขโต รสแซลมอน | 1.2 กก. [No Sticker]', is_sample = true WHERE sku_id = 'B-BEY-D|SAL|NS|012';
UPDATE master_sku SET ecommerce_name = 'Tester | Buzz Netura สุนัขโต ไก่ เม็ดใหญ่ | 50 กรัม', is_sample = false WHERE sku_id = 'TT-NET-D|CHI-L|0005';
UPDATE master_sku SET ecommerce_name = 'Tester | Buzz Netura แมวโตและลูก แซลมอน | 50 กรัม', is_sample = false WHERE sku_id = 'TT-NET-C|SAL|0005';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond แมวโต รสแซลมอน | 1 กก. [No Sticker]', is_sample = true WHERE sku_id = 'B-BEY-C|SAL|NS|010';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะบำรุงข้อ เม็ดเล็ก | 500 กรัม', is_sample = false WHERE sku_id = 'B-NEP-D|HEJ-S|005';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura สุนัขโต ไก่ เม็ดใหญ่ | 10 กก.', is_sample = false WHERE sku_id = 'B-NET-D|CHI-L|100';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะ เม็ดใหญ่ | 3 กก.', is_sample = false WHERE sku_id = 'B-NEP-D|SKN-L|030';
UPDATE master_sku SET ecommerce_name = 'Buzz Balanced+ แมวโต Weight+ | 3 กก.', is_sample = false WHERE sku_id = 'B-BAP-C|WEP|030';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะ เม็ดเล็ก | 500 กรัม', is_sample = false WHERE sku_id = 'B-NEP-D|SKN-S|005';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond แมวโต รสปลาทู | 7 กก.', is_sample = false WHERE sku_id = 'B-BEY-C|MCK|070';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond สุนัขโต รสเนื้ออบ | 1.2 กก. [No Sticker]', is_sample = true WHERE sku_id = 'B-BEY-D|BEF|NS|012';
UPDATE master_sku SET ecommerce_name = '[SET] Buzz Netura สุนัขโต ไก่ เม็ดเล็ก | 10 กก. [4 x 2.5 กก.]', is_sample = false WHERE sku_id = 'BS-NET-D|CHI-S|100';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura แมวโตและลูก ปลาเนื้อขาว แฮร์ริ่ง และไก่ | 4 กก.', is_sample = false WHERE sku_id = 'B-NET-C|FHC|040';
UPDATE master_sku SET ecommerce_name = 'ผ้าห่ม ลาย ProteinX', is_sample = false WHERE sku_id = 'PRE-BKT|PROTEINX';
UPDATE master_sku SET ecommerce_name = '[GIFT] BUZZ ชามอาหารแมว / สุนัข ลิ้มรสความอร่อยจากชามอาหารสุดน่ารัก จากบัซซ์ คละสี คละแบบ', is_sample = false WHERE sku_id = 'PRE-BOW|D|NEW';
UPDATE master_sku SET ecommerce_name = 'ที่ตักอาหารสัตว์', is_sample = false WHERE sku_id = 'PRE-SPO';
UPDATE master_sku SET ecommerce_name = '[GIFT] BUZZ ชามอาหารแมว / สุนัข ลิ้มรสความอร่อยจากชามอาหารสุดน่ารัก จากบัซซ์ คละสี คละแบบ', is_sample = false WHERE sku_id = 'PRE-BOW|CATFACE';
UPDATE master_sku SET ecommerce_name = '[SET] Buzz Balanced+ แมวโต Indoor | 7 กก. [2 x 3 กก. + 1 กก.]', is_sample = false WHERE sku_id = 'BS-BAP-C|IND|070';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond สุนัขโต รสเนื้ออบ | 10 กก.', is_sample = false WHERE sku_id = 'B-BEY-D|BEF|100';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะ เม็ดเล็ก | 1.2 กก.', is_sample = false WHERE sku_id = 'B-NEP-D|SKN-S|012';
UPDATE master_sku SET ecommerce_name = 'กระเป๋าผ้าดิบแคนวาส 14 นิ้วแนวนอน ลายนุดมี้', is_sample = false WHERE sku_id = 'PRE-BAG|CAV-NOODMI';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ ลูกสุนัข แกะ เม็ดเล็ก | 500 กรัม', is_sample = false WHERE sku_id = 'B-NEP-D|PUP-S|005';
UPDATE master_sku SET ecommerce_name = 'Tester | Buzz Netura แมวโตและลูก ปลาเนื้อขาว แฮร์ริ่ง และไก่ | 50 กรัม', is_sample = false WHERE sku_id = 'TT-NET-C|FHC|0005';
UPDATE master_sku SET ecommerce_name = 'Tester | Buzz Netura สุนัขโต ไก่ เม็ดเล็ก | 50 กรัม', is_sample = false WHERE sku_id = 'TT-NET-D|CHI-S|0005';
UPDATE master_sku SET ecommerce_name = 'Buzz Balanced+ แมวโต Weight+ | 1 กก.', is_sample = false WHERE sku_id = 'B-BAP-C|WEP|010';
UPDATE master_sku SET ecommerce_name = 'Buzz Balanced+ ลูกและแม่แมว K&P | 3 กก.', is_sample = false WHERE sku_id = 'B-BAP-C|KNP|030';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะบำรุงข้อ เม็ดใหญ่ | 500 กรัม', is_sample = false WHERE sku_id = 'B-NEP-D|HEJ-L|005';
UPDATE master_sku SET ecommerce_name = 'Buzz Balanced+ แมวโต Indoor | 1 กก.', is_sample = false WHERE sku_id = 'B-BAP-C|IND|010';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura แมวโตและลูก ปลาเนื้อขาว แฮร์ริ่ง และไก่ | 1 กก.', is_sample = false WHERE sku_id = 'B-NET-C|FHC|010';
UPDATE master_sku SET ecommerce_name = 'แปรงหวีขน (คละสี)', is_sample = false WHERE sku_id = 'PRE-BRUSH';
UPDATE master_sku SET ecommerce_name = 'Buzz Balanced+ แมวโต Hair&Skin | 3 กก.', is_sample = false WHERE sku_id = 'B-BAP-C|HNS|030';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ ลูกสุนัข แกะ เม็ดใหญ่ | 3 กก.', is_sample = false WHERE sku_id = 'B-NEP-D|PUP-L|030';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond แม่และลูกสุนัข | 1 กก. [No Sticker]', is_sample = true WHERE sku_id = 'B-BEY-D|MNB|NS|010';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura สุนัขโต ไก่ เม็ดเล็ก | 800 กรัม', is_sample = false WHERE sku_id = 'B-NET-D|CHI-S|008';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond แมวโต รสทูน่า | 7 กก.', is_sample = false WHERE sku_id = 'B-BEY-C|TUN|070';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura สุนัขโต แซลมอน เม็ดใหญ่ | 800 กรัม', is_sample = false WHERE sku_id = 'B-NET-D|SAL-L|008';
UPDATE master_sku SET ecommerce_name = 'Tester | Buzz Netura แมวโตและลูก ปลาและไก่ | 50 กรัม', is_sample = false WHERE sku_id = 'TT-NET-C|FNC|0005';
UPDATE master_sku SET ecommerce_name = 'Buzz Balanced+ แมวโต Hair&Skin | 1 กก.', is_sample = false WHERE sku_id = 'B-BAP-C|HNS|010';
UPDATE master_sku SET ecommerce_name = 'ที่ให้น้ำพกพา 600 ml (คละสี)', is_sample = false WHERE sku_id = 'PRE-PWD|L';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura แมวโตและแมวสูงวัยอายุ 7 ปีขึ้นไป ปลาค็อด และ ปลาเทราต์ | 1 กก.', is_sample = false WHERE sku_id = 'B-NET-C|CNT|010';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond แมวโต รสแซลมอน | 7 กก.', is_sample = false WHERE sku_id = 'B-BEY-C|SAL|070';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond สุนัขโต รสไก่อบและตับ | 10 กก.', is_sample = false WHERE sku_id = 'B-BEY-D|CNL|100';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura สุนัขโต ไก่ เม็ดใหญ่ | 800 กรัม', is_sample = false WHERE sku_id = 'B-NET-D|CHI-L|008';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura สุนัขโต แซลมอน เม็ดเล็ก | 2.5 กก.', is_sample = false WHERE sku_id = 'B-NET-D|SAL-S|025';
UPDATE master_sku SET ecommerce_name = 'ถุงผ้าสปันบอนด์การ์ตูนสกรีนเต็มใบ Size XL (50*40*9 cm)', is_sample = false WHERE sku_id = 'PRE-BAG|SPB|MARKET';
UPDATE master_sku SET ecommerce_name = 'ผ้าห่ม ลาย Noodmi', is_sample = false WHERE sku_id = 'PRE-BKT|NOODMI';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะ เม็ดเล็ก | 15 กก.', is_sample = false WHERE sku_id = 'B-NEP-D|SKN-S|150';
UPDATE master_sku SET ecommerce_name = 'ผ้ากันเปื้อนหมาแมว สีม่วง ไซส์ M (หมาเล็ก/แมว)', is_sample = false WHERE sku_id = 'PRE-BIB-PURPLE-M';
UPDATE master_sku SET ecommerce_name = 'ที่ให้น้ำพกพา 350 ml (คละสี)', is_sample = false WHERE sku_id = 'PRE-PWD|S';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura สุนัขโต ไก่ เม็ดใหญ่ | 2.5 กก.', is_sample = false WHERE sku_id = 'B-NET-D|CHI-L|025';
UPDATE master_sku SET ecommerce_name = 'Buzz Balanced+ แมวโต Indoor | 3 กก.', is_sample = false WHERE sku_id = 'B-BAP-C|IND|030';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะ เม็ดใหญ่ | 1.2 กก.', is_sample = false WHERE sku_id = 'B-NEP-D|SKN-L|012';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะ เม็ดใหญ่ | 500 กรัม', is_sample = false WHERE sku_id = 'B-NEP-D|SKN-L|005';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะบำรุงข้อ เม็ดเล็ก | 15 กก.', is_sample = false WHERE sku_id = 'B-NEP-D|HEJ-S|150';
UPDATE master_sku SET ecommerce_name = 'ผ้ากันเปื้อนหมาแมว สีฟ้า ไซส์ M (หมาเล็ก/แมว)', is_sample = false WHERE sku_id = 'PRE-BIB-BLUE-M';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura แมวโตและลูก แซลมอน | 1 กก.', is_sample = false WHERE sku_id = 'B-NET-C|SAL|010';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond สุนัขโต รสแซลมอน | 10 กก.', is_sample = false WHERE sku_id = 'B-BEY-D|SAL|100';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura สุนัขโต แซลมอน เม็ดใหญ่ | 10 กก.', is_sample = false WHERE sku_id = 'B-NET-D|SAL-L|100';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ ลูกสุนัข แกะ เม็ดใหญ่ | 500 กรัม', is_sample = false WHERE sku_id = 'B-NEP-D|PUP-L|005';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond แมวโต รสปลาทู | 1 กก. [No Sticker]', is_sample = true WHERE sku_id = 'B-BEY-C|MCK|NS|010';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura สุนัขโต ไก่ เม็ดเล็ก | 2.5 กก.', is_sample = false WHERE sku_id = 'B-NET-D|CHI-S|025';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura แมวโตและลูก ปลาและไก่ | 1 กก.', is_sample = false WHERE sku_id = 'B-NET-C|FNC|010';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura สุนัขโต แซลมอน เม็ดเล็ก | 800 กรัม', is_sample = false WHERE sku_id = 'B-NET-D|SAL-S|008';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะบำรุงข้อ เม็ดเล็ก | 1.2 กก.', is_sample = false WHERE sku_id = 'B-NEP-D|HEJ-S|012';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond แม่และลูกสุนัข | 7 กก.', is_sample = false WHERE sku_id = 'B-BEY-D|MNB|070';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond แม่และลูกแมว รสแซลมอน ทูน่า และนม | 7 กก.', is_sample = false WHERE sku_id = 'B-BEY-C|MNB|070';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ ลูกสุนัข แกะ เม็ดเล็ก | 3 กก.', is_sample = false WHERE sku_id = 'B-NEP-D|PUP-S|030';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond แมวโต รสแกะ | 1 กก. [No Sticker]', is_sample = true WHERE sku_id = 'B-BEY-C|LAM|NS|010';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura แมวโตและลูก ปลาและไก่ | 4 กก.', is_sample = false WHERE sku_id = 'B-NET-C|FNC|040';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะบำรุงข้อ เม็ดใหญ่ | 1.2 กก.', is_sample = false WHERE sku_id = 'B-NEP-D|HEJ-L|012';
UPDATE master_sku SET ecommerce_name = '[SET] Buzz Balanced+ แมวโต Weight+ | 7 กก. [2 x 3 กก. + 1 กก.]', is_sample = false WHERE sku_id = 'BS-BAP-C|WEP|070';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond แมวโต รสแกะ | 7 กก.', is_sample = false WHERE sku_id = 'B-BEY-C|LAM|070';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura แมวโตและลูก แซลมอน | 4 กก.', is_sample = false WHERE sku_id = 'B-NET-C|SAL|040';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะบำรุงข้อ เม็ดใหญ่ | 3 กก.', is_sample = false WHERE sku_id = 'B-NEP-D|HEJ-L|030';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะบำรุงข้อ เม็ดเล็ก | 3 กก.', is_sample = false WHERE sku_id = 'B-NEP-D|HEJ-S|030';
UPDATE master_sku SET ecommerce_name = '[SET] Buzz Balanced+ แมวโต Hair&Skin | 7 กก. [2 x 3 กก. + 1 กก.]', is_sample = false WHERE sku_id = 'BS-BAP-C|HNS|070';
UPDATE master_sku SET ecommerce_name = 'Tester | Buzz Netura สุนัขโต แซลมอน เม็ดเล็ก | 50 กรัม', is_sample = false WHERE sku_id = 'TT-NET-D|SAL-S|0005';
UPDATE master_sku SET ecommerce_name = '[SET] Buzz Netura สุนัขโต แซลมอน เม็ดเล็ก | 10 กก. [4 x 2.5 กก.]', is_sample = false WHERE sku_id = 'BS-NET-D|SAL-S|100';
UPDATE master_sku SET ecommerce_name = 'Buzz Balanced+ ลูกและแม่แมว K&P | 1 กก.', is_sample = false WHERE sku_id = 'B-BAP-C|KNP|010';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond สุนัขโต รสไก่อบและตับ | 1.2 กก. [No Sticker]', is_sample = true WHERE sku_id = 'B-BEY-D|CNL|NS|012';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond แมวโต รสทูน่า | 1 กก. [No Sticker]', is_sample = true WHERE sku_id = 'B-BEY-C|TUN|NS|010';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond สุนัขโต รสแกะ | 10 กก.', is_sample = false WHERE sku_id = 'B-BEY-D|LAM|100';
UPDATE master_sku SET ecommerce_name = 'กระเป๋าผ้าดิบแคนวาส 14 นิ้วแนวนอน ลาย proteinx', is_sample = false WHERE sku_id = 'PRE-BAG|CAV-PROTEINX';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura แมวโตและแมวสูงวัยอายุ 7 ปีขึ้นไป ปลาค็อด และ ปลาเทราต์ | 4 กก.', is_sample = false WHERE sku_id = 'B-NET-C|CNT|040';
UPDATE master_sku SET ecommerce_name = 'Buzz Beyond แม่และลูกแมว รสแซลมอน ทูน่า และนม | 1 กก. [No Sticker]', is_sample = true WHERE sku_id = 'B-BEY-C|MNB|NS|010';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura สุนัขโต แซลมอน เม็ดใหญ่ | 2.5 กก.', is_sample = false WHERE sku_id = 'B-NET-D|SAL-L|025';
UPDATE master_sku SET ecommerce_name = 'Buzz Netura+ สุนัขโต แกะ เม็ดเล็ก | 3 กก.', is_sample = false WHERE sku_id = 'B-NEP-D|SKN-S|030';
UPDATE master_sku SET ecommerce_name = 'Tester | Buzz Netura สุนัขโต แซลมอน เม็ดใหญ่ | 50 กรัม', is_sample = false WHERE sku_id = 'TT-NET-D|SAL-L|0005';
