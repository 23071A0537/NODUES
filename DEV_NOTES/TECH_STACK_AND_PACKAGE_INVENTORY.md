# NoDues Tech Stack and Package Inventory

## Overview

This repository is a full-stack JavaScript/TypeScript monorepo-style workspace for the NoDues Management System.

- Frontend: React 18 + TypeScript + Vite
- Backend: Node.js + Express 5
- Database: PostgreSQL, accessed through Neon serverless client
- Styling: Tailwind CSS + DaisyUI
- State management: Zustand
- Charts and reporting: Recharts, XLSX, PDFKit, QRCode
- Auth and security: JWT, bcrypt, cookies, Helmet, Arcjet
- Integrations: Google Drive, Twilio SMS, cron jobs

## Repository Structure

- Root workspace: coordinates frontend and backend development
- `BACKEND/`: Express API server and business logic
- `FRONTEND/`: React TypeScript client app
- `DEV_NOTES/`: project documentation and notes

## Core Runtime Stack

### Frontend

- React 18 for UI rendering
- TypeScript for typed frontend development
- Vite for development server and production bundling
- React Router DOM for client-side routing
- Zustand for lightweight state management
- Tailwind CSS for utility-first styling
- DaisyUI for Tailwind-based UI components/themes
- Lucide React for icons
- React Hot Toast for notifications
- Recharts for dashboard charts
- XLSX for Excel import/export workflows
- `qrcode.react` for payment QR code rendering

### Backend

- Node.js with ES modules (`type: module`)
- Express 5 for REST API endpoints
- dotenv for environment variable loading
- CORS for cross-origin frontend/backend access
- Helmet for HTTP security headers
- Morgan for request logging
- Cookie Parser for cookie handling
- JSON Web Token for authentication/session tokens
- bcrypt for password hashing
- UUID for identifier generation

### Database and Data Layer

- PostgreSQL as the primary database
- `@neondatabase/serverless` as the database client
- Connection pattern indicates Neon/Postgres serverless usage over SSL

### File, Document, and Messaging Integrations

- Multer for multipart file upload handling
- Google Drive API via `googleapis` for document storage workflows
- PDFKit for PDF generation
- Twilio for SMS notifications
- Node Cron for scheduled reminder jobs

### Security and Abuse Protection

- Helmet for baseline HTTP hardening
- Arcjet for bot detection and rate limiting

## Workspace Packages

## 1. Root Workspace (`package.json`)

Purpose: orchestration for running frontend and backend together.

### Scripts

- `dev`: run backend and frontend concurrently
- `dev:backend`: start backend dev server
- `dev:frontend`: start frontend dev server
- `start:backend`: start backend in normal mode
- `start:frontend`: preview built frontend
- `build:frontend`: build frontend
- `test:drive`: run backend Google Drive upload test
- `auth:drive`: run Google Drive refresh token helper
- `reset:faculty-passwords`: run backend password reset script

### Dependencies

| Package                    | Version   | Purpose                                    |
| -------------------------- | --------- | ------------------------------------------ |
| `@arcjet/node`             | `^1.2.0`  | Security, bot detection, rate limiting     |
| `@neondatabase/serverless` | `^1.0.2`  | PostgreSQL/Neon serverless database client |
| `cors`                     | `^2.8.6`  | Cross-origin access                        |
| `dotenv`                   | `^17.3.1` | Environment variable loading               |
| `express`                  | `^5.2.1`  | HTTP server framework                      |
| `helmet`                   | `^8.1.0`  | Security headers                           |
| `morgan`                   | `^1.10.1` | HTTP request logging                       |

### Dev Dependencies

| Package        | Version  | Purpose                                         |
| -------------- | -------- | ----------------------------------------------- |
| `concurrently` | `^9.1.2` | Run frontend and backend dev processes together |

## 2. Backend Workspace (`BACKEND/package.json`)

Purpose: API server, auth, dues logic, reporting, uploads, scheduled jobs, SMS, and Drive integrations.

### Scripts

- `start`: run backend server with Node
- `dev`: run backend server with Nodemon
- `test:drive`: test Google Drive upload flow
- `auth:drive`: obtain Google Drive refresh token
- `reset:faculty-passwords`: run faculty password reset script

### Dependencies

| Package                    | Version          | Purpose                                  |
| -------------------------- | ---------------- | ---------------------------------------- |
| `@arcjet/node`             | `^1.0.0-beta.16` | Bot protection and rate limiting         |
| `@neondatabase/serverless` | `^1.0.2`         | PostgreSQL/Neon access                   |
| `axios`                    | `^1.13.2`        | HTTP client for service-to-service calls |
| `bcrypt`                   | `^6.0.0`         | Password hashing                         |
| `cookie-parser`            | `^1.4.7`         | Cookie parsing middleware                |
| `cors`                     | `^2.8.5`         | Cross-origin resource sharing            |
| `dotenv`                   | `^17.2.3`        | Environment management                   |
| `express`                  | `^5.2.1`         | API server framework                     |
| `googleapis`               | `^171.4.0`       | Google Drive API integration             |
| `helmet`                   | `^8.1.0`         | Security headers                         |
| `jsonwebtoken`             | `^9.0.3`         | JWT auth/token handling                  |
| `morgan`                   | `^1.10.1`        | Request logging                          |
| `multer`                   | `^2.0.2`         | File upload middleware                   |
| `node-cron`                | `^4.2.1`         | Scheduled jobs/reminders                 |
| `pdfkit`                   | `^0.17.2`        | PDF generation                           |
| `twilio`                   | `^5.12.1`        | SMS integration                          |
| `uuid`                     | `^13.0.0`        | Unique identifiers                       |

### Dev Dependencies

| Package   | Version   | Purpose                 |
| --------- | --------- | ----------------------- |
| `nodemon` | `^3.1.11` | Development auto-reload |

## 3. Frontend Workspace (`FRONTEND/package.json`)

Purpose: role-based dashboards and UI for students, faculty, admin, HOD, HR, and operators.

### Scripts

- `dev`: run Vite dev server
- `build`: type-check with TypeScript, then build with Vite
- `preview`: preview production build
- `lint`: run ESLint on TS/TSX files

### Dependencies

| Package            | Version    | Purpose                         |
| ------------------ | ---------- | ------------------------------- |
| `daisyui`          | `^4.12.24` | Tailwind component/theme plugin |
| `lucide-react`     | `^0.344.0` | Icon library                    |
| `qrcode.react`     | `^3.1.0`   | QR code rendering               |
| `react`            | `^18.2.0`  | UI library                      |
| `react-dom`        | `^18.2.0`  | React DOM renderer              |
| `react-hot-toast`  | `^2.4.1`   | Toast notifications             |
| `react-router-dom` | `^6.22.0`  | Routing                         |
| `recharts`         | `^3.8.0`   | Data visualizations/charts      |
| `xlsx`             | `^0.18.5`  | Excel import/export             |
| `zustand`          | `^4.5.0`   | State management                |

### Dev Dependencies

| Package                            | Version    | Purpose                       |
| ---------------------------------- | ---------- | ----------------------------- |
| `@types/react`                     | `^18.2.56` | React TypeScript types        |
| `@types/react-dom`                 | `^18.2.19` | React DOM TypeScript types    |
| `@typescript-eslint/eslint-plugin` | `^7.0.2`   | TypeScript lint rules         |
| `@typescript-eslint/parser`        | `^7.0.2`   | TypeScript parser for ESLint  |
| `@vitejs/plugin-react`             | `^4.2.1`   | React support for Vite        |
| `autoprefixer`                     | `^10.4.17` | CSS vendor prefixing          |
| `eslint`                           | `^8.56.0`  | Linting                       |
| `eslint-plugin-react-hooks`        | `^4.6.0`   | React Hooks lint rules        |
| `eslint-plugin-react-refresh`      | `^0.4.5`   | React Refresh linting support |
| `postcss`                          | `^8.4.35`  | CSS processing pipeline       |
| `tailwindcss`                      | `^3.4.1`   | Utility CSS framework         |
| `typescript`                       | `^5.2.2`   | TypeScript compiler           |
| `vite`                             | `^5.1.4`   | Frontend dev/build tool       |

## 4. DEV_NOTES Workspace (`DEV_NOTES/package.json`)

This package manifest appears to be auxiliary and not part of the main runtime path. It includes a mixed subset of backend/frontend packages and seems to have been used for local experimentation or earlier assembly work.

If you are auditing the active application stack, prefer:

- root `package.json`
- `BACKEND/package.json`
- `FRONTEND/package.json`

## Verified Implementation Details

The following stack choices are confirmed by source/config files, not only by package manifests:

- Backend database client is configured in `BACKEND/config/db.js`
- Backend server is initialized in `BACKEND/server.js`
- Frontend build tooling is configured with `FRONTEND/vite.config.ts`
- Tailwind and DaisyUI are configured in `FRONTEND/tailwind.config.js`
- Frontend env usage is present through `import.meta.env`
- Google Drive env variables are documented in `BACKEND/.env.example`
- Twilio and cron configuration are documented in `BACKEND/.env.example`

## External Services and Infrastructure

Based on the codebase and environment template, the application expects these external services:

- PostgreSQL database, likely hosted on Neon or accessed using Neon-compatible Postgres connection settings
- Google Drive API for document uploads and permission/document storage
- Twilio for SMS reminders and notification flows
- Arcjet for request protection and abuse prevention

## Build and Development Tooling Summary

- Package manager: npm (`package-lock.json` files are present)
- Module format: ES modules in root and backend; frontend uses Vite/TypeScript ESM flow
- Frontend bundler: Vite
- Frontend language: TypeScript + TSX
- Backend language: JavaScript (ES modules)
- Linting: ESLint in frontend
- Dev server auto-reload: Nodemon for backend
- Concurrent local startup: `concurrently` from root workspace

## Notes

- Version numbers above are the declared versions from each `package.json` file.
- Some lockfiles may resolve to slightly newer patch versions than the declared semver ranges.
- `BACKEND/package copy.json` and `BACKEND/package-lock copy.json` look like backup or duplicate manifests and are not necessary for primary stack documentation.
