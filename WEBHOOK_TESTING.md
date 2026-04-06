# Testing WorkOS Webhooks Locally

This guide explains how to test the WorkOS webhook integration in `maiks-yt-dev`.

## 1. Setup Environment
Ensure your `.env` file has the following placeholder for local testing:
```env
WORKOS_WEBHOOK_SECRET=placeholder
```

## 2. Using the Mock Script
A script is provided to send a signed mock webhook to your local server.

1.  Start your Next.js development server:
    ```bash
    npm run dev
    ```
2.  In another terminal, run the mock script:
    ```bash
    node scripts/test-webhook.js
    ```
    *If you changed the secret in `.env`, pass it as an argument:*
    ```bash
    node scripts/test-webhook.js your-secret-here
    ```

## 3. Using WorkOS CLI (Recommended for Real Webhooks)
For testing real webhooks from the WorkOS dashboard:

1.  [Install the WorkOS CLI](https://workos.com/docs/cli).
2.  Log in to your WorkOS account:
    ```bash
    workos login
    ```
3.  Forward webhooks to your local machine:
    ```bash
    workos webhooks forward --target-url http://localhost:3000/api/webhooks/workos
    ```
4.  The CLI will provide a webhook secret starting with `whsec_...`. Update your `.env` with this value:
    ```env
    WORKOS_WEBHOOK_SECRET=whsec_...
    ```
5.  Restart your Next.js server to pick up the new environment variable.
6.  Trigger an event (e.g., create a user) in the WorkOS Dashboard.

## 4. Troubleshooting
-   **Signature Error:** Ensure `WORKOS_WEBHOOK_SECRET` in `.env` matches the secret used by the CLI or the mock script.
-   **Server Not Found:** Ensure your Next.js server is running on `http://localhost:3000`.
-   **Database Error:** Ensure your Prisma database is running and migrated (`npx prisma migrate dev`).
