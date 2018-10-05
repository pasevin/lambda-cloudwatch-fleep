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

const handleElasticBeanstalk = (event, context, callback) => {
	const subject = event.Records[0].Sns.Subject || 'AWS Elastic Beanstalk Notification';
	const message = event.Records[0].Sns.Message;
	const timestamp = event.Records[0].Sns.Timestamp;
	
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
		status + ' *' + subject + '*' + 
		'\n *Subject:* ' + event.Records[0].Sns.Subject +
		'\n *Message:* ' + message +
		'\n *Timestamp:* ' + timestamp;

	const fleepMessage = {
		message: compiled
	};
	
	return _.merge(fleepMessage, baseFleepMessage);
};

const handleCodeDeploy = (event, context, callback) => {
	const subject = 'AWS CodeDeploy Notification';
	const timestamp = event.Records[0].Sns.Timestamp;
	const snsSubject = event.Records[0].Sns.Subject;
	const message = event.Records[0].Sns.Message;
	const messageParsed = JSON.parse(message);
	var status = fleepStatus.WARNING;
	var compiled;

	try {
		if(messageParsed.status === 'SUCCEEDED'){
			status = fleepStatus.GOOD;
		} else if(messageParsed.status === 'FAILED'){
			status = fleepStatus.DANGER;
		}

		compiled = 
			status + ' *' + subject + '*' +
			'\n *Message:* ' + snsSubject +
			'\n *Deployment Group:* ' + messageParsed.deploymentGroupName +
			'\n *Application:* ' + messageParsed.applicationName +
			'\n *Status Link:* ' + 'https://console.aws.amazon.com/codedeploy/home?region=' + messageParsed.region + '#/deployments/' + messageParsed.deploymentId +
			'\n *Timestamp:* ' + timestamp;
	}
	catch(e) {
		status = fleepStatus.GOOD;

		compiled =
			status + ' *' + subject + '*' +
			'\n *Message:* ' + snsSubject +
			'\n *Details:* ' + message +
			'\n *Timestamp:* ' + timestamp;
	}
	
	
	const fleepMessage = {
		message: compiled
	};
	
	return _.merge(fleepMessage, baseFleepMessage);
};

const handleCodePipeline = (event, context, callback) => {
	const subject = 'AWS CodePipeline Notification';
	const timestamp = event.Records[0].Sns.Timestamp;
	const snsSubject = event.Records[0].Sns.Subject;
	const message = event.Records[0].Sns.Message;
	var messageParsed;
	var status = fleepStatus.WARNING;
	var changeType = '';
	var compiled;
	
	try {
		messageParsed = JSON.parse(event.Records[0].Sns.Message);
		const detailType = messageParsed['detail-type'];
		
		if(detailType === 'CodePipeline Pipeline Execution State Change'){
			changeType = '';
		} else if(detailType === 'CodePipeline Stage Execution State Change'){
			changeType = 'STAGE ' + messageParsed.detail.stage;
		} else if(detailType === 'CodePipeline Action Execution State Change'){
			changeType = 'ACTION';
		}
		
		if(messageParsed.detail.state === 'SUCCEEDED'){
			status = fleepStatus.GOOD;
		} else if(messageParsed.detail.state === 'FAILED'){
			status = fleepStatus.DANGER;
		}

		compiled =
			status + ' *' + subject + '*' +
			'\n *Message:* ' + messageParsed.detail.state + ': CodePipeline ' + changeType +
			'\n *Pipeline:* ' + messageParsed.detail.pipeline +
			'\n *Region:* ' + messageParsed.region +
			'\n *Status Link:* ' + 'https://console.aws.amazon.com/codepipeline/home?region=' + messageParsed.region + '#/view/' + messageParsed.detail.pipeline +
			'\n *Timestamp:* ' + timestamp;
	}
	catch(e) {
		status = fleepStatus.GOOD;

		compiled =
			status + ' *' + subject + '*' +
			'\n *Message:* ' + messageParsed.detail.state + ': CodePipeline ' + messageParsed.detail.pipeline +
			'\n *Detail:* ' + message +
			'\n *Timestamp:* ' + timestamp;
	}
	
	
	const fleepMessage = {
		message: compiled
	};
	
	return _.merge(fleepMessage, baseFleepMessage);
};

const handleElasticache = (event, context, callback) => {
	const subject = 'AWS ElastiCache Notification';
	const messageParsed = JSON.parse(event.Records[0].Sns.Message);
	const timestamp = event.Records[0].Sns.Timestamp;
	const region = event.Records[0].EventSubscriptionArn.split(':')[3];
	var eventname, nodename;
	var status = fleepStatus.GOOD;
	
	for(const key in messageParsed){
		eventname = key;
		nodename = messageParsed[key];
		break;
	}

	const compiled =
		status + ' *' + subject + '*' +
		'\n *Event:* ' + eventname.split(':')[1] +
		'\n *Node:* ' + nodename +
		'\n *Link to cache node:* ' + 'https://console.aws.amazon.com/elasticache/home?region=' + region + '#cache-nodes:id=' + nodename + ';nodes' +
		'\n *Timestamp:* ' + timestamp;

	const fleepMessage = {
		message: compiled
	};
	return _.merge(fleepMessage, baseFleepMessage);
};

const handleCloudWatch = (event, context, callback) => {
	const timestamp = event.Records[0].Sns.Timestamp;
	const messageParsed = JSON.parse(event.Records[0].Sns.Message);
	const region = event.Records[0].EventSubscriptionArn.split(':')[3];
	const subject = 'AWS CloudWatch Notification';
	const alarmName = messageParsed.AlarmName;
	const metricName = messageParsed.Trigger.MetricName;
	const oldState = messageParsed.OldStateValue;
	const newState = messageParsed.NewStateValue;
	const alarmReason = messageParsed.NewStateReason;
	const trigger = messageParsed.Trigger;
	var status = fleepStatus.WARNING;
	
	if (messageParsed.NewStateValue === 'ALARM') {
		status = fleepStatus.DANGER;
	} else if (messageParsed.NewStateValue === 'OK') {
		status = fleepStatus.GOOD;
	}
	
	const compiled =
		status + ' *' + subject + '*' +
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

const handleAutoScaling = (event, context, callback) => {
	const subject = 'AWS AutoScaling Notification';
	const messageParsed = JSON.parse(event.Records[0].Sns.Message);
	const snsSubject = event.Records[0].Sns.Subject;
	const timestamp = event.Records[0].Sns.Timestamp;
	var status = fleepStatus.GOOD;
	
	const compiled =
		status + ' *' + subject + '*' +
		'\n *Message:* ' + snsSubject +
		'\n *Description:* ' + messageParsed.Description +
		'\n *Event:* ' + messageParsed.Event +
		'\n *Cause:* ' + messageParsed.Cause +
		'\n *Timestamp:* ' + timestamp;

	const fleepMessage = {
		message: compiled
	};
	return _.merge(fleepMessage, baseFleepMessage);
};

const handleCatchAll = (event, context, callback) => {
	const record = event.Records[0];
	const snsSubject = record.Sns.Subject;
	const timestamp = record.Sns.Timestamp;
	const messageParsed = JSON.parse(record.Sns.Message);
	var status = fleepStatus.WARNING;
	
	if (messageParsed.NewStateValue === 'ALARM') {
		status = fleepStatus.DANGER;
	} else if (messageParsed.NewStateValue === 'OK') {
		status = fleepStatus.GOOD;
	}
	
	// Add all of the values from the event message to the Slack message description
	var description = '';
	for(const key in messageParsed) {
		const renderedMessage = typeof messageParsed[key] === 'object'
			? JSON.stringify(messageParsed[key])
			: messageParsed[key];
		description = description + '\n' + key + ': ' + renderedMessage;
	}
	
	const compiled =
		status + ' *' + snsSubject + '*' +
		'\n *Message:* ' + snsSubject +
		'\n *Description:* ' + description +
		'\n *Timestamp:* ' + timestamp;

	var fleepMessage = {
		message: compiled
	};
	
	return _.merge(fleepMessage, baseFleepMessage);
};

const processEvent = (event, context, callback) => {
	console.log('sns received:' + JSON.stringify(event, null, 2));
	var fleepMessage = null;
	const eventSubscriptionArn = event.Records[0].EventSubscriptionArn;
	const eventSnsSubject = event.Records[0].Sns.Subject || 'no subject';
	const eventSnsMessage = event.Records[0].Sns.Message;
	
	if(eventSubscriptionArn.indexOf(config.services.codepipeline.match_text) > -1 || eventSnsSubject.indexOf(config.services.codepipeline.match_text) > -1 || eventSnsMessage.indexOf(config.services.codepipeline.match_text) > -1){
		console.log('processing codepipeline notification');
		fleepMessage = handleCodePipeline(event, context, callback);
	}
	else if(eventSubscriptionArn.indexOf(config.services.elasticbeanstalk.match_text) > -1 || eventSnsSubject.indexOf(config.services.elasticbeanstalk.match_text) > -1 || eventSnsMessage.indexOf(config.services.elasticbeanstalk.match_text) > -1){
		console.log('processing elasticbeanstalk notification');
		fleepMessage = handleElasticBeanstalk(event, context, callback);
	}
	else if(eventSubscriptionArn.indexOf(config.services.cloudwatch.match_text) > -1 || eventSnsSubject.indexOf(config.services.cloudwatch.match_text) > -1 || eventSnsMessage.indexOf(config.services.cloudwatch.match_text) > -1){
		console.log('processing cloudwatch notification');
		fleepMessage = handleCloudWatch(event, context, callback);
	}
	else if(eventSubscriptionArn.indexOf(config.services.codedeploy.match_text) > -1 || eventSnsSubject.indexOf(config.services.codedeploy.match_text) > -1 || eventSnsMessage.indexOf(config.services.codedeploy.match_text) > -1){
		console.log('processing codedeploy notification');
		fleepMessage = handleCodeDeploy(event, context, callback);
	}
	else if(eventSubscriptionArn.indexOf(config.services.elasticache.match_text) > -1 || eventSnsSubject.indexOf(config.services.elasticache.match_text) > -1 || eventSnsMessage.indexOf(config.services.elasticache.match_text) > -1){
		console.log('processing elasticache notification');
		fleepMessage = handleElasticache(event, context, callback);
	}
	else if(eventSubscriptionArn.indexOf(config.services.autoscaling.match_text) > -1 || eventSnsSubject.indexOf(config.services.autoscaling.match_text) > -1 || eventSnsMessage.indexOf(config.services.autoscaling.match_text) > -1){
		console.log('processing autoscaling notification');
		fleepMessage = handleAutoScaling(event, context, callback);
	}
	else{
		fleepMessage = handleCatchAll(event, context, callback);
	}
	
	postMessage(fleepMessage, response => {
		if (response.statusCode < 400) {
			console.info('message posted successfully');
			callback(null, event);
		} else if (response.statusCode < 500) {
			console.error('error posting message to slack API: ' + response.statusCode + ' - ' + response.statusMessage);
			// Don't retry because the error is due to a problem with the request
			callback(null, event);
		} else {
			// Let Lambda retry
			context.fail('server error when processing message: ' + response.statusCode + ' - ' + response.statusMessage);
		}
	});
};

exports.handler = (event, context, callback) => {
	if (hookUrl) {
		processEvent(event, context, callback);
	} else if (config.unencryptedHookUrl) {
		hookUrl = config.unencryptedHookUrl;
		processEvent(event, context, callback);
	} else if (config.kmsEncryptedHookUrl && config.kmsEncryptedHookUrl !== '<kmsEncryptedHookUrl>') {
		var encryptedBuf = new Buffer(config.kmsEncryptedHookUrl, 'base64');
		var cipherText = { CiphertextBlob: encryptedBuf };
		var kms = new AWS.KMS();
		
		kms.decrypt(cipherText, (err, data) => {
			if (err) {
				console.log('decrypt error: ' + err);
				processEvent(event, context, callback);
			} else {
				hookUrl = 'https://' + data.Plaintext.toString('ascii');
				processEvent(event, context, callback);
			}
		});
	} else {
		context.fail('hook url has not been set.');
	}
};