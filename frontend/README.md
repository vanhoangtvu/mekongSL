# Frontend Structure for Next.js

This folder is reserved for the Next.js frontend of the WebGIS system.

## Design Goals

- Use Next.js App Router.
- Keep UI, feature logic, and shared utilities separated.
- Organize code by domain: map, stations, weather, hydrology, alerts, reports, admin.
- Prefer server/client boundaries explicitly instead of mixing everything in page files.
- Keep reusable UI in `components` and business-facing logic in `features`.

## Recommended Structure

```text
frontend/
├── public/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   ├── (dashboard)/
│   │   └── api/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── map/
│   ├── features/
│   │   ├── auth/
│   │   ├── map/
│   │   ├── stations/
│   │   ├── weather/
│   │   ├── hydrology/
│   │   ├── alerts/
│   │   ├── reports/
│   │   └── admin/
│   ├── lib/
│   │   ├── api/
│   │   ├── constants/
│   │   ├── utils/
│   │   └── validations/
│   ├── hooks/
│   ├── types/
│   └── styles/
│       └── theme/
└── README.md
```

## Folder Responsibilities

- `src/app`: route structure, layouts, pages, loading/error boundaries, API routes.
- `src/components/ui`: pure reusable UI components.
- `src/components/layout`: shell components such as header, sidebar, shell, navbar.
- `src/components/map`: map-only visual building blocks.
- `src/features`: domain modules that own state, data fetching, and feature logic.
- `src/lib/api`: API client, request wrappers, endpoint helpers.
- `src/lib/constants`: shared constants and enum-like values.
- `src/lib/utils`: generic helper functions.
- `src/lib/validations`: schema validation and form rules.
- `src/hooks`: reusable React hooks.
- `src/types`: shared TypeScript types and interfaces.
- `src/styles`: global styles, design tokens, theme primitives.

## Route Grouping Suggestion

- `(public)`: landing page, login, public map view, public reports if needed.
- `(dashboard)`: authenticated dashboard, monitoring screens, admin screens.
- `api`: server-side route handlers used by the frontend when needed.

## Implementation Rules

- Keep feature code inside `features`, not inside `app`.
- Keep presentation components dumb and reusable.
- Keep map-specific code isolated so it does not leak into unrelated screens.
- Avoid putting API calls directly in page components when the logic belongs to a feature module.
- Prefer typed service functions and typed responses from the start.

## Next Step

When the actual Next.js project is initialized, add the standard root files such as `package.json`, `tsconfig.json`, `next.config.js`, `eslint.config.*`, `src/app/layout.tsx`, and `src/app/globals.css` according to this structure.

## Current Setup

- Install dependencies with `npm install`.
- Start development server with `npm run dev` on port `4001`.
- Build production bundle with `npm run build`.
- Run type check with `npm run typecheck`.
