/** POST /api/integrations/mentormaze/events: MentorMaze event ingestion (requires X-Integration-Key). */
import { processMentorMazeEvent } from "@/lib/services/integration-processor-service";
import { integrationEventRoute } from "@/lib/api/integration-event-route";

export const POST = integrationEventRoute("MentorMaze", processMentorMazeEvent);
