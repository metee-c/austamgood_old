# Technology Stack

## Framework & Runtime
- **Next.js 15.5+** - React framework with App Router
- **React 19.2+** - UI library
- **TypeScript 5** - Type-safe development
- **Node.js** - Runtime environment

## Database & Backend
- **Supabase** - PostgreSQL database with real-time capabilities
- **@supabase/supabase-js** - Client library
- **@supabase/auth-helpers-nextjs** - Authentication helpers
- **@supabase/ssr** - Server-side rendering support

## Styling & UI
- **Tailwind CSS 3.4** - Utility-first CSS framework
- **PostCSS** - CSS processing
- **Lucide React** - Icon library
- **Custom Design System** - See DESIGN_SYSTEM.md for comprehensive UI guidelines

## Forms & Validation
- **React Hook Form** - Form state management
- **Zod** - Schema validation
- **@hookform/resolvers** - Form validation integration

## Data Fetching
- **SWR** - React hooks for data fetching with caching
- **Custom hooks pattern** - Located in `/hooks` directory for data operations

## Additional Libraries
- **date-fns** - Date manipulation
- **Recharts** - Data visualization
- **jsPDF & jspdf-autotable** - PDF generation
- **html5-qrcode** - QR/barcode scanning
- **qrcode.react & react-barcode** - Barcode generation
- **xlsx** - Excel file handling
- **Mapbox GL** - Map visualization

## Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting (see .prettierrc)
- **TypeScript** - Type checking

## Common Commands

```bash
# Development
npm run dev              # Start dev server on 0.0.0.0
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript type checking

# Database
npm run db:generate-types    # Generate TypeScript types from Supabase
npm run db:migrate           # Run database migrations
npm run db:seed              # Seed database with initial data

# Supabase CLI
supabase start               # Start local Supabase
supabase stop                # Stop local Supabase
supabase db reset            # Reset local database
```

## Configuration Files
- `next.config.js` - Next.js configuration
- `tsconfig.json` - TypeScript configuration (strict: false, target: ES2017)
- `tailwind.config.ts` - Tailwind CSS configuration
- `.prettierrc` - Prettier formatting rules (single quotes, 2 spaces, trailing commas)
- `supabase/config.toml` - Supabase local configuration

## Environment Variables
Required environment variables should be defined in `.env.local` (see `.env.local.example` for template):
- Supabase project URL and keys
- API keys for external services (Mapbox, etc.)

## Path Aliases
- `@/*` - Maps to project root for clean imports
