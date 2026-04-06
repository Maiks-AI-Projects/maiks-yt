import { WorkOS } from '@workos-inc/node';

if (!process.env.WORKOS_API_KEY) {
  throw new Error('WORKOS_API_KEY is not set');
}

export const workos = new WorkOS(process.env.WORKOS_API_KEY);
