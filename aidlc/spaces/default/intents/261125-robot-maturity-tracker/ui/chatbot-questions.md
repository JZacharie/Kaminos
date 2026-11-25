# Chatbot module questions

## Q1. [Product owner] What should the assistant answer from?
[Anchor]: a-chatbot-panel

Why we ask: this decides how the assistant is built. It either talks freely, uses your documents and
falls back to general knowledge, or answers only from your documents. It is the only question that
changes the backend.

- A. General knowledge only
- B. Our documents first, and general knowledge when they do not cover it
- C. Only our documents; say "I don't know" otherwise
- X. Other (please specify)

[Answer]: B

## Q2. [Product owner] Show the sources used?
[Anchor]: a-chatbot-sources

Why we ask: when the assistant uses documents, users may want to see which ones, to trust the answer or
to open the document.

- A. No
- B. Yes, list the documents under each answer
- X. Other (please specify)

[Answer]: A

## Q3. [Product owner] Which languages must the assistant handle?
[Anchor]: a-chatbot-input

Why we ask: it fixes the language of the interface texts and what we test. The assistant answers in the
language of the question.

- A. English only
- B. Spanish and English
- X. Other (please specify)

[Answer]: X — FRench an English

## Q4. [Product owner] Should the panel carry a disclaimer?
[Anchor]: a-chatbot-disclaimer

Why we ask: some organizations require users to be told that answers are generated.

- A. None
- B. "AI-generated, may contain errors"
- X. Other (please specify)

[Answer]: B

## Q5. [Architect] How many messages will each user send per day?

Why we ask: it sets the throttling and the daily quota of the API, and the model cost.

- A. Fewer than 20
- B. 20 to 200
- C. More than 200
- X. Other (please specify)

[Answer]: A
