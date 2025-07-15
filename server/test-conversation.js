const { config } = require('dotenv');
const DatabaseService = require('./dist/services/database.js').default;
const { Conversation } = require('./dist/models/index.js');

// Load environment variables
config();

async function testConversation() {
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
    
    // Get the latest conversation
    console.log('📋 Fetching latest conversation...');
    const latestConversation = await Conversation.findOne()
      .sort({ createdAt: -1 })
      .exec();
    
    if (!latestConversation) {
      console.log('📭 No conversations found in database');
      return;
    }

    // Display conversation details
    console.log('\n🗣️  LATEST CONVERSATION');
    console.log('=' .repeat(50));
    console.log(`Session ID: ${latestConversation.sessionId}`);
    console.log(`Status: ${latestConversation.status}`);
    console.log(`Started: ${latestConversation.startTime}`);
    console.log(`Ended: ${latestConversation.endTime || 'Still active'}`);
    console.log(`Total Messages: ${latestConversation.totalMessageCount}`);
    console.log(`Patient: ${latestConversation.patientName || 'Not specified'}`);
    console.log(`Doctor: ${latestConversation.doctorName || 'Not specified'}`);
    
    if (latestConversation.summary) {
      console.log(`Summary: ${latestConversation.summary}`);
    }
    
    if (latestConversation.actions && latestConversation.actions.length > 0) {
      console.log(`Actions: ${latestConversation.actions.join(', ')}`);
    }

    // Display messages
    console.log('\n💬 MESSAGES');
    console.log('=' .repeat(50));
    
    if (latestConversation.messages.length === 0) {
      console.log('📭 No messages in this conversation');
    } else {
      latestConversation.messages.forEach((message, index) => {
        console.log(`\n[${index + 1}] ${message.speaker.toUpperCase()} - ${message.timestamp}`);
        console.log(`   Original: "${message.originalText}"`);
        console.log(`   Translation: "${message.translatedText}"`);
        if (message.messageId) {
          console.log(`   Message ID: ${message.messageId}`);
        }
      });
    }

    // Get conversation statistics
    console.log('\n📊 CONVERSATION STATISTICS');
    console.log('=' .repeat(50));
    
    const totalConversations = await Conversation.countDocuments();
    const activeConversations = await Conversation.countDocuments({ status: 'active' });
    const completedConversations = await Conversation.countDocuments({ status: 'completed' });
    
    console.log(`Total Conversations: ${totalConversations}`);
    console.log(`Active Conversations: ${activeConversations}`);
    console.log(`Completed Conversations: ${completedConversations}`);

    // Get recent conversations summary
    console.log('\n📋 RECENT CONVERSATIONS');
    console.log('=' .repeat(50));
    
    const recentConversations = await Conversation.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('sessionId status startTime endTime totalMessageCount')
      .exec();
    
    if (recentConversations.length === 0) {
      console.log('📭 No recent conversations found');
    } else {
      recentConversations.forEach((conv, index) => {
        console.log(`${index + 1}. Session: ${conv.sessionId.substring(0, 8)}... | Status: ${conv.status} | Messages: ${conv.totalMessageCount} | Started: ${conv.startTime.toISOString()}`);
      });
    }

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
console.log('🧪 Starting conversation database test...');
testConversation(); 