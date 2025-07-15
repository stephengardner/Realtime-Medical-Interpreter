const OpenAI = require('openai');
const { createRequire } = require('module');
const require = createRequire(import.meta.url);

// Create OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testLanguageDetection() {
  console.log('🧪 Testing automatic language detection for speaker roles...\n');
  
  const testCases = [
    // English (Doctor) test cases
    { text: "Hello, how are you feeling today?", expected: "doctor" },
    { text: "What brings you in today?", expected: "doctor" },
    { text: "I'm going to prescribe you some medication", expected: "doctor" },
    { text: "Let's schedule a follow-up appointment", expected: "doctor" },
    { text: "I recommend you get some rest", expected: "doctor" },
    
    // Spanish (Patient) test cases
    { text: "Hola doctor, me duele la cabeza", expected: "patient" },
    { text: "¿Cómo está usted?", expected: "patient" },
    { text: "Tengo dolor en el pecho", expected: "patient" },
    { text: "¿Qué medicina necesito?", expected: "patient" },
    { text: "Gracias por la ayuda", expected: "patient" },
    
    // Mixed language test cases
    { text: "I have dolor de cabeza", expected: "doctor" }, // English structure
    { text: "Tengo headache", expected: "patient" }, // Spanish structure
    
    // Edge cases
    { text: "Okay", expected: "doctor" }, // Default to doctor for unclear
    { text: "Sí", expected: "patient" }, // Simple Spanish
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    try {
      console.log(`🔍 Testing: "${testCase.text}"`);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a language detection system. Analyze the given text and determine if it's primarily English or Spanish.
            
            Rules:
            - Respond with only "english" or "spanish" 
            - Base your decision on the overall language of the text
            - If mixed languages, choose the dominant one
            - If unclear, default to "english"
            
            Examples:
            "Hello, how are you?" -> english
            "¿Hola, cómo estás?" -> spanish
            "I have dolor de cabeza" -> english (mixed, but primarily English structure)
            "Tengo headache" -> spanish (mixed, but primarily Spanish structure)`
          },
          {
            role: "user",
            content: `Detect the language of this text: "${testCase.text}"`
          }
        ],
        max_tokens: 10,
        temperature: 0.1
      });

      const detectedLanguage = response.choices[0]?.message?.content?.trim().toLowerCase();
      
      let detectedSpeaker;
      if (detectedLanguage === 'spanish') {
        detectedSpeaker = 'patient';
      } else {
        detectedSpeaker = 'doctor';
      }
      
      const isCorrect = detectedSpeaker === testCase.expected;
      
      if (isCorrect) {
        console.log(`  ✅ PASS: Detected ${detectedSpeaker} (${detectedLanguage})`);
        passed++;
      } else {
        console.log(`  ❌ FAIL: Expected ${testCase.expected}, got ${detectedSpeaker} (${detectedLanguage})`);
        failed++;
      }
      
      console.log('');
      
    } catch (error) {
      console.error(`  ❌ ERROR: ${error.message}`);
      failed++;
      console.log('');
    }
  }
  
  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${(passed / (passed + failed) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Language detection is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Consider adjusting the language detection logic.');
  }
}

// Run the test
testLanguageDetection().catch(console.error); 