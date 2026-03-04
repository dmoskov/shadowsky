import { ArrowRight, Check } from "lucide-react";
import React, { useState } from "react";
import {
  TOPIC_CATEGORIES,
  TopicCategory,
} from "../../services/onboarding-service";

interface TopicsScreenProps {
  initialSelected?: string[];
  onContinue: (selectedTopics: string[]) => void;
  onBack: () => void;
  onSkip: () => void;
}

export const TopicsScreen: React.FC<TopicsScreenProps> = ({
  initialSelected = [],
  onContinue,
  onBack,
  onSkip,
}) => {
  const [selectedTopics, setSelectedTopics] =
    useState<string[]>(initialSelected);

  const toggleTopic = (topicId: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId)
        ? prev.filter((id) => id !== topicId)
        : [...prev, topicId],
    );
  };

  const handleContinue = () => {
    onContinue(selectedTopics);
  };

  return (
    <div
      className="flex min-h-screen flex-col px-4 py-8"
      style={{ background: "var(--asph-bg-primary)" }}
    >
      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1
            className="mb-2 text-3xl font-bold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            What interests you?
          </h1>
          <p
            className="text-lg"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Select topics to personalize your feed and discover relevant content
          </p>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            {selectedTopics.length > 0
              ? `${selectedTopics.length} topic${selectedTopics.length !== 1 ? "s" : ""} selected`
              : "Select at least one topic to continue"}
          </p>
        </div>

        {/* Topics Grid */}
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOPIC_CATEGORIES.map((topic: TopicCategory) => {
            const isSelected = selectedTopics.includes(topic.id);
            return (
              <button
                key={topic.id}
                onClick={() => toggleTopic(topic.id)}
                className="touch-target asph-card relative flex flex-col items-start p-4 text-left transition-all hover:shadow-md"
                style={{
                  background: isSelected
                    ? "var(--asph-primary-transparent)"
                    : "var(--asph-bg-secondary)",
                  border: isSelected
                    ? "2px solid var(--asph-primary)"
                    : "2px solid transparent",
                }}
              >
                {isSelected && (
                  <div
                    className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full"
                    style={{ backgroundColor: "var(--asph-primary)" }}
                  >
                    <Check size={16} style={{ color: "white" }} />
                  </div>
                )}
                <div className="mb-2 text-3xl">{topic.icon}</div>
                <h3
                  className="mb-1 font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  {topic.name}
                </h3>
                <p
                  className="text-sm"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  {topic.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            onClick={onBack}
            className="touch-target-sm rounded-xl px-6 py-3 font-medium transition-all hover:opacity-80"
            style={{
              color: "var(--asph-text-secondary)",
              border: "1px solid var(--asph-border-primary)",
            }}
          >
            Back
          </button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onSkip}
              className="touch-target-sm rounded-xl px-6 py-3 font-medium transition-all hover:opacity-80"
              style={{
                color: "var(--asph-text-secondary)",
                border: "1px solid var(--asph-border-primary)",
              }}
            >
              Skip
            </button>
            <button
              onClick={handleContinue}
              disabled={selectedTopics.length === 0}
              className="touch-target-sm asph-button-primary flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
