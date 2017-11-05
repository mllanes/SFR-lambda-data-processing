'use strict'

require('rootpath')()
const bluebird = require('bluebird')
const Notifications = require('lib/Notifications')

exports.handler = (event, context, cb) => {
  bluebird.each(event.Records, record => {
    return bluebird.try(() => {
      if (record.kinesis) {
        const data = JSON.parse(Buffer.from(record.kinesis.data, 'base64').toString('ascii'))
        /**
         * Detected anomalies or exhausted filter; send SMS notification via SNS topic
         */
        if (record.eventSourceARN.indexOf('RealTimePressureAnomalyDetectionOutputStream') > -1) {
          const msg = data.filterExhausted ? `Your Air Filter is exhausted. It's time to replace it!` : `Anomaly detected with your SFR system!. Check it ASAP!`
          return Notifications.send(data.customerId, data.serialNumber, msg)
        }
      }
      cb(new Error('Unknown event source'))
    })
  })
    .then(() => cb(null, 'Processing stage completed!'))
    .catch(cb)
}
