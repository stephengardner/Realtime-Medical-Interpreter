require('dotenv').config();
const IntentRecognitionService = require('./dist/services/intent-recognition.js').default;
const OpenAI = require('openai').default;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Sample medical conversation messages for testing
const testMessages = [
  {
    speaker: "doctor",
    originalText: "I'm prescribing you amoxicillin 500mg twice daily for 10 days for your infection",
    translatedText: "Te estoy recetando amoxicilina 500mg dos veces al día durante 10 días para tu infección"
  },
  {
    speaker: "doctor", 
    originalText: "Let's order a complete blood count and basic metabolic panel",
    translatedText: "Vamos a pedir un conteo sanguíneo completo y un panel metabólico básico"
  },
  {
    speaker: "doctor",
    originalText: "I want to schedule you for a follow-up appointment in 2 weeks",
    translatedText: "Quiero programarte una cita de seguimiento en 2 semanas"
  },
  {
    speaker: "doctor",
    originalText: "Based on your symptoms, I suspect you have pneumonia",
    translatedText: "Basándome en tus síntomas, sospecho que tienes neumonía"
  },
  {
    speaker: "doctor",
    originalText: "I recommend physical therapy for your back pain",
    translatedText: "Te recomiendo fisioterapia para tu dolor de espalda"
  },
  {
    speaker: "doctor",
    originalText: "Your blood pressure is 140 over 90 and your heart rate is 85",
    translatedText: "Tu presión arterial es 140 sobre 90 y tu frecuencia cardíaca es 85"
  },
  {
    speaker: "patient",
    originalText: "Me duele mucho la cabeza",
    translatedText: "My head hurts a lot"
  },
  {
    speaker: "doctor",
    originalText: "How are you feeling today?",
    translatedText: "¿Cómo te sientes hoy?"
  }
];

async function testIntentRecognition() {
  console.log('🧠 Testing Intent Recognition System');
  console.log('=' .repeat(50));
  
  try {
    // Initialize intent recognition service
    const intentService = new IntentRecognitionService(openai);
    
    // Test each message
    for (const [index, message] of testMessages.entries()) {
      console.log(`\n📝 Testing Message ${index + 1}:`);
      console.log(`Speaker: ${message.speaker}`);
      console.log(`Original: "${message.originalText}"`);
      console.log(`Translation: "${message.translatedText}"`);
      
      // Extract intents
      const intents = await intentService.extractIntents(
        message.originalText,
        message.translatedText,
        message.speaker,
        [] // No context for this test
      );
      
      if (intents.length > 0) {
        console.log(`🎯 Extracted ${intents.length} intents:`);
        intents.forEach((intent, i) => {
          console.log(`  ${i + 1}. ${intent.type} (confidence: ${intent.confidence})`);
          console.log(`     Data:`, JSON.stringify(intent, null, 6));
        });
      } else {
        console.log('❌ No intents extracted');
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Test intent summarization
    console.log('\n📊 Testing Intent Summarization');
    console.log('=' .repeat(30));
    
    const allIntents = [];
    for (const message of testMessages) {
      const intents = await intentService.extractIntents(
        message.originalText,
        message.translatedText,
        message.speaker,
        []
      );
      allIntents.push(...intents);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const summary = await intentService.summarizeIntents(allIntents);
    console.log(`\n📋 Intent Summary:\n${summary}`);
    
    // Test configuration updates
    console.log('\n⚙️  Testing Configuration Updates');
    console.log('=' .repeat(30));
    
    intentService.updateConfig({
      confidenceThreshold: 0.5,
      maxIntentsPerMessage: 5,
      enabledIntents: ['medication', 'lab_order']
    });
    
    console.log('✅ Configuration updated successfully');
    
    // Test with updated config
    const testMessage = testMessages[0]; // Medication message
    const configTestIntents = await intentService.extractIntents(
      testMessage.originalText,
      testMessage.translatedText,
      testMessage.speaker,
      []
    );
    
    console.log(`\n🔬 Testing with updated config (lower threshold):`);
    console.log(`Extracted ${configTestIntents.length} intents with confidence >= 0.5`);
    
    console.log('\n✅ Intent Recognition System Test Complete!');
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.error('❌ Error during intent recognition test:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testIntentRecognition().catch(console.error); 