import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getUserFromToken } from '@/lib/auth/simple-auth';

export default async function HomePage() {
  // Check if user has auth token
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    // Not authenticated → redirect to login
    redirect('/login');
  }

  // Verify token
  const result = await getUserFromToken(token);

  if (!result.success || !result.user) {
    // Invalid token → redirect to login
    redirect('/login');
  }

  // Default redirect to dashboard
  redirect('/dashboard');
}