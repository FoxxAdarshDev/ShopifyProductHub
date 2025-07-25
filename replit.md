# Product Content Management System

## Overview

This is a fully functional, production-ready web application for managing Shopify product content. The system automates the tedious process of manually adding HTML content to each product SKU by providing a user-friendly interface to create structured product tabs. Users can lookup products by SKU, select content tabs, fill out forms, and automatically generate and update HTML content in Shopify products.

**Current Status:** Live and operational - successfully configured with PostgreSQL database and Shopify API integration. Manual product creation workflow implemented to handle API permission restrictions.

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

### Key Configuration
- **Database URL**: Required environment variable for PostgreSQL connection
- **Shopify Credentials**: Store URL and access token for API integration
- **Build Process**: Separate frontend and backend build steps with shared TypeScript configuration

The system is designed to be easily deployable to platforms like Replit, Vercel, or traditional Node.js hosting environments, with all necessary build and runtime configurations included.