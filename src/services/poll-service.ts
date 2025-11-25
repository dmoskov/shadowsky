import type { BskyAgent } from "@atproto/api";
import type { PollData } from "../components/PollComposer";
import { createLogger } from "../utils/logger";

const logger = createLogger("PollService");

const POLL_COLLECTION = "com.shadowsky.poll";
const VOTE_COLLECTION = "com.shadowsky.pollvote";

export interface PollRecord {
  $type: "com.shadowsky.poll";
  postUri: string;
  question: string;
  options: Array<{
    id: string;
    text: string;
  }>;
  durationHours: number;
  createdAt: string;
  endsAt: string;
}

export interface PollVoteRecord {
  $type: "com.shadowsky.pollvote";
  pollUri: string;
  optionId: string;
  votedAt: string;
}

export interface PollWithVotes {
  uri: string;
  poll: PollRecord;
  votes: Record<string, number>;
  totalVotes: number;
  userVote?: string;
  isEnded: boolean;
}

class PollService {
  private agent: BskyAgent | null = null;

  setAgent(agent: BskyAgent | null) {
    this.agent = agent;
  }

  async createPoll(
    postUri: string,
    question: string,
    pollData: PollData,
  ): Promise<string | null> {
    if (!this.agent) {
      logger.error("No agent available for creating poll");
      return null;
    }

    try {
      const now = new Date();
      const endsAt = new Date(
        now.getTime() + pollData.durationHours * 60 * 60 * 1000,
      );

      const record: PollRecord = {
        $type: "com.shadowsky.poll",
        postUri,
        question,
        options: pollData.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
        })),
        durationHours: pollData.durationHours,
        createdAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
      };

      const rkey = postUri.split("/").pop() || Date.now().toString();

      const result = await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session?.did || "",
        collection: POLL_COLLECTION,
        rkey,
        record,
      });

      logger.log("Poll created:", result.data.uri);
      return result.data.uri;
    } catch (error) {
      logger.error("Failed to create poll:", error);
      return null;
    }
  }

  async getPoll(postUri: string): Promise<PollWithVotes | null> {
    if (!this.agent) {
      return null;
    }

    try {
      const rkey = postUri.split("/").pop();
      if (!rkey) return null;

      const authorDid = postUri.split("/")[2];
      if (!authorDid) return null;

      const result = await this.agent.com.atproto.repo.getRecord({
        repo: authorDid,
        collection: POLL_COLLECTION,
        rkey,
      });

      if (!result.data.value) return null;

      const poll = result.data.value as PollRecord;
      const votes = await this.getVotes(result.data.uri);
      const userVote = await this.getUserVote(result.data.uri);
      const isEnded = new Date(poll.endsAt) < new Date();

      return {
        uri: result.data.uri,
        poll,
        votes,
        totalVotes: Object.values(votes).reduce((a, b) => a + b, 0),
        userVote: userVote?.optionId,
        isEnded,
      };
    } catch (error) {
      // Poll not found is expected for posts without polls
      return null;
    }
  }

  async vote(pollUri: string, optionId: string): Promise<boolean> {
    if (!this.agent) {
      logger.error("No agent available for voting");
      return false;
    }

    try {
      const existingVote = await this.getUserVote(pollUri);
      if (existingVote) {
        logger.log("User already voted");
        return false;
      }

      const record: PollVoteRecord = {
        $type: "com.shadowsky.pollvote",
        pollUri,
        optionId,
        votedAt: new Date().toISOString(),
      };

      const rkey = `${pollUri.split("/").pop()}_${Date.now()}`;

      await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session?.did || "",
        collection: VOTE_COLLECTION,
        rkey,
        record,
      });

      logger.log("Vote recorded");
      return true;
    } catch (error) {
      logger.error("Failed to vote:", error);
      return false;
    }
  }

  private async getVotes(pollUri: string): Promise<Record<string, number>> {
    // Note: In a real implementation, this would query an aggregation service
    // For now, we'll return empty votes as we can't easily aggregate AT Protocol records
    // A proper implementation would need a separate backend service to aggregate votes
    return {};
  }

  private async getUserVote(pollUri: string): Promise<PollVoteRecord | null> {
    if (!this.agent || !this.agent.session?.did) {
      return null;
    }

    try {
      const result = await this.agent.com.atproto.repo.listRecords({
        repo: this.agent.session.did,
        collection: VOTE_COLLECTION,
        limit: 100,
      });

      const vote = result.data.records.find((record) => {
        const value = record.value as PollVoteRecord;
        return value.pollUri === pollUri;
      });

      return vote ? (vote.value as PollVoteRecord) : null;
    } catch (error) {
      return null;
    }
  }
}

export const pollService = new PollService();
