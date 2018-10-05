module.exports = {

	kmsEncryptedHookUrl: process.env.KMS_ENCRYPTED_HOOK_URL, // encrypted fleep webhook url
	unencryptedHookUrl: process.env.UNENCRYPTED_HOOK_URL,    // unencrypted fleep webhook url
	fleepUsername: process.env.FLEEP_USERNAME,               // "AWS SNS via Lamda", // fleep username to user for messages

	services: {
		elasticbeanstalk: {
			// text in the sns message or topicname to match on to process this service type
			match_text: 'ElasticBeanstalkNotifications'
		},
		cloudwatch: {
			// text in the sns message or topicname to match on to process this service type
			match_text: 'CloudWatchNotifications'
		},
		codepipeline: {
			// text in the sns message or topicname to match on to process this service type
			match_text: 'CodePipelineNotifications'
		},
		codedeploy: {
			// text in the sns message or topicname to match on to process this service type
			match_text: 'CodeDeploy'
		},
		elasticache: {
			// text in the sns message or topicname to match on to process this service type
			match_text: 'ElastiCache'
		},
		autoscaling: {
			// text in the sns message or topicname to match on to process this service type
			match_text: 'AutoScaling'
		}
	}

};