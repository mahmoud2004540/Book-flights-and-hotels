import { z } from "zod";

/**
 * One schema per operation, used by both the API route and the form, so the
 * client and the server can never disagree about what is valid.
 */

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address")
  .email("That does not look like an email address");

/**
 * Length is the requirement that actually resists cracking; character-class
 * rules mostly push people toward predictable substitutions. A common-password
 * check would be the next meaningful addition.
 */
const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "That is longer than 200 characters");

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email,
  password,
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password,
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
