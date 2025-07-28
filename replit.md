# Product Content Management System

## Overview

This is a fully functional, production-ready web application for managing Shopify product content. The system automates the tedious process of manually adding HTML content to each product SKU by providing a user-friendly interface to create structured product tabs. Users can lookup products by SKU, select content tabs, fill out forms, and automatically generate and update HTML content in Shopify products.

**Current Status:** Live and operational - successfully migrated from Replit Agent to Replit environment with enhanced Compatible Container functionality. Features include editable fields (title, image), reusable CSS styling, dynamic SKU data attributes for SEO optimization, and improved HTML generation. PostgreSQL database and Shopify API integration configured.

**Migration Status:** Successfully migrated to Replit environment (January 28, 2025) - Fixed Compatible Container URL input clearing issue, removed debug information from frontend, improved state management, resolved Shopify API TypeScript errors, and corrected URL paste behavior to only trigger on Add button click or Enter key press.

## User Preferences

Preferred communication style: Simple, everyday language.
Database: PostgreSQL (not NeonDB) with SSL connection
Shopify Store: foxxbioprocess.myshopify.com with custom credentials

## System Architecture

The application follows a monorepo structure with clear separation between client, server, and shared code:

- **Frontend**: React with TypeScript, built with Vite
- **Backend**: Express.js with TypeScript 
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query for server state
- **Authentication**: Session-based (infrastructure present)

### Directory Structure

```
├── client/          # React frontend application
├── server/          # Express.js backend API
├── shared/          # Shared types and schemas
├── attached_assets/ # Static content files
└── migrations/      # Database migration files
```

## Key Components

### Frontend Architecture
- **Component Library**: Built on shadcn/ui with Radix UI primitives
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation
- **HTTP Client**: Custom fetch wrapper with TanStack Query integration
- **Build Tool**: Vite with React plugin and development tooling

### Backend Architecture
- **API Framework**: Express.js with TypeScript
- **Database Layer**: Drizzle ORM with Neon PostgreSQL serverless
- **Route Organization**: Centralized route registration pattern
- **Error Handling**: Global error middleware with structured responses
- **External Services**: Shopify API integration for product data

### Database Schema
The system uses four main entities:
- **Products**: Core product information synced from Shopify
- **Product Content**: Tab-based content associated with products
- **Content Templates**: Reusable content templates for different tab types
- **Logo Library**: Centralized logo management for content

## Data Flow

### Product Management Workflow
1. User searches for product by SKU
2. System checks local database first, falls back to Shopify API
3. Product data is cached locally for future use
4. User selects content tabs to create/edit
5. Content is structured by tab type (description, features, applications, etc.)
6. System generates HTML output for product pages
7. Content can be saved locally and optionally pushed to Shopify

### Content Structure
Each product can have multiple content tabs:
- **Description**: Rich text with title, paragraphs, and logo grid
- **Features**: Bulleted list of product features
- **Applications**: Use cases and application scenarios  
- **Specifications**: Structured table of technical specifications
- **Videos**: Embedded video content
- **Documentation**: File downloads and datasheets
- **Safety Guidelines**: Safety and usage information

## External Dependencies

### Shopify Integration
- **Purpose**: Product data synchronization and content publishing
- **API**: REST API with store-specific access tokens
- **Data Flow**: Read product information, write generated HTML content

### Neon Database
- **Purpose**: Serverless PostgreSQL hosting
- **Connection**: WebSocket-based connection pooling
- **Features**: Auto-scaling, branching, and built-in connection pooling

### UI Framework
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling with custom design system
- **Lucide Icons**: Consistent iconography throughout the application

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with HMR for frontend
- **Backend**: tsx for TypeScript execution with auto-reload
- **Database**: Environment-based connection string configuration

### Production Build
- **Frontend**: Vite production build with static asset optimization
- **Backend**: esbuild compilation to ESM format
- **Database**: Drizzle migrations for schema management
- **Environment**: Node.js runtime with environment variable configuration

### Recent Changes (January 2025)
- **Enhanced Compatible Container**: Made fields editable (title, image) rather than auto-populated only
- **Reusable CSS**: Created separate compatible-container.css file for consistent styling across products
- **SEO Optimization**: Added dynamic SKU data attributes to all HTML sections for better Google crawling
- **HTML Generator**: Updated to include productSku parameter and data-sku attributes on all container elements
- **Image Support**: Added image URL input fields for compatible container items with visual preview
- **Fixed Tab Ordering System** (January 28, 2025): Implemented fixed tab ordering with two distinct groups:
  - Group 1: Description, Features, Applications (positions 1-3)
  - Group 2: Specifications, Documentation, Videos (positions 4-6)
  - Additional tabs (SKU Nomenclature, Safety Guidelines, Compatible Container, Sterilization Method) are inserted between the two groups
  - Applied consistent ordering across frontend tab selection, form display, visual preview, and HTML generation
- **Added Sterilization Method Tab** (January 28, 2025): New additional content tab that works like Features tab with smart import functionality for sterilization methods list
- **Fixed SKU Search Issue** (January 28, 2025): Resolved issue where product search by SKU failed due to trailing whitespace in Shopify SKU data. Updated search algorithm to handle whitespace normalization and improved matching logic for both exact and partial SKU matches. Enhanced SKU search to be exhaustive like Product ID search, now searches through ALL products in the store (up to 12,500 products across 50 pages) rather than just the first 250 products. SKU search now works properly alongside Product ID search with comprehensive coverage.
- **Enhanced Multi-Variant SKU Support** (January 28, 2025): Updated HTML generator to include ALL product variant SKUs in data-sku attributes (comma-separated) instead of just the first variant. This improves SEO crawling and ensures all product variants are properly indexed. Added automatic variant SKU detection during HTML generation.
- **HTML Content Extraction System** (January 28, 2025): Implemented comprehensive content extraction functionality that can parse existing Shopify product HTML descriptions and automatically populate appropriate content tabs. Added intelligent pattern matching for Description, Features, Applications, Specifications, Safety Guidelines, Sterilization Methods, Compatible Container, Videos, and Documentation sections. System can reverse-engineer existing HTML content to save manual data entry time.
- **Smart Content Detection UI** (January 28, 2025): Added user-friendly extraction interface that automatically detects when existing Shopify content matches our template structure and offers one-click extraction into editable tabs. Includes visual indicators and success feedback for extracted content sections.

## Key Configuration
- **Database URL**: Required environment variable for PostgreSQL connection
- **Shopify Credentials**: Store URL and access token for API integration
- **Build Process**: Separate frontend and backend build steps with shared TypeScript configuration

The system is designed to be easily deployable to platforms like Replit, Vercel, or traditional Node.js hosting environments, with all necessary build and runtime configurations included.