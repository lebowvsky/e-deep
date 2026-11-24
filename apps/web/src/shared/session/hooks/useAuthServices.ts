import { use } from 'react';
import { AuthServicesContext, type AuthServices } from '../authServices';

export function useAuthServices(): AuthServices {
  const services = use(AuthServicesContext);
  if (!services) {
    throw new Error('useAuthServices must be used inside <AuthServicesContext value={…}>.');
  }
  return services;
}
