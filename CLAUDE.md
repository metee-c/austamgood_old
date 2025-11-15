# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Required Context Files

**Before starting any task, check if these files exist and read them:**
- `supabase/DATABASE_DOCUMENTATION.md` - Complete database schema documentation (if available)
- `DESIGN_SYSTEM.md` - Complete UI/UX design system (colors, typography, components, spacing)
- These files provide essential context for all development tasks

## Project Overview

AustamGood WMS is a Warehouse Management System built with Next.js 15, TypeScript, Tailwind CSS, and Supabase. The application is designed for mid-to-large-sized businesses to manage warehouse operations including inventory tracking, receiving, shipping, order processing, route planning (VRP), and reporting. The UI is in Thai language.

## Key Technologies

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (with `strict: false`)
- **Database**: Supabase (PostgreSQL with real-time capabilities)
- **Auth**: Supabase Auth with `@supabase/auth-helpers-nextjs` and `@supabase/ssr`
- **Styling**: Tailwind CSS
- **State Management**: React hooks (Redux Toolkit available but not widely used)
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Custom components in `components/ui/`
- **Maps**: Mapbox GL (`mapbox-gl`) for route visualization
- **Data Fetching**: SWR for client-side data fetching with caching
- **Fonts**: Sarabun and Noto Sans Thai for Thai language support
- **PDF/Excel**: jsPDF with autotable for PDFs, xlsx for Excel import/export
- **Barcodes/QR**: react-barcode, qrcode.react, html5-qrcode for scanning
- **Date handling**: date-fns for date formatting and manipulation
- **Charts**: recharts for data visualization
- **Icons**: lucide-react for UI icons

## Development Commands

### Local Development
```bash
npm run dev              # Start dev server on 0.0.0.0 (accessible on network)
npm run build            # Create production build
npm run start            # Run production server
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript compiler without emitting files
```

### Database Operations
```bash
npm run db:generate-types  # Generate TypeScript types from Supabase schema
npm run db:migrate         # Run database migrations
npm run db:seed            # Seed the database
```

### Scripts
```bash
npm run recalculate-weights  # Recalculate location weights (ts-node script)
```

### Common Development Workflow
```bash
# 1. Start development
npm run dev

# 2. After database schema changes in Supabase
npm run db:generate-types

# 3. Before committing
npm run typecheck
npm run lint

# 4. Build for production
npm run build
```

## Environment Setup

Create a `.env.local` file (use `.env.local.example` as template):
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token  # Required for route planning/maps
```

**Note**: Mapbox token is required for route visualization features. Get one at https://mapbox.com

## Architecture & Project Structure

### App Router Structure
The application uses Next.js 15 App Router with the following main sections:

- `/dashboard` - Main dashboard with statistics and overview
- `/master-data` - Master data management (products, customers, suppliers, locations, etc.)
- `/warehouse` - Warehouse operations (inbound, inventory balances/ledger, transfer)
- `/receiving` - Receiving operations (orders, loadlists, picklists, routes)
- `/shipping` - Shipping operations
- `/reports` - Reporting interface
- `/production` - Production order management
- `/mobile` - Mobile-optimized interfaces for warehouse operations

### Component Organization

- `components/ui/` - Reusable UI components (Button, Card, Table, Modal, Badge, etc.)
- `components/forms/` - Form components for data entry (Add/Edit/Import forms)
- `components/layout/` - Layout components (Sidebar, Header, MainLayout, MobileLayout)
- `components/warehouse/` - Warehouse-specific components (GoodsReceiptForm, ZoneLocationSelect)
- `components/receiving/` - Receiving-specific components (LoadlistPrintDocument, FaceSheetDetailModal)
- `components/mobile/` - Mobile UI components (ScannerInput, MobileButton, QuantityInput)
- `components/production/` - Production-related components
- `components/maps/` - Map components (RouteMap with Mapbox)
- `components/vrp/` - Vehicle Routing Problem optimization components
- `components/orders/` - Order-related components (ImportOrderModal)

### Data Layer

#### Supabase Clients
- `lib/supabase/client.ts` - Client-side Supabase client for client components (uses `createClientComponentClient`)
- `lib/supabase/server.ts` - Server-side Supabase client for server components/API routes (async, uses cookies)
- `lib/supabase/route-handler.ts` - Specialized handler for API route patterns

#### Custom Hooks
Custom hooks in `hooks/` use SWR for data fetching with caching:
- `useOrders.ts` - Order data fetching and mutations
- `useSuppliers.ts` - Supplier data management
- `useCustomers.ts` - Customer data management
- `useSkus.ts` / `useSkuOptions.ts` - Product/SKU data
- `useLocations.ts` - Location data
- `useWarehouses.ts` - Warehouse data
- `useReceive.ts` - Receiving operations
- `useMoves.ts` - Inventory movement operations
- `usePreparationAreas.ts` - Preparation area data
- `useProductionOrders.ts` - Production order management
- `useEmployees.ts` - Employee data
- `useFormOptions.ts` - Form dropdown options

#### Database Services
Services in `lib/database/` provide abstraction for database operations:
- `master-sku.ts` - Product/SKU management
- `bom-sku.ts` - Bill of Materials
- `warehouse.ts` - Warehouse and location management
- `receive.ts` - Receiving operations
- `move.ts` - Inventory movements/transfers
- `user-management.ts` - User and role management
- `wms-receive-new.ts` - New receiving workflow
- `orders.service.ts` - Order management
- `file-management.ts` - File upload/management

#### Type Definitions
- `types/database/supabase.ts` - Auto-generated from Supabase schema
- `types/database/` - Database entity types
- `types/*-schema.ts` - Zod schemas for form validation
- `types/*.ts` - Application-specific type definitions

### API Routes
API routes in `app/api/` follow REST patterns with standard HTTP methods:
- `/api/receives/*` - Receiving operations (includes pallet generation, validation, dashboard)
- `/api/orders/*` - Order management (CRUD, import, dashboard, with-items)
- `/api/master-*/*` - Master data endpoints (suppliers, customers, employees, SKU, vehicles, warehouses, locations)
- `/api/loadlists/*` - Loadlist operations and available picklists
- `/api/picklists/*` - Picklist management
- `/api/face-sheets/*` - Face sheet generation and delivery documents
- `/api/route-plans/*` - Route planning, optimization, and draft orders
- `/api/mobile/loading/*` - Mobile loading operations (tasks, items, status updates, completion)
- `/api/moves/*` - Inventory movement operations and status updates
- `/api/preparation-areas/*` - Preparation area management with import/export
- `/api/storage-strategies/*` - Storage strategy configuration

### Route Planning & VRP (Vehicle Routing Problem)
The system includes advanced route optimization capabilities. See `README_VRP.md` for detailed documentation.

Key files:
- `lib/vrp/algorithms.ts` - VRP algorithms (insertion heuristic, Clarke-Wright savings, nearest neighbor)
- `lib/vrp/mapbox.ts` - Mapbox integration for route visualization and distance calculations
- `components/vrp/OptimizationSidebar.tsx` - UI for route optimization settings
- `components/maps/RouteMap.tsx` - Interactive map display with Mapbox
- `app/receiving/routes/page.tsx` - Main route planning interface
- `app/api/route-plans/optimize/route.ts` - Route optimization endpoint

**VRP Algorithms:**
- **Insertion Heuristic** (recommended): Fast, efficient, good for 20-100 orders
- **Clarke-Wright Savings**: Best results but slower, good for <70 orders
- **Nearest Neighbor**: Fastest but lower quality, for testing only

**Performance:**
- <30 orders: 2-5 seconds (Insertion + 2-opt)
- 30-70 orders: 5-15 seconds (Savings + 2-opt)
- 70-150 orders: 15-60 seconds (Insertion)
- >150 orders: 60-120 seconds (Insertion, no local search)

## Key Patterns & Conventions

### Critical: Supabase Client Usage
**IMPORTANT**: Always use the correct Supabase client for each context to avoid authentication and data access issues.

- **Client Components**: Use `createClient()` from `@/lib/supabase/client`
  ```tsx
  'use client'
  import { createClient } from '@/lib/supabase/client'

  const supabase = createClient()
  ```

- **Server Components**: Use `await createClient()` from `@/lib/supabase/server`
  ```tsx
  import { createClient } from '@/lib/supabase/server'

  export default async function Page() {
    const supabase = await createClient()
    // ...
  }
  ```

- **API Routes**: Use `await createClient()` from `@/lib/supabase/server`
  ```tsx
  import { createClient } from '@/lib/supabase/server'

  export async function GET() {
    const supabase = await createClient()
    // ...
  }
  ```

### Data Fetching
- **Client components**: Use SWR for data fetching with automatic revalidation
- **Server components**: Use direct Supabase queries with `await createClient()`
- **API routes**: Handle mutations and complex operations, return `NextResponse.json()`
- **Error handling**: Check for `error` in Supabase responses, return appropriate HTTP status codes

### Form Handling
- Forms use React Hook Form with Zod schemas for validation
- Schemas are defined in `types/*-schema.ts` files
- Form components follow naming: `Add*Form`, `Edit*Form`, `Import*Form`

### Thai Language
- All UI text is in Thai
- Use Thai fonts (Sarabun, Noto Sans Thai) configured in root layout
- Apply `font-thai` className for Thai text

### Mobile-First Features
- Mobile interfaces in `/mobile` path with optimized layouts
- Scanner input components for barcode/QR scanning
- Touch-friendly buttons and larger tap targets
- Progressive Web App (PWA) configuration in metadata

### Location Management
- Locations have hierarchical structure: Warehouse → Zone → Aisle → Rack → Shelf → Bin
- Location codes follow specific format
- Weight and capacity tracking per location
- Storage strategies determine putaway logic

### Receiving Workflow
1. Create receive order with items
2. Generate pallet IDs
3. Scan and validate pallets
4. Assign to locations
5. Generate loadlists and face sheets

## Important Notes

### Path Aliases
The project uses `@/*` as alias for root directory (configured in `tsconfig.json`).

### TypeScript Configuration
- `strict: false` - Project doesn't use strict mode (allows more flexible type handling)
- Target: ES2017
- Module resolution: bundler
- `noEmit: true` - Type checking only, no JS output

### Webpack Configuration
Client-side webpack excludes `fs`, `net`, `tls` modules for browser compatibility.

### Database Type Generation
After schema changes in Supabase, regenerate types with:
```bash
npm run db:generate-types
```
This updates `types/database/supabase.ts` with latest schema. The types are auto-generated from the live Supabase project (ID: iwlkslewdgenckuejbit).

### Network Development
Dev server runs on `0.0.0.0` to allow mobile device testing on local network.

### PWA Configuration
The app is configured as a Progressive Web App with:
- Manifest file at `/manifest.json`
- Apple Web App capabilities
- Theme color: #0099FF (primary blue)
- Optimized for mobile warehouse operations

## Common Workflows

### Adding a New Master Data Entity
1. Create database table in Supabase
2. Run `npm run db:generate-types`
3. Create Zod schema in `types/*-schema.ts`
4. Create database service in `lib/database/*.ts`
5. Create API route in `app/api/*`
6. Create form components in `components/forms/`
7. Create page in `app/master-data/*/page.tsx`
8. Add menu item to Sidebar component

### Adding a New API Endpoint
1. Create route file in `app/api/*/route.ts`
2. Import and use server Supabase client
3. Implement GET, POST, PUT, DELETE as needed
4. Return `NextResponse.json()` with data
5. Handle errors with appropriate status codes

### Working with Forms
1. Define Zod schema in `types/*-schema.ts`
2. Use `useForm` with `zodResolver`
3. Implement form UI with proper Thai labels
4. Handle submission with API call
5. Show success/error feedback
6. Revalidate data (SWR mutate or router refresh)

### Database Queries
**ALWAYS check for errors before using data to prevent runtime crashes.**

Basic operations:
- `.select()` - Fetch data (chain with `.eq()`, `.or()`, `.ilike()` for filters)
- `.insert()` - Create records
- `.update()` - Modify records
- `.delete()` - Remove records
- `.single()` - Get single record (throws error if not found)
- `.order()` - Sort results
- `.range()` - Pagination

**Error Handling Pattern (CRITICAL):**
```typescript
const { data, error } = await supabase
  .from('table')
  .select('*')

if (error) {
  console.error('Database error:', error)
  return NextResponse.json({ error: error.message }, { status: 500 })
}

// Now safe to use data
return NextResponse.json(data)
```

**Common Query Patterns:**
```typescript
// 1. Search across multiple fields
query = query.or(`field1.ilike.%${search}%,field2.ilike.%${search}%`)

// 2. Ordering
query = query.order('created_at', { ascending: false })

// 3. Single record with joins
const { data, error } = await supabase
  .from('wms_receives')
  .select(`
    *,
    master_supplier(supplier_name),
    master_employee(first_name, last_name)
  `)
  .eq('id', id)
  .single()

// 4. Date range filtering
query = query
  .gte('order_date', startDate)
  .lte('order_date', endDate)

// 5. Conditional filtering
if (status && status !== 'all') {
  query = query.eq('status', status)
}

// 6. Pagination
const { data, error } = await supabase
  .from('table')
  .select('*')
  .range(start, end)
  .order('created_at', { ascending: false })

// 7. Count
const { count, error } = await supabase
  .from('table')
  .select('*', { count: 'exact', head: true })
```

## Database Schema Overview

The system has **48 tables** across 5 main modules:
1. **Master Data** (11 tables) - Products, customers, suppliers, locations, vehicles, employees, etc.
2. **Warehouse Operations** (14 tables) - Receiving, inventory, movements, locations
3. **Order & Logistics** (9 tables) - Orders, picklists, loadlists, route plans, face sheets
4. **Production** (4 tables) - Production orders, BOM, material issues
5. **File & User Management** (10 tables) - Files, import/export jobs, users, roles, permissions

**Important**: If `supabase/DATABASE_DOCUMENTATION.md` exists, always refer to it for complete schema details including all tables, relationships, and constraints.

---

## Common Gotchas & Troubleshooting

### 1. TypeScript Strict Mode is Disabled
- `strict: false` in tsconfig.json means optional chaining and null checks are less enforced
- Always manually check for null/undefined when accessing potentially missing data
- Be extra careful with data from database queries

### 2. Supabase Client Context Issues
**Problem**: "User not authenticated" or data not loading
**Solution**: Ensure you're using the correct client:
- Client components → `@/lib/supabase/client`
- Server components/API routes → `@/lib/supabase/server` (with await)

### 3. Thai Font Not Displaying
**Problem**: Thai text shows boxes or incorrect characters
**Solution**: Always add `font-thai` class to elements with Thai text:
```tsx
<div className="font-thai">ข้อความภาษาไทย</div>
```

### 4. SWR Not Revalidating After Mutation
**Problem**: Data doesn't update after create/update/delete
**Solution**: Use SWR's mutate function:
```tsx
import { mutate } from 'swr'

// After successful mutation
mutate('/api/receives')
// or use the hook
const { mutate: localMutate } = useSWR('/api/receives')
await localMutate()
```

### 5. Next.js 15 App Router Caching
**Problem**: Data appears stale or cached incorrectly
**Solution**: Use revalidation strategies:
```tsx
// In page component
export const revalidate = 0 // disable caching
// or
export const dynamic = 'force-dynamic'

// In API route
export const dynamic = 'force-dynamic'
```

### 6. Type Generation After Schema Changes
**Problem**: TypeScript errors after Supabase schema changes
**Solution**: Always regenerate types after schema modifications:
```bash
npm run db:generate-types
```

### 7. Environment Variables Not Loading
**Problem**: NEXT_PUBLIC_SUPABASE_URL is undefined
**Solution**:
1. Ensure `.env.local` exists (copy from `.env.local.example`)
2. Restart dev server after changing env vars
3. Prefix client-side vars with `NEXT_PUBLIC_`

### 8. Route Planning/Maps Not Working
**Problem**: Maps not rendering or route optimization failing
**Solution**:
1. Ensure `NEXT_PUBLIC_MAPBOX_TOKEN` is set in `.env.local`
2. Get token from https://mapbox.com if needed
3. Restart dev server after adding token

---

## Performance Considerations

### 1. Database Queries
- Always use `.select()` to specify only needed columns instead of `*`
- Use pagination with `.range()` for large datasets
- Create indexes in Supabase for frequently filtered columns
- Use joins instead of multiple queries when fetching related data

### 2. SWR Configuration
- Set appropriate `revalidateOnFocus` and `revalidateOnReconnect` options
- Use `dedupingInterval` to prevent duplicate requests
- Consider using `useSWRInfinite` for infinite scroll

### 3. Component Optimization
- Use `React.memo()` for components that render frequently with same props
- Lazy load heavy components with `next/dynamic`
- Optimize images with `next/image`

---

## Security Best Practices

### 1. Authentication & Authorization
- Always check user authentication in API routes
- Implement Row Level Security (RLS) in Supabase
- Never expose service role key in client-side code
- Use Supabase Auth helpers for session management

### 2. Input Validation
- Use Zod schemas for all form inputs
- Sanitize user input before database queries
- Validate file uploads (type, size) before processing

### 3. API Route Security
```tsx
// Example secure API route
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  // 1. Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Validate input
  const body = await request.json()
  const result = yourSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  // 3. Perform operation
  // ...
}
```
