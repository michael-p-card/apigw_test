import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Duration } from 'aws-cdk-lib';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

export class ApigwTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // -----------------------
    // MESSAGE CONSUMER LAMBDA
    // -----------------------    

    // Create role to allow API Gateway to send messages to SQS
    const integrationRole = new iam.Role(this, 'integration-role', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });

    // Create SQS queue for sending test messages
    const test_message_queue = new sqs.Queue(this, 'test-message-queue', {
      queueName: 'test-message-queue',
      visibilityTimeout: Duration.seconds(910),
      encryption: sqs.QueueEncryption.KMS_MANAGED,
    });

    // grant sqs:SendMessage* to Api Gateway Role
    test_message_queue.grantSendMessages(integrationRole);
    
    // Api Gateway Direct Integration to enqueue the POST body
    const sendMessageIntegration = new apigateway.AwsIntegration({
      service: 'sqs',
      path: `${process.env.CDK_DEFAULT_ACCOUNT}/${test_message_queue.queueName}`,
      integrationHttpMethod: 'POST',
      options: {
        credentialsRole: integrationRole,
        requestParameters: {
          'integration.request.header.Content-Type': `'application/x-www-form-urlencoded'`,
        },
        requestTemplates: {
          'application/json': 'Action=SendMessage&MessageBody=$input.body', // This line fails with an ampersand in the message
          //'application/json': 'Action=SendMessage&MessageBody=$util.urlEncode($input.body)', // This line works if the message contains an ampersand
        },
        integrationResponses: [
          {
            statusCode: '202', // Note use of 202 Accepted here vs 200
          },
          {
            statusCode: '400',
          },
          {
            statusCode: '500',
          }
        ],
      },
    });

    // Create REST API in API Gateway
    const message_sender_api = new apigateway.RestApi(this, 'message-sender-api', {});

    // Add resource for the send_message API
    const send_message_resource = message_sender_api.root.addResource("send_message");

    // Add POST method to the resource
    send_message_resource.addMethod('POST', sendMessageIntegration, {
      methodResponses: [
        {
          statusCode: '202', // Note use of 202 Accepted here vs 200
        },
        {
          statusCode: '400',
        },
        {
          statusCode: '500',
        }
      ]
    });

    // Create message consumer lambda
    const message_consumer = new lambda.Function(this, "message_consumer", {
      code: lambda.Code.fromAsset("./message_consumer_lambda/"),
      handler: "message_consumer.handler",
      runtime: lambda.Runtime.PYTHON_3_9,
      timeout: Duration.seconds(900)
    });

    // Add the test message SQS queue as a lambda event source
    const eventSource = new lambdaEventSources.SqsEventSource(test_message_queue);
    message_consumer.addEventSource(eventSource);

  }
}
