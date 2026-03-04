import { LucideIcon } from "lucide-react";
import React from "react";

export type StorageType = "local" | "custom" | "official";

export interface StorageOption {
  type: StorageType;
  name: string;
  icon: LucideIcon;
  description: string;
  pros: string[];
  cons: string[];
  warning?: string;
  info?: string;
}

interface StorageOptionSelectorProps {
  options: StorageOption[];
  selectedType: StorageType;
  onSelect: (type: StorageType) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export const StorageOptionSelector: React.FC<StorageOptionSelectorProps> = ({
  options,
  selectedType,
  onSelect,
  disabled = false,
  isLoading = false,
}) => {
  return (
    <div className="space-y-4">
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = selectedType === option.type;

        return (
          <button
            key={option.type}
            onClick={() => onSelect(option.type)}
            disabled={disabled || isLoading || isSelected}
            className={`touch-target w-full rounded-lg p-4 text-left transition-all ${
              isSelected ? "ring-2 ring-offset-2" : "hover:brightness-110"
            } ${isLoading || disabled ? "opacity-50" : ""}`}
            style={{
              backgroundColor: "var(--asph-bg-secondary)",
              border: `2px solid ${
                isSelected
                  ? "var(--asph-primary)"
                  : "var(--asph-border-primary)"
              }`,
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="rounded-lg p-2"
                style={{
                  backgroundColor: isSelected
                    ? "var(--asph-primary)"
                    : "var(--asph-bg-tertiary)",
                }}
              >
                <Icon
                  size={20}
                  style={{
                    color: isSelected ? "white" : "var(--asph-text-secondary)",
                  }}
                />
              </div>

              <div className="flex-1">
                <h3
                  className="font-medium"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {option.name}
                </h3>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  {option.description}
                </p>

                {option.warning && (
                  <div className="border-asph-error/30 bg-asph-error/10 mt-2 rounded border p-2 text-sm font-medium text-asph-error">
                    ⚠️ {option.warning}
                  </div>
                )}

                {option.info && (
                  <div className="border-asph-info/30 bg-asph-info/10 mt-2 rounded border p-2 text-sm text-asph-info">
                    ℹ️ {option.info}
                  </div>
                )}

                <div className="mt-3 flex gap-4 text-xs">
                  <div>
                    <span style={{ color: "var(--asph-text-tertiary)" }}>
                      Pros:
                    </span>
                    <ul className="mt-1 text-asph-success">
                      {option.pros.map((pro, i) => (
                        <li
                          key={`${option.type}-pro-${i}-${pro.substring(0, 10)}`}
                        >
                          • {pro}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span style={{ color: "var(--asph-text-tertiary)" }}>
                      Cons:
                    </span>
                    <ul className="mt-1 text-asph-error">
                      {option.cons.map((con, i) => (
                        <li
                          key={`${option.type}-con-${i}-${con.substring(0, 10)}`}
                          className={con.includes("PUBLIC") ? "font-bold" : ""}
                        >
                          • {con}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {isSelected && (
                <div
                  className="flex items-center gap-1 text-sm font-semibold"
                  style={{ color: "var(--asph-primary)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle
                      cx="8"
                      cy="8"
                      r="8"
                      fill="currentColor"
                      opacity="0.2"
                    />
                    <path
                      d="M12 5L6.5 10.5L4 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Active
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
