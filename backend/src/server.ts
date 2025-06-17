import { Application } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { errorHandler, logger, authMiddleware } from "./middleware/index.ts";
import authRouter from "./routes/auth.ts";
import photosRouter from "./routes/photos.ts";
import healthRouter from "./routes/health.ts";
import { PORT } from "./config/index.ts";
import { setupQueueListener } from "./services/queue-processor.ts";

// Create and configure application
const app = new Application();

// Apply middleware
app.use(errorHandler);
app.use(logger);
app.use(authMiddleware);

// Apply routes
app.use(authRouter.routes(), authRouter.allowedMethods());
app.use(photosRouter.routes(), photosRouter.allowedMethods());
app.use(healthRouter.routes(), healthRouter.allowedMethods());

// Initialize queue listener for background processing
await setupQueueListener();

// Start server
console.log(`Server running on port ${PORT}`);
await app.listen({ port: PORT }); 