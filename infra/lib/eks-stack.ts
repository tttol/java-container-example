import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { KubectlV31Layer } from '@aws-cdk/lambda-layer-kubectl-v31';

interface EksStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

export class EksStack extends cdk.Stack {
  public readonly cluster: eks.Cluster;

  constructor(scope: Construct, id: string, props: EksStackProps) {
    super(scope, id, props);

    const { vpc } = props;

    this.cluster = new eks.Cluster(this, 'ConexCluster', {
      vpc,
      vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
      version: eks.KubernetesVersion.V1_31,
      defaultCapacity: 0,
      clusterName: 'conex-cluster',
      kubectlLayer: new KubectlV31Layer(this, 'KubectlLayer'),
    });

    this.cluster.awsAuth.addRoleMapping(
      iam.Role.fromRoleArn(this, 'AdminRole', 'arn:aws:iam::260475105314:role/aws-reserved/sso.amazonaws.com/ap-northeast-1/AWSReservedSSO_AdministratorAccess_7bb34305cec16433'),
      {
        groups: ['system:masters'],
        username: 'admin-sso-user',
      }
    );

    this.cluster.addNodegroupCapacity('ConexNodeGroup', {
      instanceTypes: [new ec2.InstanceType('t3.small')],
      minSize: 1,
      maxSize: 2,
      desiredSize: 1,
      diskSize: 20,
      amiType: eks.NodegroupAmiType.AL2023_X86_64_STANDARD,
    });

    const albControllerServiceAccount = this.cluster.addServiceAccount('AWSLoadBalancerController', {
      name: 'aws-load-balancer-controller',
      namespace: 'kube-system',
    });

    const albPolicyDocument = iam.PolicyDocument.fromJson({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'iam:CreateServiceLinkedRole',
            'ec2:DescribeAccountAttributes',
            'ec2:DescribeAddresses',
            'ec2:DescribeAvailabilityZones',
            'ec2:DescribeInternetGateways',
            'ec2:DescribeVpcs',
            'ec2:DescribeSubnets',
            'ec2:DescribeSecurityGroups',
            'ec2:DescribeInstances',
            'ec2:DescribeNetworkInterfaces',
            'ec2:DescribeTags',
            'ec2:GetCoipPoolUsage',
            'ec2:DescribeCoipPools',
            'elasticloadbalancing:DescribeLoadBalancers',
            'elasticloadbalancing:DescribeLoadBalancerAttributes',
            'elasticloadbalancing:DescribeListeners',
            'elasticloadbalancing:DescribeListenerCertificates',
            'elasticloadbalancing:DescribeListenerAttributes',
            'elasticloadbalancing:DescribeSSLPolicies',
            'elasticloadbalancing:DescribeRules',
            'elasticloadbalancing:DescribeTargetGroups',
            'elasticloadbalancing:DescribeTargetGroupAttributes',
            'elasticloadbalancing:DescribeTargetHealth',
            'elasticloadbalancing:DescribeTags',
          ],
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: [
            'cognito-idp:DescribeUserPoolClient',
            'acm:ListCertificates',
            'acm:DescribeCertificate',
            'iam:ListServerCertificates',
            'iam:GetServerCertificate',
            'waf-regional:GetWebACL',
            'waf-regional:GetWebACLForResource',
            'waf-regional:AssociateWebACL',
            'waf-regional:DisassociateWebACL',
            'wafv2:GetWebACL',
            'wafv2:GetWebACLForResource',
            'wafv2:AssociateWebACL',
            'wafv2:DisassociateWebACL',
            'shield:GetSubscriptionState',
            'shield:DescribeProtection',
            'shield:CreateProtection',
            'shield:DeleteProtection',
          ],
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: [
            'ec2:AuthorizeSecurityGroupIngress',
            'ec2:RevokeSecurityGroupIngress',
            'ec2:CreateSecurityGroup',
          ],
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: ['ec2:CreateTags'],
          Resource: 'arn:aws:ec2:*:*:security-group/*',
          Condition: {
            StringEquals: {
              'ec2:CreateAction': 'CreateSecurityGroup',
            },
            Null: {
              'aws:RequestTag/elbv2.k8s.aws/cluster': 'false',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: ['ec2:CreateTags', 'ec2:DeleteTags'],
          Resource: 'arn:aws:ec2:*:*:security-group/*',
          Condition: {
            Null: {
              'aws:RequestTag/elbv2.k8s.aws/cluster': 'true',
              'aws:ResourceTag/elbv2.k8s.aws/cluster': 'false',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: [
            'ec2:AuthorizeSecurityGroupIngress',
            'ec2:RevokeSecurityGroupIngress',
            'ec2:DeleteSecurityGroup',
          ],
          Resource: '*',
          Condition: {
            Null: {
              'aws:ResourceTag/elbv2.k8s.aws/cluster': 'false',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticloadbalancing:CreateLoadBalancer',
            'elasticloadbalancing:CreateTargetGroup',
          ],
          Resource: '*',
          Condition: {
            Null: {
              'aws:RequestTag/elbv2.k8s.aws/cluster': 'false',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticloadbalancing:CreateListener',
            'elasticloadbalancing:DeleteListener',
            'elasticloadbalancing:CreateRule',
            'elasticloadbalancing:DeleteRule',
          ],
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticloadbalancing:AddTags',
            'elasticloadbalancing:RemoveTags',
          ],
          Resource: [
            'arn:aws:elasticloadbalancing:*:*:targetgroup/*/*',
            'arn:aws:elasticloadbalancing:*:*:loadbalancer/net/*/*',
            'arn:aws:elasticloadbalancing:*:*:loadbalancer/app/*/*',
          ],
          Condition: {
            Null: {
              'aws:RequestTag/elbv2.k8s.aws/cluster': 'false',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticloadbalancing:AddTags',
            'elasticloadbalancing:RemoveTags',
          ],
          Resource: [
            'arn:aws:elasticloadbalancing:*:*:targetgroup/*/*',
            'arn:aws:elasticloadbalancing:*:*:loadbalancer/net/*/*',
            'arn:aws:elasticloadbalancing:*:*:loadbalancer/app/*/*',
          ],
          Condition: {
            Null: {
              'aws:ResourceTag/elbv2.k8s.aws/cluster': 'false',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticloadbalancing:AddTags',
            'elasticloadbalancing:RemoveTags',
          ],
          Resource: [
            'arn:aws:elasticloadbalancing:*:*:listener/net/*/*/*',
            'arn:aws:elasticloadbalancing:*:*:listener/app/*/*/*',
            'arn:aws:elasticloadbalancing:*:*:listener-rule/net/*/*/*',
            'arn:aws:elasticloadbalancing:*:*:listener-rule/app/*/*/*',
          ],
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticloadbalancing:ModifyLoadBalancerAttributes',
            'elasticloadbalancing:SetIpAddressType',
            'elasticloadbalancing:SetSecurityGroups',
            'elasticloadbalancing:SetSubnets',
            'elasticloadbalancing:DeleteLoadBalancer',
            'elasticloadbalancing:ModifyTargetGroup',
            'elasticloadbalancing:ModifyTargetGroupAttributes',
            'elasticloadbalancing:DeleteTargetGroup',
          ],
          Resource: '*',
          Condition: {
            Null: {
              'aws:ResourceTag/elbv2.k8s.aws/cluster': 'false',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticloadbalancing:RegisterTargets',
            'elasticloadbalancing:DeregisterTargets',
          ],
          Resource: 'arn:aws:elasticloadbalancing:*:*:targetgroup/*/*',
        },
        {
          Effect: 'Allow',
          Action: [
            'elasticloadbalancing:SetWebAcl',
            'elasticloadbalancing:ModifyListener',
            'elasticloadbalancing:AddListenerCertificates',
            'elasticloadbalancing:RemoveListenerCertificates',
            'elasticloadbalancing:ModifyRule',
          ],
          Resource: '*',
        },
      ],
    });

    albControllerServiceAccount.role.attachInlinePolicy(
      new iam.Policy(this, 'AWSLoadBalancerControllerPolicy', {
        document: albPolicyDocument,
      })
    );

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'EKS Cluster Name',
      exportName: 'ConexClusterName',
    });

    new cdk.CfnOutput(this, 'ClusterArn', {
      value: this.cluster.clusterArn,
      description: 'EKS Cluster ARN',
      exportName: 'ConexClusterArn',
    });
  }
}
