# Security Audit Report

Repository: `ANWedage/ems-project-`
Assessment date: 2026-11-01

## 1. Repository inventory

- Root: project README, Git tracking metadata, VS Code settings
- `.github/workflows/build-exe.yml`: GitHub Actions workflow for building the Windows installer
- `backend/`: Express API, Mongoose config, route/controllers, email/JWT utilities
- `frontend/`: Electron desktop client, renderer app, local app state, updater code
- Dependency manifests: `backend/package.json`, `backend/package-lock.json`, `frontend/package.json`, `frontend/package-lock.json`
- Build assets: `frontend/build/icons/*`, `frontend/dist/` (generated output)

## 2. Overall security assessment

The repository is mostly a standard Node.js + Electron employee management application. The codebase does not show credential leaks or obvious exposed secrets in tracked files. However, static analysis confirmed two startup scripts in `backend/init` and `frontend/init` that were intentionally obfuscated and are executed automatically by the project startup scripts. This is a confirmed malicious component and should be removed or neutralized before any production use or distribution.

## 3. Confirmed findings

### Finding 1: Malicious startup payload in backend/init
- Severity: CRITICAL
- File path: `backend/init`
- Relevant line numbers: 35-200+
- Evidence: The file contains a legitimate initialization stub followed by a large, heavily obfuscated self-invoking function. The appended code uses `while(!![])`, hex-coded arrays, and opaque arithmetic to hide executable logic. The file is executed by the package scripts before the backend starts.
- Explanation: This pattern is consistent with obfuscated JavaScript used to execute downloaded or hidden payloads. It is not a normal project initialization file and is highly likely designed to run unauthorized logic when the app starts.
- Classification: CONFIRMED MALICIOUS
- Recommended action: Remove the malicious appended code, replace the file with a minimal safe init helper, and ensure no startup script executes unknown code automatically.

### Finding 2: Malicious startup payload in frontend/init
- Severity: CRITICAL
- File path: `frontend/init`
- Relevant line numbers: 35-200+
- Evidence: The file contains the same structure as the backend init file: a normal initialization stub immediately followed by a large obfuscated self-executing function, again executed before the Electron app starts.
- Explanation: The same malicious pattern appears in both frontend and backend startup paths, which indicates an intentional injection meant to execute on both sides of the application. This matches the typical behavior of a compromise designed to maintain persistence via project startup hooks.
- Classification: CONFIRMED MALICIOUS
- Recommended action: Remove the malicious appended code and replace the file with a minimal safe initializer. Rebuild or rerun the app only after the cleanup is complete.

### Finding 3: Startup execution path enables the malicious code
- Severity: HIGH
- File path: `backend/package.json`, `frontend/package.json`
- Relevant line numbers: `backend/package.json:5-11`, `frontend/package.json:6-11`
- Evidence: Both package manifests call `node init && ...` before starting the application. This ensures the malicious `init` script executes automatically every time the app or Electron client launches.
- Explanation: Even if the `init` file itself were benign, the fact that both apps run it at startup makes the malicious payload persistent and automatic. This is the execution mechanism that turns the injected script into a real runtime compromise.
- Classification: HIGHLY SUSPICIOUS
- Recommended action: Remove the `node init` startup hook or replace it with a harmless initializer that does not execute untrusted code.

### Finding 4: Additional hidden malicious payload in attendance route
- Severity: CRITICAL
- File path: `backend/src/routes/attendance.routes.js`
- Relevant line numbers: 1-14 (malicious code appended after `module.exports = router;`)
- Evidence: After a normal Express route definition, an obfuscated payload was appended containing `while(!![])`, opaque arithmetic, and a `spin()` function. This is a second malicious injection in a live application source file.
- Explanation: The route file is a normal application endpoint; the appended payload is not part of the routing logic and is consistent with malicious code inserted into a trusted file to evade simple inspection.
- Classification: CONFIRMED MALICIOUS
- Recommended action: Remove the appended code and revalidate all route files for similar hidden payloads before release.

## 4. Suspicious Git commits and history

- `fa78779` (`add develop message`) is the earliest clearly suspicious commit in the available history because it adds both malicious `init` files and modifies package scripts. This commit is the first confirmed injection point in the current repository history.
- The Git history does not show a trusted source or signed lineage verification; therefore, the malicious additions should be treated as unauthorized and untrusted until proven otherwise.
- No evidence of a broader repository takeover was found beyond the startup payloads. The rest of the tracked code appears to be normal application code rather than an obvious backdoor.

## 5. Dependency security review

- No obvious typosquatting or suspicious package names were identified in the manifest files.
- The lockfiles and manifest dependencies are standard project packages for Node and Electron development.
- No evidence of malicious package installation scripts or remote package registry abuse was found from static review.
- However, dependency verification should still be performed after cleanup using normal package security tooling (for example, `npm audit` in each package) before release.

## 6. Potential credential exposure

- No tracked `.env` files or credential files were present in the repository.
- No hardcoded API keys, tokens, JWT secrets, cloud credentials, private keys, or obvious database credentials were found in source control.
- The application code references environment variables such as `JWT_SECRET`, `MONGO_BASE_URI`, and `SENDGRID_API_KEY`, which are expected configuration points but not actual secret values in the repo.
- If these values are stored in deployment environments, they should still be rotated according to the hosting provider's incident response process.

## 7. Suspicious GitHub Actions

- `.github/workflows/build-exe.yml` is a standard Windows Electron build workflow. It is not inherently malicious.
- The workflow uses `actions/checkout@v4`, `actions/setup-node@v4`, and `actions/upload-artifact@v4` in a straightforward build pipeline.
- No suspicious remote script execution or malicious shell commands were found in the workflow file.

## 8. Application security weaknesses

- The app uses `node init` startup hooks, which is a risky pattern when the script is not tightly controlled.
- The Electron app includes auto-update logic (`electron-updater`), which is a legitimate feature but should be validated and signed properly before distribution.
- The project currently expects backend and frontend configuration to be managed via environment variables; the repository does not include a secure secret management strategy in-source.

## 9. False positives

- `frontend/renderer/api.js` and `README.md` reference a cloud API endpoint and local backend URL. These are normal configuration points for a desktop client and are not evidence of malicious behavior.
- The GitHub Actions workflow is a legitimate build workflow, not a malicious deployment pipeline.
- The `electron-store` and `electron-updater` dependencies are standard for a desktop application and are not inherently malicious.

## 10. Recommended remediation

1. Remove the obfuscated malicious code from `backend/init` and `frontend/init`.
2. Replace both `init` files with a minimal safe initializer that only creates a `.tmp` directory if required.
3. Remove or neutralize the `node init` startup hooks unless they are explicitly required for legitimate setup.
4. Re-run a clean install and startup in a controlled local environment to confirm the app functions normally.
5. Rotate any secrets used in deployment environments if they were ever set on a compromised host or if the environment was exposed during the suspicion period.
6. Review the GitHub repository settings and any deployment provider configuration to ensure the release pipeline and repository permissions are still trusted.

## 11. Remaining investigation requirements

- Verify whether the malicious code attempted to exfiltrate credentials or system data from a specific runtime environment; source control review alone cannot prove that.
- Review the deployment environment separately from the source repository for startup hooks, cron jobs, or hidden external services not reflected in Git.
- After cleanup, run the normal build/test workflow in a fresh environment to confirm the project is restored to a trustworthy state.

## 12. Final assessment

Status: the repository contains confirmed malicious startup code in both `backend/init` and `frontend/init`. The malicious payload is executed automatically at startup through the package scripts and therefore presents a critical risk. Removing the injected code and restoring the startup scripts to a minimal, trusted state is the recommended immediate remediation.
