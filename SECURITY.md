# Security Policy

## Supported Version

HydraWatch is currently maintained as a public preview project. Security fixes apply to the `main` branch.

## Reporting Issues

Please do not open public issues for secrets, credential exposure, or exploitable vulnerabilities.

Contact the project maintainer through the repository owner profile or create a private advisory if available.

## Secrets

Never commit:

- `.env` files
- API keys
- GitHub tokens
- cloud provider credentials
- database passwords

Use environment variables or managed secret stores for deployment.
