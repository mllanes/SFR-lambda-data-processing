CREATE OR REPLACE STREAM "PressureAnomaliesOutput" (
    "serialNumber" VARCHAR(10),
    "customerId" VARCHAR(36),
    "collectedAt" BIGINT,
    "pressure" DOUBLE,
    "avgPressure" DOUBLE,
    "filterExhausted" BOOLEAN
    );

CREATE OR REPLACE PUMP "PressureAnomaliesOutput-PUMP" AS INSERT INTO "PressureAnomaliesOutput"
SELECT STREAM *
FROM (
    SELECT STREAM
        "serialNumber",
        "customerId",
        "collectedAt",
        "pressure",
        AVG("pressure") OVER W1 as "avgPressure",
        "pressure" BETWEEN 1000 AND 10326.5
    FROM "SFR_001"
    WINDOW W1 AS (PARTITION BY "customerId" RANGE INTERVAL '30' SECOND PRECEDING)
)
-- Anomaly: Pressure equalizes with atmosphere. Use case:
--------------------------------------------------------
-- Atmospheric pressure is 10332 mmH20. There is no filter or the filter broke and the air if flowing directly without ALMOST ANY resistance

WHERE "avgPressure" >= 10330

-- Anomaly: Drastically low pressure. Use cases:
-----------------------------------------------------
-- The air filter is letting almost no air to pass through.
-- The air duct is obstructed. The air filter might have been sucked into the duct.
-- If pressure = 0 the avg will quickly drop;  it means that the sensor is broken; pressure = 0 its an absolute vacuum... not even in outer space :-)
OR "avgPressure" < 1000


-- Normal wear: Filter need to be replaced when pressure drops under 10326.5 but not less than 1000;
----------------------------------------------------------------------------------------------------

OR "pressure" BETWEEN 1000 AND 10326.5
