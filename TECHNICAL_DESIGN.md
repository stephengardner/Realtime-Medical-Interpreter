# Technical Design Document: Realtime Medical Interpreter

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
- **Express.js** - Simple API routes at `/api/*`
- **OpenAI API** - Language detection and translation

## Key Technical Decisions

### WebSocket Communication

**Why:** Comfortable with it and prefer it over WebRTC for this quick POC.

### Tailwind CSS + CSS Variables

**Why:** Structured theming with light/dark mode support. Predictable, maintainable styling that works well with development tools.

### Zustand Over Redux

**Why:** Simpler API, minimal boilerplate, sufficient for POC scope. Redux would be overkill for POC imo.

### MongoDB Selection

**Why:** TypeScript-friendly, flexible schema, easy to understand. Mongoose provides structured data modeling.

### Monorepo Structure

```
root/
├── client/     # React frontend
├── server/     # Node.js backend
```

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

Sometimes it hallucinates on the first message... The prompt ends up getting confused with output. Tried buffering data from client... Think there was a feedback loop and may have been resolved, but need to look into it more.
