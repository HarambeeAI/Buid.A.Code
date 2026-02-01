import { Queue, QueueEvents } from "bullmq";
import redis from "./redis";

// Queue name for analysis processing
export const ANALYSIS_QUEUE_NAME = "analysis-processing";

// Job data interface
export interface AnalysisJobData {
  analysisId: string;
}

// Create queue instance for adding jobs
export const analysisQueue = new Queue<AnalysisJobData>(ANALYSIS_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "custom",
    },
    removeOnComplete: {
      age: 24 * 60 * 60, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
    },
  },
});

// Queue events for monitoring
export const analysisQueueEvents = new QueueEvents(ANALYSIS_QUEUE_NAME, {
  connection: redis,
});

// Helper function to add an analysis job to the queue
export async function enqueueAnalysis(analysisId: string): Promise<string> {
  const job = await analysisQueue.add(
    "process-analysis",
    { analysisId },
    {
      jobId: `analysis-${analysisId}`,
    }
  );

  return job.id ?? `analysis-${analysisId}`;
}

export default analysisQueue;
