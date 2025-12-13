# Personal Weather Station Alexa Smart Home Skill

This repository contains an AWS Lambda handler for an Alexa **Smart Home** skill that exposes five virtual devices sourced from your personal weather station. Each device can be used in Alexa routines:

- Outside temperature (`Alexa.TemperatureSensor`)
- Wind speed (`Alexa.RangeController`)
- Barometric pressure (`Alexa.RangeController`)
- Precipitation rate (`Alexa.RangeController`)
- Solar radiation (`Alexa.RangeController`)

The handler expects a weather-station API that returns current readings. Discovery and state reporting are implemented so that each reading becomes a separate device Alexa can target in routines.

## Configuration

The Lambda function pulls configuration from environment variables and falls back to the values you provided:

| Variable | Purpose | Default |
| --- | --- | --- |
| `PWS_API_URL` | Base URL for the weather endpoint (should return JSON). | `https://api.weather.com/v2/pws/observations/current` |
| `PWS_API_KEY` | API key for the weather service. | `f1994ef8630f4028994ef8630fd02897` |
| `PWS_STATION_ID` | Weather station identifier. | `IVILNI74` |
| `PWS_UNITS` | Unit system to request from the API (`m` for metric, `e` for imperial). | `m` |

Requests are built as `PWS_API_URL?stationId=<PWS_STATION_ID>&format=json&units=<PWS_UNITS>&apiKey=<PWS_API_KEY>`, matching the [Weather.com PWS API](https://api.weather.com/v2/pws/observations/current?stationId=KMAHANOV10&format=json&units=e&apiKey=yourApiKey).

## Deployment overview

1. Create and configure an AWS Lambda function that runs the Smart Home handler and can access your weather API.
2. Create a **Smart Home** skill in the Alexa Developer Console and point it at the Lambda ARN.
3. Enable the skill and run device discovery to surface the five virtual weather devices in Alexa.

## Set up AWS Lambda

1. In the AWS console, go to **IAM → Roles → Create role**. Choose **AWS service → Lambda**, then attach the **AWSLambdaBasicExecutionRole** policy for CloudWatch logging. Name the role (e.g., `pws-smart-home-role`) and create it.
2. Go to **Lambda → Create function**. Choose **Author from scratch**, select **Node.js 18.x** (or newer) as the runtime, and pick the IAM role you created above. Name the function (e.g., `pws-smart-home`).
3. Upload the code:
   - Option A: Zip this repository (or just `src/` plus `package.json`) and upload via **Code → Upload from → .zip file**.
   - Option B: Use the **Upload from → Amazon S3** option if you prefer to store the bundle in S3.
4. In **Configuration → Environment variables**, add the keys from the table above if you need to override defaults (especially `PWS_API_KEY`, `PWS_STATION_ID`, or `PWS_UNITS`).
5. In **Configuration → General configuration**, set the handler to `src/index.handler` if it is not already.
6. Save the function. Copy the **Function ARN**; you will use it in the Alexa Developer Console.

> Tip: You can test the Lambda in the console with a simple event that calls `Alexa.Discovery`, or using the `node` snippet in [Testing locally](#testing-locally).

## Add the skill in the Alexa Developer Console

These steps assume you already have an AWS account and have deployed the Lambda from this repo.

1. Visit [developer.amazon.com/alexa](https://developer.amazon.com/alexa) and choose **Create Skill**.
2. Enter a skill name (e.g., "Personal Weather Station"), pick your default language, and select **Smart Home** as the model.
3. Under **Choose a method to host your skill's backend resources**, pick **Provision your own** and click **Create skill**.
4. In the **Smart Home service endpoint** section, select **AWS Lambda ARN** and paste the Lambda ARN you deployed earlier.
5. Click **Save**. Copy the **Skill ID** from the top of the page.
6. In the AWS Lambda console, add an **Alexa Smart Home** trigger to your function and paste the Skill ID when prompted, then save.
7. Back in the Alexa Developer Console, build the model (if prompted) and click **Save** once more.
8. Enable the skill in your Alexa mobile app (or via the console's **Test** tab with `Development` enabled), then run device discovery. The five virtual devices—temperature, wind speed, pressure, precipitation, and solar radiation—should appear and become available for routines.

## How it works

- **Discovery**: `src/index.js` responds to the `Alexa.Discovery` directive with five endpoints, one per reading, each supporting `retrievable` properties.
- **State reporting**: On `Alexa.ReportState`, the handler fetches a fresh reading via `src/weatherClient.js`, maps the requested endpoint to the relevant property, and returns the value in Alexa's expected schema.
- **Extensibility**: `src/weatherClient.js` normalizes several likely field names (e.g., `wind_speed`, `windSpeed`, or `wind`). If your API returns different keys, adjust the mapping in that file.

## Testing locally

There are no automated tests yet. To quickly exercise the handler, you can simulate a directive payload with `node`:

```bash
node -e "const h=require('./src'); h.handler({directive:{header:{namespace:'Alexa.Discovery',name:'Discover'},payload:{} } }).then(console.log)"
```

Replace the input event to mimic `Alexa.ReportState` for an endpoint (e.g., `pws-wind-speed`) as needed.
