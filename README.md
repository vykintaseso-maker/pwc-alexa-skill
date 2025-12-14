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
| `ALEXA_PROACTIVE_TOKEN` | Bearer token for sending proactive `ChangeReport` events to Alexa (used for routines). | _unset_ |

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

> UI note: Alexa renders RangeController sensors with a slider. That does not affect routine triggers or accuracy. Proactive updates (below) keep values fresh so the app shows the latest number instead of "Server is unresponsive".

## Configure Account Linking (Auth Code Grant)

If you want Alexa to exchange OAuth tokens on behalf of the user (for example, to secure access to your weather API), complete the **Account Linking** section in the Alexa Developer Console using **Auth Code Grant**:

1. Choose **Auth Code Grant** as the authorization grant type.
2. Supply the OAuth details from your identity provider (Login with Amazon values shown as an example):
   - **Your Web Authorization URI**: Where Alexa sends the user to sign in (e.g., `https://www.amazon.com/ap/oa`).
   - **Access Token URI**: The token endpoint that exchanges the authorization code (e.g., `https://api.amazon.com/auth/o2/token`).
   - **Your Client ID** and **Your Secret**: Values from your OAuth app / security profile.
   - **Your Authentication Scheme**: `HTTP Basic` (most providers, including Login with Amazon, expect basic auth on the token endpoint).
   - **Scope**: Space-separated scopes required by your API (e.g., `profile` or a custom scope your weather service enforces).
   - **Domain List**: Hostnames the Alexa mobile/web app is allowed to load during login. Include the domain of your authorization page (e.g., `www.amazon.com` or your IdP’s domain).
   - **Default Access Token Expiration Time**: Match your provider’s token lifetime (e.g., 3600 seconds for a one-hour token).
3. Copy the **Redirect URLs** shown in the console and add them to the **Allowed Return/Redirect URLs** list in your OAuth provider configuration. Alexa uses these URLs to receive the authorization code after the user signs in.
4. Save the Account Linking settings, then disable and re-enable the skill in the Alexa app to trigger the login flow before running device discovery or state reports.

### What if you don't have your own identity system?

Alexa Smart Home skills still require account linking so that Alexa can attach an access token to each directive. If you do not have user accounts of your own, use a lightweight OAuth provider so you can complete the Account Linking section:

- **Login with Amazon**: Create a Security Profile in the [Amazon Developer Console](https://developer.amazon.com/settings/console/home.html#/apiprofile) and use its client ID/secret as your OAuth app. Every user who enables the skill will sign in with their Amazon account, and you can treat the token as authorization to call your Lambda without mapping it to a separate user record.
- **Amazon Cognito (minimal setup)**: Create a Cognito User Pool with a single app client, enable the hosted UI for OAuth2, and allow a single scope (e.g., `openid`). You do not need to onboard users in Cognito—Alexa will obtain a token from the hosted UI during linking, and your Lambda can ignore the user identity if the token verifies against your app client.
- **Static/shared credentials**: If this is strictly for personal use, you can keep a single user in your OAuth provider and share the credentials with yourself. Alexa just needs to exchange an auth code for a token; your Lambda can accept any token issued by that client without differentiating users.

Skipping account linking entirely is not supported for Smart Home skills (unless you use Alexa Connect Kit hardware). Configure one of the options above so Alexa can obtain a token during skill enablement.

### Example: set up Amazon Cognito for this skill

If you want a lightweight identity provider without managing your own users, you can use the Cognito hosted UI to satisfy Alexa's Account Linking requirements:

1. In AWS, go to **Cognito → User pools → Create user pool**. Choose **Email** as a required attribute (or leave defaults) and create the pool.
2. In **App integration → App clients**, create a new client (e.g., `alexa-pws-client`). Enable **Generate client secret** and **Enable username password auth**. Save the app client.
3. Still under **App integration**, open **Hosted UI → Domains** and set a unique domain prefix (e.g., `pws-alexa-demo`). In some regions AWS will assign a generated prefix if your desired name is unavailable; that is fine. Copy the domain **without the scheme** (e.g., `pws-alexa-demo.auth.<region>.amazoncognito.com`).
4. Under **Hosted UI → App client settings**, configure the OAuth flow:
   - **Allowed callback URLs**: Add the redirect URLs from the Alexa **Account Linking** page.
   - **Allowed sign-out URLs**: Optional; can be left blank.
   - **Allowed OAuth flows**: Check **Authorization code grant**.
   - **Allowed OAuth scopes**: Select `openid` (and `profile` if you prefer), keeping the scope list minimal.
   - Save the changes.
5. In the Alexa Developer Console **Account Linking** section, plug in the Cognito hosted UI endpoints:
   - **Authorization URI**: `https://<your-domain>.auth.<region>.amazoncognito.com/oauth2/authorize`
   - **Access Token URI**: `https://<your-domain>.auth.<region>.amazoncognito.com/oauth2/token`
   - **Client ID** / **Client Secret**: Values from the Cognito app client.
   - **Scope**: `openid` (and `profile` if you selected it).
   - **Authentication scheme**: `HTTP Basic`.
   - **Domain list**: Add `<your-domain>.auth.<region>.amazoncognito.com` **without** `https://`. If Cognito assigned you a generated domain such as `us-east-1bw1dmbdqq.auth.us-east-1.amazoncognito.com`, paste that host as-is; the Alexa console rejects entries with the URL scheme.
6. Save the Account Linking settings in Alexa, then disable and re-enable the skill to trigger the hosted UI login. Alexa will obtain an access token from Cognito and include it on subsequent directives, even if you do not map it to user records in your Lambda.

### Troubleshoot account linking errors with Cognito

If the Alexa app shows **Unable to link the skill** and Cognito returns an `error` parameter, double-check these items:

1. **Domain list format** (Alexa console): Enter only the hostname (e.g., `us-east-1bw1dmbdqq.auth.us-east-1.amazoncognito.com`). Do **not** include `https://` or path segments.
2. **Authorization URI** (Alexa console): Use `https://<domain>/oauth2/authorize`. Do not append query parameters; Alexa will add them.
3. **Access token URI** (Alexa console): Use `https://<domain>/oauth2/token`.
4. **Redirect URLs** (Cognito hosted UI → App client settings): Paste **all** Alexa redirect URLs shown in the Account Linking page. A missing URL will cause Cognito to reject the request with an `error=invalid_request`.
5. **Allowed OAuth flows** (Cognito hosted UI → App client settings): Enable **Authorization code grant**. Disable implicit grant unless you need it.
6. **Allowed OAuth scopes** (Cognito hosted UI → App client settings): Include every scope listed in the Alexa console (e.g., `openid profile`). A scope mismatch triggers an error from Cognito.
7. **Identity providers** (Cognito hosted UI → App client settings): Check **Cognito User Pool** so the hosted UI can present the login form.
8. **App client secret** (Cognito → App clients): If the Alexa console is configured for `HTTP Basic`, ensure the app client was created **with** a secret and that the secret matches the one in Alexa. If you prefer no secret, set Alexa's authentication scheme to **Credentials in request body** and recreate the app client without a secret.
9. After saving both Cognito and Alexa settings, **disable and re-enable** the skill to force a fresh login.

Check the **CloudWatch Logs** for your Lambda and the **Monitoring → CloudWatch** section of your Cognito user pool to see the exact OAuth error (e.g., `invalid_client`, `unauthorized_client`, or `invalid_request`). Addressing the specific reason there usually resolves the linking failure.

## How it works

- **Discovery**: `src/index.js` responds to the `Alexa.Discovery` directive with five endpoints, one per reading, each supporting `retrievable` properties.
- **State reporting**: On `Alexa.ReportState`, the handler fetches a fresh reading via `src/weatherClient.js`, maps the requested endpoint to the relevant property, and returns the value in Alexa's expected schema.
- **Extensibility**: `src/weatherClient.js` normalizes several likely field names (e.g., `wind_speed`, `windSpeed`, or `wind`). If your API returns different keys, adjust the mapping in that file.

## Keep readings fresh for routines (3-minute updates)

Alexa only offers sensors as routine triggers when they are **proactively reported**. The Lambda now supports proactive `ChangeReport` events and a scheduled refresh so every weather reading is pushed roughly every three minutes:

1. Generate an LWA access token that can call the Alexa event gateway. The token should target the Smart Home skill client you registered in the developer console. Set it as `ALEXA_PROACTIVE_TOKEN` in the Lambda environment.
2. In **Amazon EventBridge (CloudWatch Events)**, create a **Schedule** rule with a fixed rate of `3 minutes` that targets this Lambda function.
3. When the rule fires, the Lambda will fetch the latest weather snapshot once and send a proactive `ChangeReport` for all five endpoints. The same change report is also emitted after any on-demand `ReportState` request when `ALEXA_PROACTIVE_TOKEN` is present.

This combination keeps the Alexa app display current (reducing "Server is unresponsive" messages), surfaces all five devices in the routine picker, and lets you drive other devices based on thresholds (e.g., turn on outdoor lights when solar radiation drops below 10).

### Step-by-step: create the 3-minute EventBridge rule

Follow these steps to schedule the proactive refresh without needing a custom payload:

1. In the AWS console, open **Amazon EventBridge → Events → Rules → Create rule**.
2. Name the rule (e.g., `pws-every-3-minutes`) and choose **Schedule** as the rule type.
3. Under **Schedule pattern**, select **A recurring schedule** and choose **Rate expression**. Enter `3` and select **Minutes** so the expression becomes `rate(3 minutes)`.
4. Click **Next**, then under **Select targets** choose **AWS service → Lambda function** and pick your deployed weather-station Lambda.
5. Leave **Retry policy and dead-letter queue** at defaults unless you have specific operational requirements. No input transformation is required; leave **Invoke target with** set to **Input matched to the rule**.
6. Click **Next** through the remaining steps and **Create rule**. EventBridge will start invoking the Lambda every three minutes. The Lambda code will detect the scheduled event and send `ChangeReport` updates for all endpoints using the `ALEXA_PROACTIVE_TOKEN` you configured.

> Tip: You can confirm invocations are arriving by opening **Lambda → Monitor → Logs** and verifying entries every three minutes. If you do not see events, confirm the rule state is **Enabled** and that the Lambda has permissions to be invoked by EventBridge (automatically added when you set the target).

## Testing locally

There are no automated tests yet. To quickly exercise the handler, you can simulate a directive payload with `node`:

```bash
node -e "const h=require('./src'); h.handler({directive:{header:{namespace:'Alexa.Discovery',name:'Discover'},payload:{} } }).then(console.log)"
```

Replace the input event to mimic `Alexa.ReportState` for an endpoint (e.g., `pws-wind-speed`) as needed.

## Troubleshooting device discovery

If the Lambda test event succeeds but Alexa cannot find devices during discovery:

1. Confirm the skill type is **Smart Home** (not Custom). Discovery only runs for Smart Home skills.
2. In the Lambda console, add an **Alexa Smart Home** trigger and paste the Skill ID from the developer console. Without this trigger, Alexa cannot invoke the Lambda.
3. In the Alexa Developer Console **Smart Home service endpoint** section, verify the Lambda ARN matches the function you deployed (region-sensitive).
4. Enable the skill for your account (mobile app or **Test** tab with `Development` enabled), then run discovery again. You should see five devices after a successful **Discover** directive.
5. If discovery still fails, check **CloudWatch Logs** for the Lambda to confirm whether Alexa sent a `Discover` directive and whether any errors were thrown during `buildDiscoveryResponse`.
