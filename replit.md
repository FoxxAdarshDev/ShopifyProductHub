# Product Content Management System

## Overview

This is a fully functional, production-ready web application for managing Shopify product content. The system automates the tedious process of manually adding HTML content to each product SKU by providing a user-friendly interface to create structured product tabs. Users can lookup products by SKU, select content tabs, fill out forms, and automatically generate and update HTML content in Shopify products.

**Current Status:** Live and operational - successfully migrated from Replit Agent to Replit environment with enhanced Compatible Container functionality. Features include editable fields (title, image), reusable CSS styling, dynamic SKU data attributes for SEO optimization, and improved HTML generation. PostgreSQL database and Shopify API integration configured.

**Migration Status:** Successfully migrated to Replit environment (January 29, 2025) - Complete migration from Replit Agent to Replit environment accomplished. Fixed critical content extraction bugs including H2 heading extraction patterns and documentation content extraction regex patterns. All core functionality preserved, database connected, and system fully operational. Enhanced Shopify Liquid template created with improved styling, responsive design, and fixed UI issues including video full-width display, subscriber button visibility, logo grid styling, and tab text readability.

**Enhanced Search & Navigation** (January 29, 2025): Implemented comprehensive product search across ALL store products (334 total) with deep SKU and Product ID matching. Added dedicated sidebar navigation with filtered views for Draft Mode and New Layout products. Enhanced All Products page with comprehensive search functionality that searches the entire store inventory rather than just initial 20 products. Created separate pages for Draft Mode Products and New Layout Products with full search capabilities and real-time content status detection.

**Rate Limiting & Performance Optimization** (January 29, 2025): Fixed critical Shopify API rate limiting issues (HTTP 429 errors) by implementing intelligent batching and rate limiting in content status checks. Limited API requests to 20 products per batch with 100ms delays between individual requests and 200ms delays between batches. Optimized content status checking to prioritize local database queries and only check Shopify API when necessary. System now gracefully handles rate limits and continues processing without overwhelming the API.

**Persistent State Management & Caching** (January 29, 2025): Implemented ContentStatusCache service to store content status data and prevent re-fetching during navigation. Reduced batch size from 10 to 5 products with 2-second delays between batches and 500ms delays between individual requests. Cache persists for 5 minutes and automatically invalidates expired entries. Frontend now sends single request for all 334 products while backend handles intelligent batching and state persistence. System prioritizes cached data, then local database, and only hits Shopify API when absolutely necessary.

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
- **Enhanced Content Extraction Patterns** (January 28, 2025): Fixed CSS selector patterns to properly match the actual generated HTML structure. Updated extraction logic to find tab-content divs with correct class and ID combinations. Enhanced Description extraction to properly parse logo grid images, Features extraction to handle styled list items, and Documentation extraction to find custom datasheet links. System now successfully extracts Description (with H2 titles, paragraphs, and logo grids), Features (with proper text cleaning), Specifications table data (7 rows extracted), Documentation (custom datasheet links), and Videos (default content detection). Compatible Container extraction improved but requires products with complete item data structure.
- **Comprehensive Content Extraction Achievement** (January 28, 2025): Successfully implemented extraction for 5 out of 6 major content sections. System now properly extracts Description (paragraphs + logo grids), Features (list items with text cleaning), Specifications (table rows with item/value pairs), Documentation (custom datasheets), and Videos (default content detection). All extracted content is automatically saved as drafts and appears in form tabs. Template detection working properly - products with generated layouts show correct status indicators.
- **Enhanced Badge System** (January 28, 2025): Fixed and improved the content status badge display system. "Draft Mode" badge now only shows for unsaved draft content and is hidden when content is published to Shopify. Changed "New Layout (2)" format to "New Layout: 2" format where the number represents the count of content sections/tabs. Added proper badge display in both AllProducts page and ProductManager page with real-time content status detection. System now correctly identifies when products have our template structure saved in Shopify and displays appropriate "New Layout" and "Shopify Content" badges.
- **Absolute URL Conversion** (January 28, 2025): Implemented automatic conversion of relative URLs to absolute URLs with proper domain formatting in HTML generation. Converts URLs like `/products/...` and `/collections/...` to use the actual store domain (e.g., `foxxbioprocess.com`) instead of the `.myshopify.com` domain, ensuring proper links when content is copied from preview.
- **Default Content for Videos and Documentation Tabs** (January 28, 2025): Added automatic default content that appears on every product regardless of custom input. Videos tab now includes "Video coming soon" placeholder and YouTube channel link (https://www.youtube.com/channel/UCfTcuV6zESARyzKfG2T6YFg) with branded layout. Documentation tab includes default link to product datasheets page (http://www.foxxlifesciences.com/pages/product-data-sheets) that always appears alongside any custom datasheets. Both tabs provide consistent brand presence across all products.
- **Enhanced Content Extraction for Additional Tabs** (January 28, 2025): Extended the HTML content extraction system to support all Additional Content Tabs (Optional) including SKU Nomenclature, Safety Usage Guidelines, and Sterilization Method. The system now intelligently extracts titles, table data, list items, and structured content from these additional sections, providing complete coverage of all tab types available in the interface. Extraction patterns match the exact HTML structure generated by the system for seamless round-trip content editing.
- **Fixed Compatible Container Multi-Item Extraction** (January 28, 2025): Resolved critical bug where Compatible Container extraction was only capturing 1 item instead of all 4 items from HTML content. Root cause was in the initial regex pattern that truncated content too early. Implemented robust div-matching algorithm that properly extracts complete content by counting nested div tags. System now successfully extracts all compatible container items with titles, URLs, and images. Enhanced extraction debugging and implemented direct link-based extraction method for improved reliability.
- **Critical Bug Fixes for Data Persistence** (January 28, 2025): Fixed multiple critical issues affecting content persistence and extraction after Replit migration. Fixed Description H2 title generation in HTML generator (titles now properly appear inside description tab content, not just in main container). Fixed Compatible Container extraction regex patterns to match actual generated HTML structure (h4 titles, p descriptions, a links). These fixes resolve issues where content appeared to be lost after page reload or Shopify updates, ensuring reliable round-trip content editing between extraction, editing, saving, and re-extraction.
- **Final HTML Generation Issues Resolved** (January 28, 2025): Fixed remaining critical HTML generation issues affecting H2 headings and video content. Updated HTML generator to properly handle both `title` and `h2Heading` fields in description content, ensuring user-entered H2 titles appear correctly in generated HTML. Fixed video form display issue where URLs extracted from Shopify appeared truncated in form fields - added `getVideoUrl` helper function to handle both direct `videoUrl` and `videos` array formats. All content types (H2 headings, logos, video iframes, features, specifications) now save and generate correctly when updating products to Shopify.
- **Shopify Liquid Template Integration** (January 29, 2025): Created `halo-product-tab.liquid` Shopify template that automatically detects and creates tab navigation from product description HTML. Template intelligently parses the generated HTML structure, detects available content sections by their IDs (description, features, applications, specifications, etc.), and dynamically creates corresponding tab buttons and content areas. Includes complete responsive styling, smooth animations, JavaScript tab switching functionality, and fallback to original description for products without template structure. Template maintains exact styling compatibility with the application's preview interface and supports all content types including compatible containers, specifications tables, video embeds, and documentation links.
- **Enhanced Dynamic Tab System** (January 29, 2025): Upgraded Shopify Liquid template to use fully dynamic tab creation based on actual HTML content analysis. JavaScript now scans the product description HTML, identifies which tabs contain content, and only creates navigation buttons for tabs that have actual data. This eliminates empty tabs and ensures the interface adapts automatically to different products' content structures. System supports all tab types and maintains proper ordering.
- **Improved Compatible Container Cards** (January 29, 2025): Enhanced CSS styling for compatible container items with better visual hierarchy, improved image display (contain fit with background), consistent card heights, and interactive hover effects. Added proper line-height controls, responsive image sizing, and styled action buttons with border and hover states for better user experience.
- **Professional Documentation Link Cards** (January 29, 2025): Redesigned documentation links with card-based styling featuring icons, shadows, and hover animations. Links now appear as individual cards with proper spacing, emoji-based file type indicators, and color-coded backgrounds. Improved visual hierarchy and interaction feedback for better user engagement.

## Key Configuration
- **Database URL**: Required environment variable for PostgreSQL connection
- **Shopify Credentials**: Store URL and access token for API integration
- **Build Process**: Separate frontend and backend build steps with shared TypeScript configuration

The system is designed to be easily deployable to platforms like Replit, Vercel, or traditional Node.js hosting environments, with all necessary build and runtime configurations included.