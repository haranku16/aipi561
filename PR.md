# Pull Request Description

## Summary
This PR includes various infrastructure and application improvements, including:
- Dockerfile setup for Deno and AWS CDK
- Server configuration using Oak framework
- Infrastructure as Code (IaC) using AWS CDK
- Frontend configuration and static assets
- Development environment setup
- GitHub Actions workflow for automated deployment

## Changes
- Added Dockerfile with Deno and AWS CDK installation
- Configured server using Oak framework
- Set up infrastructure stacks (DynamoDB, S3, AppRunner)
- Added frontend configuration files
- Updated development environment setup
- Added necessary TypeScript configurations
- Implemented health check endpoint
- Added GitHub Actions workflow for CDK deployment (.github/workflows/deploy-cdk.yml)
  - Automated deployment on push to main branch
  - Uses Node.js 20 for deployment
  - Configures AWS credentials from GitHub secrets
  - Handles CDK stack deployment

## Testing Details
- The app is deployed and can be accessed at the health check endpoint: https://nhhprpj4yn.us-east-1.awsapprunner.com/health
- The health check endpoint returns a `{"status":"healthy"}` response
- All infrastructure components (DynamoDB, S3, AppRunner) are properly configured and deployed
- Frontend static assets and configurations are in place
- Development environment is properly set up for local testing
- GitHub Actions workflow successfully deploys the CDK stack

## Additional Notes
- The application uses a single-table design for DynamoDB
- S3 bucket is configured with appropriate bucket policies
- Infrastructure is tagged with project and environment information
- All necessary permissions and security configurations are in place
- GitHub Actions workflow uses secure credential management through GitHub secrets
- Automated deployment process ensures consistent infrastructure updates 