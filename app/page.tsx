import { validateRequest } from '@/lib/auth';
import Unauthorized from './unauthorized';
import Dashboard from './(dashboard)/dashboard-wrapper';

export default async function Home() {
  const { user } = await validateRequest();
  if (!user) {
    return <Unauthorized />;
  }
  return <Dashboard user={user} />;
}
