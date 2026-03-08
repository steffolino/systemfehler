export default function AdminLogin() {
  return (
    <div className="max-w-md mx-auto p-8">
      <h2 className="text-xl font-bold mb-4">Admin Login</h2>
      <a
        href="/api/auth/github/login"
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Sign in with GitHub
      </a>
    </div>
  );
}
