import React from 'react';

interface LanguageToggleProps {
  isDoctorSpanish: boolean;
  onToggle: (isDoctorSpanish: boolean) => void;
  disabled?: boolean;
}

export function LanguageToggle({ isDoctorSpanish, onToggle, disabled = false }: LanguageToggleProps) {
  return (
    <div className="bg-muted rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-foreground font-medium">Language Configuration</h3>
        <button
          onClick={() => !disabled && onToggle(!isDoctorSpanish)}
          disabled={disabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            disabled 
              ? 'bg-muted-foreground/20 cursor-not-allowed opacity-50' 
              : isDoctorSpanish 
                ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600' 
                : 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isDoctorSpanish ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className={`${disabled ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>👩‍⚕️ Doctor:</span>
          <span className={`font-medium ${
            disabled 
              ? 'text-muted-foreground/60' 
              : isDoctorSpanish 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-green-600 dark:text-green-400'
          }`}>
            {isDoctorSpanish ? '🇪🇸 Spanish' : '🇺🇸 English'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`${disabled ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>🧑‍🦱 Patient:</span>
          <span className={`font-medium ${
            disabled 
              ? 'text-muted-foreground/60' 
              : isDoctorSpanish 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-blue-600 dark:text-blue-400'
          }`}>
            {isDoctorSpanish ? '🇺🇸 English' : '🇪🇸 Spanish'}
          </span>
        </div>
      </div>
      
      <div className={`mt-3 text-xs ${disabled ? 'text-muted-foreground/40' : 'text-muted-foreground/80'}`}>
        {disabled ? 'Language locked during conversation' : 'Click toggle to switch language assignments'}
      </div>
    </div>
  );
} 