'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '../../lib/auth';

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredRole?: string
) {
  return function AuthenticatedComponent(props: P) {
    const router = useRouter();

    useEffect(() => {
      // Check authentication
      if (!authService.isAuthenticated()) {
        router.replace('/auth');
        return;
      }

      // Check token validity
      if (!authService.isTokenValid()) {
        authService.logout();
        router.replace('/auth');
        return;
      }

      // Check role if required
      if (requiredRole && !authService.hasRole(requiredRole)) {
        router.replace('/unauthorized');
        return;
      }
    }, [router]);

    // Only render if authenticated and authorized
    if (!authService.canAccess(requiredRole)) {
      return null;
    }

    return <Component {...props} />;
  };
}
