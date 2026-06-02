let token: string | null = null;

export const authStore = {
  getToken(): string | null {
    return token;
  },
  setToken(t: string): void {
    token = t;
  },
  clear(): void {
    token = null;
  },
  isAuthenticated(): boolean {
    return token !== null;
  },
};
