import { resolve } from 'node:path';
import dotenv from 'dotenv';

// Automatically load .env.test for E2E integration test runs
dotenv.config({ path: resolve(__dirname, '../.env.test') });
