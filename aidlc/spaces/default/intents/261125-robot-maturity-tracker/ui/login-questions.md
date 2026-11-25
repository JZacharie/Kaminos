# Login — questions

Answer with the letter of one option. Question 1 decides which backend is built; the others shape the requirements.

## Q1. [Product owner] How do people sign in?
[Anchor]: a-login-form

Why we ask: this picks the sign-in backend. A is a plain email and password; B adds a 6-digit code from an authenticator app on every sign-in; C adds a hosted login page so the company's existing login can be plugged in later.

- A. Email and password
- B. Email, password and an authenticator-app code (MFA)
- C. Through the company's existing login (hosted login page, ready to connect)
- X. Other (please specify)

[Answer]: B

## Q2. [Product owner] Which roles exist?
[Anchor]: a-login-role-badge

Why we ask: the role badge and everything that depends on "admin" in the screens are built from this answer.

- A. One role for everybody
- B. Two roles: user and admin
- X. Other (please specify)

[Answer]: B

## Q3. [Product owner] Who creates accounts?
[Anchor]: a-login-signup

Why we ask: it decides whether the screen offers "Create an account" or tells people to ask an administrator. The 1.0 backend is always invite-only (administrators create accounts).

- A. Administrators invite people
- B. People sign up themselves (email verification)
- X. Other (please specify)

[Answer]: A

## Q4. [Product owner] What happens when someone forgets the password?
[Anchor]: a-login-forgot

Why we ask: it decides whether the "Forgot password?" link starts a reset by email or points to an administrator.

- A. They reset it themselves by email
- B. They ask an administrator
- X. Other (please specify)

[Answer]: A

## Q5. [Security] Which password rules apply?

Why we ask: the rules are shown on the screen and enforced by the backend. The 1.0 backend enforces option A.

- A. At least 12 characters with upper case, lower case, a digit and a symbol
- B. At least 8 characters
- X. Other (please specify)

[Answer]: B
