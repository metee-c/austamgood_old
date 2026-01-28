-- Migration 305: Fix RLS policies for packing_rules and packing_box_stocks tables
-- Issue: Tables had RLS enabled but policies were not allowing SELECT for anonymous/public users

-- packing_rules
DROP POLICY IF EXISTS "Allow all for authenticated users" ON packing_rules;
CREATE POLICY "Allow select for all" ON packing_rules FOR SELECT USING (true);
CREATE POLICY "Allow insert for authenticated" ON packing_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON packing_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for authenticated" ON packing_rules FOR DELETE TO authenticated USING (true);

-- packing_box_stocks
DROP POLICY IF EXISTS "Allow all for authenticated users" ON packing_box_stocks;
CREATE POLICY "Allow select for all" ON packing_box_stocks FOR SELECT USING (true);
CREATE POLICY "Allow insert for authenticated" ON packing_box_stocks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON packing_box_stocks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for authenticated" ON packing_box_stocks FOR DELETE TO authenticated USING (true);

-- packing_box_stock_history
DROP POLICY IF EXISTS "Allow all for authenticated users" ON packing_box_stock_history;
CREATE POLICY "Allow select for all" ON packing_box_stock_history FOR SELECT USING (true);
CREATE POLICY "Allow insert for authenticated" ON packing_box_stock_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON packing_box_stock_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for authenticated" ON packing_box_stock_history FOR DELETE TO authenticated USING (true);
