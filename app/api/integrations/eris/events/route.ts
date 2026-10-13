/** POST /api/integrations/eris/events: ERIS event ingestion (requires X-Integration-Key). */
import { processErisEvent } from "@/lib/services/integration-processor-service";
import { integrationEventRoute } from "@/lib/api/integration-event-route";

export const POST = integrationEventRoute("ERIS", processErisEvent);
