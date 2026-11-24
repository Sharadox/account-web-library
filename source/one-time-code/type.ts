/** The secret pepper (at least 32 characters, from the environment) and what the code is for (`sign-in:<request id>`). */
export interface OneTimeCodeHashOptions {
  pepper: string;
  purpose: string;
}
