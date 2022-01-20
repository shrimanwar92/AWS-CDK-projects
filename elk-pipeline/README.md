## ELK Stack

Amazon Opensearch Service is used to setup the open source Elastic Search infrastructure. 

Amazon Opensearch also provides installation of Dashboards with every Amazon Opensearch. 

FileBeat and Metricbeat have been setup in every app instances to ship the app logs & ec2 metric data to Logstash.

Logstash listens for beats data on port 5044 and the logstash output is configured to opensearch & dashboards.

Access to EC2 instances, logstash and opensearch is controlled by setting least previlge security group policies.

## Application related architecture
Once synthesised, this app generates 3 stacks. The purpose of using separate stacks is for easier development so that if some error occurs in stack deployment then we can re-deploy the erroneous stack only.

The 3 deployed stacks are:

 * `BaseStack` which creates basic infra like roles, vpc, IGW, etc.
 * `OpenSearchLogStash` creates stack containing LogStash & Opensearch service. Logstash listening on 5044 port.
 * `AppStack` creates application instances with metricbeat and filebeat installed. These instances send log data to logstash on port 5044.

After successful deployment, open Dashboards on port 5601 on `OpenSearchLogStash` instance IP. Open application on port 3000 on `AppStack` IP's.

## Useful commands
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
 
## Manual task to be done before deploying

1) Create keyPair with name "my-key-pair" via console.
2) In cdk application, lib/utils.ts set MY_IP (used for ssh on port 22)
