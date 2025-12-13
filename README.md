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
| `PWS_API_URL` | Base URL for the weather endpoint (should return JSON). | `https://api.example.com/weather` |
| `PWS_API_KEY` | API key for the weather service. | `f1994ef8630f4028994ef8630fd02897` |
| `PWS_DEVICE_ID` | Weather station identifier. | `IVILNI74` |
| `PWS_DEVICE_KEY` | Device-level secret, if required by the API. | `lBadpl8H` |

The code builds the request as `<PWS_API_URL>?apiKey=...&deviceId=...&deviceKey=...`. Update `PWS_API_URL` (and the defaults, if you prefer) to match the endpoint described in your API documentation.

## Deployment

1. Create a new **Smart Home** skill in the Alexa Developer Console and choose **AWS Lambda** as the endpoint.
2. Deploy `src/index.js` to a Lambda function (Node.js 18 runtime or later). Set the environment variables from the table above so the function can reach your weather API.
3. In the Alexa skill configuration, use the Lambda ARN as the default endpoint.
4. From the Alexa app, disable and re-enable the skill to trigger device discovery. The five devices listed above should appear and be available to routines.

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
