import { Router } from "oak";
import { HealthResponse } from "../types/index.ts";

const router = new Router({ prefix: "/health" });

router.get("/", (ctx) => {
  const response: HealthResponse = { status: "healthy" };
  ctx.response.body = response;
});

export default router; 