import { Application } from "oak";
import { errorHandler, logger } from "./middleware/index.ts";
import mapRouter from "./routes/map.ts";
import healthRouter from "./routes/health.ts";
import { PORT } from "./config/index.ts";

// Create and configure application
const app = new Application();

// Apply middleware
app.use(errorHandler);
app.use(logger);

// Apply routes
app.use(mapRouter.routes(), mapRouter.allowedMethods());
app.use(healthRouter.routes(), healthRouter.allowedMethods());

// Start server
console.log(`Server running on port ${PORT}`);
await app.listen({ port: PORT }); 