'use strict'

const bluebird = require('bluebird')
const exec = bluebird.promisify(require('child_process').exec)
const fs = require('fs-extra')
const path = require('path')

class Deployment {
  static deploy (sourcePath, parameters) {
    return bluebird.try(() => {
      sourcePath = path.resolve(sourcePath)

      const pkg = require(`${sourcePath}/package.json`)
      const lambdaName = pkg.name
      const tmpDir = path.resolve(`${process.env.HOME}/.${lambdaName}`)
      const bundle = `code.zip`

      console.log(`Deploying lambda ${lambdaName} and it's infrastructure. Please wait...`)

      return fs.remove(tmpDir)
        .then(() => fs.mkdirs(tmpDir))
        .then(() => fs.copy(`${sourcePath}/`, `${tmpDir}/`))
        .then(() => exec(`cd ${tmpDir} && zip -r ${tmpDir}/${bundle} * >/dev/null`))
        .then(() => exec(`aws s3api create-bucket --bucket ${lambdaName} --acl private`))
        .then(() => exec(`aws s3 cp ${tmpDir}/${bundle} s3://${lambdaName}/${bundle}`))
        .then(() => Deployment._deployInfrastructure(sourcePath, parameters))
        .then(() => exec(`aws lambda update-function-code --function-name ${lambdaName} --s3-bucket ${lambdaName} --s3-key ${bundle}`))
        .then(() => exec(`aws lambda publish-version --function-name ${lambdaName}`))
        .then(() => Deployment._startKinesisAnalyticsApp())
        .then(() => console.log(`Infrastructure and Lambda ready!`))
    })
  }

  static _deployInfrastructure (sourcePath, parameters) {
    const templateFile = `${sourcePath}/infrastructure/template.json`
    const pkg = require(`${sourcePath}/package.json`)
    const lambdaName = pkg.name

    return fs.pathExists(templateFile)
      .then(exists => {
        if (!exists) {
          throw new Error(`Couldn't find resources for lambda ${lambdaName} at ${sourcePath}/infrastructure/template.json`)
        }

        const stackFile = `${process.env.HOME}/.stack-${lambdaName}.json`
        let cfOptions = `--capabilities CAPABILITY_NAMED_IAM --template-body file:///${stackFile}`

        if (parameters) {
          cfOptions += ` --parameters ${parameters}`
        }

        return fs.readFile(`${sourcePath}/infrastructure/kinesisAnalyticsCode.sql`)
          .then(appSql => {
            appSql = appSql.toString()
            const template = require(templateFile)
            template.Resources.RealTimePressureAnomalyDetectionApplication.Properties.ApplicationCode = appSql

            return fs.writeJson(stackFile, template, {spaces: 2})
              .then(() => Deployment._upsertStack(lambdaName, cfOptions))
          })
      })
  }

  static _upsertStack (stackName, cfOptions) {
    return exec(`aws cloudformation create-stack --stack-name ${stackName} ${cfOptions}`)
      .catch(err => {
        if (err.toString().indexOf(`Stack [${stackName}] already exists`) > -1) {
          return exec(`aws cloudformation update-stack --stack-name ${stackName} ${cfOptions}`)
        }
        throw err
      })
      .catch(err => {
        if (err.toString().indexOf(`No updates are to be performed`) === -1) {
          throw err
        }
      })
      .then(() => exec(`aws cloudformation describe-stacks --stack-name ${stackName} --query Stacks[0] --output json`))
      .then(res => {
        res = JSON.parse(res)
        const statusToWaitFor = res.StackStatus.indexOf('CREATE') > -1 ? 'stack-create-complete' : 'stack-update-complete'
        return exec(`aws cloudformation wait ${statusToWaitFor} --stack-name ${stackName}`)
      })
  }

  static _startKinesisAnalyticsApp () {
    const appName = 'SFR-pressure-anomaly-detection'
    return exec(`aws kinesisanalytics describe-application --application-name ${appName} --query ApplicationDetail --output json`)
      .then(res => {
        const appDetails = JSON.parse(res)
        if (appDetails.ApplicationStatus.indexOf('RUNNING') === -1) {
          const config = JSON.stringify({
            Id: appDetails.InputDescriptions[0].InputId,
            InputStartingPositionConfiguration: {
              InputStartingPosition: 'LAST_STOPPED_POINT'
            }
          })
          return exec(`aws kinesisanalytics start-application --application-name ${appName} --input-configurations '${config}'`)
            .then(() => Deployment._waitForKinesisAppToStart(appName))
            .then(() => console.log(`Kinesis analytics app ${appName} is now running!`))
        }
        console.log(`Kinesis analytics app ${appName} is already running!`)
      })
  }

  static _waitForKinesisAppToStart (appName) {
    return bluebird.delay(3000)
      .then(() => exec(`aws kinesisanalytics describe-application --application-name ${appName} --query ApplicationDetail.ApplicationStatus`))
      .then(res => res.toString().indexOf('RUNNING') === -1 ? Deployment._waitForKinesisAppToStart(appName) : Promise.resolve())
  }
}

module.exports = Deployment
