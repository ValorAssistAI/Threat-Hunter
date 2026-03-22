## Summary

<!-- What does this PR do? Why? Link any related issues. -->

Closes #

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Infrastructure / Terraform
- [ ] Documentation
- [ ] Dependency update
- [ ] Security fix

## Changes

<!-- Bullet list of what changed -->

-

## Testing

<!-- How was this tested? -->

- [ ] Ran `pnpm run typecheck`
- [ ] Ran `pnpm --filter @workspace/api-server run build`
- [ ] Tested API endpoints manually
- [ ] Ran the agent against AWS with the new changes
- [ ] DB schema changes run through `drizzle-kit push`
- [ ] Terraform `plan` reviewed (if infra changes)

## OpenAPI / Codegen

- [ ] If I changed `lib/api-spec/openapi.yaml`, I ran `pnpm --filter @workspace/api-spec run codegen` and committed the generated files

## Security

- [ ] No secrets or credentials in code
- [ ] AWS IAM permissions follow least-privilege
- [ ] Scope validation enforced for any new agent tools
- [ ] No new external network calls without review

## Deployment Notes

<!-- Anything the deployer needs to know: env vars, migration steps, infra changes -->
