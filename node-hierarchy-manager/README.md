# Node Hierarchy Manager (Antigravity)

This is the frontend component of the Antigravity platform. It provides a visual interface for managing hierarchical nodes, integrating with NotebookLM for knowledge curation.

## Features

- **Hierarchical Node Tree**: View and navigate complex node structures.
- **Node Curation**: Open a curation modal to generate NotebookLM artifacts (infographics, audio, etc.).
- **NotebookLM Integration**: Fetch and sync notebooks directly from the UI.
- **Supabase Persistence**: Real-time updates and multi-tenant data storage.

## Tech Stack

- **React 18**
- **TypeScript**
- **Vite**
- **TailwindCSS**
- **Lucide React** (Icons)
- **Supabase SDK**

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Environment Setup

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:5000
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## Project Structure

- `src/components/`: Reusable UI components.
  - `NodeTree.tsx`: The main hierarchy visualization.
  - `CurationModal.tsx`: Interface for NotebookLM artifact generation.
- `src/services/`: API and database service layers.
  - `NotebookLMService.ts`: Handles communication with the NotebookLM backend.
- `src/App.tsx`: Main application entry point.

## Contributing

1. Follow the `ESLint` and `TypeScript` standards defined in the project.
2. Ensure all new components are responsive and follow the design system.
