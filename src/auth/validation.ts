import { z } from "zod";

import { MINIMUM_PASSWORD_LENGTH } from "./constants";

const normalizedEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

const password = z
  .string()
  .min(
    MINIMUM_PASSWORD_LENGTH,
    `Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
  )
  .max(128, "Password must be 128 characters or fewer.");

export const signUpSchema = z
  .object({
    email: normalizedEmail,
    password,
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    error: "Passwords do not match.",
    path: ["passwordConfirmation"],
  });

export const signInSchema = z.object({
  email: normalizedEmail,
  password: z.string().min(1, "Enter your password.").max(128),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
