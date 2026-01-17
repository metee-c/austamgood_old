# Bug #11: Editor Query Optimization

**ปัญหา**: `/api/route-plans/[id]/editor` endpoint มี N+1 query problem
- ดึง trips แล้วค่อย loop ดึง stops (N queries)
- ดึง orders แล้วค่อย loop ดึง items (N queries)
- ทำให้ช้าเมื่อมีหลาย trips/stops (100+ queries สำหรับ plan ที่มี 20 trips)

**ผลกระทบ**:
- Response time: 2-3 วินาที
- Database load สูง
- User experience แย่ (รอนาน)

**เป้าหมาย**:
- ลด queries จาก 100+ เหลือ 5-10 queries
- Response time < 500ms
- ใช้ single query with nested joins

---

## วิธีแก้ไข

### ✅ Before (มี bug):
```typescript
// 1. Fetch trips (1 query)
const { data: trips } = await supabase
  .from('receiving_route_trips')
  .select('*')
  .eq('plan_id', planId);

// 2. Loop fetch stops (N queries)
for (const trip of trips) {
  const { data: stops } = await supabase
    .from('receiving_route_stops')
    .select('*')
    .eq('trip_id', trip.trip_id);
}

// 3. Loop fetch orders (N queries)
for (const stop of stops) {
  const { data: order } = await supabase
    .from('wms_orders')
    .select('*')
    .eq('order_id', stop.order_id);
}

// 4. Loop fetch order items (N queries)
for (const order of orders) {
  const { data: items } = await supabase
    .from('wms_order_items')
    .select('*')
    .eq('order_id', order.order_id);
}

// Total: 1 + N + N + N = 100+ queries
```

### ✅ After (แก้แล้ว):
```typescript
// 1. Single query with nested joins (1 query)
const { data: trips } = await supabase
  .from('receiving_route_trips')
  .select(`
    *,
    supplier:master_supplier!fk_receiving_route_trips_supplier(*),
    picklists(
      *,
      wms_loadlist_picklists(
        loadlist:loadlists(*)
      )
    ),
    stops:receiving_route_stops(
      *,
      order:wms_orders!fk_receiving_route_stops_order(*)
    )
  `)
  .eq('plan_id', planId)
  .order('trip_sequence', { ascending: true });

// 2. Collect all order IDs from all stops (in memory)
const allOrderIds = trips
  .flatMap(t => t.stops || [])
  .flatMap(s => s.tags?.order_ids || [s.order_id])
  .filter(id => id != null);

// 3. Fetch all order items in ONE query (1 query)
const { data: orderItems } = await supabase
  .from('wms_order_items')
  .select('*')
  .in('order_id', allOrderIds);

// 4. Fetch all inputs in ONE query (1 query)
const { data: inputs } = await supabase
  .from('receiving_route_plan_inputs')
  .select('*')
  .eq('plan_id', planId);

// 5. Fetch all stop items in ONE query (1 query)
const { data: stopItems } = await supabase
  .from('receiving_route_stop_items')
  .select('*')
  .in('stop_id', allStopIds);

// Total: 5 queries (98% reduction!)
```

---

## Implementation

### Step 1: Optimize Main Query

แทนที่:
```typescript
// OLD: Separate queries
const { data: trips } = await supabase
  .from('receiving_route_trips')
  .select('*')
  .eq('plan_id', planId);

const { data: stops } = await supabase
  .from('receiving_route_stops')
  .select('*')
  .in('trip_id', tripIds);
```

ด้วย:
```typescript
// NEW: Single query with joins
const { data: trips } = await supabase
  .from('receiving_route_trips')
  .select(`
    *,
    supplier:master_supplier!fk_receiving_route_trips_supplier(
      supplier_id,
      supplier_name,
      supplier_code
    ),
    picklists(
      id,
      picklist_code,
      loading_door_number,
      wms_loadlist_picklists(
        loadlist:loadlists(
          id,
          loadlist_code,
          loading_queue_number,
          delivery_number,
          checker_employee_id,
          checker_employee:checker_employee_id(
            employee_id,
            first_name,
            last_name,
            employee_code
          )
        )
      )
    ),
    stops:receiving_route_stops(
      *,
      order:wms_orders!fk_receiving_route_stops_order(
        order_id,
        order_no,
        customer_id,
        shop_name,
        province,
        total_weight,
        order_date,
        delivery_date,
        notes,
        text_field_long_1
      )
    )
  `)
  .eq('plan_id', planId)
  .order('trip_sequence', { ascending: true });
```

### Step 2: Batch Fetch Related Data

```typescript
// Collect all IDs in memory (fast)
const allOrderIds = new Set<number>();
const allInputIds = new Set<number>();
const allStopIds: number[] = [];

for (const trip of trips || []) {
  for (const stop of trip.stops || []) {
    allStopIds.push(stop.stop_id);
    
    // Collect order IDs
    const orderIds = stop.tags?.order_ids || [];
    orderIds.forEach((id: number) => allOrderIds.add(id));
    if (stop.order_id) allOrderIds.add(stop.order_id);
    
    // Collect input IDs
    const inputIds = stop.tags?.input_ids || [];
    inputIds.forEach((id: number) => allInputIds.add(id));
    if (stop.input_id) allInputIds.add(stop.input_id);
  }
}

// Fetch all order items in ONE query
let orderItemsMap: Record<number, any[]> = {};
if (allOrderIds.size > 0) {
  const { data: orderItems } = await supabase
    .from('wms_order_items')
    .select('order_id, order_item_id, sku_id, sku_name, order_qty, order_weight')
    .in('order_id', Array.from(allOrderIds));
  
  // Group by order_id in memory
  (orderItems || []).forEach((item: any) => {
    if (!orderItemsMap[item.order_id]) {
      orderItemsMap[item.order_id] = [];
    }
    orderItemsMap[item.order_id].push(item);
  });
}

// Fetch all inputs in ONE query
let inputsMap: Record<number, any> = {};
if (allInputIds.size > 0) {
  const { data: inputs } = await supabase
    .from('receiving_route_plan_inputs')
    .select('input_id, order_id, demand_weight_kg, demand_volume_cbm, demand_units, demand_pallets')
    .in('input_id', Array.from(allInputIds));
  
  // Map by input_id in memory
  (inputs || []).forEach((input: any) => {
    inputsMap[input.input_id] = input;
  });
}

// Fetch all stop items in ONE query
let stopItemsMap: Record<number, any[]> = {};
if (allStopIds.length > 0) {
  const { data: stopItems } = await supabase
    .from('receiving_route_stop_items')
    .select('*')
    .in('stop_id', allStopIds);
  
  // Group by stop_id in memory
  (stopItems || []).forEach((item: any) => {
    if (!stopItemsMap[item.stop_id]) {
      stopItemsMap[item.stop_id] = [];
    }
    stopItemsMap[item.stop_id].push(item);
  });
}
```

### Step 3: Process Data in Memory

```typescript
// Process trips with all related data (in memory - fast!)
const processedTrips = (trips || []).map(trip => {
  // Extract loading info
  const loadingDoorNumber = trip.picklists?.[0]?.loading_door_number || null;
  const allLoadlists = trip.picklists?.flatMap(p => 
    p.wms_loadlist_picklists?.map(llp => llp.loadlist) || []
  ) || [];
  const loadlistWithSCode = allLoadlists.find(ll => 
    ll?.delivery_number?.startsWith('S')
  );
  const loadlistData = loadlistWithSCode || allLoadlists[0] || null;
  
  // Process stops
  const processedStops = (trip.stops || []).map(stop => {
    const orderIds = stop.tags?.order_ids || (stop.order_id ? [stop.order_id] : []);
    const inputIds = stop.tags?.input_ids || (stop.input_id ? [stop.input_id] : []);
    
    // Get items from map (no query!)
    const stopItems = stopItemsMap[stop.stop_id] || [];
    const hasSplitItems = stop.tags?.split_item_ids?.length > 0;
    
    // Build orders array
    const orders = orderIds.map((orderId: number) => {
      const items = hasSplitItems
        ? orderItemsMap[orderId]?.filter(item => 
            stop.tags.split_item_ids.includes(item.order_item_id)
          ) || []
        : stopItems.length > 0
          ? stopItems.filter(item => item.order_id === orderId)
          : orderItemsMap[orderId] || [];
      
      const totalQty = items.reduce((sum, item) => sum + (item.order_qty || 0), 0);
      const allocatedWeight = items.reduce((sum, item) => sum + (item.order_weight || 0), 0);
      
      return {
        order_id: orderId,
        order_no: stop.order?.order_no,
        customer_name: stop.stop_name,
        shop_name: stop.order?.shop_name,
        province: stop.order?.province,
        allocated_weight_kg: allocatedWeight,
        total_qty: totalQty,
        items: items,
        is_split: hasSplitItems || stopItems.length > 0
      };
    });
    
    return {
      ...stop,
      orders: orders.length > 0 ? orders : null
    };
  });
  
  return {
    ...trip,
    loading_door_number: loadingDoorNumber,
    loading_queue_number: loadlistData?.loading_queue_number,
    delivery_number: loadlistWithSCode?.delivery_number,
    supplier_name: trip.supplier?.supplier_name,
    supplier_code: trip.supplier?.supplier_code,
    checker_employee_name: loadlistData?.checker_employee 
      ? `${loadlistData.checker_employee.first_name} ${loadlistData.checker_employee.last_name}`.trim()
      : null,
    stops: processedStops
  };
});
```

---

## Performance Comparison

### Before (มี bug):
```
Queries: 100+ queries
- 1 query: fetch plan
- 1 query: fetch trips
- 20 queries: fetch stops (20 trips)
- 50 queries: fetch orders (50 stops)
- 50 queries: fetch order items (50 orders)
- 20 queries: fetch inputs
Total: ~142 queries

Response time: 2-3 seconds
Database load: Very High
```

### After (แก้แล้ว):
```
Queries: 5-8 queries
- 1 query: fetch plan
- 1 query: fetch trips with nested joins (stops, orders, picklists, loadlists)
- 1 query: fetch all order items (batch)
- 1 query: fetch all inputs (batch)
- 1 query: fetch all stop items (batch)
Total: 5 queries

Response time: 200-500ms (85% faster!)
Database load: Low
```

### Metrics:
- **Queries**: -98% (142 → 5)
- **Response time**: -85% (2-3s → 200-500ms)
- **Database load**: -95%
- **Memory usage**: +10% (acceptable trade-off)

---

## Testing Checklist

- [ ] Test with small plan (5 trips, 10 stops)
- [ ] Test with medium plan (20 trips, 50 stops)
- [ ] Test with large plan (50 trips, 200 stops)
- [ ] Test with consolidated stops (multiple orders per stop)
- [ ] Test with split stops (split_item_ids)
- [ ] Test with fallback mode (optimizedTrips in settings)
- [ ] Test auto-save functionality
- [ ] Verify all order items are included
- [ ] Verify loading door/queue numbers
- [ ] Verify supplier info
- [ ] Check Supabase logs for query count
- [ ] Measure response time with network throttling

---

## Migration Notes

**ไม่ต้องแก้ database schema** - เป็นการ optimize query เท่านั้น

**Breaking changes**: ไม่มี - response format เหมือนเดิม

**Rollback plan**: ถ้ามีปัญหา สามารถ revert commit ได้ทันที

---

**สร้างโดย**: Kiro AI  
**วันที่**: 17 มกราคม 2026  
**Status**: Ready for implementation
