# Attribute based access control using AWS CDK

This is a AWS CDK project that creates
*   Two users Alice and Bob. Alice belongs to a developer group and Bob belongs to a testers group.
*   A group policy that allows "ec2:Describe*" permission to both groups.
*   User Alice have the permission to only start, stop and reboot instances belonging to tag `team: developers`.
*	User Bob have the permission to only start, stop and reboot instances belonging to tag `team: testers`.
*   4 EC2 instances. 2 instances belong to developers group with tag `team: developers` and 2 instances belong to testers group with tag `team: testers`.
*	If Alice tries to start, stop and reboot instances belonging to tag `team: testers`, she will get `You are not authorized to perform this operation` error.
*	If Bob tries to start, stop and reboot instances belonging to tag `team: developers`, he will get `You are not authorized to perform this operation` error.

## Useful commands

 * `cdk deploy`   deploys Attribute based access control stack.
 * `cdk synth`    compiles ts project to generate cloudformation
 
 
# Images
 
## Alice's permission
![ScreenShot](/screenshots/alice1.PNG)
![ScreenShot](/screenshots/alice2.PNG) 
![ScreenShot](/screenshots/alice3.PNG) 
![ScreenShot](/screenshots/alice4.PNG)

## Bob's permission
![ScreenShot](/screenshots/bob1.PNG)
![ScreenShot](/screenshots/bob2.PNG) 
![ScreenShot](/screenshots/bob3.PNG) 
![ScreenShot](/screenshots/bob4.PNG)