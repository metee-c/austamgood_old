# Project Structure

## Root Directory Organization

```
austamgood-wms/
├── app/                    # Next.js App Router pages and API routes
├── components/             # Reusable React components
├── hooks/                  # Custom React hooks for data fetching
├── lib/                    # Utility libraries and configurations
├── types/                  # TypeScript type definitions
├── utils/                  # Utility functions
├── supabase/              # Database migrations and seeds
├── public/                # Static assets
├── scripts/               # Database and maintenance scripts
└── docs/                  # Project documentation
```

## App Directory (`/app`)

Next.js 15 App Router structure with route-based organization:

- `app/api/` - API route handlers
- `app/dashboard/` - Main dashboard page
- `app/receiving/` - Inbound/receiving operations
- `app/shipping/` - Outbound/shipping operations
- `app/warehouse/` - Warehouse management pages
- `app/production/` - Production order management
- `app/master-data/` - Master data management pages
- `app/mobile/` - Mobile-optimized pages for warehouse workers
- `app/reports/` - Reporting and analytics pages
- `app/layout.tsx` - Root layout with font configuration
- `app/globals.css` - Global styles and Tailwind imports
- `app/page.tsx` - Root page (redirects to dashboard)

## Components Directory (`/components`)

Organized by feature/domain:

- `components/ui/` - Reusable UI components (buttons, badges, cards, modals, tables)
- `components/forms/` - Form components and inputs
- `components/layout/` - Layout components (headers, sidebars, navigation)
- `components/mobile/` - Mobile-specific components
- `components/orders/` - Order-related components
- `components/receiving/` - Receiving/inbound components
- `components/warehouse/` - Warehouse management components
- `components/production/` - Production-related components
- `components/maps/` - Map and location visualization components
- `components/vrp/` - Vehicle routing problem components

## Hooks Directory (`/hooks`)

Custom React hooks following a consistent pattern for data operations:

- `useCustomers.ts` - Customer data operations
- `useEmployees.ts` - Employee data operations
- `useLocations.ts` - Location data operations
- `useOrders.ts` - Order CRUD operations
- `useReceive.ts` - Receiving operations
- `useSkus.ts` - SKU/product data
- `useSuppliers.ts` - Supplier data
- `useWarehouses.ts` - Warehouse data
- `useProductionOrders.ts` - Production order operations
- `useMoves.ts` - Stock movement operations
- `useFormOptions.ts` - Dropdown/select options for forms

**Hook Pattern**: Each hook typically exports multiple functions:
- `use[Entity]s()` - Fetch list with optional filters
- `use[Entity]()` - Fetch single record by ID
- `useCreate[Entity]()` - Create operation
- `useUpdate[Entity]()` - Update operation
- `useDelete[Entity]()` - Delete operation

## Types Directory (`/types`)

TypeScript type definitions organized by domain:

- `types/database/` - Generated Supabase database types
- `types/auth/` - Authentication-related types
- `*-schema.ts` files - Zod schemas and TypeScript types for entities:
  - `customer-schema.ts`
  - `employee-schema.ts`
  - `order-schema.ts`
  - `inbound-schema.ts`
  - `production-order-schema.ts`
  - `warehouse.ts`
  - etc.

## Lib Directory (`/lib`)

Utility libraries and configurations:

- `lib/supabase/` - Supabase client configuration
- `lib/database/` - Database utility functions
- `lib/vrp/` - Vehicle routing problem algorithms

## Utils Directory (`/utils`)

Helper functions organized by purpose:

- `utils/constants/` - Application constants
- `utils/formatting/` - Formatting utilities (dates, numbers, etc.)
- `utils/validation/` - Validation functions
- `utils/palletIdGenerator.ts` - Pallet ID generation logic

## Supabase Directory (`/supabase`)

Database-related files:

- `supabase/migrations/` - SQL migration files
- `supabase/seed/` - Database seed data
- `supabase/functions/` - Edge functions
- `supabase/config.toml` - Local Supabase configuration

## Key Conventions

1. **File Naming**: 
   - Components: PascalCase (e.g., `Button.tsx`)
   - Hooks: camelCase with 'use' prefix (e.g., `useOrders.ts`)
   - Utilities: camelCase (e.g., `formatDate.ts`)
   - Types: kebab-case with suffix (e.g., `order-schema.ts`)

2. **Import Paths**: Use `@/` alias for absolute imports from project root

3. **Component Organization**: Group related components by feature/domain rather than by type

4. **Data Fetching**: Use custom hooks in `/hooks` directory, not direct Supabase calls in components

5. **Type Safety**: Define Zod schemas in `/types` for runtime validation and TypeScript types

6. **Styling**: Use Tailwind utility classes following the design system in `DESIGN_SYSTEM.md`

7. **Thai Language**: Primary language is Thai - UI text, comments, and documentation should support Thai characters
