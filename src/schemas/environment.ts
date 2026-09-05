import { z } from "zod";

export const databaseUrlSchema = z.url();
export const authSecretSchema = z.string().min(32);
export const firmsMapKeySchema = z.string().min(1);
