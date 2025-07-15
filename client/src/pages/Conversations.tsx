import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { MessageSquare, Clock, User, Stethoscope, ArrowLeft } from 'lucide-react';
import IntentBadges from '../components/IntentBadges';
import { Intent } from '../state/store';

interface Conversation {
  _id: string;
  sessionId: string;
  patientName?: string;
  doctorName?: string;
  status: 'active' | 'completed' | 'cancelled';
  summary?: string;
  actions?: string[];
  startTime: string;
  endTime?: string;
  totalMessageCount: number;
  messages: Array<{
    speaker: 'patient' | 'doctor';
    originalText: string;
    translatedText: string;
    timestamp: string;
    intents?: Intent[];
  }>;
}

const getWebSocketUrl = () => {
  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }
  
  // Production - use current domain
  const protocol = window.location.protocol;
  return `${protocol}//${window.location.host}`;
};

const API_BASE_URL = getWebSocketUrl();

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/conversations`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch conversations');
        }
        
        const data = await response.json();
        setConversations(data.conversations || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'shadow-sm status-active';
      case 'completed':
        return 'shadow-sm status-completed';
      case 'cancelled':
        return 'text-destructive bg-destructive/10 border-destructive/20 shadow-sm';
      default:
        return 'text-muted-foreground bg-muted/50 border-border shadow-sm';
    }
  };

  // Generate a unique key for an intent based on its type and key properties
const getIntentKey = (intent: Intent): string => {
  switch (intent.type) {
    case 'medication':
      return `${intent.type}:${intent.medication?.name || ''}:${intent.action || ''}`;
    case 'lab_order':
      const sortedTests = intent.tests ? [...intent.tests].sort().join(',') : '';
      return `${intent.type}:${intent.labType || ''}:${sortedTests}`;
    case 'appointment':
      return `${intent.type}:${intent.appointmentType || ''}:${intent.timeframe || ''}:${intent.specialty || ''}`;
    case 'diagnosis':
      return `${intent.type}:${intent.condition || ''}:${intent.status || ''}`;
    case 'treatment':
      return `${intent.type}:${intent.treatment || ''}:${intent.category || ''}`;
    case 'vital_signs':
      const vitalsKey = intent.vitals ? JSON.stringify(intent.vitals) : '';
      return `${intent.type}:${vitalsKey}`;
    default:
      return `${intent.type}:${JSON.stringify(intent)}`;
  }
};

// Extract all intents from all messages in a conversation and deduplicate them
const extractAllIntents = (conversation: Conversation): Intent[] => {
  const allIntents = conversation.messages.flatMap(message => message.intents || []);
  
  // Deduplicate intents based on their key properties
  const intentMap = new Map<string, Intent>();
  
  allIntents.forEach(intent => {
    const key = getIntentKey(intent);
    const existing = intentMap.get(key);
    
    // If we don't have this intent yet, or if this one has higher confidence, use it
    if (!existing || intent.confidence > existing.confidence) {
      intentMap.set(key, intent);
    }
  });
  
  return Array.from(intentMap.values());
};

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="container mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            <span className="ml-2 text-muted-foreground">Loading conversations...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="container mx-auto">
          <div className="text-center">
            <div className="text-red-600 mb-4">Error: {error}</div>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 shadow-md">
        <div className="container mx-auto px-2 md:px-4 py-2 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 md:space-x-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </Link>
              <div className="flex items-center space-x-2 md:space-x-3">
                <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 gradient-bg-enhanced rounded-lg shadow-lg flex-shrink-0">
                  <MessageSquare className="h-4 w-4 md:h-5 md:w-5 text-white drop-shadow-sm" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-bold text-foreground">
                    Conversation History
                  </h1>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    View past medical consultations
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
        {conversations.length === 0 ? (
          <div className="text-center py-8 md:py-12">
            <MessageSquare className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-base md:text-lg font-semibold text-foreground mb-2">No conversations yet</h3>
            <p className="text-sm md:text-base text-muted-foreground mb-4">
              Start a conversation to see it appear here
            </p>
            <Link to="/">
              <Button size="sm" className="md:size-default">
                Start New Conversation
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6">
            <div className="flex items-center justify-between mb-2 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground truncate">
                  Medical Conversations
                </h2>
                <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-semibold border border-primary/20 flex-shrink-0">
                  {conversations.length}
                </span>
              </div>
            </div>
            
            <div className="grid gap-4">
              {conversations.map((conversation) => (
                <Card key={conversation._id} className="card-elevated overflow-hidden">
                  <CardHeader className="pb-3 px-3 md:px-6">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base md:text-lg flex items-center gap-2 mb-2 min-w-0">
                          <div className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <MessageSquare className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                          </div>
                          <span className="truncate font-semibold min-w-0">Session {conversation.sessionId.substring(0, 6)}...</span>
                        </CardTitle>
                        <CardDescription className="ml-10 md:ml-11">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs md:text-sm">
                            <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate font-medium">{formatDate(conversation.startTime)}</span>
                            </span>
                            {conversation.endTime && (
                              <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                                <Clock className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate font-medium">Ended: {formatDate(conversation.endTime)}</span>
                              </span>
                            )}
                          </div>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(conversation.status)} uppercase tracking-wide`}>
                          {conversation.status}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 md:px-6">
                    <div className="space-y-3 md:space-y-4 min-w-0">
                      {/* Participant Info */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
                        {conversation.doctorName && (
                          <div className="flex items-center gap-2 min-w-0">
                            <Stethoscope className="h-4 w-4 text-doctor flex-shrink-0" />
                            <span className="text-xs md:text-sm font-medium truncate">Dr. {conversation.doctorName}</span>
                          </div>
                        )}
                        {conversation.patientName && (
                          <div className="flex items-center gap-2 min-w-0">
                            <User className="h-4 w-4 text-patient flex-shrink-0" />
                            <span className="text-xs md:text-sm font-medium truncate">{conversation.patientName}</span>
                          </div>
                        )}
                      </div>

                      {/* Summary */}
                      {conversation.summary && (
                        <div className="bg-muted/30 rounded-lg p-2 md:p-3 border-l-4 border-primary">
                          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                            {conversation.summary}
                          </p>
                        </div>
                      )}

                      {/* Actions/Intents */}
                      {(() => {
                        const allIntents = extractAllIntents(conversation);
                        return allIntents.length > 0 ? (
                          <div className="bg-accent/30 rounded-lg p-3 border border-border/50">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-2 rounded-full bg-primary"></div>
                              <h4 className="text-xs md:text-sm font-semibold text-foreground">
                                Actions Detected / Confidence ({allIntents.length})
                              </h4>
                            </div>
                            <IntentBadges intents={allIntents} />
                          </div>
                        ) : null;
                      })()}

                      {/* Stats */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 pt-2 border-t border-border/50 min-w-0">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted/50 text-muted-foreground text-xs font-medium border border-border/50">
                            <MessageSquare className="h-3 w-3 mr-1.5 flex-shrink-0" />
                            {conversation.totalMessageCount} msg{conversation.totalMessageCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground/70 font-mono truncate min-w-0">
                          ID: {conversation.sessionId.substring(0, 12)}...
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 