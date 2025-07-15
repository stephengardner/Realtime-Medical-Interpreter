# AI Medical Interpreter

An AI-driven, real-time, hands-free language interpreter for doctor-patient conversations. Built with React, Node.js, MongoDB, and OpenAI's API.

## Features

- **Real-time Translation**: Instant translation between languages using OpenAI's API
- **Automatic Language Detection**: Automatically detects the speaker's language
- **Speaker Role Management**: Distinguish between doctor and patient communications
- **Conversation History**: Track and display the full conversation with timestamps
- **Intent Recognition**: AI-powered detection of medical intents (symptoms, medications, procedures, etc.)
- **AI-Powered Summaries**: Generate medical summaries of conversations
- **Modern UI**: Beautiful, responsive interface with dark/light theme support
- **WebSocket Communication**: Real-time bidirectional communication
- **Medical Context**: Specialized for healthcare conversations
- **Persistent Storage**: MongoDB integration for conversation persistence
- **Technical Documentation**: Built-in technical design documentation

## Technology Stack

### Frontend

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **ShadCN UI** for beautiful components
- **Lucide React** for icons
- **WebSocket** for real-time communication
- **React Markdown** for documentation rendering

### Backend

- **Node.js** with Express
- **TypeScript** for type safety
- **MongoDB** with Mongoose for data persistence
- **WebSocket** (ws) for real-time communication
- **OpenAI API** for translation, language detection, and intent recognition
- **Zod** for data validation
- **CORS** and **Helmet** for security

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- OpenAI API key
- **MongoDB** (local installation or MongoDB Atlas)

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd ai-medical-interpreter
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up MongoDB**

   You can either:

   - Install MongoDB locally: [MongoDB Installation Guide](https://docs.mongodb.com/manual/installation/)
   - Use MongoDB Atlas (cloud): [MongoDB Atlas Setup](https://www.mongodb.com/cloud/atlas)

4. **Set up environment variables**

   Create a `.env` file in the `server` directory:

   ```env
   # OpenAI API Configuration
   OPENAI_API_KEY=your_openai_api_key_here

   # Server Configuration
   PORT=3001
   CLIENT_URL=http://localhost:5173

   # Database Configuration (Required)
   MONGODB_URI=mongodb://localhost:27017/ai-medical-interpreter
   # Or for MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-medical-interpreter

   # Webhook Configuration (optional)
   WEBHOOK_URL=https://webhook.site/your-webhook-id-here

   # Node Environment
   NODE_ENV=development
   ```

## Development

Start both the client and server in development mode:

```bash
npm run dev
```

This will start:

- Frontend: `http://localhost:5173` (or `http://localhost:5174` if 5173 is in use)
- Backend: `http://localhost:3001`

Or run them separately:

```bash
# Terminal 1 - Start the server
npm run dev:server

# Terminal 2 - Start the client
npm run dev:client
```

## Usage

1. **Connect to the Server**: Click "Connect to AI" to establish a WebSocket connection
2. **Select Speaker Role**: Choose whether you're speaking as a doctor or patient
3. **Send Messages**: Type your message and click "Send Message" or press Enter
4. **View Translations**: See real-time translations appear in the conversation area
5. **Intent Recognition**: View detected medical intents as badges below each message
6. **Generate Summary**: Click "Generate Summary" to create an AI-powered conversation summary
7. **Clear Conversation**: Reset the conversation history when needed
8. **Technical Documentation**: Access the technical design documentation via the header navigation

## API Endpoints

### REST API

#### Health & System

- **`GET /api/health`**: Health check with database status

  ```json
  {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "database": {
      "connected": true,
      "state": "connected"
    }
  }
  ```

- **`GET /api/connections`**: Active WebSocket connections count
  ```json
  {
    "activeConnections": 5
  }
  ```

#### Conversations

- **`GET /api/conversations`**: Get all conversations (last 100, most recent first)

  ```json
  {
    "success": true,
    "conversations": [...],
    "total": 25
  }
  ```

- **`GET /api/conversations/:id/intents`**: Get extracted intents for a specific conversation

  ```json
  {
    "success": true,
    "conversationId": "...",
    "sessionId": "...",
    "totalIntents": 15,
    "intentsByType": {
      "symptom": [...],
      "medication": [...],
      "procedure": [...]
    },
    "intents": [...]
  }
  ```

- **`POST /api/conversations/:sessionId/stop`**: Stop an active conversation

  ```json
  {
    "success": true,
    "message": "Conversation stopped"
  }
  ```

- **`POST /api/conversations/:sessionId/resume`**: Resume a conversation
  ```json
  {
    "success": true,
    "message": "Conversation resumed"
  }
  ```
  **Request Body:**
  ```json
  {
    "conversationId": "conversation_id_here"
  }
  ```

### WebSocket Events

#### Client to Server

- `audio`: Send audio data for real-time translation
- `language_config`: Configure doctor and patient languages
  ```json
  {
    "type": "language_config",
    "data": {
      "doctorLanguage": "English",
      "patientLanguage": "Spanish"
    }
  }
  ```

#### Server to Client

- `session_ready`: Session is ready for audio streaming
- `audio`: Real-time audio translation data
- `translation`: Translated message with intent recognition
- `event`: System events (reconnecting, etc.)
- `error`: Error messages

## Project Structure

```
ai-medical-interpreter/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── ui/        # ShadCN UI components
│   │   │   ├── IntentBadges.tsx  # Intent recognition display
│   │   │   └── theme-provider.tsx
│   │   ├── hooks/         # Custom React hooks
│   │   │   ├── useRealtimeAI.ts  # OpenAI Realtime API integration
│   │   │   └── useAudioRecording.ts
│   │   ├── lib/           # Utility functions
│   │   │   └── utils.ts
│   │   ├── pages/         # Page components
│   │   │   ├── Conversations.tsx
│   │   │   └── TechnicalDesign.tsx
│   │   ├── state/         # State management
│   │   │   └── store.ts
│   │   ├── App.tsx        # Main application component
│   │   └── main.tsx       # Entry point
│   ├── package.json
│   └── vite.config.ts
├── server/                # Node.js backend
│   ├── src/
│   │   ├── models/        # MongoDB models
│   │   │   ├── conversation/
│   │   │   │   └── conversation.model.ts
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   ├── services/      # Service layer
│   │   │   ├── database.ts
│   │   │   └── intent-recognition.ts
│   │   ├── index.ts       # Server entry point
│   │   └── realtime.ts    # WebSocket management
│   ├── config.example.env # Environment variables example
│   ├── package.json
│   └── tsconfig.json
├── package.json           # Root package.json
└── README.md
```

## Features in Detail

### Language Detection

The system automatically detects the language of incoming messages using OpenAI's API and maintains context for accurate translations.

### Intent Recognition

AI-powered detection of medical intents including:

- Symptoms and conditions
- Medications and treatments
- Procedures and tests
- Scheduling and appointments
- General medical queries

### Medical Context

The translator is specifically tuned for medical conversations, ensuring accuracy in medical terminology and context.

### Real-time Communication

WebSocket connections provide instant, bidirectional communication between client and server for smooth user experience.

### Persistent Storage

MongoDB integration ensures conversations are saved and can be retrieved for future reference.

### Theme Support

Built-in light/dark theme support with system preference detection and manual toggle.

### Responsive Design

Mobile-friendly interface that works across all device sizes.

## Database Schema

### Conversations Collection

```typescript
{
  sessionId: string;
  messages: Array<{
    id: string;
    text: string;
    translatedText?: string;
    speaker: "doctor" | "patient";
    detectedLanguage?: string;
    timestamp: Date;
    intents?: Array<{
      category: string;
      confidence: number;
      entities: any[];
    }>;
  }>;
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Environment Variables

### Required

- `OPENAI_API_KEY`: Your OpenAI API key
- `MONGODB_URI`: MongoDB connection string

### Optional

- `PORT`: Server port (default: 3001)
- `CLIENT_URL`: Frontend URL for CORS (default: http://localhost:5173)
- `WEBHOOK_URL`: Webhook endpoint for conversation completion notifications
- `NODE_ENV`: Environment (development/production)

## Deployment

### Heroku Deployment

1. Set environment variables in Heroku dashboard
2. Ensure MongoDB Atlas is configured for production
3. Deploy using Git or Heroku CLI

### Environment Variables for Production

```env
OPENAI_API_KEY=your_production_openai_key
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ai-medical-interpreter-prod
NODE_ENV=production
```

## Future Enhancements

- **OpenAI Realtime API**: Integration with OpenAI's real-time audio API ✅ (Implemented)
- **Voice Recording**: Browser-based audio recording and processing ✅ (Implemented)
- **Multiple Languages**: Support for more language pairs
- **Medical Orders**: Structured parsing for lab tests and appointments
- **Webhook Integration**: External system integration for scheduling and follow-ups
- **Audio Playback**: Text-to-speech for translated messages
- **User Authentication**: Multi-user support and session management
- **Conversation Analytics**: Insights and reporting on conversation patterns

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**: Ensure MongoDB is running and MONGODB_URI is correct
2. **Port Already in Use**: Check if port 3001 is already in use and kill the process
3. **OpenAI API Errors**: Verify your API key and check rate limits
4. **WebSocket Connection Issues**: Ensure both client and server are running

### Development Tips

- Use `npm run dev` to start both client and server simultaneously
- Check browser console for client-side errors
- Check server console for backend errors
- Use MongoDB Compass to inspect database contents

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For support, email support@ai-medical-interpreter.com or create an issue in the repository.

---

Built with ❤️ for better healthcare communication
