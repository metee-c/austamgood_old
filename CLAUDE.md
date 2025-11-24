# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Required Context Files

**Before starting any task, check if these files exist and read them:**
- `supabase/DATABASE_DOCUMENTATION.md` - Complete database schema documentation (if available)
- `DESIGN_SYSTEM.md` - Complete UI/UX design system (colors, typography, components, spacing)
- These files provide essential context for all development tasks

## Project Overview

AustamGood WMS is a Warehouse Management System built with Next.js 15, TypeScript, Tailwind CSS, and Supabase. The application is designed for mid-to-large-sized businesses to manage warehouse operations including inventory tracking, receiving, shipping, order processing, route planning (VRP), online packing, and reporting. The UI is in Thai language.

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
npm run build

# 4. Build for production
npm run build
```

### Database Migration Workflow
When making database schema changes:
```bash
# 1. Create migration file in supabase/migrations/
# Follow naming: XXX_descriptive_name.sql

# 2. Test migration locally
npm run db:migrate

# 3. Regenerate TypeScript types
npm run db:generate-types

# 4. Update affected services in lib/database/

# 5. Test the changes
npm run dev

# 6. Verify build
npm run build
```

**Migration File Examples:**
- `007_add_receive_to_ledger_trigger.sql` - Add database trigger
- `010_add_reference_doc_type_to_ledger.sql` - Add column to existing table
- `012_fix_date_type_casting.sql` - Fix data type issues
- `014_create_stock_import_tables.sql` - Create new tables for stock import
- `015_add_move_to_ledger_trigger.sql` - Add trigger for inventory transfers
- `026_add_workflow_status_enums.sql` - Add workflow status enums
- `027_create_workflow_status_triggers.sql` - Create 6 workflow triggers
- `028_add_loadlist_rls_and_triggers.sql` - Add RLS policies for loadlists

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
- `/online-packing` - **NEW**: E-commerce order packing system (9 sub-pages)
- `/stock-management` - Stock transfer, count, and adjustment

### Online Packing Module (New)
A comprehensive e-commerce packing system migrated from external POS_FULL system:

**Pages:**
- `/online-packing` - Main packing interface with barcode scanning
- `/online-packing/dashboard` - Packing statistics and productivity metrics
- `/online-packing/import` - Multi-platform order import (Shopee, TikTok, Lazada)
- `/online-packing/products` - Product master data management
- `/online-packing/promotions` - Freebie and promotion management
- `/online-packing/returns` - Return request handling with image upload
- `/online-packing/settings` - Box configuration and packing rules
- `/online-packing/users` - User management with role-based permissions
- `/online-packing/erp` - ERP export with bundle expansion

**Database Tables:** All tables use `packing_*` prefix (15 tables total)
**Type Definitions:** `types/online-packing.ts` (11 interfaces)
**Key Features:** Barcode scanning, bundle product expansion, audio feedback, multi-platform support

**Audio Feedback Pattern:**
The online packing module uses audio files for user feedback during packing operations:
- Audio files stored in `public/audio/` (success.mp3, error.mp3, etc.)
- Played via `new Audio('/audio/file.mp3').play()` for instant feedback
- Used for scan confirmations, errors, and completion events

### Stock Management Module
Inventory management operations for stock movements and adjustments:
- `/stock-management/transfer` - Stock transfers between locations
- `/stock-management/count` - Stock counting and cycle counts
- `/stock-management/adjustment` - Inventory adjustments and corrections
- `/stock-management/import` - **NEW**: Bulk stock import from legacy systems

**Database Tables:** `wms_stock_import_batches`, `wms_stock_import_staging`
**Type Definitions:** `types/stock-import.ts`
**Database Service:** `lib/database/stock-import.ts`
**Key Features:** Batch processing, validation, error tracking, multi-warehouse support

### Component Organization

- `components/ui/` - Reusable UI components (Button, Card, Table, Modal, Badge, etc.)
- `components/forms/` - Form components for data entry (Add/Edit/Import forms)
- `components/layout/` - Layout components (Sidebar, Header, MainLayout, MobileLayout, MobileBottomNav)
- `components/warehouse/` - Warehouse-specific components (GoodsReceiptForm, ZoneLocationSelect)
- `components/receiving/` - Receiving-specific components (LoadlistPrintDocument, FaceSheetDetailModal)
- `components/mobile/` - Mobile UI components (ScannerInput, MobileButton, QuantityInput)
- `components/production/` - Production-related components
- `components/maps/` - Map components (RouteMap with Mapbox)
- `components/vrp/` - Vehicle Routing Problem optimization components
- `components/orders/` - Order-related components (ImportOrderModal)

### Layout System

The application uses two distinct layout systems:

**Desktop Layout:**
- Root layout in `app/layout.tsx` provides global styles and fonts
- `MainLayout` component includes Sidebar navigation
- Full-featured navigation with collapsible sections
- Optimized for large screens

**Mobile Layout:**
- Separate layout in `app/mobile/layout.tsx` for mobile routes
- `MobileLayout` component with bottom navigation
- `MobileBottomNav` component for touch-optimized navigation
- Larger tap targets and simplified UI
- Mobile routes must be under `/mobile/*` path to use mobile layout

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
- `stock-import.ts` - **NEW**: Stock import batch processing

#### Type Definitions
- `types/database/supabase.ts` - Auto-generated from Supabase schema
- `types/database/` - Database entity types
- `types/*-schema.ts` - Zod schemas for form validation
- `types/*.ts` - Application-specific type definitions
- `types/online-packing.ts` - **NEW**: Online packing module types (11 interfaces)
- `types/stock-import.ts` - **NEW**: Stock import batch and staging types

### API Routes
API routes in `app/api/` follow REST patterns with standard HTTP methods:
- `/api/receives/*` - Receiving operations (includes pallet generation, validation, dashboard)
- `/api/orders/*` - Order management (CRUD, import, dashboard, with-items)
- `/api/master-*/*` - Master data endpoints (suppliers, customers, employees, SKU, vehicles, warehouses, locations)
- `/api/loadlists/*` - Loadlist operations and available picklists
  - `/api/loadlists/[id]/scan` - Scan orders onto loadlist (GET/POST)
  - `/api/loadlists/[id]/depart` - Mark loadlist as departed (POST)
- `/api/picklists/*` - Picklist management
  - `/api/picklists/[id]/print` - Mark picklist as printing (POST)
- `/api/face-sheets/*` - Face sheet generation and delivery documents
- `/api/route-plans/*` - Route planning, optimization, and draft orders
- `/api/mobile/loading/*` - Mobile loading operations (tasks, items, status updates, completion)
- `/api/moves/*` - Inventory movement operations and status updates
- `/api/preparation-areas/*` - Preparation area management with import/export
- `/api/storage-strategies/*` - Storage strategy configuration
- `/api/system-users/*` - System user management endpoints
- `/api/stock-import/*` - Stock import batch processing (upload, validate, process)

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

### Delivery Workflow Status Management (NEW)
The system implements an automated workflow with 6 database triggers that transition statuses automatically:

**Complete Workflow:**
```
1. Import Orders → status: draft
2. Create & Publish Route Plan → Orders: draft → confirmed (TRIGGER 1)
3. Create Picklist → Orders: confirmed → in_picking (TRIGGER 2)
4. Print Picklist API → Picklist: pending → picking
5. Complete Picklist → Orders: in_picking → picked + Route: ready_to_load (TRIGGER 3)
6. Scan to Loadlist → Orders: picked → loaded (TRIGGER 4)
7. Loadlist Depart API → Orders: loaded → in_transit + Route: in_transit (TRIGGER 5)
8. Mark Delivered → Orders: delivered + Loadlist/Route: completed (TRIGGER 6)
```

**Key Features:**
- Automatic status transitions via database triggers
- `loadlists` table with `loadlist_items` for tracking scanned orders
- API endpoints: `/api/picklists/[id]/print`, `/api/loadlists/[id]/scan`, `/api/loadlists/[id]/depart`
- Status enums: `draft`, `confirmed`, `in_picking`, `picked`, `loaded`, `in_transit`, `delivered`
- Route plan statuses: `draft`, `published`, `ready_to_load`, `in_transit`, `completed`

**Documentation:** See `docs-archive/workflow/WORKFLOW_IMPLEMENTATION_SUMMARY.md` for complete details

## Important Documentation Files

The codebase includes several important documentation files that provide detailed context for specific features:

- **DOCUMENTATION_INDEX.md** - Complete index of all 44+ documentation files organized by topic and role
- **DESIGN_SYSTEM.md** - Complete UI/UX design system (colors, typography, components, spacing)
- **README_VRP.md** - Vehicle Routing Problem system documentation
- **GEMINI.md** - AI configuration and guidelines for Gemini AI
- **docs-archive/workflow/WORKFLOW_IMPLEMENTATION_SUMMARY.md** - Delivery workflow status management system
- **docs-archive/workflow/WORKFLOW_STATUS_DESIGN.md** - Workflow design specifications
- **docs-archive/stock-import/STOCK_IMPORT_SUMMARY.md** - Stock import system documentation
- **docs-archive/stock-import/STOCK_IMPORT_PLAN.md** - Detailed stock import planning
- **docs-archive/mobile/MOBILE_RECEIVE_GUIDE.md** - Mobile receiving operations guide
- **docs-archive/mobile/MOBILE_TRANSFER_GUIDE.md** - Mobile transfer operations guide
- **docs-archive/workflow/WORKFLOW_QUICK_START.md** - Quick start guide for workflow system

**Best Practice:** Always check DOCUMENTATION_INDEX.md first to find relevant documentation before starting work on a feature. These docs contain critical context about design decisions, implementation details, and common patterns.

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

### Adding a New Module/Feature
1. Create database tables in Supabase (with appropriate prefix if module-specific)
2. Run `npm run db:generate-types`
3. Create type definitions in `types/` (e.g., `types/module-name.ts`)
4. Create Zod schema in `types/module-schema.ts` if forms are needed
5. Create database service in `lib/database/` if needed
6. Create API routes in `app/api/`
7. Create pages in `app/module-name/`
8. Add menu item to Sidebar component (`components/layout/Sidebar.tsx`)

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

The system has **80+ tables** across 7 main modules:
1. **Master Data** (11 tables) - Products, customers, suppliers, locations, vehicles, employees, etc.
2. **Warehouse Operations** (14 tables) - Receiving, inventory, movements, locations
3. **Order & Logistics** (9 tables) - Orders, picklists, loadlists, route plans, face sheets
4. **Production** (4 tables) - Production orders, BOM, material issues
5. **File & User Management** (10 tables) - Files, import/export jobs, users, roles, permissions
6. **Online Packing** (15 tables) - E-commerce packing system with `packing_*` prefix
7. **Inventory Ledger** (15 tables) - Complete inventory tracking with ledger system
8. **Stock Import** (2 tables) - Legacy system data import with `wms_stock_import_*` prefix

**Important**: If `supabase/DATABASE_DOCUMENTATION.md` exists, always refer to it for complete schema details including all tables, relationships, and constraints.

### Recent Schema Additions
The system includes recent migrations that add:
- Inventory ledger system with triggers (migrations 007-013)
- `receive_to_ledger` trigger that auto-creates ledger entries
- `reference_doc_type` field for tracking document origins
- Date type casting fixes for production dates
- Stock import tables for legacy system migration (migration 014)
- Move to ledger trigger system (migration 015) - auto-creates ledger entries for transfers
- Balance sync fixes for all move types (migrations 021-023)
- Workflow status management system (migrations 026-028):
  - Added `ready_to_load` and `in_transit` statuses to route plans
  - Created `loadlist_status_enum` and restructured `loadlists` table
  - 6 database triggers for automatic status transitions across workflow
  - Loadlist items tracking and RLS policies

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

### 9. Build Errors After Migration
**Problem**: Type errors or module not found after adding new modules
**Solution**:
1. Clear Next.js cache: `rm -rf .next`
2. Regenerate database types: `npm run db:generate-types`
3. Run typecheck: `npm run typecheck`
4. Rebuild: `npm run build`

### 10. Mobile Layout Not Rendering Correctly
**Problem**: Mobile pages show desktop layout or have layout issues
**Solution**:
1. Ensure mobile pages use `MobileLayout` component from `components/layout/MobileLayout.tsx`
2. Check that `app/mobile/layout.tsx` exists and wraps mobile routes
3. Mobile routes should be under `/mobile/*` path
4. Use mobile-specific components from `components/mobile/`

### 11. Location Dropdown Performance Issues
**Problem**: Location dropdowns freeze or load slowly with thousands of locations
**Solution**: The system now implements a search-first approach:
- API defaults to 100 locations when no search term is provided
- Search increases limit to 500 locations
- 300ms debounce prevents excessive API calls while typing
- Duplicate API calls are prevented with ref-based locking
- Users are prompted to use search for specific locations

**Related Files:**
- [app/api/master-location/route.ts](app/api/master-location/route.ts) - API with limit parameter
- [hooks/useLocations.ts](hooks/useLocations.ts) - Hook with debouncing and duplicate prevention
- [components/warehouse/ZoneLocationSelect.tsx](components/warehouse/ZoneLocationSelect.tsx) - Search-optimized dropdown

### 12. Workflow Status Not Updating Automatically
**Problem**: Order or route status not changing after completing workflow steps
**Solution**: Check database triggers are enabled:
1. Verify triggers exist: Run `npm run db:migrate` to ensure migrations 026-028 are applied
2. Check trigger status in Supabase dashboard
3. Verify the action that should trigger status change is actually happening:
   - Route publish must update `receiving_route_plans.status = 'published'`
   - Picklist completion must update `wms_picklists.status = 'completed'`
   - Loadlist scan must INSERT into `loadlist_items`
4. Check for error messages in Supabase logs
5. Manually test triggers with SQL if needed

**Related Documentation:**
- [docs-archive/workflow/WORKFLOW_IMPLEMENTATION_SUMMARY.md](docs-archive/workflow/WORKFLOW_IMPLEMENTATION_SUMMARY.md) - Complete workflow documentation
- [docs-archive/workflow/WORKFLOW_STATUS_DESIGN.md](docs-archive/workflow/WORKFLOW_STATUS_DESIGN.md) - Design specifications

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
