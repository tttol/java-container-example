# Conex Infrastructure with AWS CDK

This directory contains AWS CDK code for deploying the Conex Spring Boot application to Amazon EKS.

## Architecture Overview

<img width="834" height="762" alt="スクリーンショット 2025-12-31 6 22 54" src="https://github.com/user-attachments/assets/b95fdc4a-f55d-4ee6-91ee-eb30ad3954cb" />
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

Create a `k8s` directory in your project root and add the following manifests:

```bash
mkdir -p k8s
```

#### a) Deployment (k8s/deployment.yaml)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: conex-app
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: conex-app
  template:
    metadata:
      labels:
        app: conex-app
    spec:
      serviceAccountName: conex-app
      containers:
      - name: conex-app
        image: <account-id>.dkr.ecr.<region>.amazonaws.com/conex-app:latest
        ports:
        - containerPort: 8080
        env:
        - name: SPRING_DATASOURCE_URL
          value: jdbc:mysql://<rds-endpoint>:3306/conex
        - name: SPRING_DATASOURCE_USERNAME
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: username
        - name: SPRING_DATASOURCE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 5
```

#### b) Service (k8s/service.yaml)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: conex-app-service
  namespace: default
spec:
  type: LoadBalancer
  selector:
    app: conex-app
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
```

#### c) Ingress (k8s/ingress.yaml) - Optional, for ALB

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: conex-app-ingress
  namespace: default
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /actuator/health
spec:
  ingressClassName: alb
  rules:
  - http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: conex-app-service
            port:
              number: 80
```

### 3. Create Kubernetes Secret for Database Credentials

Create a Kubernetes Secret from AWS Secrets Manager credentials:

```bash
# Get database secret ARN from CDK outputs
DB_SECRET_ARN="<database-secret-arn>"

# Extract credentials from Secrets Manager
DB_USERNAME=$(aws secretsmanager get-secret-value --secret-id $DB_SECRET_ARN --query 'SecretString' --output text | jq -r .username)
DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id $DB_SECRET_ARN --query 'SecretString' --output text | jq -r .password)

# Create Kubernetes Secret
kubectl create secret generic db-credentials \
  --from-literal=username=$DB_USERNAME \
  --from-literal=password=$DB_PASSWORD \
  --namespace=default
```

**Alternative: Using External Secrets Operator (Recommended for Production)**

Install External Secrets Operator:

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace
```

Create External Secret manifest (k8s/external-secret.yaml):

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secretsmanager
  namespace: default
spec:
  provider:
    aws:
      service: SecretsManager
      region: <your-region>
      auth:
        jwt:
          serviceAccountRef:
            name: conex-app
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: default
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secretsmanager
    kind: SecretStore
  target:
    name: db-credentials
  data:
  - secretKey: username
    remoteRef:
      key: <database-secret-arn>
      property: username
  - secretKey: password
    remoteRef:
      key: <database-secret-arn>
      property: password
```

### 4. Push Manifests to Git Repository

```bash
git add k8s/
git commit -m "Add Kubernetes manifests for conex-app"
git push origin main
```

### 5. Deploy via ArgoCD

#### Create ArgoCD Application

**Method A: Using ArgoCD CLI**

```bash
# Install ArgoCD CLI
brew install argocd

# Login to ArgoCD
ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
kubectl port-forward svc/argocd-server -n argocd 8080:443 &
argocd login localhost:8080 --username admin --password $ARGOCD_PASSWORD --insecure

# Create Application
argocd app create conex-app \
  --repo https://github.com/<your-username>/java-container-example.git \
  --path k8s \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace default \
  --sync-policy automated \
  --auto-prune \
  --self-heal
```

**Method B: Using Application YAML (Recommended)**

Create `k8s/argocd-application.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: conex-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/<your-username>/java-container-example.git
    targetRevision: main
    path: k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

Apply the Application:

```bash
kubectl apply -f k8s/argocd-application.yaml
```

#### Verify Deployment in ArgoCD

**Using ArgoCD UI:**

```bash
# Port forward to ArgoCD server
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Open browser to https://localhost:8080
# Username: admin
# Password: (from step 5 above)
```

In the UI, you can:
- View application sync status (Synced/OutOfSync)
- See deployed resources (Deployment, Service, Ingress)
- Check resource health (Healthy/Degraded)

**Using ArgoCD CLI:**

```bash
# List applications
argocd app list

# Get application details
argocd app get conex-app

# Manually sync application
argocd app sync conex-app
```

### 6. Continuous Deployment Workflow

After initial setup, the GitOps workflow operates as follows:

1. **Build and push new image:**
```bash
cd app/conex
docker build -t <account-id>.dkr.ecr.<region>.amazonaws.com/conex-app:v1.0.1 .
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/conex-app:v1.0.1
```

2. **Update manifest with new image tag:**
```bash
# Edit k8s/deployment.yaml and update image tag from :latest to :v1.0.1
```

3. **Commit and push changes:**
```bash
git add k8s/deployment.yaml
git commit -m "Update image tag to v1.0.1"
git push origin main
```

4. **ArgoCD automatically detects and deploys** (if sync-policy is automated)
   - Or manually sync: `argocd app sync conex-app`

#### Advanced: Automated Image Tag Updates

For fully automated deployments, consider integrating:
- **CI/CD Pipeline** (GitHub Actions, GitLab CI) for building and pushing images
- **ArgoCD Image Updater** to automatically update image tags in Git
- **Kustomize** or **Helm** for managing different environments

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
