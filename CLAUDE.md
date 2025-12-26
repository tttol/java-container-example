# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository is a sample project for learning container applications, aimed at mastering technologies such as Amazon ECS/EKS and Argo CD.

## Project Structure

- `app/conex`: Spring Boot application source code
- `infra`: AWS CDK infrastructure code (TypeScript)

## Coding Standards

### Language Rules

- **Source Code**: All source code, including comments, must be written in English.
- **HTML/Templates**: All user-facing text in HTML templates, JSP, Thymeleaf, etc. must be written in English.
- **Documentation**: Documentation and README files should be written in English for international collaboration.

## Technology Stack

### Application
- Java 25
- Spring Boot 4.0.1
- MyBatis 4.0.0
- Thymeleaf (Template Engine)
- Gradle (using Gradle Wrapper)
- Testcontainers (Test Environment)

### Infrastructure
- AWS CDK 2.186.0 (TypeScript)
- Amazon EKS (Kubernetes 1.31)
- Amazon RDS (MySQL 8.0)
- Amazon ECR (Container Registry)
- AWS Secrets Manager
- ArgoCD (GitOps Deployment)

## Development Commands

### Build and Test

```bash
# Build the application
./app/conex/gradlew -p app/conex build

# Run tests
./app/conex/gradlew -p app/conex test

# Run a specific test class
./app/conex/gradlew -p app/conex test --tests "io.github.tttol.conex.ConexApplicationTests"

# Run a specific test method
./app/conex/gradlew -p app/conex test --tests "io.github.tttol.conex.ConexApplicationTests.contextLoads"
```

### Running the Application

```bash
# Start the Spring Boot application
./app/conex/gradlew -p app/conex bootRun
```

### Other Development Commands

```bash
# Check dependencies
./app/conex/gradlew -p app/conex dependencies

# Clean the project
./app/conex/gradlew -p app/conex clean
```

### Infrastructure Commands

```bash
# Build CDK project
cd infra && npm run build

# Deploy all stacks
cd infra && npx cdk deploy --all

# Deploy specific stack
cd infra && npx cdk deploy ConexVpcStack

# Destroy all stacks
cd infra && npx cdk destroy --all

# View CloudFormation template
cd infra && npx cdk synth

# Compare deployed stack with current state
cd infra && npx cdk diff
```

## Architecture

### Application Structure

- **Package Root**: `io.github.tttol.conex`
- **Entry Point**: `ConexApplication.java` - Standard Spring Boot application class
- **Test Configuration**: Supports integration testing environment using Testcontainers
  - `TestcontainersConfiguration.java`: Testcontainers configuration class (leveraging Spring Boot 4.0 Dev Services feature)

### Key Dependencies

- **Web**: Spring Web MVC (for RESTful API implementation)
- **Template Engine**: Thymeleaf (for dynamic HTML page generation)
- **Data Access**: MyBatis (SQL mapper framework)
- **Development Tools**: Spring Boot DevTools (hot reload support)
- **Testing**: Testcontainers (container-based testing environment)
- **Code Generation**: Lombok (reduces boilerplate code)

### Testing Strategy

This project uses Testcontainers, enabling Docker container-based testing during development. Tests are executed using JUnit 5 via `useJUnitPlatform()`.

### Infrastructure Architecture

The AWS infrastructure is defined using CDK and consists of 4 stacks:

#### 1. VpcStack (`infra/lib/vpc-stack.ts`)
- **VPC**: 10.0.0.0/16 CIDR block
- **Subnets**: Public, Private, and Database subnets across 2 Availability Zones
- **Networking**: Internet Gateway, NAT Gateway, and Route Tables
- **Purpose**: Provides network isolation and security boundaries

#### 2. RdsStack (`infra/lib/rds-stack.ts`)
- **Database**: RDS MySQL 8.0 (t3.micro instance for development)
- **Storage**: GP3 storage with auto-scaling (20GB-100GB)
- **Security**: Credentials stored in AWS Secrets Manager
- **Access Control**: Security group allowing access only from EKS cluster
- **Backup**: Daily automated backups with 1-day retention

#### 3. EksStack (`infra/lib/eks-stack.ts`)
- **Cluster**: EKS with Kubernetes 1.31
- **Node Group**: Managed node group with t3.medium instances (2-4 nodes)
- **Load Balancing**: IAM roles configured for AWS Load Balancer Controller
- **Database Access**: Security group rules to access RDS
- **Deployment**: Nodes run in private subnets for security

#### 4. ApplicationStack (`infra/lib/application-stack.ts`)
- **Container Registry**: ECR repository for Docker images
- **Service Account**: Kubernetes Service Account with IRSA (IAM Roles for Service Accounts)
- **Permissions**: Access to Secrets Manager (for DB credentials) and ECR
- **Image Management**: Lifecycle policy to retain last 10 images

#### Stack Dependencies
```
VpcStack
  ├── RdsStack (requires VPC)
  ├── EksStack (requires VPC and RDS security group)
  └── ApplicationStack (requires EKS cluster and DB secret)
```

#### Deployment Flow
1. Deploy VpcStack - Creates network infrastructure
2. Deploy RdsStack - Creates database with credentials in Secrets Manager
3. Deploy EksStack - Creates Kubernetes cluster with access to RDS
4. Deploy ApplicationStack - Creates ECR and service account with permissions
5. Install AWS Load Balancer Controller via Helm
6. Install ArgoCD for GitOps deployment
7. Build and push Docker image to ECR
8. Deploy application via ArgoCD

For detailed infrastructure setup instructions, see `infra/README.md`.
