const AWS = require('aws-sdk');
const url = require('url');
const https = require('https');
const config = require('./config');
const _ = require('lodash');
var hookUrl;

const fleepStatus = {
	GOOD: ' ;) *[GOOD]*',
	WARNING: ' :/ *[WARNING]*',
	DANGER: ' :O *[DANGER]*'
};

var baseFleepMessage = {
	user: config.fleepUsername
};

const postMessage = (message, callback) => {
	const body = JSON.stringify(message);
	const options = url.parse(hookUrl);
	options.method = 'POST';
	options.headers = {
		'Content-Type': 'application/json',
		'Content-Length': Buffer.byteLength(body),
	};
	
	const postReq = https.request(options, res => {
		var chunks = [];
		res.setEncoding('utf8');
		res.on('data', chunk => {
			return chunks.push(chunk);
		});
		res.on('end', () => {
			const body = chunks.join('');
			if (callback) {
				callback({
					body: body,
					statusCode: res.statusCode,
					statusMessage: res.statusMessage
				});
			}
		});
		return res;
	});
	
	postReq.write(body);
	postReq.end();
};

const handleElasticBeanstalk = (event) => {
	const subject = event.Records[0].Sns.Subject || 'AWS Elastic Beanstalk Notification';
	const message = event.Records[0].Sns.Message;
	
	const stateRed = message.indexOf(' to RED');
	const stateSevere = message.indexOf(' to Severe');
	const butWithErrors = message.indexOf(' but with errors');
	const noPermission = message.indexOf('You do not have permission');
	const failedDeploy = message.indexOf('Failed to deploy application');
	const failedConfig = message.indexOf('Failed to deploy configuration');
	const failedQuota = message.indexOf('Your quota allows for 0 more running instance');
	const unsuccessfulCommand = message.indexOf('Unsuccessful command execution');
	
	const stateYellow = message.indexOf(' to YELLOW');
	const stateDegraded = message.indexOf(' to Degraded');
	const stateInfo = message.indexOf(' to Info');
	const removedInstance = message.indexOf('Removed instance ');
	const addingInstance = message.indexOf('Adding instance ');
	const abortedOperation = message.indexOf(' aborted operation.');
	const abortedDeployment = message.indexOf('some instances may have deployed the new application version');
	
	var status = fleepStatus.GOOD;
	
	if (stateRed != -1 || stateSevere != -1 || butWithErrors != -1 || noPermission != -1 || failedDeploy != -1 || failedConfig != -1 || failedQuota != -1 || unsuccessfulCommand != -1) {
		status = fleepStatus.DANGER;
	}
	if (stateYellow != -1 || stateDegraded != -1 || stateInfo != -1 || removedInstance != -1 || addingInstance != -1 || abortedOperation != -1 || abortedDeployment != -1) {
		status = fleepStatus.WARNING;
	}
	
	const compiled = 
		status + ' *' + subject + '* \n' + 
		JSON.parse(message);

	const fleepMessage = {
		message: compiled
	};
	
	return _.merge(fleepMessage, baseFleepMessage);
};

const handleCodeDeploy = (event) => {
	const subject = 'AWS CodeDeploy Notification';
	const timestamp = (new Date(event.Records[0].Sns.Timestamp)).getTime()/1000;
	const snsSubject = event.Records[0].Sns.Subject;
	var message;
	var status = fleepStatus.WARNING;
	var compiled;

	try {
		message = JSON.parse(event.Records[0].Sns.Message);
		
		if(message.status === 'SUCCEEDED'){
			status = fleepStatus.GOOD;
		} else if(message.status === 'FAILED'){
			status = fleepStatus.DANGER;
		}

		compiled = 
			status + ' *' + subject + '* \n' +
			snsSubject + 
			'\n' + message +
			'\n *Deployment Group:* ' + message.deploymentGroupName +
			'\n *Application:* ' + message.applicationName +
			'\n *Status Link:* ' + 'https://console.aws.amazon.com/codedeploy/home?region=' + message.region + '#/deployments/' + message.deploymentId +
			'\n *Timestamp:* ' + timestamp;
	}
	catch(e) {
		status = fleepStatus.GOOD;
		message = event.Records[0].Sns.Message;

		compiled =
			status + ' *' + subject + '* \n' +
			snsSubject +
			'\n' + message +
			'\n *Timestamp:* ' + timestamp;
	}
	
	
	const fleepMessage = {
		message: compiled
	};
	
	return _.merge(fleepMessage, baseFleepMessage);
};

const handleCodePipeline = (event) => {
	const subject = 'AWS CodePipeline Notification';
	const timestamp = (new Date(event.Records[0].Sns.Timestamp)).getTime()/1000;
	var message;
	var status = fleepStatus.WARNING;
	var changeType = '';
	var compiled;
	
	try {
		message = JSON.parse(event.Records[0].Sns.Message);
		const detailType = message['detail-type'];
		
		if(detailType === 'CodePipeline Pipeline Execution State Change'){
			changeType = '';
		} else if(detailType === 'CodePipeline Stage Execution State Change'){
			changeType = 'STAGE ' + message.detail.stage;
		} else if(detailType === 'CodePipeline Action Execution State Change'){
			changeType = 'ACTION';
		}
		
		if(message.detail.state === 'SUCCEEDED'){
			status = fleepStatus.GOOD;
		} else if(message.detail.state === 'FAILED'){
			status = fleepStatus.DANGER;
		}

		compiled =
			status + ' *' + subject + '* \n' +
			'\n' + message +
			'\n *' + message.detail.state + ':* CodePipeline ' + changeType +
			'\n *Pipeline:* ' + message.detail.pipeline +
			'\n *Region:* ' + message.region +
			'\n *Status Link:* ' + 'https://console.aws.amazon.com/codepipeline/home?region=' + message.region + '#/view/' + message.detail.pipeline +
			'\n *Timestamp:* ' + timestamp;
	}
	catch(e) {
		status = fleepStatus.GOOD;
		message = event.Records[0].Sns.Message;

		compiled =
			status + ' *' + subject + '* \n' +
			'\n' + message +
			'\n *' + message.detail.state + ':* CodePipeline ' + changeType +
			'\n *Timestamp:* ' + timestamp;
	}
	
	
	const fleepMessage = {
		message: compiled
	};
	
	return _.merge(fleepMessage, baseFleepMessage);
};

const handleElasticache = (event) => {
	const subject = 'AWS ElastiCache Notification';
	const message = JSON.parse(event.Records[0].Sns.Message);
	const timestamp = (new Date(event.Records[0].Sns.Timestamp)).getTime()/1000;
	const region = event.Records[0].EventSubscriptionArn.split(':')[3];
	var eventname, nodename;
	var status = fleepStatus.GOOD;
	
	for(const key in message){
		eventname = key;
		nodename = message[key];
		break;
	}

	const compiled =
		status + ' *' + subject + '* \n' +
		'\n' + message +
		'\n *Event:* ' + eventname.split(':')[1] +
		'\n *Node:* ' + nodename +
		'\n *Link to cache node:* ' + 'https://console.aws.amazon.com/elasticache/home?region=' + region + '#cache-nodes:id=' + nodename + ';nodes' +
		'\n *Timestamp:* ' + timestamp;

	const fleepMessage = {
		message: compiled
	};
	return _.merge(fleepMessage, baseFleepMessage);
};

const handleCloudWatch = (event) => {
	const timestamp = (new Date(event.Records[0].Sns.Timestamp)).getTime()/1000;
	const message = JSON.parse(event.Records[0].Sns.Message);
	const region = event.Records[0].EventSubscriptionArn.split(':')[3];
	const subject = 'AWS CloudWatch Notification';
	const alarmName = message.AlarmName;
	const metricName = message.Trigger.MetricName;
	const oldState = message.OldStateValue;
	const newState = message.NewStateValue;
	const alarmReason = message.NewStateReason;
	const trigger = message.Trigger;
	var status = fleepStatus.WARNING;
	
	if (message.NewStateValue === 'ALARM') {
		status = fleepStatus.DANGER;
	} else if (message.NewStateValue === 'OK') {
		status = fleepStatus.GOOD;
	}
	
	const compiled =
		status + ' *' + subject + '* \n' +
		'\n' + message +
		'\n *Alarm Name:* ' + alarmName +
		'\n *Alarm Description:* ' + alarmReason +
		'\n *Trigger:* ' + trigger.Statistic + ' ' +
			metricName + ' ' +
			trigger.ComparisonOperator + ' ' +
			trigger.Threshold + ' for ' +
			trigger.EvaluationPeriods + ' period(s) of ' +
			trigger.Period + ' seconds.' +
		'\n *Old State:* ' + oldState +
		'\n *Current State:* ' + newState +
		'\n *Link to Alarm:* ' + 'https://console.aws.amazon.com/cloudwatch/home?region=' + region + '#alarm:alarmFilter=ANY;name=' + encodeURIComponent(alarmName) +
		'\n *Timestamp:* ' + timestamp;

	const fleepMessage = {
		message: compiled
	};
	return _.merge(fleepMessage, baseFleepMessage);
};

const handleAutoScaling = (event) => {
	const subject = 'AWS AutoScaling Notification';
	const message = JSON.parse(event.Records[0].Sns.Message);
	const snsSubject = event.Records[0].Sns.Subject;
	const timestamp = (new Date(event.Records[0].Sns.Timestamp)).getTime()/1000;
	var status = fleepStatus.GOOD;
	
	const compiled =
		status + ' *' + subject + '* \n' +
		snsSubject +
		'\n' + message +
		'\n *Description:* ' + message.Description +
		'\n *Event:* ' + message.Event +
		'\n *Cause:* ' + message.Cause +
		'\n *Timestamp:* ' + timestamp;

	const fleepMessage = {
		message: compiled
	};
	return _.merge(fleepMessage, baseFleepMessage);
};

const handleCatchAll = (event) => {
	const record = event.Records[0];
	const subject = record.Sns.Subject;
	const timestamp = new Date(record.Sns.Timestamp).getTime() / 1000;
	const message = JSON.parse(record.Sns.Message);
	var status = fleepStatus.WARNING;
	
	if (message.NewStateValue === 'ALARM') {
		status = fleepStatus.DANGER;
	} else if (message.NewStateValue === 'OK') {
		status = fleepStatus.GOOD;
	}
	
	// Add all of the values from the event message to the Slack message description
	var description = '';
	for(const key in message) {
		const renderedMessage = typeof message[key] === 'object'
			? JSON.stringify(message[key])
			: message[key];
		description = description + '\n' + key + ': ' + renderedMessage;
	}
	
	const compiled =
		status + ' *' + subject + '* \n' +
		'\n' + message +
		'\n *Description:* ' + description +
		'\n *Timestamp:* ' + timestamp;

	var fleepMessage = {
		message: compiled
	};
	
	return _.merge(fleepMessage, baseFleepMessage);
};

const processEvent = (event, context) => {
	console.log('sns received:' + JSON.stringify(event, null, 2));
	var fleepMessage = null;
	const eventSubscriptionArn = event.Records[0].EventSubscriptionArn;
	const eventSnsSubject = event.Records[0].Sns.Subject || 'no subject';
	const eventSnsMessage = event.Records[0].Sns.Message;
	
	if(eventSubscriptionArn.indexOf(config.services.codepipeline.match_text) > -1 || eventSnsSubject.indexOf(config.services.codepipeline.match_text) > -1 || eventSnsMessage.indexOf(config.services.codepipeline.match_text) > -1){
		console.log('processing codepipeline notification');
		fleepMessage = handleCodePipeline(event,context);
	}
	else if(eventSubscriptionArn.indexOf(config.services.elasticbeanstalk.match_text) > -1 || eventSnsSubject.indexOf(config.services.elasticbeanstalk.match_text) > -1 || eventSnsMessage.indexOf(config.services.elasticbeanstalk.match_text) > -1){
		console.log('processing elasticbeanstalk notification');
		fleepMessage = handleElasticBeanstalk(event,context);
	}
	else if(eventSubscriptionArn.indexOf(config.services.cloudwatch.match_text) > -1 || eventSnsSubject.indexOf(config.services.cloudwatch.match_text) > -1 || eventSnsMessage.indexOf(config.services.cloudwatch.match_text) > -1){
		console.log('processing cloudwatch notification');
		fleepMessage = handleCloudWatch(event,context);
	}
	else if(eventSubscriptionArn.indexOf(config.services.codedeploy.match_text) > -1 || eventSnsSubject.indexOf(config.services.codedeploy.match_text) > -1 || eventSnsMessage.indexOf(config.services.codedeploy.match_text) > -1){
		console.log('processing codedeploy notification');
		fleepMessage = handleCodeDeploy(event,context);
	}
	else if(eventSubscriptionArn.indexOf(config.services.elasticache.match_text) > -1 || eventSnsSubject.indexOf(config.services.elasticache.match_text) > -1 || eventSnsMessage.indexOf(config.services.elasticache.match_text) > -1){
		console.log('processing elasticache notification');
		fleepMessage = handleElasticache(event,context);
	}
	else if(eventSubscriptionArn.indexOf(config.services.autoscaling.match_text) > -1 || eventSnsSubject.indexOf(config.services.autoscaling.match_text) > -1 || eventSnsMessage.indexOf(config.services.autoscaling.match_text) > -1){
		console.log('processing autoscaling notification');
		fleepMessage = handleAutoScaling(event, context);
	}
	else{
		fleepMessage = handleCatchAll(event, context);
	}
	
	postMessage(fleepMessage, response => {
		if (response.statusCode < 400) {
			console.info('message posted successfully');
			context.succeed();
		} else if (response.statusCode < 500) {
			console.error('error posting message to slack API: ' + response.statusCode + ' - ' + response.statusMessage);
			// Don't retry because the error is due to a problem with the request
			context.succeed();
		} else {
			// Let Lambda retry
			context.fail('server error when processing message: ' + response.statusCode + ' - ' + response.statusMessage);
		}
	});
};

exports.handler = (event, context) => {
	if (hookUrl) {
		processEvent(event, context);
	} else if (config.unencryptedHookUrl) {
		hookUrl = config.unencryptedHookUrl;
		processEvent(event, context);
	} else if (config.kmsEncryptedHookUrl && config.kmsEncryptedHookUrl !== '<kmsEncryptedHookUrl>') {
		var encryptedBuf = new Buffer(config.kmsEncryptedHookUrl, 'base64');
		var cipherText = { CiphertextBlob: encryptedBuf };
		var kms = new AWS.KMS();
		
		kms.decrypt(cipherText, (err, data) => {
			if (err) {
				console.log('decrypt error: ' + err);
				processEvent(event, context);
			} else {
				hookUrl = 'https://' + data.Plaintext.toString('ascii');
				processEvent(event, context);
			}
		});
	} else {
		context.fail('hook url has not been set.');
	}
};