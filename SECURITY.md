# Security

## Report a vulnerability

Use GitHub private vulnerability reporting. Open the repository's **Security** tab, choose **Report a vulnerability**, and describe what you found and how to reproduce it. Only the maintainer can see the report.

Please do not open a public issue or pull request for a security problem.

## What to expect

- I will reply as soon as I can.
- A fix, or a clear answer on whether it is a vulnerability.
- Credit in the fix commit if you want it.

## Supported version

Only the latest commit on `main` is supported. Breather is a static app, so fixes ship by deploying `main`.

## What Breather holds

Breather has no accounts, no server and no personal data. It stores your mix and saved presets in your browser's local storage on your own device. It sets no cookies and sends nothing anywhere. A Content Security Policy limits the page to its own files, and the build fails if that stops being true.

The repository holds no secrets. If you find one, report it the same way.
