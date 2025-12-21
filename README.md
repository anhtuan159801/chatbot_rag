# RAGBot Admin Console

A comprehensive admin console for managing RAG (Retrieval Augmented Generation) chatbot systems with Facebook integration and document management capabilities.

## Features

- **Dashboard**: Real-time system metrics and AI-powered analysis
- **Knowledge Base Management**: Upload, crawl, and manage legal documents
- **Chat History**: View and manage Facebook Messenger conversations
- **Member Directory**: Manage community board members and contacts
- **System Configuration**: Configure AI models, Facebook integration, and system prompts

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS with custom design system
- **Icons**: Lucide React
- **Charts**: Recharts
- **Backend**: Node.js with Express
- **AI Integration**: Google Gemini API (securely proxied)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory with the following:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run preview` - Preview production build locally
- `npm run serve-dist` - Serve the built distribution

## Deployment

The application is optimized for deployment on platforms like Render or Koyeb. The server includes:

- Health check endpoints (`/health`, `/ping`) to prevent sleep issues
- Security headers for enhanced protection
- API proxy for secure Gemini API access

## Security Features

- API keys are securely handled through backend proxy (not exposed in frontend)
- Comprehensive security headers implemented
- Input validation and sanitization
- Secure data storage with localStorage encryption

## Performance Optimizations

- Component lazy loading with React Suspense
- Optimized bundle size
- Efficient data fetching and caching
- Loading states and user feedback mechanisms

## Architecture Notes

### AI Agent Architecture: Guidelines vs Routing Pattern

This system implements advanced AI agent architecture using the Guidelines approach instead of traditional routing patterns:

- **Problem with Supervisor Pattern**: When users ask multiple questions at once, traditional routing only selects one agent, potentially ignoring parts of the query
- **Solution**: Guidelines approach allows multiple logic modules to be active simultaneously
- **Technology**: Built with concepts from Parlant framework for dynamic guideline matching

### Design System Components

The application includes standardized components:
- Button: With variants (primary, secondary, danger, success, ghost)
- Input: With validation and helper text support
- Select: With accessible dropdown implementation
- Loading: With overlay and inline options
- Toast: With multiple notification types

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /ping` - Keep-alive endpoint
- `POST /api/gemini/analyze` - Secure Gemini API proxy

## Environment Variables

- `GEMINI_API_KEY` - Google Gemini API key (required)
- `PORT` - Server port (defaults to 8080)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add documentation for new features
5. Submit a pull request

## License

This project is licensed under the MIT License.