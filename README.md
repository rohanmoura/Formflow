# FormFlow

FormFlow is a focused form builder: create a form, share a public link, and review responses in one dashboard.

## Run locally

Requirements: Git, Docker Desktop, Node.js 22, and pnpm 9.

```powershell
.\scripts\start-local.ps1
```

The launcher creates `.env`, starts PostgreSQL, applies migrations, and runs the app. Add your Clerk development keys to `.env` to enable authentication. Open http://localhost:3000. To start manually, create `.env` from `.env.example`, add both Clerk keys, then run:

```powershell
docker compose up -d postgres
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @formflow/db build
pnpm db:deploy
pnpm dev
```

Open http://localhost:3000. The Compose database volume persists across restarts. Stop services with `docker compose down`; remove database data too with `docker compose down -v`.

### Clerk sign-in

FormFlow uses Clerk for all sign-in and sign-up. Copy its publishable and secret keys into `.env` as `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`, enable Google under **SSO connections** in the Clerk dashboard, then restart the app. Clerk identity is synchronized to FormFlow's PostgreSQL users table, which remains necessary for form ownership and API authorization. Existing accounts with the same verified email are linked to their existing forms. Clerk user emails must be verified before they can access a workspace. Without both Clerk keys, the dashboard remains in preview mode and sign-in shows a setup notice; no local password auth is available.

For local development and the temporary interview demo, use the **Clerk Development instance** keys (`pk_test_…` and `sk_test_…`). This AWS deployment is deliberately short-lived; it is not a permanent production deployment. Development instances have a relaxed security posture, a 100-user cap, and separate non-transferable test data, so use demo accounts and synthetic form responses only. The Clerk dashboard and Google consent flow may identify the app as a development app. Do not switch to production keys for this workflow.

The EC2 bootstrap intentionally leaves both Clerk values blank. After the instance is healthy, connect with the printed AWS Systems Manager command and securely edit `/opt/formflow/.env.production` on the instance: replace the blank `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` values with the keys from the **Development** instance. Do not paste the secret key into Git, a workflow, or a public issue. Save the file, run `sudo chmod 600 /opt/formflow/.env.production`, then restart the web container:

```bash
cd /opt/formflow
sudo docker compose --profile tls --env-file .env.production up -d --force-recreate web
```

Open the printed HTTPS URL, verify Clerk sign-in (including Google if enabled), create a disposable form, and submit a test response. A temporary public IP is different from localhost, so verify the sign-in/redirect flow on the actual EC2 URL before the interview; if Clerk rejects it, do not expose the demo until its development-instance origin/redirect configuration permits it. Terminating the instance deletes the database and this instance's Clerk key file. Local and AWS environments use the same Clerk Development instance unless you create another one; accounts and test data belong to that Clerk instance.

To run the complete app container locally, use `docker compose up --build -d` after setting `.env`.

## Current MVP functionality

- Account registration, sign-in, and session management handled by Clerk (Google and email options)
- Form drafts with ordered fields, five field types, required validation, and choice options
- Publish/close controls with public share links
- Public response submission with server-side validation
- Response dashboard, text search, and CSV export
- Form duplication after responses arrive, preserving the original response history
- Form deletion with an explicit confirmation and cascading cleanup

Supported initial fields: short text, long text, email, single choice, and multiple choice.

## Architecture

- `apps/web`: Next.js dashboard, owner API, public form pages, and health check
- `packages/db`: Prisma schema, migrations, and PostgreSQL client
- `packages/validation`: shared form and submission schemas
- `packages/eslint-config`, `packages/typescript-config`: shared workspace config
- PostgreSQL stores Clerk-linked app users, forms, fields, submissions, and answers

The first release is a modular web app plus PostgreSQL. There is no background worker until an asynchronous feature requires one. To preserve response integrity, a form that already has submissions cannot be edited; duplicate it to make a new version. Email verification and password reset are managed by Clerk.

## Try the complete form flow

1. Open http://localhost:3000 and sign up with Google or the email option configured in Clerk.
2. In the dashboard, select **Create a form**. Give it a title and description, then add questions. Try short text, email, long text, and a choice question with at least two distinct options.
3. Save the draft, then select **Publish form** and copy its public link.
4. Open the link in a private/incognito window. Submit one response; try leaving a required answer empty to see browser validation.
5. Return to the owner window and open **Responses**. Find your answer, search its text, and export the CSV.
6. Back in the editor, duplicate the form to start a new version without losing the response history. Closing a published form makes its public link unavailable; deleting a form asks for confirmation and removes its responses.

Sign out and back in using Clerk to confirm the session works. Other accounts cannot open or change your private forms.

## Reliability verification checklist

Use two separate Clerk development accounts and a private/incognito window. Keep the form owner in the regular window and test the respondent in the private window.

- **Authentication:** signed-out requests to `/api/forms` and private form/response APIs return `401`; after sign-out, reload a protected editor URL and confirm it returns to sign-in.
- **Ownership:** account A creates and publishes a form. Account B cannot view, edit, publish, close, delete, duplicate from its private editor endpoint, or read A’s responses. Confirm B’s dashboard contains only B’s forms.
- **Public access:** the published share URL loads signed out. Draft, closed, deleted, and unknown slugs do not disclose form data or accept submissions.
- **Response validation:** test missing required answers, malformed email, invalid/forged choice values, duplicate answer IDs, unknown question IDs, missing answers, and oversized payloads; each is rejected without creating a response.
- **Submission integrity:** submit a valid response and verify exactly one response appears with every answer in the correct question. Refresh the owner’s response page and verify the data remains.
- **Concurrent changes:** while submitting in one window, close the form in another; a closed form must not accept a later submission. If an edit conflicts with a concurrent response, the edit should fail safely and preserve the response.
- **Data lifecycle:** duplicate a form with responses; the copy has its questions but none of the original responses. Delete a form and confirm its related submissions/answers are removed.
- **Session isolation:** sign into account B in a separate browser profile/private window; signing out there must not sign out account A’s browser session.

Playwright end-to-end tests cover public submission throttling and, when a Clerk test-user email is configured, respondent email capture, one-response-per-email behavior, and pagination. Cross-user access checks additionally require a second Clerk test-user email. Install the browser once with `pnpm exec playwright install chromium`, then run `pnpm test:e2e` with the local app and database running. Set `E2E_CLERK_USER_EMAIL` and optionally `E2E_CLERK_OTHER_USER_EMAIL` in `.env` to existing users in your Clerk development instance. Tests create and delete their own forms and responses. Use `pnpm typecheck`, `pnpm lint`, and `pnpm build` for automated code checks as well.

## Environment variables

See `.env.example`. Keep `.env` and production environment files private and out of Git. Configure both Clerk keys for each deployment. AWS credentials belong in your local AWS CLI configuration, never in this repository.

## Development commands

- `pnpm dev`: run the web app
- `pnpm lint`, `pnpm typecheck`, `pnpm build`: code quality and production build
- `pnpm db:migrate`: create/apply a development migration
- `pnpm db:deploy`: apply migrations in deployment
- `pnpm db:studio`: inspect the local database

## Git and publishing

Use `master` for stable work and short-lived feature branches such as `feat/form-builder` or `fix/session-expiry`. Open a pull request to `master`; CI runs lint, typecheck, and build. A push to `master` or a `vX.Y.Z` tag publishes an image **only after** those checks pass. A `master` push publishes `latest` and a commit-SHA tag; a version tag also publishes its semver tag. The Docker Hub repository is `${DOCKERHUB_USERNAME}/formflow`; the AWS launcher currently defaults to `rohanmoura/formflow:latest`, so set the GitHub secret `DOCKERHUB_USERNAME` to `rohanmoura` for the default launch command, or pass your actual image name with `-DockerHubImage`. Add `DOCKERHUB_TOKEN` as a Docker Hub access token with permission to push that repository. GitHub secrets are not available for inspection by this local project, so the first Actions run is the confirmation that both values and repository permissions are correct.

## Deployment

### AWS EC2 demo

The AWS option is a **temporary interview demo**: start one EC2 instance when you want to show FormFlow, then terminate it afterward. It runs the published FormFlow image, PostgreSQL, and a Caddy HTTPS proxy. It uses an instance role and AWS Systems Manager; SSH and PostgreSQL are not exposed publicly. It is not always-on hosting and does not use Clerk Production keys. Termination deletes the attached database volume and the instance's app/key files; the IAM role/profile are retained for the next launch. AWS compute/storage and public IPv4 usage can incur charges while resources exist.

Prerequisites:

- Push the repository to `https://github.com/rohanmoura/Formflow` and make it publicly readable by the instance bootstrap.
- Add GitHub repository secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`; confirm the **CI** workflow succeeds, including its image-publish job, before launching EC2. Ensure the image account matches the launch script default `rohanmoura/formflow` (or pass `-DockerHubImage <account>/formflow:latest`).
- Install AWS CLI, configure credentials with `aws configure`, and use a region with a default VPC and available `t3.small` capacity.
- The AWS identity needs permission to create EC2 instances/security groups and create/attach an instance role/profile with `AmazonSSMManagedInstanceCore`, including `iam:PassRole`.

Launch after the Docker Hub image is published:

```powershell
.\scripts\aws\deploy.ps1 -Region ap-south-1
```

The script prints the instance ID and HTTPS URL and waits up to 10 minutes for the health endpoint. Bootstrap installs Docker, obtains a short-lived certificate for the public IP, pulls the image, and applies database migrations. If health does not come up in time, the script reports the instance ID and leaves the instance running for diagnosis; inspect the bootstrap log through SSM and terminate it if you do not need it. AWS compute, storage, and public IPv4 can incur charges while running. Check AWS billing and terminate the demo as soon as you finish:

```powershell
.\scripts\aws\terminate.ps1 -InstanceId i-0123456789abcdef0 -Region ap-south-1
```

Termination asks you to type `DELETE`; it permanently removes the instance, its attached database volume, and its per-launch security group. A fresh launch creates a new database and IP address, so repeat the Clerk Development key setup for each instance. The HTTPS certificate renews daily while the instance runs. Termination does not remove the reusable IAM role/profile; it also does not delete the Docker Hub image or Clerk Development users.
