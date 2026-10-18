import { resolve } from 'node:path';
import dotenv from 'dotenv';

// Automatically load .env.test for E2E integration test runs if present
dotenv.config({ path: resolve(__dirname, '../.env.test') });

// Safe test defaults for CI / environments without a local .env.test file
process.env.APP_ENV = process.env.APP_ENV || 'test';
process.env.MFA_REQUIRED_FOR_PRIVILEGED_ROLES = process.env.MFA_REQUIRED_FOR_PRIVILEGED_ROLES || 'false';
process.env.JOB_WORKER_ENABLED = process.env.JOB_WORKER_ENABLED || 'false';
process.env.JOB_RETRY_BASE_MS = process.env.JOB_RETRY_BASE_MS || '0';
process.env.DOCUMENT_JOBS_PER_ORG_PER_MINUTE = process.env.DOCUMENT_JOBS_PER_ORG_PER_MINUTE || '100000';
