'use strict'

module.exports = {
  DynamoDB: {
    version: '2012-08-10',
    bathWriteSize: 25
  },
  SNS: {
    version: '2010-03-31'
  },
  /**
   * in seconds
   */
  notificationsDelay: 30
}
