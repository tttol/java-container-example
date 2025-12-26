# Conex Infrastructure with AWS CDK

This directory contains AWS CDK code for deploying the Conex Spring Boot application to Amazon EKS.

## Architecture Overview

The infrastructure consists of 4 stacks:

1. **VpcStack** - Network infrastructure
   - VPC with public, private, and database subnets across 2 AZs
   - Internet Gateway and NAT Gateway
   - Route tables

2. **RdsStack** - Database layer
   - RDS MySQL 8.0 instance (t3.micro for development)
   - Database credentials stored in AWS Secrets Manager
   - Security group allowing access from EKS

3. **EksStack** - Kubernetes cluster
   - EKS cluster with managed node group (t3.medium, 2-4 nodes)
   - IAM roles for AWS Load Balancer Controller
   - Security group configured to access RDS

4. **ApplicationStack** - Application resources
   - ECR repository for Docker images
   - IAM Service Account for pod-level permissions
   - Permissions to access Secrets Manager and ECR

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js and npm installed
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- Docker installed (for building application images)

## Deployment Steps

### 1. Bootstrap CDK (first time only)

```bash
npx cdk bootstrap
```

### 2. Build and Deploy All Stacks

```bash
npm run build
npx cdk deploy --all
```

Or deploy stacks individually:

```bash
npx cdk deploy ConexVpcStack
npx cdk deploy ConexRdsStack
npx cdk deploy ConexEksStack
npx cdk deploy ConexApplicationStack
```

### 3. Configure kubectl

After EKS deployment, configure kubectl to access the cluster:

```bash
aws eks update-kubeconfig --name conex-cluster --region <your-region>
```

### 4. Install AWS Load Balancer Controller

```bash
helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=conex-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### 5. Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

Access ArgoCD UI:

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Get initial admin password:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

## Application Deployment

### 1. Build and Push Docker Image

```bash
cd ../app/conex
docker build -t <account-id>.dkr.ecr.<region>.amazonaws.com/conex-app:latest .
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/conex-app:latest
```

### 2. Create Kubernetes Manifests

Create deployment manifests that reference:
- ECR image URI (from ApplicationStack outputs)
- Database credentials from Secrets Manager
- Service account name: `conex-app`

### 3. Deploy via ArgoCD

Configure ArgoCD to watch your Git repository and automatically deploy changes.

## Useful CDK Commands

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and compile
- `npm run test` - Run unit tests
- `npx cdk deploy` - Deploy stacks to AWS
- `npx cdk diff` - Compare deployed stack with current state
- `npx cdk synth` - Generate CloudFormation templates
- `npx cdk destroy --all` - Delete all stacks

## Cost Optimization

This setup is configured for development/learning with minimal costs:
- RDS: t3.micro instance
- EKS: t3.medium nodes (2-4 instances)
- Single NAT Gateway

For production, consider:
- Larger instance types
- Multi-AZ RDS deployment
- Multiple NAT Gateways for HA
- Auto-scaling configurations

## Outputs

After deployment, the following outputs will be available:

- **VpcId** - The VPC ID
- **DatabaseEndpoint** - RDS endpoint
- **DatabaseSecretArn** - ARN of database credentials in Secrets Manager
- **ClusterName** - EKS cluster name
- **ECRRepositoryUri** - ECR repository URI for pushing images
- **ServiceAccountName** - Kubernetes service account name for the application

## Troubleshooting

### EKS cluster creation timeout
EKS cluster creation can take 15-20 minutes. Be patient.

### kubectl connection issues
Ensure your AWS CLI is configured with the same account/region as the deployed stack.

### RDS connection issues
Verify that the EKS security group has been added to the RDS security group ingress rules.
