/** POST /api/integrations/study-lpu/events: Study LPU event ingestion (requires X-Integration-Key). */
import { processStudyLpuEvent } from "@/lib/services/integration-processor-service";
import { integrationEventRoute } from "@/lib/api/integration-event-route";

export const POST = integrationEventRoute("Study LPU", processStudyLpuEvent);
