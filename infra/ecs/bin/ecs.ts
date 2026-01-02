import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecr from 'aws-cdk-lib/aws-ecr';

export class MinimalEcsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Use default VPC (no NAT Gateway cost)
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', {
      isDefault: true,
    });

    // ECS Cluster with Fargate Spot enabled
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      enableFargateCapacityProviders: true,
    });

    // Task Definition (Java application requires more resources)
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
    });

    // Reference existing ECR repository
    const repository = ecr.Repository.fromRepositoryName(this, 'Repository', 'tttol/conex2');

    // Use ECR image for Java application
    taskDefinition.addContainer('AppContainer', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'conex_20260102052342'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs-test',
        logRetention: logs.RetentionDays.ONE_DAY,
      }),
      portMappings: [{ containerPort: 8080 }],
      environment: {
        SPRING_PROFILES_ACTIVE: 'prod',
        DB_URL: 'jdbc:mysql://dummy-host:3306/dummy_db',
        DB_USER: 'dummy_user',
        DB_PASSWORD: 'dummy_password',
      },
    });

    // Fargate Service with Spot and initially stopped
    const service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: 1,
        },
      ],
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
    });

    // Allow inbound HTTP traffic
    service.connections.allowFromAnyIpv4(ec2.Port.tcp(8080), 'Allow HTTP');

    // Output cluster and service names for easy CLI access
    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: service.serviceName,
    });
  }
}

const app = new cdk.App();
new MinimalEcsStack(app, 'MinimalEcsStack', {
  env: { account: '339713062121', region: 'ap-northeast-1' },
});
