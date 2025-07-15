import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import ReactMarkdown from 'react-markdown';

const technicalDesignContent = `# Technical Design Document: Realtime AI Medical Interpreter

## Overview

Real-time English ↔ Spanish translation system for medical consultations using WebSocket communication and OpenAI's Realtime API.

## Architecture

### Frontend Stack

- **React 18 + TypeScript** - Modern, type-safe frontend, required by spec.
- **WebSockets** - Familiar technology for me over WebRTC. Should give me more flexibility on the server-side.
- **Tailwind CSS** - Utility-first styling, LLM-friendly, standardized approach, good for team structure and LLM outputs.
- **Zustand** - Lightweight state management (Redux = overkill for POC).

### Backend Stack

- **Node.js + TypeScript + NoSQL** - End-to-end typescript and type safety.
- **MongoDB + Mongoose** - Easy to use, TypeScript-compatible data storage. Utilize mongoose for schema protection and overall structure.
- **Express.js** - Simple API routes at \`/api/*\`
- **OpenAI API** - Language detection and translation

## Key Technical Decisions

### WebSocket Communication

**Why:** Comfortable with it over WebRTC for this quick POC.

### Tailwind CSS + CSS Variables

**Why:** Structured theming with light/dark mode support. Predictable, maintainable styling that works well with development tools.

### Zustand Over Redux

**Why:** Simpler API, minimal boilerplate, sufficient for POC scope. Redux would be overkill for POC imo.

### MongoDB Selection

**Why:** TypeScript-friendly, flexible schema, easy to understand. Mongoose provides structured data modeling.

### Monorepo Structure

\`\`\`
ai-medical-interpreter/
├── client/     # React frontend
├── server/     # Node.js backend
\`\`\`

**Why:** Simplified development for POC. Would split for production.

### Async Language Detection

**Implementation:** OpenAI Completions API analyzes transcribed text to determine speaker (doctor/patient) and language.

### Heroku Deployment

**Why:** Familiar PaaS platform, built-in CI/CD, logging, quick deployment cycles, very familiar with it... Not a big fan of vercel's model.

## Design Philosophy

- **Minimalist UI** - Clean, medical-appropriate interface
- **Real-time feedback** - Immediate translation updates
- **Professional appearance** - Suitable for healthcare environments

## Technical Considerations

- Chunked audio processing for reduced latency
- WebSocket reconnection handling
- Environment-specific configurations
- Error handling and graceful degradation

## Future Scalability

- Background processing of conversation classifications and any compute intensive tasks with AMQP or otherwise
- Enhanced real-time infrastructure - make sure we use Redis and/or a way to communicate websocket messages across multiple servers with a sticky session
- Any language to any language support
- Authentication system integration

## Conclusion

Technology choices balance rapid development with maintainability, using familiar tools and established patterns for efficient POC development.

# Known Issues

Some hallucinations have been experienced, particularly on the first message.  May have been recently fixed by addressing a feedback loop, but needs further investigation.`;

export default function TechnicalDesign() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 shadow-md">
        <div className="container mx-auto px-2 md:px-4 py-2 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 md:space-x-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-10 h-10 gradient-bg-enhanced rounded-lg shadow-lg">
                  <FileText className="h-5 w-5 text-white drop-shadow-sm" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    Technical Design Document
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Architecture and implementation details
                  </p>
                </div>
              </div>
            </div>
            {/* <div className="flex items-center space-x-2">
              <a
                href="https://github.com/your-repo/ai-medical-interpreter"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                <span>View on GitHub</span>
              </a>
            </div> */}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-4">
                <FileText className="h-5 w-5" />
                Technical Design Document
              </CardTitle>
              <CardDescription>
                Comprehensive technical overview of the Realtime Medical Interpreter system
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-8">
              <div className="prose prose-lg dark:prose-invert max-w-none">
                <ReactMarkdown 
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-3xl font-bold text-foreground mb-6 mt-8 first:mt-0 border-b border-border pb-3">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-2xl font-bold text-foreground mb-4 mt-6 border-b border-border pb-2">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-xl font-semibold text-foreground mb-3 mt-5">
                        {children}
                      </h3>
                    ),
                    h4: ({ children }) => (
                      <h4 className="text-lg font-semibold text-foreground mb-2 mt-4">
                        {children}
                      </h4>
                    ),
                    p: ({ children }) => (
                      <p className="text-muted-foreground mb-4 leading-relaxed">
                        {children}
                      </p>
                    ),
                    strong: ({ children }) => (
                      <strong className="text-foreground font-semibold">
                        {children}
                      </strong>
                    ),
                                         code: ({ children }) => (
                       <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary">
                         {children}
                       </code>
                     ),
                    pre: ({ children }) => (
                      <pre className="bg-muted border border-border p-4 rounded-lg overflow-x-auto mb-4 text-sm">
                        {children}
                      </pre>
                    ),
                    ul: ({ children }) => (
                      <ul className="text-muted-foreground mb-4 ml-6 list-disc">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="text-muted-foreground mb-4 ml-6 list-decimal">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-muted-foreground mb-1">
                        {children}
                      </li>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-l-primary pl-4 text-muted-foreground italic mb-4">
                        {children}
                      </blockquote>
                    ),
                    hr: () => (
                      <hr className="border-border my-8" />
                    ),
                    a: ({ children, href }) => (
                      <a 
                        href={href} 
                        className="text-primary hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {technicalDesignContent}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
} 