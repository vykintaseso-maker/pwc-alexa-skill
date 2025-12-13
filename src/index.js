const { fetchWeatherSnapshot } = require('./weatherClient');

const ENDPOINTS = [
  {
    endpointId: 'pws-outside-temp',
    friendlyName: 'Outside Temperature',
    description: 'Personal weather station outside temperature',
    displayCategories: ['TEMPERATURE_SENSOR'],
    capability: {
      type: 'AlexaInterface',
      interface: 'Alexa.TemperatureSensor',
      version: '3',
      properties: {
        supported: [{ name: 'temperature' }],
        retrievable: true,
        proactivelyReported: false,
      },
    },
  },
  {
    endpointId: 'pws-wind-speed',
    friendlyName: 'Wind Speed',
    description: 'Personal weather station wind speed',
    displayCategories: ['SENSOR'],
    capability: buildRangeCapability({
      instance: 'WindSpeed',
      friendlyName: 'Wind speed',
      unitOfMeasure: 'm/s',
      min: 0,
      max: 200,
      precision: 0.1,
    }),
  },
  {
    endpointId: 'pws-pressure',
    friendlyName: 'Barometric Pressure',
    description: 'Personal weather station pressure sensor',
    displayCategories: ['SENSOR'],
    capability: buildRangeCapability({
      instance: 'Pressure',
      friendlyName: 'Pressure',
      unitOfMeasure: 'hPa',
      min: 800,
      max: 1100,
      precision: 0.1,
    }),
  },
  {
    endpointId: 'pws-precipitation',
    friendlyName: 'Precipitation Rate',
    description: 'Personal weather station precipitation sensor',
    displayCategories: ['SENSOR'],
    capability: buildRangeCapability({
      instance: 'Precipitation',
      friendlyName: 'Precipitation',
      unitOfMeasure: 'mm/h',
      min: 0,
      max: 200,
      precision: 0.1,
    }),
  },
  {
    endpointId: 'pws-solar-radiation',
    friendlyName: 'Solar Radiation',
    description: 'Personal weather station solar radiation sensor',
    displayCategories: ['SENSOR'],
    capability: buildRangeCapability({
      instance: 'SolarRadiation',
      friendlyName: 'Solar radiation',
      unitOfMeasure: 'W/m^2',
      min: 0,
      max: 2000,
      precision: 1,
    }),
  },
];

const ATTRIBUTE_TO_ENDPOINT = {
  outsideTemperature: 'pws-outside-temp',
  windSpeed: 'pws-wind-speed',
  pressure: 'pws-pressure',
  precipitation: 'pws-precipitation',
  solarRadiation: 'pws-solar-radiation',
};

exports.handler = async (event, context) => {
  const directive = event.directive;
  const namespace = directive?.header?.namespace;

  if (namespace === 'Alexa.Discovery' && directive.header.name === 'Discover') {
    return buildDiscoveryResponse();
  }

  if (namespace === 'Alexa' && directive.header.name === 'ReportState') {
    const endpointId = directive.endpoint.endpointId;
    return handleStateReport(endpointId, directive.header.correlationToken, directive.endpoint.scope);
  }

  throw new Error(`Unsupported directive: ${namespace}`);
};

function buildRangeCapability({ instance, friendlyName, unitOfMeasure, min, max, precision }) {
  return {
    type: 'AlexaInterface',
    interface: 'Alexa.RangeController',
    instance,
    version: '3',
    properties: {
      supported: [{ name: 'rangeValue' }],
      retrievable: true,
      proactivelyReported: false,
    },
    capabilityResources: {
      friendlyNames: [
        {
          '@type': 'text',
          value: {
            text: friendlyName,
            locale: 'en-US',
          },
        },
      ],
    },
    configuration: {
      supportedRange: {
        minimumValue: min,
        maximumValue: max,
        precision,
      },
      unitOfMeasure,
    },
  };
}

function buildDiscoveryResponse() {
  const endpoints = ENDPOINTS.map((endpoint) => ({
    endpointId: endpoint.endpointId,
    manufacturerName: 'Personal Weather Station',
    friendlyName: endpoint.friendlyName,
    description: endpoint.description,
    displayCategories: endpoint.displayCategories,
    cookie: {},
    capabilities: [
      endpoint.capability,
      {
        type: 'AlexaInterface',
        interface: 'Alexa',
        version: '3',
      },
    ],
  }));

  return {
    event: {
      header: {
        namespace: 'Alexa.Discovery',
        name: 'Discover.Response',
        payloadVersion: '3',
        messageId: randomMessageId(),
      },
      payload: { endpoints },
    },
  };
}

async function handleStateReport(endpointId, correlationToken, scope) {
  const snapshot = await fetchWeatherSnapshot();
  const properties = buildProperties(snapshot, endpointId);

  return {
    context: { properties },
    event: {
      header: {
        namespace: 'Alexa',
        name: 'StateReport',
        messageId: randomMessageId(),
        correlationToken,
        payloadVersion: '3',
      },
      endpoint: {
        scope,
        endpointId,
      },
      payload: {},
    },
  };
}

function buildProperties(snapshot, endpointId) {
  const now = new Date().toISOString();
  const props = [];

  if (endpointId === ATTRIBUTE_TO_ENDPOINT.outsideTemperature) {
    const value = toNumber(snapshot.outsideTemperature);
    props.push({
      namespace: 'Alexa.TemperatureSensor',
      name: 'temperature',
      value: { value, scale: 'CELSIUS' },
      timeOfSample: now,
      uncertaintyInMilliseconds: 500,
    });
  }

  const rangeMappings = [
    {
      endpointId: ATTRIBUTE_TO_ENDPOINT.windSpeed,
      instance: 'WindSpeed',
      value: snapshot.windSpeed,
    },
    {
      endpointId: ATTRIBUTE_TO_ENDPOINT.pressure,
      instance: 'Pressure',
      value: snapshot.pressure,
    },
    {
      endpointId: ATTRIBUTE_TO_ENDPOINT.precipitation,
      instance: 'Precipitation',
      value: snapshot.precipitation,
    },
    {
      endpointId: ATTRIBUTE_TO_ENDPOINT.solarRadiation,
      instance: 'SolarRadiation',
      value: snapshot.solarRadiation,
    },
  ];

  rangeMappings.forEach((mapping) => {
    if (endpointId === mapping.endpointId) {
      props.push({
        namespace: 'Alexa.RangeController',
        instance: mapping.instance,
        name: 'rangeValue',
        value: toNumber(mapping.value),
        timeOfSample: now,
        uncertaintyInMilliseconds: 500,
      });
    }
  });

  if (!props.length) {
    throw new Error(`No matching endpoint for ${endpointId}`);
  }

  return props;
}

function randomMessageId() {
  return `pws-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function toNumber(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Value ${value} is not a valid number`);
  }
  return parsed;
}
