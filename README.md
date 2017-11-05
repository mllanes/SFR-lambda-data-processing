# AWS IoT Challenge 2017 - [HVAC Smart Filter Replacement (SFR) project](http://aws-iot-challenge-2017.marcos.io)

### What is this app for?

It's a Lambda service that processes the data samples coming from [SFR-devices](https://github.com/mllanes/SFR-device) (raspberry pi +  pressure sensors) and notifies customers (via SMS) of detected pressure anomalies across the Air Filter.

### What do I need to deploy this?

* An AWS account
* AWS CLI an a profile with permissions to provision all the infrastructure (multiple services are used so the quick answer here is AdministratorAccess)
* Node.JS

### How do I deploy the lambda service and necessary infrastructure:

    npm install --production
    npm run deploy


### What *"anomalies"* would this app detect?

Drastically low pressure. Possible causes:
---
-- The air filter is letting almost no air to pass through.
-- The air duct is obstructed. The air filter might have been sucked into the duct.
-- If pressure = 0 the avg will quickly drop;  it means that the sensor is broken; pressure = 0 its an absolute vacuum... not even in outer space :-)

Pressure equalizes with atmosphere. Possible cause:
---
-- Atmospheric pressure is 10332 mmH20. There is no filter or the filter broke and the air is flowing directly with ALMOST NO resistance

Filter degradation/clogging. Possible cause:
---
-- Wear. Filter needs to be replaced when pressure drops under 10326.5 mmH2O but not less than 1000 mmH2O
