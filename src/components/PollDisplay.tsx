import { formatDistanceToNow } from "date-fns";
import { CheckCircle, Clock, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { pollService, type PollWithVotes } from "../services/poll-service";

interface PollDisplayProps {
  postUri: string;
  onVote?: (optionId: string) => void;
}

export function PollDisplay({ postUri, onVote }: PollDisplayProps) {
  const [pollData, setPollData] = useState<PollWithVotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {
    const loadPoll = async () => {
      setLoading(true);
      const data = await pollService.getPoll(postUri);
      setPollData(data);
      setLoading(false);
    };

    loadPoll();
  }, [postUri]);

  if (loading) {
    return (
      <div
        className="mt-3 animate-pulse rounded-lg border p-4"
        style={{ borderColor: "var(--asph-border-primary)" }}
      >
        <div
          className="mb-3 h-4 w-1/3 rounded"
          style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
        />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={`poll-skeleton-${i}`}
              className="h-10 rounded-lg"
              style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!pollData) {
    return null;
  }

  const { poll, votes, totalVotes, userVote, isEnded } = pollData;
  const hasVoted = !!userVote;
  const showResults = hasVoted || isEnded;

  const handleVote = async (optionId: string) => {
    if (hasVoted || isEnded || voting) return;

    setVoting(true);
    setSelectedOption(optionId);

    const success = await pollService.vote(pollData.uri, optionId);

    if (success) {
      setPollData((prev) =>
        prev
          ? {
              ...prev,
              userVote: optionId,
              votes: {
                ...prev.votes,
                [optionId]: (prev.votes[optionId] || 0) + 1,
              },
              totalVotes: prev.totalVotes + 1,
            }
          : null,
      );
      onVote?.(optionId);
    }

    setVoting(false);
  };

  const getPercentage = (optionId: string): number => {
    if (totalVotes === 0) return 0;
    return Math.round(((votes[optionId] || 0) / totalVotes) * 100);
  };

  const getTimeRemaining = (): string => {
    if (isEnded) return "Poll ended";
    return formatDistanceToNow(new Date(poll.endsAt), { addSuffix: true });
  };

  return (
    <div
      className="mt-3 rounded-lg border p-3"
      style={{
        backgroundColor: "var(--asph-bg-secondary)",
        borderColor: "var(--asph-border-primary)",
      }}
    >
      <div className="space-y-2">
        {poll.options.map((option) => {
          const percentage = getPercentage(option.id);
          const isSelected =
            userVote === option.id || selectedOption === option.id;
          const isWinning =
            showResults &&
            percentage ===
              Math.max(...poll.options.map((o) => getPercentage(o.id))) &&
            percentage > 0;

          return (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              disabled={hasVoted || isEnded || voting}
              className={`relative w-full overflow-hidden rounded-lg border p-3 text-left transition-all ${
                !showResults
                  ? "hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  : ""
              } ${isSelected ? "border-blue-500" : ""}`}
              style={{
                borderColor: isSelected
                  ? undefined
                  : "var(--asph-border-primary)",
              }}
            >
              {showResults && (
                <div
                  className="absolute inset-0 transition-all"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: isWinning
                      ? "var(--asph-primary)"
                      : "var(--asph-bg-tertiary)",
                    opacity: 0.2,
                  }}
                />
              )}

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isSelected && (
                    <CheckCircle size={16} className="text-blue-500" />
                  )}
                  <span
                    className={`text-sm ${isWinning ? "font-medium" : ""}`}
                    style={{ color: "var(--asph-text-primary)" }}
                  >
                    {option.text}
                  </span>
                </div>

                {showResults && (
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    {percentage}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div
        className="mt-3 flex items-center gap-3 text-xs"
        style={{ color: "var(--asph-text-tertiary)" }}
      >
        <span className="flex items-center gap-1">
          <Users size={12} />
          {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {getTimeRemaining()}
        </span>
      </div>
    </div>
  );
}
