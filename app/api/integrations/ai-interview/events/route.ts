/** POST /api/integrations/ai-interview/events: AI Interview event ingestion (requires X-Integration-Key). */
import { processAiInterviewEvent } from "@/lib/services/integration-processor-service";
import { integrationEventRoute } from "@/lib/api/integration-event-route";

export const POST = integrationEventRoute("AI Interview", processAiInterviewEvent);
