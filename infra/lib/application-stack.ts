import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface ApplicationStackProps extends cdk.StackProps {
  cluster: eks.Cluster;
  dbSecret: secretsmanager.ISecret;
}

export class ApplicationStack extends cdk.Stack {
  public readonly ecrRepository: ecr.Repository;
  public readonly appServiceAccount: eks.ServiceAccount;

  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    const { cluster, dbSecret } = props;

    this.ecrRepository = new ecr.Repository(this, 'ConexRepository', {
      repositoryName: 'conex-app',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          description: 'Keep last 5 images',
          maxImageCount: 5,
        },
      ],
    });

    this.appServiceAccount = cluster.addServiceAccount('ConexAppServiceAccount', {
      name: 'conex-app',
      namespace: 'default',
    });

    dbSecret.grantRead(this.appServiceAccount);

    this.ecrRepository.grantPullPush(this.appServiceAccount);

    new cdk.CfnOutput(this, 'ECRRepositoryUri', {
      value: this.ecrRepository.repositoryUri,
      description: 'ECR Repository URI for Conex application',
      exportName: 'ConexECRRepositoryUri',
    });

    new cdk.CfnOutput(this, 'ServiceAccountName', {
      value: this.appServiceAccount.serviceAccountName,
      description: 'Kubernetes Service Account name for Conex application',
      exportName: 'ConexServiceAccountName',
    });

    new cdk.CfnOutput(this, 'ServiceAccountRole', {
      value: this.appServiceAccount.role.roleArn,
      description: 'IAM Role ARN for Conex application service account',
      exportName: 'ConexServiceAccountRoleArn',
    });
  }
}
