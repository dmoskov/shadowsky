import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";


import { createLogger } from '../utils/logger';

const logger = createLogger('Userequiredparamx');
/**
 * Hook to safely extract and validate a required route parameter.
 * If the parameter is missing, it shows an error state instead of crashing.
 *
 * @param paramName - The name of the required route parameter
 * @returns An object with the validated parameter value and an error component if validation fails
 */
export function useRequiredParam(paramName: string): {
  value: string | null;
  isValid: boolean;
} {
  const params = useLocalSearchParams();
  const paramValue = params[paramName];

  // Convert param value to string or null
  const value =
    typeof paramValue === "string"
      ? paramValue
      : Array.isArray(paramValue)
        ? paramValue[0] || null
        : null;

  const isValid = !!value;

  // Log error for debugging when param is missing
  useEffect(() => {
    if (!isValid) {
      logger.error(`Missing required route parameter: ${paramName}`,
      );
    }
  }, [isValid, paramName]);

  return { value, isValid };
}

/**
 * Hook to safely extract and validate multiple required route parameters.
 *
 * @param paramNames - Array of required parameter names
 * @returns An object with a values map and validation status
 */
export function useRequiredParams(paramNames: string[]): {
  values: Record<string, string | null>;
  isValid: boolean;
} {
  const params = useLocalSearchParams();

  const values: Record<string, string | null> = {};
  let allValid = true;

  for (const paramName of paramNames) {
    const paramValue = params[paramName];
    const value =
      typeof paramValue === "string"
        ? paramValue
        : Array.isArray(paramValue)
          ? paramValue[0] || null
          : null;

    values[paramName] = value;
    if (!value) {
      allValid = false;
      logger.error(`Missing required route parameter: ${paramName}`,
      );
    }
  }

  return { values, isValid: allValid };
}
