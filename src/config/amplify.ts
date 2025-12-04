import { Amplify } from "aws-amplify";
import { parseAmplifyConfig } from "aws-amplify/utils";
import amplifyOutputs from "../../amplify_outputs.json";

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
  // In development, use Vite proxy to avoid CORS issues
  // The proxy forwards /api/* requests to localhost:3002
  if (import.meta.env.DEV) {
    return "";
  }

  // In production, use the API Gateway URL from amplify_outputs
  const customApi = outputs.custom?.API;
  if (customApi) {
    const apiName = Object.keys(customApi)[0];
    if (apiName && customApi[apiName]?.endpoint) {
      // Endpoint already includes the stage (e.g., https://xxx.execute-api.us-west-1.amazonaws.com/prod/)
      // Remove trailing slash if present since our API paths start with /
      const endpoint = customApi[apiName].endpoint;
      return endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
    }
  }

  // Fallback to relative URLs (will use Vite proxy if configured)
  return "";
}

export { outputs };
