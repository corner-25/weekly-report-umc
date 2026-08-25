import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: 'ADMIN' | 'ANALYST' | 'STAFF';
      departmentId: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    role: 'ADMIN' | 'ANALYST' | 'STAFF';
    departmentId: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'ADMIN' | 'ANALYST' | 'STAFF';
    departmentId: string | null;
  }
}
