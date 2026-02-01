import "dotenv/config";
import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { ANALYSIS_QUEUE_NAME, AnalysisJobData } from "../lib/queue";

// Custom backoff delays in milliseconds (30s, 60s, 120s)
const BACKOFF_DELAYS = [30000, 60000, 120000];

// Job timeout: 10 minutes
const JOB_TIMEOUT = 10 * 60 * 1000;

// Create a dedicated Redis connection for the worker
function createWorkerRedis(): Redis {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL environment variable is not set");
  }

  return new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  });
}

// Create Prisma client for the worker
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const prisma = createPrismaClient();

/**
 * Process an analysis job
 *
 * This is the main job processor that:
 * 1. Sets the analysis status to CLASSIFYING and started_at timestamp
 * 2. Runs the analysis pipeline (implemented in future user stories)
 * 3. Updates status to COMPLETED or FAILED based on outcome
 */
async function processAnalysisJob(job: Job<AnalysisJobData>): Promise<void> {
  const { analysisId } = job.data;

  console.log(`[Worker] Starting job ${job.id} for analysis ${analysisId}`);

  // Update status to CLASSIFYING and set started_at
  const analysis = await prisma.analysis.update({
    where: { id: analysisId },
    data: {
      status: "CLASSIFYING",
      started_at: new Date(),
      current_stage: "Initializing analysis pipeline",
    },
  });

  if (!analysis) {
    throw new Error(`Analysis ${analysisId} not found`);
  }

  console.log(`[Worker] Analysis ${analysisId} set to CLASSIFYING`);

  // TODO: Implement the full analysis pipeline in future user stories (US-034 to US-038)
  // For now, we just set up the infrastructure

  // The pipeline stages will be:
  // 1. Document Normalisation (US-034)
  // 2. Page Classification (US-035)
  // 3. Matrix Analysis (US-036)
  // 4. Cross-Validation + Scoring (US-037)
  // 5. Recommendations + Completion (US-038)

  // This placeholder allows the worker infrastructure to be tested
  // The actual processing will be implemented in subsequent iterations
}

// Create the worker
const worker = new Worker<AnalysisJobData>(
  ANALYSIS_QUEUE_NAME,
  async (job) => {
    await processAnalysisJob(job);
  },
  {
    connection: createWorkerRedis(),
    concurrency: 1, // Process one job at a time
    limiter: {
      max: 10, // Max 10 jobs per minute
      duration: 60000,
    },
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        // Return delay for the next retry
        const delayIndex = Math.min(attemptsMade - 1, BACKOFF_DELAYS.length - 1);
        return BACKOFF_DELAYS[delayIndex];
      },
    },
  }
);

// Job completion handler
worker.on("completed", async (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

// Job failure handler
worker.on("failed", async (job, err) => {
  const analysisId = job?.data.analysisId;
  const attemptsMade = job?.attemptsMade ?? 0;
  const maxAttempts = 3;

  console.error(`[Worker] Job ${job?.id} failed (attempt ${attemptsMade}/${maxAttempts}):`, err.message);

  // If all retries exhausted, mark analysis as FAILED
  if (analysisId && attemptsMade >= maxAttempts) {
    console.log(`[Worker] All retries exhausted for analysis ${analysisId}, marking as FAILED`);
    try {
      await prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: "FAILED",
          current_stage: `Failed: ${err.message}`,
        },
      });
    } catch (updateErr) {
      console.error(`[Worker] Failed to update analysis status:`, updateErr);
    }
  }
});

// Worker error handler
worker.on("error", (err) => {
  console.error("[Worker] Worker error:", err);
});

// Job stalled handler (when a job exceeds the lock duration)
worker.on("stalled", (jobId) => {
  console.warn(`[Worker] Job ${jobId} has stalled`);
});

// Graceful shutdown
async function shutdown() {
  console.log("[Worker] Shutting down...");
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log(`[Worker] Analysis worker started, listening on queue: ${ANALYSIS_QUEUE_NAME}`);
console.log(`[Worker] Retry policy: 3 attempts with backoff (30s/60s/120s)`);
console.log(`[Worker] Job timeout: 10 minutes`);

export default worker;
