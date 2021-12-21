##ELK Stack

Amazon Opensearch Service is used to setup the open source Elastic Search infrastructure. 

Amazon Opensearch also provides installation of Dashboards with every Amazon Opensearch. 

FileBeat and Metricbeat have been setup in every app instances to ship the app logs & ec2 metric data to Logstash.

Logstash listens for beats data on port 5044 and the logstash output is configured to opensearch & dashboards.

Access to EC2 instances, logstash and opensearch is controlled by setting least previlge security group policies.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
 
## Manual task to be done before deploying

1) Create keyPair with name "my-key-pair" via console.
2) In cdk application, lib/utils.ts set MY_IP (used for ssh on port 22)
