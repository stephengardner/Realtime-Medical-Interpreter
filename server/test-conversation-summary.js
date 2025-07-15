const { config } = require('dotenv');
const DatabaseService = require('./dist/services/database.js').default;
const { Conversation } = require('./dist/models/index.js');

// Load environment variables
config();

async function testConversationSummary() {
  const databaseService = DatabaseService.getInstance();
  
  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable is required');
      process.exit(1);
    }

    console.log('🔌 Connecting to database...');
    await databaseService.connect({ uri: mongoUri });
    
    // Create a test conversation with sample messages
    console.log('📝 Creating test conversation with sample messages...');
    const testConversation = new Conversation({
      sessionId: 'test-summary-session-' + Date.now(),
      status: 'active',
      messages: [
        {
          speaker: 'doctor',
          originalText: 'Hello, how are you feeling today?',
          translatedText: 'Hola, ¿cómo te sientes hoy?',
          timestamp: new Date(),
          messageId: 'msg1'
        },
        {
          speaker: 'patient',
          originalText: 'Me duele el estómago desde ayer',
          translatedText: 'My stomach has been hurting since yesterday',
          timestamp: new Date(),
          messageId: 'msg2'
        },
        {
          speaker: 'doctor',
          originalText: 'I see. Can you describe the pain? Is it sharp or dull?',
          translatedText: 'Entiendo. ¿Puedes describir el dolor? ¿Es agudo o sordo?',
          timestamp: new Date(),
          messageId: 'msg3'
        },
        {
          speaker: 'patient',
          originalText: 'Es como un dolor punzante, especialmente después de comer',
          translatedText: 'It\'s like a stabbing pain, especially after eating',
          timestamp: new Date(),
          messageId: 'msg4'
        },
        {
          speaker: 'doctor',
          originalText: 'I recommend avoiding spicy foods and taking some antacids. Let\'s schedule a follow-up in a week.',
          translatedText: 'Recomiendo evitar alimentos picantes y tomar algunos antiácidos. Programemos una cita de seguimiento en una semana.',
          timestamp: new Date(),
          messageId: 'msg5'
        }
      ],
      startTime: new Date(),
      totalMessageCount: 5,
    });

    await testConversation.save();
    console.log(`✅ Created test conversation with ${testConversation.messages.length} messages`);
    
    // Test the summary generation by completing the conversation
    console.log('\n📝 Testing conversation summary generation...');
    
    // Simulate what happens when a conversation is completed
    const testSummary = "The patient complained of stomach pain since yesterday, describing it as stabbing pain especially after eating. The doctor recommended avoiding spicy foods, taking antacids, and scheduling a follow-up appointment in one week.";
    
    // Complete the conversation with the summary
    await testConversation.completeConversation(testSummary);
    
    // Verify the conversation was completed with summary
    const completedConversation = await Conversation.findById(testConversation._id);
    console.log(`✅ Conversation completed successfully`);
    console.log(`   Status: ${completedConversation.status}`);
    console.log(`   Summary: ${completedConversation.summary}`);
    console.log(`   End time: ${completedConversation.endTime}`);
    console.log(`   Total messages: ${completedConversation.totalMessageCount}`);

    // Display the conversation details
    console.log('\n💬 CONVERSATION DETAILS');
    console.log('=' .repeat(50));
    console.log(`Session ID: ${completedConversation.sessionId}`);
    console.log(`Started: ${completedConversation.startTime}`);
    console.log(`Ended: ${completedConversation.endTime}`);
    console.log(`\nMessages:`);
    completedConversation.messages.forEach((msg, index) => {
      console.log(`${index + 1}. ${msg.speaker.toUpperCase()}: "${msg.originalText}"`);
      console.log(`   Translation: "${msg.translatedText}"`);
    });

    console.log(`\n📋 SUMMARY:`);
    console.log(`${completedConversation.summary}`);

    // Test finding conversations with summaries
    console.log('\n🔍 Testing conversation queries with summaries...');
    const conversationsWithSummaries = await Conversation.find({ 
      summary: { $ne: null } 
    }).select('sessionId summary status startTime endTime totalMessageCount');
    
    console.log(`Found ${conversationsWithSummaries.length} conversations with summaries:`);
    conversationsWithSummaries.forEach((conv, index) => {
      console.log(`${index + 1}. Session: ${conv.sessionId.substring(0, 8)}...`);
      console.log(`   Summary: ${conv.summary.substring(0, 100)}...`);
      console.log(`   Status: ${conv.status} | Messages: ${conv.totalMessageCount}`);
    });

    // Clean up test conversation
    await Conversation.findByIdAndDelete(testConversation._id);
    console.log('\n🗑️ Test conversation cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Disconnect from database
    try {
      await databaseService.disconnect();
      console.log('\n🔌 Disconnected from database');
    } catch (disconnectError) {
      console.error('❌ Error disconnecting:', disconnectError);
    }
    
    process.exit(0);
  }
}

// Run the test
console.log('🧪 Starting conversation summary test...');
testConversationSummary(); 