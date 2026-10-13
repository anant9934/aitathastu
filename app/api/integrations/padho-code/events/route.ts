/** POST /api/integrations/padho-code/events: Padho Code event ingestion (requires X-Integration-Key). */
import { processPadhoCodeEvent } from "@/lib/services/integration-processor-service";
import { integrationEventRoute } from "@/lib/api/integration-event-route";

export const POST = integrationEventRoute("Padho Code", processPadhoCodeEvent);
