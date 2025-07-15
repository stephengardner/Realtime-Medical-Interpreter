import { useCallback, useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ThemeProvider } from './components/theme-provider';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Moon, Sun, Mic, MicOff, Languages, MessageSquare, Radio, Volume2, Stethoscope, User, Zap, Wifi, WifiOff, History, FileText } from 'lucide-react';
import { useTheme } from './components/theme-provider';
import { useAudioRecording } from './hooks/useAudioRecording';
import { useRealtimeAI } from './hooks/useRealtimeAI';
import { useStore, Transcript } from './state/store';
import Conversations from './pages/Conversations';
import TechnicalDesign from './pages/TechnicalDesign';
import IntentBadges from './components/IntentBadges';
import { LanguageToggle } from './components/LanguageToggle';

const getWebSocketUrl = () => {
  if (import.meta.env.DEV) {
    return 'ws://localhost:3001';
  }
  
  // Production - use current domain with wss for HTTPS
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

const WEBSOCKET_URL = getWebSocketUrl();

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="rounded-full hover:bg-accent/50 transition-all duration-200 hover:scale-105"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

function StatusIndicator({ isConnected, isSessionReady, isRecording, isSpeaking, isPlaying }: {
  isConnected: boolean;
  isSessionReady: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  isPlaying: boolean;
}) {
  return (
    <div className={`status-card text-sm space-y-3 ${isConnected ? 'status-connected' : 'status-disconnected'}`}>
      <div className="flex items-center gap-2">
        {isConnected ? (
          <Wifi className="h-4 w-4 text-success" />
        ) : (
          <WifiOff className="h-4 w-4 text-error" />
        )}
        <span className={`font-medium ${isConnected ? 'text-success' : 'text-error'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <div className="w-full h-px bg-border" />
      
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full transition-colors ${
          isSessionReady ? 'bg-success animate-pulse' : 'bg-error'
        }`} />
        <span className={`font-medium ${isSessionReady ? 'text-success' : 'text-error'}`}>
          {isSessionReady ? 'Connected' : 'Click Start Listening to connect'}
        </span>
      </div>
      
      {isRecording && (
        <>
          <div className="w-full h-px bg-border" />
          <div className="flex items-center gap-2">
            {isSpeaking ? (
              <>
                <Radio className="h-4 w-4 text-error animate-pulse" />
                <span className="text-error font-medium">Speaking</span>
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 text-success animate-pulse" />
                <span className="text-success font-medium">Listening</span>
              </>
            )}
          </div>
        </>
      )}
      
      {isPlaying && (
        <>
          <div className="w-full h-px bg-border" />
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-doctor animate-pulse" />
            <span className="text-doctor font-medium">Playing</span>
          </div>
        </>
      )}
    </div>
  )
}

function InterpreterInterface() {
  const {
    transcripts,
    currentRole,
    isDoctorSpanish,
    isRecording,
    isPlaying,
    isSpeaking,
    isLoading,
    conversationId,
    sessionId,
    conversationSummary,
    conversationEnded,
    addTranscript,
    updateTranscript,
    updateTranscriptRole,
    updateTranslation,
    updateIntents,
    setCurrentRole,
    setIsDoctorSpanish,
    setIsRecording,
    setIsPlaying,
    setIsSpeaking,
    setIsLoading,
    setConversationId,
    setSessionId,
    setConversationSummary,
    setConversationEnded,
    reset,
  } = useStore();

  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const isSessionReadyRef = useRef(false);
  const audioRecordingRef = useRef<{ startRecording: () => void; stopRecording: () => void } | null>(null);
  const conversationScrollRef = useRef<HTMLDivElement>(null);

  const handleConnect = useCallback(() => {
    console.log("[Client] Connected to realtime server");
    setIsConnected(true);
  }, []);

  const handleDisconnect = useCallback(() => {
    console.log("[Client] Disconnected from realtime server");
    setIsConnected(false);
    setIsSessionReady(false);
    isSessionReadyRef.current = false; // Reset ref
  }, []);

  const handleSessionReady = useCallback((data: { sessionId: string; conversationId?: string }) => {
    console.log("[Client] Session ready - starting audio recording");
    setIsSessionReady(true);
    isSessionReadyRef.current = true; // Update ref immediately
    setIsLoading(false);
    
    // Store session and conversation IDs
    setSessionId(data.sessionId);
    if (data.conversationId) {
      setConversationId(data.conversationId);
    }
    
    audioRecordingRef.current?.startRecording();
    setIsRecording(true);
  }, [setSessionId, setConversationId]);

  const handleTranscript = useCallback((data: { id: string; text: string; is_user: boolean; finished: boolean; role?: string }) => {
    console.log("[Client] Received transcript:", { id: data.id, textLength: data.text.length, is_user: data.is_user, finished: data.finished, role: data.role });
    console.log("[Client] Transcript finished:", data.finished);
    
    // Check if transcript already exists in store
    const existingTranscript = transcripts.find(t => t.id === data.id);
    
    if (!existingTranscript) {
      // First time seeing this transcript - add it to store
      // Use role from server if provided, otherwise default to currentRole
      const transcriptRole = data.role || currentRole;
      console.log("[Client] Adding new transcript to store:", data.id, "with role:", transcriptRole);
      
      addTranscript({
        id: data.id,
        text: data.text,
        translation: "",
        isUser: data.is_user,
        role: transcriptRole as "doctor" | "patient" | "detecting",
      });
      
      // Update the client's currentRole to match the server's detected speaker (only if not detecting)
      if (data.role && data.role !== currentRole && data.role !== "detecting") {
        console.log("[Client] 🔄 Updating currentRole from", currentRole, "to", data.role);
        setCurrentRole(data.role as "doctor" | "patient");
      } else {
        console.log("[Client] 🔄 Role unchanged:", currentRole, "server sent:", data.role);
      }
    } else {
      // Transcript exists - update the text and role if provided
      console.log("[Client] Updating existing transcript:", data.id, data.text, "finished:", data.finished);
      updateTranscript(data.id, data.text, data.finished);
      
      // If this is the final transcript with a corrected role, update the existing transcript's role
      if (data.finished && data.role && data.role !== existingTranscript.role) {
        console.log("[Client] 🔄 Updating transcript role from", existingTranscript.role, "to", data.role);
        // Update the specific transcript's role in the store
        updateTranscriptRole(data.id, data.role as "doctor" | "patient" | "detecting");
        // Also update the currentRole for future messages (only if not detecting)
        if (data.role !== "detecting") {
          setCurrentRole(data.role as "doctor" | "patient");
        }
      }
    }
  }, [currentRole, addTranscript, updateTranscript, updateTranscriptRole, transcripts, setCurrentRole]);

  const handleTranslation = useCallback((data: { id: string; text: string; finished: boolean }) => {
    console.log("[Client] Received translation:", JSON.stringify(data, null, 2));
    console.log("[Client] Calling updateTranslation with id:", data.id, "text:", data.text, "finished:", data.finished);
    updateTranslation(data.id, data.text, data.finished);
  }, [updateTranslation]);

  const handleConversationStopped = useCallback((data: { conversationId: string; summary: string | null }) => {
    console.log("[Client] Conversation stopped:", data);
    if (data.summary) {
      setConversationSummary(data.summary);
      console.log("[Client] Set conversation summary:", data.summary);
    }
  }, [setConversationSummary]);

  const handleIntentsExtracted = useCallback((data: { messageId: string; intents: any[] }) => {
    console.log("[Client] Intents extracted:", data);
    if (data.messageId && data.intents) {
      updateIntents(data.messageId, data.intents);
      console.log("[Client] Updated intents for message:", data.messageId);
    }
  }, [updateIntents]);

  const realtime = useRealtimeAI({
    url: WEBSOCKET_URL,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onSessionReady: handleSessionReady,
    onTranscript: handleTranscript,
    onTranslation: handleTranslation,
    onConversationStopped: handleConversationStopped,
    onIntentsExtracted: handleIntentsExtracted,
    onAudioEvent: useCallback((data: { event: string }) => {
      console.log("[Client] Audio event:", data);
      if (data.event === "speech_started") {
        setIsSpeaking(true);
      } else if (data.event === "speech_stopped") {
        setIsSpeaking(false);
      } else if (data.event === "audio_playing") {
        setIsPlaying(true);
      } else if (data.event === "audio_stopped") {
        setIsPlaying(false);
      }
    }, []),
    onError: useCallback((error: string) => {
      console.error("[Client] Realtime error:", error);
    }, []),
  });

  // Handle language configuration toggle
  const handleLanguageToggle = useCallback((newIsDoctorSpanish: boolean) => {
    console.log("[Client] Language configuration changed:", newIsDoctorSpanish ? "Doctor=Spanish, Patient=English" : "Doctor=English, Patient=Spanish");
    setIsDoctorSpanish(newIsDoctorSpanish);
    
    // Send language configuration to server
    const languageConfig = {
      type: "language_config",
      data: {
        isDoctorSpanish: newIsDoctorSpanish,
        doctorLanguage: newIsDoctorSpanish ? "spanish" : "english",
        patientLanguage: newIsDoctorSpanish ? "english" : "spanish"
      }
    };
    
    realtime.sendMessage(languageConfig);
  }, [setIsDoctorSpanish, realtime]);

  // Auto-scroll to bottom when messages are added or updated (translations, intents, etc.)
  useEffect(() => {
    if (conversationScrollRef.current) {
      conversationScrollRef.current.scrollTop = conversationScrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  const audioRecording = useAudioRecording({
    onAudioChunk: (audioData: ArrayBuffer) => {
      const sessionReady = isSessionReadyRef.current;
      // console.log(`[Client] Audio chunk received: ${audioData.byteLength} bytes, sessionReady: ${sessionReady}`);
      if (sessionReady) {
        realtime.sendAudio(audioData);
      } else {
        console.log("[Client] Session not ready (ref), skipping audio chunk");
      }
    },
    onSpeakingChange: (isSpeaking: boolean) => {
      setIsSpeaking(isSpeaking);
    },
  });

  audioRecordingRef.current = audioRecording;

  const handleToggleRecording = async () => {
    if (isRecording) {
      console.log("[Client] Stopping recording and realtime connection");
      
      // Stop the conversation on the server
      if (sessionId) {
        try {
          await fetch(`${WEBSOCKET_URL.replace('ws://', 'http://').replace('wss://', 'https://')}/api/conversations/${sessionId}/stop`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          console.log("[Client] Conversation stopped on server");
        } catch (error) {
          console.error("[Client] Error stopping conversation:", error);
        }
      }
      
      audioRecording.stopRecording();
      realtime.stop();
      setIsRecording(false);
      setIsSessionReady(false);
      isSessionReadyRef.current = false; // Reset ref
      
      // Mark conversation as ended
      setConversationEnded(true);
      console.log("[Client] Conversation ended");
    } else {
      console.log("[Client] Starting realtime connection");
      
      // Always reset all state when starting a new conversation
      console.log("[Client] Resetting all state for new conversation");
      reset();
      
      // Reset component-level state as well
      setIsSessionReady(false);
      setIsConnected(false);
      isSessionReadyRef.current = false;
      
      // Set loading state after reset
      setIsLoading(true);
      
      realtime.start();
    }
  };

  const getLanguageLabel = (role: "doctor" | "patient" | "detecting", isOriginal: boolean) => {
    if (role === "detecting") {
      return "...";
    }
    if (isOriginal) {
      return role === "doctor" ? "EN" : "ES";
    } else {
      return role === "doctor" ? "ES" : "EN";
    }
  };
  
  const getLanguageColor = (role: "doctor" | "patient" | "detecting", isOriginal: boolean) => {
    if (role === "detecting") {
      return 'bg-muted text-muted-foreground';
    }
    if (isOriginal) {
      return role === "doctor" ? 'badge-en' : 'badge-es';
    } else {
      return role === "doctor" ? 'badge-es' : 'badge-en';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Enhanced Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 shadow-md">
        <div className="container mx-auto px-4 py-2 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 md:space-x-4">
              <div className="flex items-center justify-center w-8 h-8 md:w-12 md:h-12 rounded-xl shadow-lg">
                <img 
                  src="/logo.png" 
                  alt="Realtime Medical Interpreter Logo" 
                  className="w-12 h-12 md:w-18 md:h-18 rounded-xl object-cover"
                />
              </div>
              <div>
                <h1 className="text-base md:text-2xl font-bold text-foreground">
                  <span className="title-gradient">
                    AI Interpreter
                  </span>
                  {/* <span className="text-foreground ml-1 md:ml-2">Medical Interpreter</span> */}
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden md:block">
                  Real-time English ↔ Spanish translation for medical consultations
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1 md:space-x-2">
              <Link to="/conversations">
                <Button variant="ghost" size="sm" className="text-xs md:text-sm">
                  <History className="h-4 w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">History</span>
                </Button>
              </Link>
              <Link to="/technical-design">
                <Button variant="ghost" size="sm" className="text-xs md:text-sm">
                  <FileText className="h-4 w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Tech Design</span>
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Subtitle Section */}
      <div className="md:hidden bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-2">
          <div className="text-center space-y-0.5">
            <p className="text-xs text-muted-foreground">
              Real-time English ↔ Spanish translation for medical consultations
            </p>
            <p className="text-[10px] text-muted-foreground">
              Automatic speaker role detection and prescription/action item logging
            </p>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-2  md:px-4 py-4 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left Sidebar - Controls */}
          <div className="lg:col-span-1 space-y-4">
            {/* Language Configuration */}
            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Languages className="h-5 w-5" />
                  Language Configuration
                </CardTitle>
                <CardDescription>
                  Configure which language each role speaks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LanguageToggle
                  isDoctorSpanish={isDoctorSpanish}
                  onToggle={handleLanguageToggle}
                  disabled={isRecording}
                />
              </CardContent>
            </Card>

            {/* Recording Control */}
            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Recording
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleToggleRecording}
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                  variant={isRecording ? "prominent-stop" : "prominent"}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                      Connecting...
                    </>
                  ) : isRecording ? (
                    <>
                      <MicOff className="h-5 w-5 mr-2" />
                      Stop Listening
                    </>
                  ) : (
                    <>
                      <Mic className="h-5 w-5 mr-2" />
                      Start Listening
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Status */}
            <StatusIndicator
              isConnected={isConnected}
              isSessionReady={isSessionReady}
              isRecording={isRecording}
              isSpeaking={isSpeaking}
              isPlaying={isPlaying}
            />
          </div>

          {/* Main Content - Conversation */}
          <div className="lg:col-span-3">
            <div className="space-y-4">
              {/* Conversation Summary */}
              {conversationSummary && (
                <Card className="card-elevated">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Conversation Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/30 rounded-lg p-4 border-l-4 border-primary">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {conversationSummary}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Conversation Ended Message */}
              {conversationEnded && (
                <Card className="card-elevated border-orange-200 bg-orange-50/50 dark:bg-orange-900/20 dark:border-orange-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-orange-800 dark:text-orange-200">
                          Conversation Ended
                        </h3>
                        <p className="text-sm text-orange-700 dark:text-orange-300">
                          Click "Start Listening" to begin a new conversation. You can now change language settings.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Live Conversation */}
              <Card className="card-elevated h-[calc(100vh-12rem)] md:h-[calc(100vh-12rem)] overflow-y-auto conversation-scrollable-container" ref={conversationScrollRef}>
                <CardHeader className="border-b bg-muted/20 rounded-t-xl">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Live Conversation
                  </CardTitle>
                  <CardDescription>
                    Real-time translation between English and Spanish
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-full overflow-auto">
                    {transcripts.length === 0 && !conversationEnded ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <div className="w-24 h-24 gradient-bg-enhanced rounded-full flex items-center justify-center mb-6 shadow-lg ready-glow">
                          <MessageSquare className="h-12 w-12 text-white drop-shadow-md" />
                        </div>
                        <h3 className="text-xl md:text-2xl font-bold mb-3 text-foreground">Ready to Translate</h3>
                        <p className="text-muted-foreground mb-4 text-sm md:text-lg">
                          Select the language configuration and click the <span className="font-semibold text-blue-600 dark:text-blue-400">"Start Listening"</span> button to begin.
                        </p>
                      </div>
                    ) : transcripts.length === 0 && conversationEnded ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <div className="w-24 h-24 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center mb-6 shadow-lg">
                          <MessageSquare className="h-12 w-12 text-orange-600 dark:text-orange-400" />
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-orange-800 dark:text-orange-200">Conversation Ended</h3>
                        <p className="text-orange-700 dark:text-orange-300 mb-4 text-lg">
                          Click <span className="font-semibold">"Start Listening"</span> to begin a new conversation.
                        </p>
                      </div>
                    ) : (
                    <div className="space-y-4 p-6">
                      {transcripts.map((item: Transcript, index) => (
                        <div
                          key={item.id}
                          className="space-y-3 animate-fade-in"
                          style={{ animationDelay: `${index * 0.1}s` }}
                        >
                          {/* Speaker Header */}
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              item.role === "detecting" ? "bg-muted text-muted-foreground" :
                              item.role === "doctor" ? "role-icon-doctor" : "role-icon-patient"
                            }`}>
                              {item.role === "detecting" ? (
                                <Zap className="h-4 w-4 animate-pulse" />
                              ) : item.role === "doctor" ? (
                                <Stethoscope className="h-4 w-4" />
                              ) : (
                                <User className="h-4 w-4" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${
                                  item.role === "detecting" ? "text-muted-foreground" :
                                  item.role === "doctor" ? "doctor-text" : "patient-text"
                                }`}>
                                  {item.role === "detecting" ? "Detecting..." : 
                                   item.role === "doctor" ? "Doctor" : "Patient"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(item.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Original Message */}
                          <div className="ml-11 space-y-2">
                            <div className={`p-4 rounded-lg ${
                              item.role === "detecting" ? "bg-muted/20 border border-muted" :
                              item.role === "doctor" ? "bubble-doctor" : "bubble-patient"
                            }`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium text-muted-foreground">Original</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLanguageColor(item.role, true)}`}>
                                  {getLanguageLabel(item.role, true)}
                                </span>
                              </div>
                              <p className="font-medium">{item.text}</p>
                            </div>
                            
                            {/* Translation */}
                            {item.translation && (
                              <div className={`p-4 rounded-lg ${
                                item.role === "detecting" ? "bg-muted/20 border border-muted" :
                                item.role === "doctor" ? "bubble-translation-doctor" : "bubble-translation-patient"
                              }`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-medium text-muted-foreground">Translation</span>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLanguageColor(item.role, false)}`}>
                                    {getLanguageLabel(item.role, false)}
                                  </span>
                                </div>
                                <p className="font-medium">{item.translation}</p>
                              </div>
                            )}
                            
                            {/* Intent Badges */}
                            {item.intents && item.intents.length > 0 && (
                              <IntentBadges intents={item.intents} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Router>
        <Routes>
          <Route path="/" element={<InterpreterInterface />} />
          <Route path="/conversations" element={<Conversations />} />
          <Route path="/technical-design" element={<TechnicalDesign />} />
        </Routes>
      </Router>
    </ThemeProvider>
  )
}

export default App;
