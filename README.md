# lambda-cloudwatch-fleep

An [AWS Lambda](http://aws.amazon.com/lambda/) function for better
Fleep (based on the [original Slack repo](https://github.com/assertible/lambda-cloudwatch-slack))
notifications. [Check out the blog post](https://assertible.com/blog/npm-package-lambda-cloudwatch-slack).


## Overview

This function was originally derived from the
[AWS blueprint named `cloudwatch-alarm-to-slack`](https://aws.amazon.com/blogs/aws/new-slack-integration-blueprints-for-aws-lambda/). The
function in this repo improves on the default blueprint in several
ways:

**Better default formatting for CloudWatch notifications:**

![AWS Cloud Notification for Fleep](https://github.com/pasevin/lambda-cloudwatch-fleep/raw/master/images/cloudwatch.png)

**Support for notifications from Elastic Beanstalk:**

![Elastic Beanstalk Fleep Notifications](https://github.com/pasevin/lambda-cloudwatch-fleep/raw/master/images/elastic-beanstalk.png)

**Support for notifications from Code Deploy:**

![AWS CodeDeploy Notifications](https://github.com/pasevin/lambda-cloudwatch-fleep/raw/master/images/code-deploy.png)

**Basic support for notifications from ElastiCache:**

![AWS ElastiCache Notifications](https://github.com/pasevin/lambda-cloudwatch-fleep/raw/master/images/elasticache.png)

**Support for notifications from CodePipeline:**

![AWS CodePipeline Notifications](https://github.com/pasevin/lambda-cloudwatch-fleep/raw/master/images/code-pipeline.png)

**Support for encrypted and unencrypted Fleep webhook url:**


## Configuration

Clone this repository and open the Makefile in your editor, then follow
the steps beow:


### 1. Configure AWS environment

Fill in the variables at the top of the `Makefile`. For example, your
variables may look like this:

```
LAMBDA_FUNCTION_NAME=cloudwatch-to-fleep
AWS_REGION=us-west-2
AWS_ROLE=arn:aws:iam::123456789123:role/lambda_exec_role
AWS_PROFILE=default
```

### 2. Setup Fleep hook

Follow these steps to configure the webhook in Fleep:

  1. Navigate to
     [https://fleep.io/blog/integrations/webhooks/](https://fleep.io/blog/integrations/webhooks/)
     and follow instructions on how to create "Generic Webhook".

  2. Copy the webhook URL and use it in the next section.

### 3. Configure AWS Lambda script

Next, open `deploy.env.example`, there are several configuration
options here. At a minimum, you must fill out `UNENCRYPTED_HOOK_URL`
(or `KMS_ENCRYPTED_HOOK_URL`) and `FLEEP_USERNAME`.

When you're done, copy the file to `deploy.env`:

```
$ cp deploy.env.example deploy.env
```

#### Encrypted the Fleep webhook URL

If you don't want or need to encrypt your hook URL, you can use the
`UNENCRYPTED_HOOK_URL`.  If this variable is specified, the
`KMS_ENCRYPTED_HOOK_URL` is ignored.

If you **do** want to encrypt your hook URL, follow these steps to
encrypt your Fleep hook URL for use in this function:

  1. Create a KMS key -
     http://docs.aws.amazon.com/kms/latest/developerguide/create-keys.html.

  2. Encrypt the event collector token using the AWS CLI.
     $ aws kms encrypt --key-id alias/<KMS key name> --plaintext "<FLEEP_HOOK_URL>"

     Note: You must exclude the protocol from the URL
     (e.g. "fleep.io/hook/abc123").

  3. Copy the base-64 encoded, encrypted key (CiphertextBlob) to the
     ENCRYPTED_HOOK_URL variable.

  4. Give your function's role permission for the kms:Decrypt action.
     Example:

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "Stmt1443036478000",
            "Effect": "Allow",
            "Action": [
                "kms:Decrypt"
            ],
            "Resource": [
                "<your KMS key ARN>"
            ]
        }
    ]
}
```


### 4. Deploy to AWS Lambda

The final step is to deploy the integration to AWS Lambda:

    make deploy

## Tests

With the variables filled in, you can test the function:

```
npm install
make test
```

## Caveats

- Environment variables specified in `deploy.env` may not show up on
  AWS Lambda but are still in use.

- `node-lambda` appends `-development` to Lambda function names. To
  fix this, check out the `.env` file created by `node-lambda` and set
  the `AWS_ENVIRONMENT` var to an empty string, like
  `AWS_ENVIRONMENT=`

## License

MIT License
