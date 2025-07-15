import React from 'react';
import { Intent } from '../state/store';

interface IntentBadgesProps {
  intents: Intent[];
  className?: string;
}

const getIntentLabel = (intent: Intent): string => {
  switch (intent.type) {
    case 'medication':
      return `${intent.action || 'prescribe'} ${intent.medication?.name || 'medication'}${
        intent.medication?.dosage ? ` ${intent.medication.dosage}` : ''
      }`;
    case 'lab_order':
      return `${intent.labType || 'lab'} order${
        intent.tests && intent.tests.length > 0 ? `: ${intent.tests.join(', ')}` : ''
      }`;
    case 'appointment':
      return `${intent.appointmentType || 'schedule'} appointment${
        intent.timeframe ? ` in ${intent.timeframe}` : ''
      }`;
    case 'diagnosis':
      return `${intent.status || 'suspected'} ${intent.condition || 'condition'}`;
    case 'treatment':
      return `${intent.treatment || 'treatment'} (${intent.category || 'procedure'})`;
    case 'vital_signs':
      return `vital signs: ${Object.keys(intent.vitals || {}).join(', ')}`;
    default:
      return intent.type;
  }
};

const getIntentIcon = (intent: Intent): string => {
  switch (intent.type) {
    case 'medication':
      return '💊';
    case 'lab_order':
      return '🧪';
    case 'appointment':
      return '📅';
    case 'diagnosis':
      return '🩺';
    case 'treatment':
      return '🏥';
    case 'vital_signs':
      return '📊';
    default:
      return '📝';
  }
};

const IntentBadges: React.FC<IntentBadgesProps> = ({ intents, className = '' }) => {
  if (!intents || intents.length === 0) {
    return null;
  }

  return (
    <>
      <style>{`
        .intent-badge {
          --badge-bg: rgb(255 251 235); /* amber-50 */
          --badge-text: rgb(120 53 15); /* amber-900 */
          --badge-border: rgb(253 230 138); /* amber-200 */
          --badge-confidence: rgb(180 83 9); /* amber-700 */
        }
        
        .dark .intent-badge {
          --badge-bg: rgb(120 53 15 / 0.15); /* amber-900 with opacity */
          --badge-text: rgb(252 211 77); /* amber-300 */
          --badge-border: rgb(180 83 9 / 0.3); /* amber-700 with opacity */
          --badge-confidence: rgb(251 191 36); /* amber-400 */
        }
      `}</style>
      <div className={`flex flex-wrap gap-2 mt-2 ${className}`}>
        {intents.map((intent, index) => (
          <div
            key={index}
            className="intent-badge inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border"
            style={{
              backgroundColor: 'var(--badge-bg)',
              color: 'var(--badge-text)',
              borderColor: 'var(--badge-border)'
            }}
            title={`Confidence: ${Math.round(intent.confidence * 100)}%`}
          >
            <span className="mr-1 text-sm">{getIntentIcon(intent)}</span>
            <span className="truncate max-w-32">{getIntentLabel(intent)}</span>
            <span 
              className="ml-1 font-normal"
              style={{ color: 'var(--badge-confidence)' }}
            >
              {Math.round(intent.confidence * 100)}%
            </span>
          </div>
        ))}
      </div>
    </>
  );
};

export default IntentBadges; 