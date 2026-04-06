import { auth } from '@workos-inc/authkit-nextjs';

export default async function AuthExamplePage() {
  // Check if the user is logged in
  const { user } = await auth();

  if (!user) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">You are not logged in.</h1>
        <p className="mt-4">
          <a href="/api/auth/login" className="text-blue-600 hover:underline">
            Click here to log in
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Logged in as: {user.firstName} {user.lastName}</h1>
      <p className="mt-4">Email: {user.email}</p>
      <div className="mt-8">
        <p>This page is protected on the server using the WorkOS AuthKit <code>auth()</code> helper.</p>
      </div>
    </div>
  );
}
