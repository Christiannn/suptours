# Security policy

## Reporting a vulnerability

**Please do not open a public issue.**

suptur.dk handles bookings, accounts and uploaded images for real people, so a
vulnerability report that arrives as a public issue is a disclosure before it
is a report.

Use GitHub's [private vulnerability
reporting](https://github.com/Christiannn/suptours/security/advisories/new)
instead. It is enabled on this repository and goes straight to the maintainer.

If that is not available to you, email **christian.munch@gmail.com** with
`SECURITY` in the subject.

### What to include

Whatever you have. A rough report is far better than none:

- What you found, and roughly how someone would reach it
- The URL, endpoint or file involved
- Whether you think it exposes data, allows a change, or allows access

You do not need a working exploit, and please do not build one against the live
site — see below.

### What to expect

This is a one-person project, so there is no on-call rota. Realistically:

| | |
|---|---|
| Acknowledgement | within a few days |
| First assessment | within two weeks |
| Fix for something serious | as fast as I can, and I will tell you where it stands |

I will credit you when the fix ships unless you would rather I did not.

## Testing boundaries

Please **do not** test against `suptur.dk` or `api.suptur.dk`. They are the
live site and a live database belonging to real users.

If you want to poke at a running instance, run one yourself — `README.md` and
`local-dev.md` set up the whole stack locally against Docker Supabase in a few
commands, with seed data and no real people in it.

Out of scope, because they are already known and deliberate:

- **SSH on port 22 is open to the internet.** It is key-only (passwords are
  refused, see `deploy/bootstrap/02-ssh-keys.sh`) with fail2ban in front.
  Restricting it further is a planned step, documented in `deploy/README.md`.
- **`staging.suptur.dk` is behind a single shared password.** It holds no real
  data — its database is migrations plus seed fixtures, rebuilt on demand.
- The VPS address and architecture are in this repository on purpose. They are
  not credentials.

## Scope

This policy covers this repository and the `suptur.dk` deployment described in
`deploy/`. It does not cover third-party services the site talks to — report
those to the service in question.
