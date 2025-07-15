import OpenAI from "openai";
import { SpeakerType } from "../models";

// Base interface for all intents
export interface BaseIntent {
  type: string;
  confidence: number;
  extractedAt: Date;
  metadata?: Record<string, any>;
}

// Specific intent types
export interface MedicationIntent extends BaseIntent {
  type: "medication";
  medication: {
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    route?: string; // oral, injection, topical, etc.
  };
  action: "prescribe" | "discontinue" | "modify" | "refill";
}

export interface LabOrderIntent extends BaseIntent {
  type: "lab_order";
  labType: string;
  tests: string[];
  urgency?: "routine" | "urgent" | "stat";
  instructions?: string;
}

export interface AppointmentIntent extends BaseIntent {
  type: "appointment";
  appointmentType: "schedule" | "reschedule" | "cancel";
  timeframe?: string;
  specialty?: string;
  reason?: string;
}

export interface DiagnosisIntent extends BaseIntent {
  type: "diagnosis";
  condition: string;
  severity?: "mild" | "moderate" | "severe";
  status: "suspected" | "confirmed" | "ruled_out";
}

export interface TreatmentIntent extends BaseIntent {
  type: "treatment";
  treatment: string;
  category: "procedure" | "therapy" | "referral" | "lifestyle";
  details?: string;
}

export interface VitalSignsIntent extends BaseIntent {
  type: "vital_signs";
  vitals: {
    bloodPressure?: { systolic: number; diastolic: number };
    heartRate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };
  unit?: "metric" | "imperial";
}

// Union type for all possible intents
export type Intent =
  | MedicationIntent
  | LabOrderIntent
  | AppointmentIntent
  | DiagnosisIntent
  | TreatmentIntent
  | VitalSignsIntent;

// Configuration for intent recognition
export interface IntentRecognitionConfig {
  enabledIntents: string[];
  confidenceThreshold: number;
  maxIntentsPerMessage: number;
}

// OpenAI function schema for intent recognition
const intentRecognitionSchema = {
  name: "extract_medical_intents",
  description:
    "Extract structured medical intents and actions from doctor-patient conversations",
  parameters: {
    type: "object",
    properties: {
      intents: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "medication",
                "lab_order",
                "appointment",
                "diagnosis",
                "treatment",
                "vital_signs",
              ],
              description: "The type of medical intent detected",
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Confidence score for this intent extraction",
            },
            data: {
              type: "object",
              description: "Intent-specific structured data",
              properties: {
                // Medication-specific fields
                medication: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    dosage: { type: "string" },
                    frequency: { type: "string" },
                    duration: { type: "string" },
                    route: { type: "string" },
                  },
                },
                action: {
                  type: "string",
                  enum: ["prescribe", "discontinue", "modify", "refill"],
                },
                // Lab order fields
                labType: { type: "string" },
                tests: {
                  type: "array",
                  items: { type: "string" },
                },
                urgency: {
                  type: "string",
                  enum: ["routine", "urgent", "stat"],
                },
                instructions: { type: "string" },
                // Appointment fields
                appointmentType: {
                  type: "string",
                  enum: ["schedule", "reschedule", "cancel"],
                },
                timeframe: { type: "string" },
                specialty: { type: "string" },
                reason: { type: "string" },
                // Diagnosis fields
                condition: { type: "string" },
                severity: {
                  type: "string",
                  enum: ["mild", "moderate", "severe"],
                },
                status: {
                  type: "string",
                  enum: ["suspected", "confirmed", "ruled_out"],
                },
                // Treatment fields
                treatment: { type: "string" },
                category: {
                  type: "string",
                  enum: ["procedure", "therapy", "referral", "lifestyle"],
                },
                details: { type: "string" },
                // Vital signs fields
                vitals: {
                  type: "object",
                  properties: {
                    bloodPressure: {
                      type: "object",
                      properties: {
                        systolic: { type: "number" },
                        diastolic: { type: "number" },
                      },
                    },
                    heartRate: { type: "number" },
                    temperature: { type: "number" },
                    weight: { type: "number" },
                    height: { type: "number" },
                    respiratoryRate: { type: "number" },
                    oxygenSaturation: { type: "number" },
                  },
                },
                unit: {
                  type: "string",
                  enum: ["metric", "imperial"],
                },
              },
            },
          },
          required: ["type", "confidence", "data"],
        },
      },
    },
    required: ["intents"],
  },
};

export class IntentRecognitionService {
  private openai: OpenAI;
  private config: IntentRecognitionConfig;

  constructor(openai: OpenAI, config?: Partial<IntentRecognitionConfig>) {
    this.openai = openai;
    this.config = {
      enabledIntents: [
        "medication",
        "lab_order",
        "appointment",
        "diagnosis",
        "treatment",
        "vital_signs",
      ],
      confidenceThreshold: 0.7,
      maxIntentsPerMessage: 3,
      ...config,
    };
  }

  /**
   * Extract intents from a medical conversation message
   */
  async extractIntents(
    originalText: string,
    translatedText: string,
    speaker: SpeakerType,
    conversationContext?: string[]
  ): Promise<Intent[]> {
    try {
      // Only process doctor messages for now, as they typically contain actionable intents
      if (speaker !== "doctor") {
        return [];
      }

      // Prepare the context for better intent recognition
      const context = conversationContext
        ? `Previous conversation context:\n${conversationContext.join(
            "\n"
          )}\n\n`
        : "";

      const prompt = `${context}Analyze the following medical conversation message and extract any structured intents or actions:

Original text: "${originalText}"
Translated text: "${translatedText}"
Speaker: ${speaker}

Extract medical intents such as:
- Medication prescriptions, modifications, or discontinuations
- Lab orders and test requests
- Appointment scheduling or changes
- Diagnoses (suspected, confirmed, or ruled out)
- Treatment plans or procedures
- Vital signs measurements

Only extract intents that are clearly actionable and have sufficient detail. Be conservative with confidence scores.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a medical intent extraction system. Extract structured medical intents from doctor-patient conversations. 
            
            Focus on actionable items that a doctor might say, such as:
            - "I'm prescribing you amoxicillin 500mg twice daily for 10 days"
            - "Let's order a CBC and basic metabolic panel"
            - "I want to schedule you for a follow-up in 2 weeks"
            - "Based on your symptoms, I suspect you have pneumonia"
            - "I recommend physical therapy for your back pain"
            
            Only extract intents with high confidence when the text clearly indicates an action or decision.
            Set confidence lower for ambiguous or conversational statements.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        functions: [intentRecognitionSchema],
        function_call: { name: "extract_medical_intents" },
        temperature: 0.2,
        max_tokens: 1000,
      });

      const functionCall = response.choices[0]?.message?.function_call;
      if (!functionCall || !functionCall.arguments) {
        console.log(`[IntentRecognition] No function call response received`);
        return [];
      }

      const result = JSON.parse(functionCall.arguments);
      const extractedIntents: Intent[] = [];

      // Process each extracted intent
      for (const intentData of result.intents) {
        if (intentData.confidence < this.config.confidenceThreshold) {
          console.log(
            `[IntentRecognition] Intent below confidence threshold: ${intentData.type} (${intentData.confidence})`
          );
          continue;
        }

        if (!this.config.enabledIntents.includes(intentData.type)) {
          console.log(
            `[IntentRecognition] Intent type not enabled: ${intentData.type}`
          );
          continue;
        }

        // Create the intent object based on type
        const intent = this.createIntentFromData(intentData);
        if (intent) {
          extractedIntents.push(intent);
        }

        // Limit number of intents per message
        if (extractedIntents.length >= this.config.maxIntentsPerMessage) {
          break;
        }
      }

      console.log(
        `[IntentRecognition] Extracted ${extractedIntents.length} intents from message`
      );
      return extractedIntents;
    } catch (error) {
      console.error(`[IntentRecognition] Error extracting intents:`, error);
      return [];
    }
  }

  /**
   * Create a typed intent object from the extracted data
   */
  private createIntentFromData(intentData: any): Intent | null {
    const baseIntent = {
      confidence: intentData.confidence,
      extractedAt: new Date(),
      metadata: intentData.metadata || {},
    };

    switch (intentData.type) {
      case "medication":
        return {
          ...baseIntent,
          type: "medication",
          medication: intentData.data.medication || {},
          action: intentData.data.action || "prescribe",
        } as MedicationIntent;

      case "lab_order":
        return {
          ...baseIntent,
          type: "lab_order",
          labType: intentData.data.labType || "unknown",
          tests: intentData.data.tests || [],
          urgency: intentData.data.urgency,
          instructions: intentData.data.instructions,
        } as LabOrderIntent;

      case "appointment":
        return {
          ...baseIntent,
          type: "appointment",
          appointmentType: intentData.data.appointmentType || "schedule",
          timeframe: intentData.data.timeframe,
          specialty: intentData.data.specialty,
          reason: intentData.data.reason,
        } as AppointmentIntent;

      case "diagnosis":
        return {
          ...baseIntent,
          type: "diagnosis",
          condition: intentData.data.condition || "unknown",
          severity: intentData.data.severity,
          status: intentData.data.status || "suspected",
        } as DiagnosisIntent;

      case "treatment":
        return {
          ...baseIntent,
          type: "treatment",
          treatment: intentData.data.treatment || "unknown",
          category: intentData.data.category || "procedure",
          details: intentData.data.details,
        } as TreatmentIntent;

      case "vital_signs":
        return {
          ...baseIntent,
          type: "vital_signs",
          vitals: intentData.data.vitals || {},
          unit: intentData.data.unit || "metric",
        } as VitalSignsIntent;

      default:
        console.log(
          `[IntentRecognition] Unknown intent type: ${intentData.type}`
        );
        return null;
    }
  }

  /**
   * Get a summary of intents for a conversation
   */
  async summarizeIntents(intents: Intent[]): Promise<string> {
    if (intents.length === 0) {
      return "No actionable intents detected in this conversation.";
    }

    const intentSummary = intents
      .map((intent: any) => {
        switch (intent.type) {
          case "medication":
            return `Medication: ${intent.action} ${intent.medication.name}${
              intent.medication.dosage ? ` ${intent.medication.dosage}` : ""
            }`;
          case "lab_order":
            return `Lab Order: ${intent.labType} - ${intent.tests.join(", ")}`;
          case "appointment":
            return `Appointment: ${intent.appointmentType}${
              intent.timeframe ? ` in ${intent.timeframe}` : ""
            }`;
          case "diagnosis":
            return `Diagnosis: ${intent.status} ${intent.condition}`;
          case "treatment":
            return `Treatment: ${intent.treatment} (${intent.category})`;
          case "vital_signs":
            return `Vital Signs: ${Object.keys(intent.vitals).join(", ")}`;
          default:
            return `${intent.type}: detected`;
        }
      })
      .join("; ");

    return intentSummary;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<IntentRecognitionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export default IntentRecognitionService;
