# Heroku Deployment Guide

## Prerequisites

1. **Heroku CLI** installed
2. **Git** installed
3. **Node.js 22.x** (matching your current version)
4. **OpenAI API Key** (required for the app to function)

## Step 1: Prepare Your Environment

1. **Create a `.env` file in the `server` directory** (copy from `server/config.example.env`):

   ```bash
   cp server/config.example.env server/.env
   ```

2. **Add your OpenAI API key** to the `.env` file:
   ```env
   OPENAI_API_KEY=your_actual_openai_api_key_here
   PORT=3001
   CLIENT_URL=http://localhost:5173
   NODE_ENV=development
   ```

## Step 2: Deploy to Heroku

1. **Login to Heroku**:

   ```bash
   heroku login
   ```

2. **Create a new Heroku app**:

   ```bash
   heroku create your-app-name
   ```

3. **Set environment variables on Heroku**:

   ```bash
   heroku config:set OPENAI_API_KEY=your_actual_openai_api_key_here
   heroku config:set NODE_ENV=production
   ```

4. **Deploy the app**:
   ```bash
   git add .
   git commit -m "Deploy to Heroku"
   git push heroku main
   ```

## Step 3: Access Your App

Your app will be available at: `https://your-app-name.herokuapp.com`

## How the Deployment Works

### Architecture

- **Monorepo structure**: Client and Server in same repository
- **Production build**: Client builds to static files, server serves them
- **WebSocket support**: Real-time communication between client and server
- **Environment-aware**: WebSocket URL automatically adjusts for production

### Build Process

1. Heroku runs `npm run heroku-postbuild` (which runs `npm run build`)
2. Client builds to `client/dist/`
3. Server builds to `server/dist/`
4. Server serves client files in production

### Environment Variables

- **OPENAI_API_KEY**: Required for AI functionality
- **NODE_ENV**: Set to `production` for Heroku
- **PORT**: Automatically set by Heroku

## Troubleshooting

### WebSocket Connection Issues

If WebSocket connections fail:

1. Check that your app is using HTTPS (required for WSS)
2. Verify the WebSocket URL is correct in production

### Build Failures

If the build fails:

1. Check that all dependencies are in the correct `package.json` files
2. Ensure TypeScript compilation succeeds locally
3. Check Heroku logs: `heroku logs --tail`

### OpenAI API Issues

If AI features don't work:

1. Verify your OpenAI API key is set correctly
2. Check API key permissions and usage limits
3. Monitor server logs for API errors

## Environment Variables Reference

| Variable         | Required | Description         |
| ---------------- | -------- | ------------------- |
| `OPENAI_API_KEY` | Yes      | Your OpenAI API key |
| `NODE_ENV`       | Yes      | Set to `production` |
| `PORT`           | No       | Auto-set by Heroku  |

## Local Development

To run locally after deployment setup:

```bash
# Install dependencies
npm install

# Start development servers
npm run dev
```

## Production Features

✅ **Static file serving**: Client served from server  
✅ **WebSocket support**: Real-time communication  
✅ **Environment detection**: Auto-configures for production  
✅ **Health checks**: API endpoints for monitoring  
✅ **Graceful shutdown**: Proper cleanup on exit  
✅ **Keep-alive**: WebSocket connection maintenance

## Monitoring

Your deployed app includes:

- **Health check endpoint**: `/api/health`
- **Connection monitor**: `/api/connections`
- **Server logs**: `heroku logs --tail`

## Custom Domain (Optional)

To use a custom domain:

1. Add domain to Heroku: `heroku domains:add yourdomain.com`
2. Configure DNS to point to Heroku
3. Add SSL certificate if needed

## Security Notes

- **API keys**: Never commit to Git (use environment variables)
- **HTTPS/WSS**: Required for production WebSocket connections
- **CORS**: Automatically configured for production
- **Helmet**: Security headers enabled
