const { config } = require('dotenv');
const DatabaseService = require('./dist/services/database.js').default;
const { Conversation } = require('./dist/models/index.js');

// Load environment variables
config();

async function testConversationManagement() {
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
    
    // Find an active conversation to test with
    console.log('📋 Finding active conversation to test...');
    const activeConversation = await Conversation.findOne({ status: 'active' });
    
    if (!activeConversation) {
      console.log('📭 No active conversations found, creating a test conversation...');
      const testConversation = new Conversation({
        sessionId: 'test-session-' + Date.now(),
        status: 'active',
        messages: [],
        startTime: new Date(),
        totalMessageCount: 0,
      });
      await testConversation.save();
      console.log(`✅ Created test conversation: ${testConversation._id}`);
      
      // Test stopping the conversation
      console.log('\n🛑 Testing conversation stopping...');
      testConversation.status = 'completed';
      testConversation.endTime = new Date();
      await testConversation.save();
      console.log('✅ Conversation stopped successfully');
      
      // Test resuming the conversation
      console.log('\n🔄 Testing conversation resuming...');
      testConversation.status = 'active';
      testConversation.endTime = undefined;
      await testConversation.save();
      console.log('✅ Conversation resumed successfully');
      
      // Clean up test conversation
      await Conversation.findByIdAndDelete(testConversation._id);
      console.log('🗑️ Test conversation cleaned up');
      
    } else {
      console.log(`📋 Found active conversation: ${activeConversation.sessionId}`);
      console.log(`   Status: ${activeConversation.status}`);
      console.log(`   Messages: ${activeConversation.totalMessageCount}`);
      
      // Test stopping the conversation
      console.log('\n🛑 Testing conversation stopping...');
      const originalStatus = activeConversation.status;
      activeConversation.status = 'completed';
      activeConversation.endTime = new Date();
      await activeConversation.save();
      console.log('✅ Conversation stopped successfully');
      
      // Verify it's completed
      const stoppedConversation = await Conversation.findById(activeConversation._id);
      console.log(`   Updated status: ${stoppedConversation.status}`);
      console.log(`   End time: ${stoppedConversation.endTime}`);
      
      // Test resuming the conversation
      console.log('\n🔄 Testing conversation resuming...');
      stoppedConversation.status = 'active';
      stoppedConversation.endTime = undefined;
      await stoppedConversation.save();
      console.log('✅ Conversation resumed successfully');
      
      // Verify it's active again
      const resumedConversation = await Conversation.findById(activeConversation._id);
      console.log(`   Updated status: ${resumedConversation.status}`);
      console.log(`   End time: ${resumedConversation.endTime || 'Still active'}`);
    }

    // Show final statistics
    console.log('\n📊 FINAL STATISTICS');
    console.log('=' .repeat(50));
    
    const totalConversations = await Conversation.countDocuments();
    const activeConversations = await Conversation.countDocuments({ status: 'active' });
    const completedConversations = await Conversation.countDocuments({ status: 'completed' });
    
    console.log(`Total Conversations: ${totalConversations}`);
    console.log(`Active Conversations: ${activeConversations}`);
    console.log(`Completed Conversations: ${completedConversations}`);

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
console.log('🧪 Starting conversation management test...');
testConversationManagement(); 