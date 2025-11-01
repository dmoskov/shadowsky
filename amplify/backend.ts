import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { writingFeedback } from './functions/writing-feedback/resource';
import { generateAltText } from './functions/generate-alt-text/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
defineBackend({
  auth,
  data,
  writingFeedback,
  generateAltText,
});
