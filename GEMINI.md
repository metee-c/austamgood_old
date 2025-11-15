# Project Overview

This is a Warehouse Management System (WMS) built with Next.js, Tailwind CSS, and Supabase. The application is designed to manage warehouse operations, including inventory tracking, order processing, and reporting. The user interface is in Thai.

## Key Technologies

*   **Framework:** [Next.js](https://nextjs.org/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Database and Backend:** [Supabase](https://supabase.io/)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)

# Building and Running

## Prerequisites

*   [Node.js](https://nodejs.org/) (version 20 or higher)
*   [Supabase CLI](https://supabase.com/docs/guides/cli)

## Installation

1.  Install the dependencies:

    ```bash
    npm install
    ```

2.  Set up your Supabase project by creating a `.env.local` file with your Supabase URL and anon key. You can use `.env.local.example` as a template.

## Development

To run the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Building for Production

To create a production build:

```bash
npm run build
```

To run the production server:

```bash
npm run start
```

## Database Migrations

To apply database migrations:

```bash
npm run db:migrate
```

To seed the database:

```bash
npm run db:seed
```

To generate TypeScript types from your database schema:

```bash
npm run db:generate-types
```

# Development Conventions

## Linting and Type Checking

*   **Linting:** The project uses ESLint to enforce code quality. To run the linter:

    ```bash
    npm run lint
    ```

*   **Type Checking:** The project uses TypeScript for static type checking. To check for type errors:

    ```bash
    npm run typecheck
    ```

## Coding Style

The project uses Prettier for code formatting. It is recommended to set up your editor to format on save.
