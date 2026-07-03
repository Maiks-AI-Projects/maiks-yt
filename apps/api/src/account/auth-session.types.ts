export type AuthSessionSnapshot = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  session: {
    id?: string;
    userId?: string;
  };
} | null;
