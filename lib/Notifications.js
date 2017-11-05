'use strict'

const AWS = require('aws-sdk')
const bluebird = require('bluebird')
const constants = require('lib/config/constants')
const SNS = bluebird.promisifyAll(new AWS.SNS({
  apiVersion: constants.SNS.version
}))
const DynamoDB = bluebird.promisifyAll(new AWS.DynamoDB.DocumentClient({
  apiVersion: constants.DynamoDB.version,
  region: process.env.PROVISIONED_AWS_REGION
}))
const _ = require('lodash')
const testCustomers = require('test-customers.json')

class Notifications {
  static send (customerId, serialNumber, message) {
    const phoneNumber = _.find(testCustomers, {customerId: customerId}).mobilePhone

    return DynamoDB.getAsync({
      TableName: process.env.CUSTOMER_NOTIFICATIONS_TABLE,
      Key: {
        customerId: customerId,
        serialNumber: serialNumber
      }
    })
      .then(res => {
        if (!res.Item || Math.floor(Date.now() / 1000) > res.Item.ttl) {
          return SNS.publishAsync({
            Message: message,
            PhoneNumber: phoneNumber
          })
            .then(() => DynamoDB.putAsync({
              TableName: process.env.CUSTOMER_NOTIFICATIONS_TABLE,
              Item: {
                customerId: customerId,
                serialNumber: serialNumber,
                ttl: Math.floor(Date.now() / 1000) + constants.notificationsDelay
              }
            }))
            .then(() => console.log('Notification sent!'))
        }
      })
  }
}

module.exports = Notifications
