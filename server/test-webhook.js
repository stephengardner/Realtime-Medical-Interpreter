const fetch = require('node-fetch');

// Test webhook functionality
async function testWebhook() {
  const webhookUrl = process.env.WEBHOOK_URL || 'https://webhook.site/YOUR_WEBHOOK_ID_HERE';
  
  console.log('🧪 Testing webhook functionality...');
  console.log(`📡 Webhook URL: ${webhookUrl}`);
  
  // Sample webhook payload similar to what the app would send
  const testPayload = {
    event: 'conversation_completed',
    timestamp: new Date().toISOString(),
    conversation: {
      id: 'test-conversation-id',
      sessionId: 'test-session-id',
      patientName: 'John Doe',
      doctorName: 'Dr. Smith',
      startTime: new Date(Date.now() - 300000), // 5 minutes ago
      endTime: new Date(),
      summary: 'Patient presented with mild headache. Prescribed acetaminophen.',
      totalMessages: 8,
      status: 'completed'
    },
    actions: [
      {
        type: 'medication',
        action: 'prescribe',
        medication: {
          name: 'acetaminophen',
          dosage: '500mg',
          frequency: 'every 6 hours',
          duration: '3 days'
        },
        confidence: 0.95,
        extractedAt: new Date()
      },
      {
        type: 'diagnosis',
        condition: 'tension headache',
        severity: 'mild',
        status: 'suspected',
        confidence: 0.88,
        extractedAt: new Date()
      }
    ],
    analytics: {
      totalActions: 2,
      actionsByType: [
        { type: 'medication', count: 1 },
        { type: 'diagnosis', count: 1 }
      ],
      conversationDuration: 5 // minutes
    }
  };
  
  try {
    console.log('📤 Sending test webhook...');
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Medical-Interpreter-Test/1.0',
        'X-Webhook-Source': 'ai-medical-interpreter-test'
      },
      body: JSON.stringify(testPayload)
    });
    
    if (response.ok) {
      console.log('✅ Webhook test successful!');
      console.log(`📊 Status: ${response.status}`);
      console.log(`📋 Response headers:`, Object.fromEntries(response.headers));
      
      // Try to get response body if available
      try {
        const responseBody = await response.text();
        if (responseBody) {
          console.log(`📄 Response body: ${responseBody}`);
        }
      } catch (e) {
        // Response body might be empty or not available
      }
      
      console.log('\n🎉 Test completed successfully!');
      console.log('💡 You can now check your webhook.site dashboard to see the received payload.');
    } else {
      console.error('❌ Webhook test failed!');
      console.error(`Status: ${response.status}`);
      console.error(`Response: ${await response.text()}`);
    }
    
  } catch (error) {
    console.error('❌ Error sending webhook:', error);
  }
}

// Run the test
testWebhook().catch(console.error); 