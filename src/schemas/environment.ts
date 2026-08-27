import { z } from "zod";

export const databaseUrlSchema = z.url();
export const authSecretSchema = z.string().min(32);
