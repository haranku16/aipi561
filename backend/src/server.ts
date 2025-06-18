import { Application } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { errorHandler, logger, authMiddleware } from "./middleware/index.ts";
import authRouter from "./routes/auth.ts";
import photosRouter from "./routes/photos.ts";
import healthRouter from "./routes/health.ts";
import { PORT, testAWSCredentials } from "./config/index.ts";
import { ServiceFactory } from "./config/service-factory.ts";

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

// Test AWS credentials before starting
console.log("Testing AWS credentials...");
try {
  await testAWSCredentials();
} catch (error) {
  console.error("Failed to verify AWS credentials. The application may not work properly.");
  // Don't throw here - let the server start and see if it works anyway
}

// Initialize services and queue listener for background processing
const { queueProcessor } = ServiceFactory.createServices();
await queueProcessor.setupQueueListener();

// Start server
console.log(`Server running on port ${PORT}`);
await app.listen({ port: PORT }); 