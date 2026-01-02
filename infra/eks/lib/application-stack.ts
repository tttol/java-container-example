import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface ApplicationStackProps extends cdk.StackProps {
  cluster: eks.Cluster;
  dbSecret: secretsmanager.ISecret;
  dbSecurityGroup: ec2.SecurityGroup;
}

export class ApplicationStack extends cdk.Stack {
  public readonly appServiceAccount: eks.ServiceAccount;

  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    const { cluster, dbSecret, dbSecurityGroup } = props;

    const ecrRepository = ecr.Repository.fromRepositoryName(
      this,
      'ExistingConexRepository',
      'tttol/conex'
    );

    new ec2.CfnSecurityGroupIngress(this, 'DBSecurityGroupIngress', {
      ipProtocol: 'tcp',
      fromPort: 3306,
      toPort: 3306,
      sourceSecurityGroupId: cluster.clusterSecurityGroup.securityGroupId,
      groupId: dbSecurityGroup.securityGroupId,
      description: 'Allow MySQL access from EKS cluster',
    });

    this.appServiceAccount = cluster.addServiceAccount('ConexAppServiceAccount', {
      name: 'conex-app',
      namespace: 'default',
    });

    dbSecret.grantRead(this.appServiceAccount);

    ecrRepository.grantPullPush(this.appServiceAccount);

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
