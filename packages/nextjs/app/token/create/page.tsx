import { redirect } from 'next/navigation';

export default function TokenCreatePage() {
  redirect('/create?type=token');
}
