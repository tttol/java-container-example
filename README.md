# About this repository
This repository is an example application for learning containerized applications. I want to learn the following technical skills:
- Amazon ECS/EKS
- Argo CD

# Architecture

```mermaid
graph TB
    subgraph Internet
        User[User/Browser]
    end

    subgraph AWS["AWS Cloud"]
        subgraph VPC["VPC (10.0.0.0/16)"]
            IGW[Internet Gateway]

            subgraph PublicSubnet["Public Subnet (10.0.0.0/24)"]
                NAT[NAT Gateway]
                ALB[Application Load Balancer]
            end

            subgraph PrivateSubnet["Private Subnet (10.0.1.0/24)"]
                subgraph EKS["EKS Cluster (conex-cluster)<br/>Kubernetes 1.31"]
                    subgraph NodeGroup["Node Group (t3.small x1)"]
                        subgraph ArgoCDNS["Namespace: argocd"]
                            ArgoCDServer[ArgoCD Server]
                            ArgoCDRepo[ArgoCD Repo Server]
                            ArgoCDController[ArgoCD App Controller]
                        end

                        subgraph DefaultNS["Namespace: default"]
                            SpringBoot1[SpringBoot App Pod 1]
                            SpringBoot2[SpringBoot App Pod 2]
                        end
                    end
                end
            end

            subgraph DatabaseSubnet["Database Subnet (10.0.2.0/24)"]
                RDS[(RDS MySQL 8.0<br/>t3.micro)]
            end
        end

        ECR[ECR Repository<br/>conex-app]
        SecretsManager[Secrets Manager<br/>DB Credentials]
    end

    subgraph GitRepo["Git Repository"]
        AppManifests[Kubernetes Manifests<br/>Deployment/Service/Ingress]
    end

    User -->|HTTPS| IGW
    IGW --> ALB
    ALB -->|Route traffic| SpringBoot1
    ALB -->|Route traffic| SpringBoot2

    SpringBoot1 -->|Query| RDS
    SpringBoot2 -->|Query| RDS
    SpringBoot1 -->|Get credentials| SecretsManager
    SpringBoot2 -->|Get credentials| SecretsManager

    NodeGroup -->|Pull image| ECR
    NAT -->|Outbound| IGW
    NodeGroup -.->|via NAT| NAT

    ArgoCDRepo -->|Watch| AppManifests
    ArgoCDController -->|Deploy| SpringBoot1
    ArgoCDController -->|Deploy| SpringBoot2

    RDS -.->|Credentials stored| SecretsManager

    classDef aws fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:#232F3E
    classDef k8s fill:#326CE5,stroke:#fff,stroke-width:2px,color:#fff
    classDef app fill:#6DB33F,stroke:#fff,stroke-width:2px,color:#fff
    classDef db fill:#527FFF,stroke:#fff,stroke-width:2px,color:#fff
    classDef argocd fill:#EF7B4D,stroke:#fff,stroke-width:2px,color:#fff

    class VPC,ECR,SecretsManager,ALB,NAT,IGW aws
    class EKS,NodeGroup k8s
    class SpringBoot1,SpringBoot2 app
    class RDS db
    class ArgoCDServer,ArgoCDRepo,ArgoCDController argocd
```

## Architecture Components

### Network Layer (VPC Stack)
- **VPC**: 10.0.0.0/16 CIDR block across 1 Availability Zone
- **Public Subnet**: Hosts NAT Gateway and Application Load Balancer
- **Private Subnet**: Hosts EKS worker nodes with egress via NAT Gateway
- **Database Subnet**: Isolated subnet for RDS instance

### Database Layer (RDS Stack)
- **RDS MySQL 8.0**: t3.micro instance in isolated subnet
- **Secrets Manager**: Stores database credentials securely
- **Storage**: 20GB with auto-scaling up to 30GB (GP3)
- **Backup**: Disabled for cost optimization

### Container Orchestration (EKS Stack)
- **EKS Control Plane**: Managed Kubernetes 1.31
- **Node Group**: 1x t3.small instance (min: 1, max: 2)
- **Security**: Nodes in private subnet, controlled access to RDS

### Application Layer (Application Stack)
- **ECR Repository**: Stores Docker images with lifecycle policy (keep last 5 images)
- **Service Account**: IRSA-enabled account with access to Secrets Manager and ECR
- **ArgoCD**: GitOps deployment tool running in argocd namespace
- **SpringBoot App**: Java application running in default namespace

### Traffic Flow
1. User accesses application via Internet Gateway
2. Application Load Balancer routes traffic to SpringBoot pods
3. SpringBoot pods retrieve DB credentials from Secrets Manager
4. SpringBoot pods query RDS MySQL database
5. ArgoCD watches Git repository and deploys application updates

# Project Structure
This repository has two directories.
1. `app`: Application source code.
2. `infra`: CDK source code.


