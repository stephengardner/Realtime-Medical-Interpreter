# Webhook Integration for AI Medical Interpreter

## Overview

When a conversation is completed, AI Medical Interpreter now automatically sends a webhook notification to webhook.site (or any configured webhook URL) with all the extracted actions and conversation details.

## Features

- **Automatic Webhook Sending**: Triggered when conversations are completed
- **Comprehensive Payload**: Includes conversation details, extracted actions, and analytics
- **Action Types Supported**:
  - Medication prescriptions/modifications
  - Lab orders and test requests
  - Appointment scheduling
  - Diagnoses (suspected, confirmed, ruled out)
  - Treatment plans and procedures
  - Vital signs measurements

## Configuration

### 1. Set up webhook.site

1. Go to [webhook.site](https://webhook.site/)
2. You'll get a unique URL like: `https://webhook.site/your-unique-webhook-id`
3. This URL is currently configured as the default

### 2. Configure Environment Variable

Add to your environment variables (or `.env` file):

```env
WEBHOOK_URL=https://webhook.site/your-webhook-id-here
```

If no `WEBHOOK_URL` is provided, it defaults to your current webhook.site URL.

## Webhook Payload Structure

When a conversation is completed, the webhook receives:

```json
{
  "event": "conversation_completed",
  "timestamp": "2025-01-14T20:27:09.123Z",
  "conversation": {
    "id": "conversation-mongodb-id",
    "sessionId": "session-id",
    "patientName": "John Doe",
    "doctorName": "Dr. Smith",
    "startTime": "2025-01-14T20:22:09.123Z",
    "endTime": "2025-01-14T20:27:09.123Z",
    "summary": "Patient presented with mild headache. Prescribed acetaminophen.",
    "totalMessages": 8,
    "status": "completed"
  },
  "actions": [
    {
      "type": "medication",
      "action": "prescribe",
      "medication": {
        "name": "acetaminophen",
        "dosage": "500mg",
        "frequency": "every 6 hours",
        "duration": "3 days"
      },
      "confidence": 0.95,
      "extractedAt": "2025-01-14T20:27:09.123Z"
    },
    {
      "type": "diagnosis",
      "condition": "tension headache",
      "severity": "mild",
      "status": "suspected",
      "confidence": 0.88,
      "extractedAt": "2025-01-14T20:27:09.123Z"
    }
  ],
  "analytics": {
    "totalActions": 2,
    "actionsByType": [
      { "type": "medication", "count": 1 },
      { "type": "diagnosis", "count": 1 }
    ],
    "conversationDuration": 5
  }
}
```

## Action Types

### 1. Medication Actions

```json
{
  "type": "medication",
  "action": "prescribe|discontinue|modify|refill",
  "medication": {
    "name": "medication name",
    "dosage": "dosage amount",
    "frequency": "how often",
    "duration": "how long",
    "route": "oral|injection|topical|etc"
  },
  "confidence": 0.95,
  "extractedAt": "timestamp"
}
```

### 2. Lab Orders

```json
{
  "type": "lab_order",
  "labType": "blood work|imaging|etc",
  "tests": ["test1", "test2"],
  "urgency": "routine|urgent|stat",
  "instructions": "special instructions",
  "confidence": 0.88,
  "extractedAt": "timestamp"
}
```

### 3. Appointments

```json
{
  "type": "appointment",
  "appointmentType": "schedule|reschedule|cancel",
  "timeframe": "next week|in 2 weeks|etc",
  "specialty": "cardiology|orthopedics|etc",
  "reason": "follow-up|check-up|etc",
  "confidence": 0.92,
  "extractedAt": "timestamp"
}
```

### 4. Diagnoses

```json
{
  "type": "diagnosis",
  "condition": "condition name",
  "severity": "mild|moderate|severe",
  "status": "suspected|confirmed|ruled_out",
  "confidence": 0.85,
  "extractedAt": "timestamp"
}
```

### 5. Treatments

```json
{
  "type": "treatment",
  "treatment": "treatment name",
  "category": "procedure|therapy|referral|lifestyle",
  "details": "additional details",
  "confidence": 0.9,
  "extractedAt": "timestamp"
}
```

### 6. Vital Signs

```json
{
  "type": "vital_signs",
  "vitals": {
    "bloodPressure": { "systolic": 120, "diastolic": 80 },
    "heartRate": 72,
    "temperature": 98.6,
    "weight": 70,
    "height": 175,
    "respiratoryRate": 16,
    "oxygenSaturation": 98
  },
  "unit": "metric|imperial",
  "confidence": 0.93,
  "extractedAt": "timestamp"
}
```

## Testing

To test the webhook functionality:

```bash
cd server
node test-webhook.js
```

This will send a test payload to your webhook URL and verify it's working correctly.

## Integration Notes

- **Webhook.site**: Perfect for proof of concept - automatically logs all requests
- **No Response Configuration Needed**: webhook.site works out of the box
- **Custom Webhooks**: You can replace the URL with any webhook endpoint
- **Failure Handling**: Webhook failures are logged but don't interrupt the conversation flow
- **Retry Logic**: Currently no retry logic (can be added if needed)

## Monitoring

Check your webhook.site dashboard to see:

- All received webhooks
- Request headers and body
- Response status codes
- Timing information

## Next Steps

For production use, you might want to:

1. Replace webhook.site with your actual webhook endpoint
2. Add authentication headers if needed
3. Implement retry logic for failed webhook deliveries
4. Add webhook signature verification for security

## Security Considerations

- The webhook contains PHI (Protected Health Information)
- Ensure your webhook endpoint is HTTPS
- Consider adding authentication/authorization
- Log webhook attempts for audit purposes
