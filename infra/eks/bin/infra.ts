#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { RdsStack } from '../lib/rds-stack';
import { EksStack } from '../lib/eks-stack';
import { ApplicationStack } from '../lib/application-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const vpcStack = new VpcStack(app, 'ConexVpcStack', { env });

const rdsStack = new RdsStack(app, 'ConexRdsStack', {
  env,
  vpc: vpcStack.vpc,
});

const eksStack = new EksStack(app, 'ConexEksStack', {
  env,
  vpc: vpcStack.vpc,
});

const applicationStack = new ApplicationStack(app, 'ConexApplicationStack', {
  env,
  cluster: eksStack.cluster,
  dbSecret: rdsStack.dbSecret,
  dbSecurityGroup: rdsStack.dbSecurityGroup,
});