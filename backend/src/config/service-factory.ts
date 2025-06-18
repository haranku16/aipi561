import { EnvironmentConfig, createEnvironmentConfig } from "./environment.ts";
import { createAWSClients } from "./aws-clients.ts";
import { AuthService, IAuthService } from "../services/auth.ts";
import { PhotosService, IPhotosService } from "../services/photos.ts";
import { QueueProcessor, IQueueProcessor } from "../services/queue-processor.ts";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface ServiceContainer {
  authService: IAuthService;
  photosService: IPhotosService;
  queueProcessor: IQueueProcessor;
}

export class ServiceFactory {
  private static instance: ServiceContainer | null = null;

  static createServices(config?: EnvironmentConfig): ServiceContainer {
    if (this.instance && !config) {
      return this.instance;
    }

    const envConfig = config || createEnvironmentConfig();
    const { dynamoClient, s3Client } = createAWSClients(envConfig.awsRegion);

    const authService = new AuthService(envConfig);
    const queueProcessor = new QueueProcessor(envConfig, dynamoClient, s3Client);
    const photosService = new PhotosService(envConfig, dynamoClient, s3Client, queueProcessor, getSignedUrl);

    this.instance = {
      authService,
      photosService,
      queueProcessor,
    };

    return this.instance;
  }

  static reset(): void {
    this.instance = null;
  }
} 