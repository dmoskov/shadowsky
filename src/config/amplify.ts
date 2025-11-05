import { Amplify } from 'aws-amplify';
import { parseAmplifyConfig } from 'aws-amplify/utils';
import amplifyOutputs from '../../amplify_outputs.json';

// Type for the extended amplify outputs with custom API configuration
type AmplifyOutputsWithAPI = typeof amplifyOutputs & {
  custom?: {
    API?: {
      [key: string]: {
        endpoint: string;
        region: string;
        apiName: string;
      };
    };
  };
};

const outputs: AmplifyOutputsWithAPI = amplifyOutputs;

// Parse the base Amplify configuration
const amplifyConfig = parseAmplifyConfig(outputs);

// Configure Amplify
Amplify.configure({
  ...amplifyConfig,
  API: {
    ...amplifyConfig.API,
    REST: outputs.custom?.API || {},
  },
});

// Get API base URL
export function getApiBaseUrl(): string {
  // In development, use relative URLs (proxied through Vite)
  if (import.meta.env.DEV) {
    return '';
  }

  // In production, use the API Gateway URL from amplify_outputs
  const customApi = outputs.custom?.API;
  if (customApi) {
    const apiName = Object.keys(customApi)[0];
    if (apiName && customApi[apiName]?.endpoint) {
      // Return the base URL with /prod/api path
      return `${customApi[apiName].endpoint}prod`;
    }
  }

  // Fallback to relative URLs
  return '';
}

export { outputs };
