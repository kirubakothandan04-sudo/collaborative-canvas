import { YServer } from "y-partyserver";
import { routePartykitRequest } from "partyserver";

export class CollaborativeCanvas extends YServer {}

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  },
};
