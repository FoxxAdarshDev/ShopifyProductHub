# Product Content Management System

## Overview

This is a production-ready web application for managing Shopify product content. It automates the process of adding HTML content to product SKUs by providing a user-friendly interface to create structured product tabs. Users can lookup products by SKU, select content tabs, fill out forms, and automatically generate and update HTML content in Shopify products.

The system is live and operational, successfully migrated to a Replit environment with enhanced functionality. Key capabilities include:
- Editable product fields (title, image) and reusable CSS styling.
- Dynamic SKU data attributes for SEO optimization.
- Improved HTML generation.
- PostgreSQL database and Shopify API integration.
- Enhanced product display with infinite scroll.
- Robust SKU search functionality.
- Automated HTML template detection and content status tracking.
- Database-first architecture for efficient content status detection and rate limiting.
- Background processing for Shopify API calls.
- Comprehensive content extraction from existing Shopify HTML.
- Dynamic Shopify Liquid template integration for tabbed content display.

The business vision is to streamline content management for Shopify stores, enhancing efficiency and reducing manual effort for product content updates.

## User Preferences

Preferred communication style: Simple, everyday language.
Database: PostgreSQL (not NeonDB) with SSL connection
Shopify Store: foxxbioprocess.myshopify.com with custom credentials

## System Architecture

The application follows a monorepo structure with clear separation between client, server, and shared code.

### UI/UX Decisions
- **Component Library**: Built on shadcn/ui with Radix UI primitives.
- **Styling**: Tailwind CSS for utility-first styling with a custom design system.
- **Icons**: Lucide Icons for consistent iconography.
- **Design Philosophy**: Focus on user-friendly interface for content creation, visual previews, and structured data entry.
- **Badge System**: Clear visual indicators for content status (New Layout, Draft Mode, Shopify Content).
- **Tab Ordering**: Fixed tab ordering with distinct groups for content consistency.
- **Image Support**: Visual previews for images in compatible container items.
- **Documentation Cards**: Professional, card-based styling for documentation links.

### Technical Implementations
- **Frontend**: React with TypeScript, built with Vite for fast development and optimized builds.
  - **Routing**: Wouter for lightweight client-side routing.
  - **Forms**: React Hook Form with Zod validation for robust form handling.
  - **HTTP Client**: Custom fetch wrapper with TanStack Query for server state management and caching.
- **Backend**: Express.js with TypeScript.
  - **Database Layer**: Drizzle ORM with PostgreSQL.
  - **Route Organization**: Centralized route registration pattern.
  - **Error Handling**: Global error middleware for structured responses.
  - **External Services**: Shopify API integration for product data.
- **Database Schema**: Four main entities: Products, Product Content, Content Templates, and Logo Library.
- **Data Flow**:
    1. User searches for product by SKU, system prioritizes local database then Shopify API.
    2. Product data is cached locally.
    3. User creates/edits content tabs structured by type (Description, Features, Applications, Specifications, Videos, Documentation, Safety Guidelines, SKU Nomenclature, Compatible Container, Sterilization Method).
    4. System generates HTML output and can save locally or push to Shopify.
- **Content Structure**: Each product supports multiple content tabs with specific data types (e.g., rich text, bulleted lists, tables, embedded videos, file downloads).
- **Content Extraction**: Comprehensive HTML content extraction system parses existing Shopify product descriptions and populates content tabs. It supports various formats including plain text specifications and handles multi-variant SKU data.
- **HTML Generation**: Generates Shopify-compatible HTML with dynamic SKU attributes, reusable CSS, and proper URL conversion (relative to absolute).
- **Shopify Liquid Template Integration**: `halo-product-tab.liquid` template dynamically creates tab navigation from generated HTML, ensuring responsive design and consistent styling.
- **Queue System**: Shopify API queue system resolves rate limiting issues by managing requests with priority-based queuing and automatic retries.

### System Design Choices
- **Monorepo Structure**: Facilitates shared types and schemas between frontend and backend.
- **Database-First Architecture**: Prioritizes database queries to minimize Shopify API calls and improve performance, implementing intelligent caching and background processing.
- **Rate Limiting Solution**: Intelligent batching and delays in API requests to prevent HTTP 429 errors.
- **Persistent State Management**: Frontend caching with `localStorage` and `useProductStatusCache` hook for immediate data display.
- **Background Processing**: `backgroundProcessor` service updates product status in small batches to avoid rate limiting.
- **Enhanced Search**: Comprehensive product search across all store products with deep SKU and Product ID matching.
- **Automatic Background Status Checker**: Runs on server startup and page load, using batch processing.

## External Dependencies

- **Shopify API**:
    - **Purpose**: Product data synchronization and content publishing.
    - **Integration**: REST API for reading product information and writing generated HTML content.
- **Neon Database**:
    - **Purpose**: Serverless PostgreSQL hosting.
    - **Integration**: WebSocket-based connection pooling.
- **Radix UI**:
    - **Purpose**: Accessible component primitives for UI development.
- **Tailwind CSS**:
    - **Purpose**: Utility-first CSS framework for styling.
- **Lucide Icons**:
    - **Purpose**: Consistent iconography throughout the application.